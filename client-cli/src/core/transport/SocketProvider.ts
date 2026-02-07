import { io } from "socket.io-client";

class SocketProvider {
    constructor() {
        this.socket = null;
    }

    connect(url, token = null) {
        this.socket = io(url, {
            auth: { token }
        });

        this.socket.on("connect", () => {
            // Connection logic handled in main index
        });

        this.socket.on("connect_error", (err) => {
            console.error("Connection error:", err.message);
        });
    }

    setAuth(token) {
        if (this.socket) {
            this.socket.auth = { token };
        }
    }

    send(message) {
        if (this.socket) {
            this.socket.emit("message", message);
        }
    }

    onMessage(callback) {
        if (this.socket) {
            this.socket.on("message", (data) => {
                callback(data);
            });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

export default new SocketProvider();