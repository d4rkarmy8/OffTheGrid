import { io } from "socket.io-client";

class SocketProvider {
    constructor() {
        this.socket = null;
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            this.socket = io(url);

            this.socket.on("connect", () => {
                console.log("Socket connected successfully!");
                resolve();
            });

            this.socket.on("connect_error", (err) => {
                console.error("Connection error:", err.message);
                reject(err);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.socket.connected) {
                    reject(new Error("Connection timeout"));
                }
            }, 10000);
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