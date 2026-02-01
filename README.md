# OffTheGrid

**A project to go beyond network limitations and counter internet blackouts in protests and natural calamities.**

## Overview

OffTheGrid is a resilient messaging application designed to function in challenged network environments. This implementation currently focuses on a **Socket.io-based Client-Server architecture** that enables real-time communication between CLI clients.

## Features

### Core Capabilities
-   **Real-time Messaging**: Instant communication between connected clients using Socket.io.
-   **CLI Interface**: A command-line interface built with `inquirer` and `chalk` for a user-friendly terminal experience.
-   **Structured Messaging**: Messages are sent as structured objects `{ sender, text }` for better handling and display.
-   **Automated Diagnostics**: The client sends hardcoded diagnostic messages on startup to verify connectivity.

### New Enhancements
-   **In-Memory Authentication**: 
    -   **No Database Required**: User registration and login work without PostgreSQL or any external database.
    -   **Secure Password Storage**: Passwords are hashed using bcrypt before storing in memory.
    -   **Session Management**: Users remain logged in for the duration of their socket connection.
    -   **Simple Registration**: New users can register with just a username and password.
-   **Strict 1-1 Routing**: 
    -   Privacy-first design. Messages are routed **server-side** exclusively to the intended recipient's socket ID.
    -   No broadcasting: If User A sends a message to User C, User B never receives the data packet.
-   **Persistent Chat Sessions**: After login, users can access a main menu to start direct chats with other users.

## Project Structure

```
OffTheGrid/
├── client-cli/                 # CLI Client Application
│   ├── src/
│   │   ├── core/
│   │   │   └── transport/
│   │   │       ├── SocketProvider.js    # Wraps socket.io-client logic
│   │   │       └── TransportInterface.js
│   │   └── ui/
│   │       └── prompts/
│   │           └── chatPrompt.js
│   ├── index.js                # Client Entry Point (CLI Loop)
│   └── package.json            # Client dependencies (chalk, inquirer, etc.)
│
├── server/                     # Central Signaling/Relay Server
│   ├── src/
│   │   ├── sockets/
│   │   │   └── socketHandler.js # Server-side socket logic & routing
│   │   └── index.js            # Server Entry Point (Express + Socket.io)
│   └── package.json            # Server dependencies (express, socket.io, etc.)
│
└── README.md                   # Project Documentation
```

## Getting Started

### Prerequisites

-   **Node.js**: Ensure Node.js (v18+ recommended) is installed.
-   **npm**: Comes with Node.js.

### Installation

1.  **Install Server Dependencies**:
    ```bash
    cd server
    npm install
    ```

2.  **Install Client Dependencies**:
    ```bash
    cd ../client-cli
    npm install
    ```

### Running the Application

You will need at least **two terminals** (one for the server, one or more for clients).

#### 1. Start the Server
In the first terminal:
```bash
cd server
npm start
```
*The server will start listening on port 3000.*

#### 2. Start a Client
In a new terminal:
```bash
cd client-cli
node index.js
```
*   You will be prompted to **Login** or **Register**.
*   For new users, select **Register** and enter a username and password.
*   For existing users, select **Login** and enter your credentials.
*   After successful login, enter the username of the person you want to chat with.
*   Type messages and hit Enter. Type "exit" to return to the main menu.

#### 3. Start Additional Clients
Open more terminals and repeat step 2 to simulate multiple users chatting with each other.

## Technical Details

-   **Communication Protocol**: Socket.io (WebSocket with fallback).
-   **Server**: Node.js, Express, Socket.io.
-   **Client**: Node.js CLI using `inquirer` for input loops and `chalk` for styling.
-   **Authentication**: In-Memory (Map<Username, SocketID>). No persistence.
-   **Module System**:
    -   Server: CommonJS (`require`).
    -   Client: ESM (`import`), configured via `"type": "module"` in `package.json`.
