import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  
  connect(userId: string, username: string): Socket {
    this.socket = io(process.env.VITE_API_URL);
    
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