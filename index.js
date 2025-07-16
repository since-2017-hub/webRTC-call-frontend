const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    // origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory storage for demo purposes
const users = new Map();
const activeUsers = new Map();
const calls = new Map();

// Authentication endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Check if user already exists
  let existingUser = null;
  for (const [id, user] of users.entries()) {
    if (user.username === username) {
      existingUser = { id, ...user };
      break;
    }
  }
  
  let user;
  if (existingUser) {
    // Existing user logging back in
    user = { ...existingUser, isOnline: false };
    users.set(existingUser.id, user);
  } else {
    // New user
    const userId = uuidv4();
    user = { id: userId, username, isOnline: false };
    users.set(userId, user);
  }
  
  console.log(`User ${username} logged in with ID: ${user.id}`);
  res.json({ user, token: user.id });
});

// Get all users (online and offline)
app.get('/api/users', (req, res) => {
  const allUsers = Array.from(users.values()).map(user => ({
    ...user,
    isOnline: activeUsers.has(user.id)
  }));
  res.json(allUsers);
});

// Get only online users
app.get('/api/online-users', (req, res) => {
  const onlineUsers = Array.from(activeUsers.values());
  res.json(onlineUsers);
});

// Broadcast updated user list to all connected clients
const broadcastUserList = () => {
  const onlineUsers = Array.from(activeUsers.values());
  console.log('Broadcasting user list:', onlineUsers.map(u => u.username));
  io.emit('users_updated', onlineUsers);
};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // User joins
  socket.on('join', (userData) => {
    console.log('User joining:', userData);
    
    // Update user status to online
    const user = { 
      ...userData, 
      socketId: socket.id, 
      isOnline: true,
      lastSeen: new Date().toISOString()
    };
    
    activeUsers.set(userData.id, user);
    socket.userId = userData.id;
    socket.username = userData.username;
    
    // Update the main users map
    if (users.has(userData.id)) {
      users.set(userData.id, { ...users.get(userData.id), isOnline: true });
    }
    
    console.log(`${user.username} is now online. Total online users: ${activeUsers.size}`);
    
    // Broadcast updated user list to all clients
    broadcastUserList();
    
    // Send welcome message to the joining user
    socket.emit('join_success', {
      message: 'Successfully connected to the server',
      onlineUsers: Array.from(activeUsers.values())
    });
  });

  // Initiate call
  socket.on('call_user', (data) => {
    const { to, from, callType, offer } = data;
    const targetUser = activeUsers.get(to);
    
    console.log(`Call initiated from ${from.username} to user ID: ${to}`);
    
    if (targetUser) {
      const callId = uuidv4();
      calls.set(callId, {
        id: callId,
        from,
        to: targetUser,
        callType,
        status: 'ringing',
        startTime: Date.now()
      });
      
      console.log(`Sending incoming call to ${targetUser.username}`);
      
      // Send incoming call notification
      io.to(targetUser.socketId).emit('incoming_call', {
        callId,
        from,
        callType,
        offer
      });
      
      // Send call status to caller
      socket.emit('call_status', { status: 'ringing', callId });
    } else {
      console.log(`Target user ${to} not found or offline`);
      socket.emit('call_status', { status: 'user_offline' });
    }
  });

  // Accept call
  socket.on('accept_call', (data) => {
    const { callId, answer } = data;
    const call = calls.get(callId);
    
    if (call) {
      call.status = 'connected';
      const callerUser = activeUsers.get(call.from.id);
      
      console.log(`Call ${callId} accepted`);
      
      if (callerUser) {
        io.to(callerUser.socketId).emit('call_accepted', {
          callId,
          answer
        });
      }
    }
  });

  // Reject call
  socket.on('reject_call', (data) => {
    const { callId } = data;
    const call = calls.get(callId);
    
    if (call) {
      const callerUser = activeUsers.get(call.from.id);
      
      console.log(`Call ${callId} rejected`);
      
      if (callerUser) {
        io.to(callerUser.socketId).emit('call_rejected', { callId });
      }
      
      calls.delete(callId);
    }
  });

  // End call
  socket.on('end_call', (data) => {
    const { callId } = data;
    const call = calls.get(callId);
    
    if (call) {
      const otherUserId = call.from.id === socket.userId ? call.to.id : call.from.id;
      const otherUser = activeUsers.get(otherUserId);
      
      console.log(`Call ${callId} ended`);
      
      if (otherUser) {
        io.to(otherUser.socketId).emit('call_ended', { callId });
      }
      
      calls.delete(callId);
    }
  });

  // ICE candidates
  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    const targetUser = activeUsers.get(to);
    
    if (targetUser) {
      io.to(targetUser.socketId).emit('ice_candidate', {
        from: socket.userId,
        candidate
      });
    }
  });

  // Handle typing indicators (optional feature)
  socket.on('typing', (data) => {
    const { to } = data;
    const targetUser = activeUsers.get(to);
    
    if (targetUser) {
      io.to(targetUser.socketId).emit('user_typing', {
        from: socket.userId,
        username: socket.username
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User ${socket.username} disconnected`);
      
      // Remove from active users
      activeUsers.delete(socket.userId);
      
      // Update main users map
      if (users.has(socket.userId)) {
        users.set(socket.userId, { 
          ...users.get(socket.userId), 
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
      }
      
      // End any active calls
      for (const [callId, call] of calls.entries()) {
        if (call.from.id === socket.userId || call.to.id === socket.userId) {
          const otherUserId = call.from.id === socket.userId ? call.to.id : call.from.id;
          const otherUser = activeUsers.get(otherUserId);
          
          if (otherUser) {
            io.to(otherUser.socketId).emit('call_ended', { callId });
          }
          
          calls.delete(callId);
        }
      }
      
      // Broadcast updated user list
      broadcastUserList();
      
      console.log(`Total online users: ${activeUsers.size}`);
    }
  });

  // Ping/Pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebRTC signaling server ready for connections');
});