import { io, Socket } from 'socket.io-client';
const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL;
class SocketService {
  private socket: Socket | null = null;
  
  connect(userId: string, username: string): Socket {
    this.socket = io(SOCKET_BASE_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket?.emit('join', { id: userId, username });
    });
    
    return this.socket;
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  getSocket(): Socket | null {
    return this.socket;
  }
}

export default new SocketService();