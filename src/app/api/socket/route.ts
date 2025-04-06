import { Server } from 'socket.io'
import { NextRequest } from 'next/server'

const io = new Server({
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

export async function GET(request: NextRequest) {
  // @ts-ignore
  const response = await io.handleUpgrade(request)
  return response
}

export const dynamic = 'force-dynamic'
export const runtime = 'edge'