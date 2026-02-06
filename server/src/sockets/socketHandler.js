const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const messageSchema = require('../schemas/message.schema.json');
const supabase = require('../config/supabase');
const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(messageSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Map to track connected users: username -> socketId
const userSockets = new Map();

//  ADDED EDGE CASE: Track last message time per user (basic rate limiting)
const lastMessageTime = new Map();

async function saveMessage(data) {
    try {
        await supabase.from('messages').insert([{
            id: data.id,
            sender_username: data.from,
            recipient_username: data.to,
            content: data.content,
            status: data.status || 'sent',
            timestamp: data.timestamp
        }]);
    } catch (err) {
        console.error("DB Save Error:", err.message);
    }
}

async function updateMessageStatus(id, status) {
    try {
        await supabase.from('messages').update({ status }).eq('id', id);
    } catch (err) {
        console.error("DB Update Error:", err.message);
    }
}

const socketHandler = (io) => {
    // Middleware for JWT verification
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (token) {
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) return next(new Error('Authentication error'));
                socket.user = decoded; // { id, username }
                next();
            });
        } else {
            next(); // Allow connection for login/register
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        if (socket.user) {
            const username = socket.user.username.trim().toLowerCase();
            console.log(`[Auth] User ${username} authenticated on socket ${socket.id}`);
            userSockets.set(username, socket.id);
            // Broadcast status
            io.emit('user_status', { username: socket.user.username, status: 'online' });
        }

        // REGISTER
        socket.on('register', async ({ username, password }) => {
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const { data, error } = await supabase.from('users').insert([{
                    username,
                    password_hash: hashedPassword
                }]).select().single();
                if (error) {
                    throw error;
                }
                socket.emit('register_success', { userId: data.id });
            } catch (err) {
                console.error(`[Register Error] ${err.message}`);
                socket.emit('error', { message: 'Registration failed (Username might be taken)' });
            }
        });

        // LOGIN
        socket.on('login', async ({ username, password }) => {
            try {
                const { data, error } = await supabase.from('users').select('*').eq('username', username);
                if (data.length === 0 || error) {
                    return socket.emit('error', { message: 'User not found' });
                }

                const user = data[0];
                const match = await bcrypt.compare(password, user.password_hash);

                if (!match) {
                    return socket.emit('error', { message: 'Invalid password' });
                }

                const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

                // Update socket state
                socket.user = { id: user.id, username: user.username };
                const normalizedUsername = user.username.trim().toLowerCase();
                userSockets.set(normalizedUsername, socket.id);

                socket.emit('login_success', { token, username: user.username });
                // Broadcast status
                io.emit('user_status', { username: user.username, status: 'online' });

                console.log(`[Login] User ${user.username} logged in and mapped to ${socket.id}`);
                console.log(`[Status] Currently online: ${Array.from(userSockets.keys()).join(', ')}`);

            } catch (err) {
                console.error(`[Login Error] ${err.message}`);
                socket.emit('error', { message: 'Login failed' });
            }
        });

        // MESSAGE (Direct Routing)
        socket.on('message', async (data) => {
            if (!socket.user) return socket.emit('error', { message: 'Unauthorized' });

            const valid = validate(data);
            if (!valid) {
                console.error(`Invalid message from ${socket.id}:`, validate.errors);
                socket.emit('error', { message: 'Invalid message format', errors: validate.errors });
                return;
            }

            if (data.from !== socket.user.username) {
                console.warn(`[Security] Blocked spoofing attempt: ${socket.id} tried to send as ${data.from}`);
                data.from = socket.user.username; // Force correct sender
            }

            const sender = data.from.trim().toLowerCase();
            const recipientUsername = data.to ? data.to.trim().toLowerCase() : null;

            if (!recipientUsername) {
                return socket.emit('error', { message: 'Recipient "to" field is required' });
            }

            //  ADDED EDGE CASE: Prevent self-messaging
            if (sender === recipientUsername) {
                return socket.emit('error', { message: 'You cannot message yourself' });
            }

            //  ADDED EDGE CASE: Prevent empty / whitespace-only messages
            if (!data.content || data.content.trim().length === 0) {
                return socket.emit('error', { message: 'Message cannot be empty' });
            }

            //  ADDED EDGE CASE: Limit message length
            if (data.content.length > 1000) {
                return socket.emit('error', { message: 'Message is too long' });
            }

            //  ADDED EDGE CASE: Basic rate limiting (anti-spam)
            const now = Date.now();
            const lastTime = lastMessageTime.get(sender) || 0;
            if (now - lastTime < 500) {
                return socket.emit('error', { message: 'You are sending messages too fast' });
            }
            lastMessageTime.set(sender, now);

            console.log(`[Message] Direct Message from ${data.from} to ${recipientUsername}`);

            //  ADDED EDGE CASE: Prevent duplicate message IDs
            const { data: existing } = await supabase
                .from('messages')
                .select('id')
                .eq('id', data.id)
                .single();

            if (existing) return;

            // Save to DB
            saveMessage(data);

            const recipientSocketId = userSockets.get(recipientUsername);

            if (recipientSocketId) {
                console.log(`[Routing] Delivering to socket: ${recipientSocketId}`);
                io.to(recipientSocketId).emit('message', data);
                updateMessageStatus(data.id, 'delivered');
            } else {
                console.log(`[Routing] User "${recipientUsername}" is offline. Map contains: [${Array.from(userSockets.keys()).join(', ')}]`);
                socket.emit('notification', `User ${data.to} is offline.`);
                // Send explicit status update to sender if not found in map
                socket.emit('user_status', { username: data.to, status: 'offline' });
            }
        });

        // GET INBOX
        socket.on('get_inbox', async () => {
            if (!socket.user) return;
            try {
                const currentUser = socket.user.username;

                // Get all messages involving this user
                const { data: allMessages, error } = await supabase
                    .from('messages')
                    .select('sender_username, recipient_username, content, timestamp, status')
                    .or(`sender_username.eq.${currentUser},recipient_username.eq.${currentUser}`)
                    .order('timestamp', { ascending: false });

                if (error) throw error;

                // Process messages to create inbox
                const conversations = {};

                allMessages.forEach(msg => {
                    const contact = msg.sender_username === currentUser
                        ? msg.recipient_username
                        : msg.sender_username;

                    if (!conversations[contact]) {
                        conversations[contact] = {
                            contact: contact,
                            last_message_preview: msg.content,
                            last_timestamp: msg.timestamp,
                            unread_count: 0
                        };
                    }

                    // Count unread (messages sent TO current user that aren't read)
                    if (msg.recipient_username === currentUser &&
                        msg.status !== 'read') {
                        conversations[contact].unread_count++;
                    }
                });

                const inboxData = Object.values(conversations)
                    .sort((a, b) => new Date(b.last_timestamp) - new Date(a.last_timestamp));

                console.log(`[Inbox] Returning ${inboxData.length} conversations for ${currentUser}`);
                socket.emit('inbox_data', inboxData);
            } catch (err) {
                console.error("Inbox Error:", err.message);
                socket.emit('error', { message: 'Failed to fetch inbox' });
            }
        });

        // GET ALL USERS STATUS
        socket.on('get_all_users_status', async () => {
            if (!socket.user) return;
            try {
                const currentUser = socket.user.username.trim().toLowerCase();
                const { data: users, error } = await supabase
                    .from('users')
                    .select('username');

                if (error) throw error;

                const statusList = users
                    .filter(u => u.username && u.username.trim().toLowerCase() !== currentUser)
                    .map(u => ({
                        username: u.username,
                        status: userSockets.has(u.username.trim().toLowerCase()) ? 'online' : 'offline'
                    }));

                socket.emit('all_users_status_data', statusList);
            } catch (err) {
                console.error("Users Status Error:", err.message);
                socket.emit('error', { message: 'Failed to fetch users status' });
            }
        });

        // GET ONLINE USERS
        socket.on('get_online_users', () => {
            if (!socket.user) return;
            const currentUser = socket.user.username.trim().toLowerCase();
            const onlineUsers = Array.from(userSockets.keys())
                .filter(u => u !== currentUser);

            console.log(`[OnlineUsers] Requester: ${currentUser}, AllOnline: [${Array.from(userSockets.keys()).join(', ')}], Returning: [${onlineUsers.join(', ')}]`);
            socket.emit('online_users_data', onlineUsers);
        });

        // GET CHAT HISTORY
        socket.on('get_chat_history', async ({ contact }) => {
            if (!socket.user) return;
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`and(sender_username.eq.${socket.user.username},recipient_username.eq.${contact}),and(sender_username.eq.${contact},recipient_username.eq.${socket.user.username})`)
                    .order('timestamp', { ascending: true })
                    .limit(50);

                if (error) throw error;
                socket.emit('chat_history', { contact, messages: data });

                // Mark messages as read
                await supabase
                    .from('messages')
                    .update({ status: 'read' })
                    .eq('recipient_username', socket.user.username)
                    .eq('sender_username', contact)
                    .eq('status', 'pending');

            } catch (err) {
                console.error("History Error:", err.message);
                socket.emit('error', { message: 'Failed to fetch history' });
            }
        });

        socket.on('disconnect', () => {
            if (socket.user) {
                const username = socket.user.username.trim().toLowerCase();
                console.log(`[Disconnect] User ${username} left (${socket.id})`);
                // Only delete if this is the active socket for this username
                if (userSockets.get(username) === socket.id) {
                    userSockets.delete(username);
                    // Broadcast status
                    io.emit('user_status', { username: socket.user.username, status: 'offline' });
                }
            } else {
                console.log(`[Disconnect] Guest left (${socket.id})`);
            }
        });
    });
};

module.exports = socketHandler;
