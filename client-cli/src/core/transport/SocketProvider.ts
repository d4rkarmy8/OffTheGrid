import { io, Socket } from "socket.io-client";

class SocketProvider {
    socket: Socket | null;

    constructor() {
        this.socket = null;
    }

    connect(url: string, token: string | null = null) {
        this.socket = io(url, {
            auth: { token },
            transports: ['websocket', 'polling'] // Force websocket first
        });

        this.socket.on("connect_error", (err: any) => {
            console.error("Connection error:", err.message);
        });

        this.socket.on("connect", () => {
            // Connection logic handled in main index
        });

        this.socket.on("connect_error", (err: Error) => {
            console.error("Connection error:", err.message);
        });
    }

    setAuth(token: string | null) {
        if (this.socket) {
            this.socket.auth = { token };
        }
    }

    send(message: any) {
        if (this.socket) {
            this.socket.emit("message", message);
        }
    }

    onMessage(callback: (data: any) => void) {
        if (this.socket) {
            this.socket.on("message", (data: any) => {
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