import { io } from "socket.io-client";

class SocketProvider {
    socket: any = null;

    connect(url: string, token: string | null = null) {
        console.log(`Connecting to ${url}...`);
        this.socket = io(url, {
            auth: { token },
            transports: ['websocket', 'polling'] // Force websocket first
        });

        this.socket.on("connect_error", (err: any) => {
            console.error("Connection error:", err.message);
        });

        this.socket.on("connect", () => {
            console.log("Connected to server");
        });
    }

    emit(event: string, payload?: any) {
        if (this.socket) {
            this.socket.emit(event, payload);
        }
    }

    on(event: string, callback: (...args: any[]) => void) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    once(event: string, callback: (...args: any[]) => void) {
        if (this.socket) {
            this.socket.once(event, callback);
        }
    }

    off(event: string, callback?: (...args: any[]) => void) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    setAuth(token: string | null) {
        if (this.socket) {
            this.socket.auth = { token };
            this.socket.disconnect().connect(); // 🔥 REQUIRED
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

export default new SocketProvider();
