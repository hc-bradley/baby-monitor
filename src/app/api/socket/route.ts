import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { NextApiRequest } from 'next'
import { NextApiResponse } from 'next'

const ioHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!res.socket.server.io) {
    const path = '/api/socket'
    const httpServer = createServer()
    const io = new SocketIOServer(httpServer, {
      path: path,
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('camera-frame', (frameData: string) => {
        socket.broadcast.emit('camera-frame', frameData)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export const GET = ioHandler
export const POST = ioHandler