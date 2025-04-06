import { Server } from 'socket.io';
import { NextResponse } from 'next/server';

const io = new Server({
  path: '/api/socket',
  addTrailingSlash: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('camera-frame', (frameData) => {
    console.log('Received frame from:', socket.id);
    console.log('Frame data length:', frameData.length);

    // Validate frame data
    if (!frameData || typeof frameData !== 'string' || !frameData.startsWith('data:image')) {
      console.error('Invalid frame data received');
      return;
    }

    // Broadcast to all clients except the sender
    socket.broadcast.emit('camera-frame', frameData);
    console.log('Broadcasted frame to all clients');
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });
});

export async function GET() {
  return new NextResponse('WebSocket server is running', { status: 200 });
}

export const dynamic = 'force-dynamic';