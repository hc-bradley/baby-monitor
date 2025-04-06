const { createServer } = require('http')
const { Server } = require('socket.io')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('camera-frame', (frameData) => {
      // Broadcast the frame to all connected clients except the sender
      socket.broadcast.emit('camera-frame', frameData)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  const PORT = process.env.PORT || 3001
  server.listen(PORT, () => {
    console.log(`> Server listening on port ${PORT}`)
  })
})