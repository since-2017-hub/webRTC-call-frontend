const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: corsOptions
});

// In-memory storage
const users = new Map();
const activeCalls = new Map();

// API Routes
app.get('/api/users', (req, res) => {
  const userList = Array.from(users.values());
  res.json(userList);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple demo authentication - accept any username/password
  const user = {
    id: uuidv4(),
    username,
    isOnline: false
  };
  
  const token = 'demo-token-' + user.id;
  
  res.json({
    user,
    token
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  socket.on('join', (userData) => {
    console.log('👤 User joining:', userData.username);
    
    const user = {
      id: userData.id,
      username: userData.username,
      socketId: socket.id,
      isOnline: true
    };
    
    users.set(socket.id, user);
    
    // Send success response with current online users
    const onlineUsers = Array.from(users.values());
    socket.emit('join_success', {
      message: `Welcome ${userData.username}!`,
      onlineUsers
    });
    
    // Broadcast updated user list to all clients
    io.emit('users_updated', onlineUsers);
    
    console.log('📊 Online users:', onlineUsers.length);
  });
  
  socket.on('call_user', async (data) => {
    const { to, from, callType, offer } = data;
    console.log(`📞 Call request: ${from.username} -> ${to} (${callType})`);
    
    // Find target user
    const targetUser = Array.from(users.values()).find(user => user.id === to);
    
    if (!targetUser) {
      socket.emit('call_status', { status: 'user_offline' });
      return;
    }
    
    const callId = uuidv4();
    activeCalls.set(callId, {
      id: callId,
      caller: from,
      callee: targetUser,
      callType,
      status: 'ringing'
    });
    
    // Send incoming call to target user
    io.to(targetUser.socketId).emit('incoming_call', {
      callId,
      from,
      callType,
      offer
    });
    
    // Send ringing status to caller
    socket.emit('call_status', { status: 'ringing' });
    
    console.log('📞 Call initiated:', callId);
  });
  
  socket.on('accept_call', (data) => {
    const { callId, answer } = data;
    console.log('✅ Call accepted:', callId);
    
    const call = activeCalls.get(callId);
    if (!call) {
      console.log('❌ Call not found:', callId);
      return;
    }
    
    call.status = 'connected';
    
    // Send acceptance to caller
    io.to(call.caller.socketId || call.caller.id).emit('call_accepted', {
      callId,
      answer
    });
    
    console.log('🔗 Call connected:', callId);
  });
  
  socket.on('reject_call', (data) => {
    const { callId } = data;
    console.log('❌ Call rejected:', callId);
    
    const call = activeCalls.get(callId);
    if (call) {
      // Notify caller
      io.to(call.caller.socketId || call.caller.id).emit('call_rejected');
      activeCalls.delete(callId);
    }
  });
  
  socket.on('end_call', (data) => {
    const { callId } = data;
    console.log('📴 Call ended:', callId);
    
    const call = activeCalls.get(callId);
    if (call) {
      // Notify both parties
      io.to(call.caller.socketId || call.caller.id).emit('call_ended');
      io.to(call.callee.socketId).emit('call_ended');
      activeCalls.delete(callId);
    }
  });
  
  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    console.log('🧊 ICE candidate relay to:', to);
    
    // Find target user and relay ICE candidate
    const targetUser = Array.from(users.values()).find(user => user.id === to);
    if (targetUser) {
      io.to(targetUser.socketId).emit('ice_candidate', {
        candidate
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      console.log('👋 User left:', user.username);
      
      // End any active calls involving this user
      for (const [callId, call] of activeCalls.entries()) {
        if (call.caller.socketId === socket.id || call.callee.socketId === socket.id) {
          console.log('📴 Ending call due to disconnect:', callId);
          
          // Notify the other party
          const otherSocketId = call.caller.socketId === socket.id 
            ? call.callee.socketId 
            : call.caller.socketId;
          
          io.to(otherSocketId).emit('call_ended');
          activeCalls.delete(callId);
        }
      }
      
      users.delete(socket.id);
      
      // Broadcast updated user list
      const onlineUsers = Array.from(users.values());
      io.emit('users_updated', onlineUsers);
      
      console.log('📊 Remaining online users:', onlineUsers.length);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready`);
  console.log(`🌐 CORS enabled for: ${corsOptions.origin.join(', ')}`);
});