# OffTheGrid

**A project to go beyond network limitations and counter internet blackouts in protests and natural calamities.**

## Overview

OffTheGrid is a resilient messaging application designed to function in challenged network environments. This implementation currently focuses on a **Socket.io-based Client-Server architecture** that enables real-time communication between CLI clients.

## Features implemented

-   **Real-time Messaging**: Instant communication between connected clients using Socket.io.
-   **CLI Interface**: A command-line interface built with `inquirer` and `chalk` for a user-friendly terminal experience.
-   **User Identification**: Users are prompted to enter a username upon connection. Messages are broadcasted with the sender's identity (e.g., `[Alice]: Hello`).
-   **Structured Messaging**: Messages are sent as structured objects `{ sender, text }` for better handling and display.
-   **Automated Diagnostics**: The client sends hardcoded diagnostic messages on startup to verify connectivity.
-   **ESM Support**: The client-cli is built using ECMAScript Modules (`import`/`export`) to support modern dependencies.

## Project Structure

```
OffTheGrid/
├── client-cli/                 # CLI Client Application
│   ├── src/
│   │   ├── core/
│   │   │   └── transport/
│   │   │       ├── SocketProvider.js    # Wraps socket.io-client logic
│   │   │       ├── BluetoothProvider.js # Placeholder for future Bluetooth support
│   │   │       └── TransportInterface.js
│   │   └── ui/
│   │       └── prompts/
│   │           └── chatPrompt.js
│   ├── index.js                # Client Entry Point (CLI Loop)
│   └── package.json            # Client dependencies (chalk, inquirer, etc.)
│
├── server/                     # Central Signaling/Relay Server
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── sockets/
│   │   │   └── socketHandler.js # Server-side socket logic & broadcasting
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
*   You will be prompted to enter your **username**.
*   Once connected, you can type messages and hit Enter to send.
*   Incoming messages from other clients will appear automatically.

#### 3. Start Additional Clients
Open more terminals and repeat step 2 to simulate multiple users (e.g., Alice, Bob) chatting with each other.

## Technical Details

-   **Communication Protocol**: Socket.io (WebSocket with fallback).
-   **Server**: Node.js with Express.
-   **Client**: Node.js CLI using `inquirer` for input loops and `chalk` for styling.
-   **Module System**:
    -   Server: CommonJS (`require`).
    -   Client: ESM (`import`), configured via `"type": "module"` in `package.json`.
