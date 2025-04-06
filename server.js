const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 10000,
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

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
    })

    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason)
    })
  })

  const PORT = process.env.PORT || 3000
  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
  })
})