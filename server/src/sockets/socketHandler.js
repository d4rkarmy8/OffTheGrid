const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const bcrypt = require('bcrypt');
const messageSchema = require('../schemas/message.schema.json');

const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(messageSchema);

// In-memory user storage: username -> { passwordHash, socketId }
const users = new Map();

// Map to track connected users: username -> socketId
const userSockets = new Map();

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // REGISTER
        socket.on('register', async ({ username, password }) => {
            console.log(`[REGISTER] Received registration request for: ${username}`);
            try {
                // Check if user already exists
                if (users.has(username)) {
                    console.log(`[REGISTER] Username already taken: ${username}`);
                    return socket.emit('error', { message: 'Username already taken' });
                }

                // Hash password and store user
                const hashedPassword = await bcrypt.hash(password, 10);
                users.set(username, { passwordHash: hashedPassword });

                console.log(`[REGISTER] User registered successfully: ${username}`);
                socket.emit('register_success', { username });
            } catch (err) {
                console.error("[REGISTER] Error:", err.message);
                socket.emit('error', { message: 'Registration failed' });
            }
        });

        // LOGIN
        socket.on('login', async ({ username, password }) => {
            console.log(`[LOGIN] Received login request for: ${username}`);
            console.log(`[LOGIN] Current registered users:`, Array.from(users.keys()));
            try {
                // Check if user exists
                const user = users.get(username);
                if (!user) {
                    console.log(`[LOGIN] User not found: ${username}`);
                    return socket.emit('error', { message: 'User not found' });
                }

                // Verify password
                const match = await bcrypt.compare(password, user.passwordHash);
                if (!match) {
                    console.log(`[LOGIN] Invalid password for: ${username}`);
                    return socket.emit('error', { message: 'Invalid password' });
                }

                // Update socket state
                socket.user = { username };
                userSockets.set(username, socket.id);

                console.log(`[LOGIN] User ${username} logged in successfully and mapped to ${socket.id}`);
                socket.emit('login_success', { username });

            } catch (err) {
                console.error("[LOGIN] Error:", err.message);
                socket.emit('error', { message: 'Login failed' });
            }
        });

        // MESSAGE (Direct Routing)
        socket.on('message', (data) => {
            if (!socket.user) return socket.emit('error', { message: 'Unauthorized' });

            const valid = validate(data);
            if (!valid) {
                console.error(`Invalid message from ${socket.id}:`, validate.errors);
                socket.emit('error', { message: 'Invalid message format', errors: validate.errors });
                return;
            }

            if (data.from !== socket.user.username) {
                return socket.emit('error', { message: 'Sender mismatch spoofing detected' });
            }

            const recipientUsername = data.to;

            if (!recipientUsername) {
                return socket.emit('error', { message: 'Recipient "to" field is required' });
            }

            console.log(`Direct Message from ${data.from} to ${recipientUsername}`);

            const recipientSocketId = userSockets.get(recipientUsername);

            if (recipientSocketId) {
                io.to(recipientSocketId).emit('message', data);
            } else {
                console.log(`User ${recipientUsername} is offline.`);
                socket.emit('notification', `User ${recipientUsername} is offline.`);
            }
        });

        socket.on('disconnect', () => {
            if (socket.user) {
                console.log(`User disconnected: ${socket.user.username}`);
                userSockets.delete(socket.user.username);
            } else {
                console.log(`User disconnected: ${socket.id}`);
            }
        });
    });
};

module.exports = socketHandler;
