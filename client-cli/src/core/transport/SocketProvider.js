import { io } from "socket.io-client";

class SocketProvider {
    constructor() {
        this.socket = null;
    }

    connect(url) {
        this.socket = io(url);

        this.socket.on("connect", () => {
            // Connection logic handled in main index
        });

        this.socket.on("connect_error", (err) => {
            console.error("Connection error:", err.message);
        });
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