import inquirer from 'inquirer';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import socketProvider from './src/core/transport/SocketProvider';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

let currentUser: string | null = null;
let currentToken: string | null = null;

async function main() {
    console.log(chalk.blue.bold('Welcome to OffTheGrid CLI Chat!'));

    socketProvider.connect(SERVER_URL);

    await authFlow();
}

async function authFlow() {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Select an option:',
        choices: ['Login', 'Register', 'Exit']
    }]);

    if (action === 'Exit') {
        process.exit(0);
    }

    const { username, password } = await inquirer.prompt([
        { type: 'input', name: 'username', message: 'Username:' },
        { type: 'input', name: 'password', message: 'Password:' }
    ]);

    socketProvider.emit(action === 'Login' ? 'login' : 'register', { username, password });

    const result = await waitForAuth(
        action === 'Login' ? 'login_success' : 'register_success'
    );

    if (!result.success) {
        console.log(chalk.red(result.message));
        return authFlow();
    }

    if (action === 'Register') {
        console.log(chalk.green('✔ Registered successfully. Please login.'));
        return authFlow();
    }

    currentUser = result.data.username;
    currentToken = result.data.token;

    socketProvider.setAuth(currentToken);

    console.log(chalk.green(`✔ Logged in as ${currentUser}`));
    await mainMenu();
}

function waitForAuth(successEvent: string): Promise<any> {
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            cleanup();
            resolve({ success: false, message: 'Timeout' });
        }, 5000);

        const cleanup = () => {
            clearTimeout(timeout);
            socketProvider.off(successEvent);
            socketProvider.off('error');
        };

        socketProvider.once(successEvent, (data: any) => {
            cleanup();
            resolve({ success: true, data });
        });

        socketProvider.once('error', (err: any) => {
            cleanup();
            resolve({ success: false, message: err.message || 'Error' });
        });
    });
}

async function mainMenu() {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Main Menu:',
        choices: ['Start Chat', 'Logout', 'Exit']
    }]);

    if (action === 'Exit') process.exit(0);
    if (action === 'Logout') {
        currentUser = null;
        currentToken = null;
        socketProvider.setAuth(null);
        return authFlow();
    }

    await chatSetup();
}

async function chatSetup() {
    const { recipient } = await inquirer.prompt([{
        type: 'input',
        name: 'recipient',
        message: 'Chat with username:'
    }]);

    setupChatListeners(recipient);
    await chatLoop(recipient);
}

function setupChatListeners(recipient: string) {
    socketProvider.off('message');

    socketProvider.on('message', (data: any) => {
        const time = new Date(data.timestamp).toLocaleTimeString();
        console.log(chalk.cyan(`[${time}] [${data.from}]: ${data.content}`));
    });

    socketProvider.on('message_delivered', ({ id }: any) => {
        console.log(chalk.green(`✔ Delivered (${id})`));
    });
}

async function chatLoop(recipient: string) {
    while (true) {
        const { message } = await inquirer.prompt([
            { type: 'input', name: 'message', message: '>' }
        ]);

        if (message.toLowerCase() === 'exit') break;

        const payload = {
            id: uuidv4(),
            from: currentUser,
            to: recipient,
            content: message,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        socketProvider.emit('message', payload);
    }

    await mainMenu();
}

main();
