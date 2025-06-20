const { io } = require('socket.io-client');

// Replace with your actual JWT token
const JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODRkOTMxOGU0OTY0OGMzNzMwZWNhOTgiLCJlbWFpbCI6InRlc3QzQGV4YW1wbGUuY29tIiwiaWF0IjoxNzUwNDMyMDUyLCJleHAiOjE3NTA1MTg0NTJ9.7B7qeZx1p0nnpDmlSB6ALsLwAJQDgDc_2_NuNGP5LNk';

// Replace with your actual group ID
const GROUP_ID = '68556ed888cca741859a410d';

const socket = io('http://127.0.0.1:4040', {
  transports: ['websocket'],
  auth: {
    token: JWT_TOKEN,
  },
  extraHeaders: {
    Authorization: `Bearer ${JWT_TOKEN}`,
  },
});

socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on('connected', (data) => {
  console.log('✅ Server confirmed connection:', data);

  // Now try to join a room
  console.log('🚪 Joining room for group:', GROUP_ID);
  socket.emit('joinRoom', { groupId: GROUP_ID });
});

socket.on('joinedRoom', (data) => {
  console.log('✅ Successfully joined room:', data);

  // Now try to send a test message
  console.log('💬 Sending test message...');
  socket.emit('sendMessage', {
    groupId: GROUP_ID,
    content: 'Hello from test client!',
  });
});

socket.on('newMessage', (data) => {
  console.log('📨 New message received:', data);
});

socket.on('userJoined', (data) => {
  console.log('👤 User joined:', data);
});

socket.on('userLeft', (data) => {
  console.log('👋 User left:', data);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  socket.disconnect();
  process.exit(0);
});

console.log('🔄 Attempting to connect to WebSocket server...');
