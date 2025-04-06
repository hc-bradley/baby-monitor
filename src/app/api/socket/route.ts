import { Server } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';

interface SocketServer extends HTTPServer {
  io?: Server;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    console.log('New Socket.io server...');
    const io = new Server(res.socket.server, {
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

    res.socket.server.io = io;
  }

  res.end();
};

export const GET = ioHandler;
export const POST = ioHandler;