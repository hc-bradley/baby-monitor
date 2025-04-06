'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Link from 'next/link'

export default function MonitorPage() {
  const imageRef = useRef<HTMLImageElement>(null)
  const socketRef = useRef<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001')

    socketRef.current.on('connect', () => {
      setIsConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      setIsConnected(false)
    })

    socketRef.current.on('camera-frame', (frameData: string) => {
      if (imageRef.current) {
        imageRef.current.src = frameData
        setLastUpdate(new Date())
      }
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return (
    <main className="min-h-screen p-4 flex flex-col items-center space-y-4">
      <div className="w-full max-w-3xl flex justify-between items-center">
        <Link
          href="/"
          className="text-primary hover:underline"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Monitor Mode</h1>
        <div className="w-[60px]" /> {/* Spacer for alignment */}
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
        <img
          ref={imageRef}
          className="w-full h-full object-contain"
          alt="Video feed"
        />

        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            Connecting to camera...
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {lastUpdate && (
        <p className="text-sm text-muted-foreground">
          Last frame received: {lastUpdate.toLocaleTimeString()}
        </p>
      )}

      <p className="text-muted-foreground text-center max-w-md">
        Keep this page open to monitor the video feed. Make sure both devices are connected to the internet.
      </p>
    </main>
  )
}
