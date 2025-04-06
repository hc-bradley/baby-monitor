'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Link from 'next/link'

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<any>(null)
  const [error, setError] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001')

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const captureFrame = async (videoTrack: MediaStreamTrack) => {
    if (!videoRef.current || !canvasRef.current) return null;

    try {
      if ('ImageCapture' in window) {
        const imageCapture = new ImageCapture(videoTrack);
        return await imageCapture.takePhoto();
      } else {
        // Fallback to canvas capture
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0);
        return new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/jpeg', 0.8);
        });
      }
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      const videoTrack = stream.getVideoTracks()[0]

      const sendFrame = async () => {
        if (!isStreaming) return

        try {
          const blob = await captureFrame(videoTrack);
          if (!blob) return;

          const reader = new FileReader()
          reader.onloadend = () => {
            socketRef.current.emit('camera-frame', reader.result)
          }
          reader.readAsDataURL(blob)
          setTimeout(sendFrame, 100) // Send frame every 100ms
        } catch (err) {
          console.error('Error sending frame:', err)
        }
      }

      setIsStreaming(true)
      sendFrame()
    } catch (err: any) {
      setError(err.message || 'Failed to access camera')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
  }

  return (
    <main className="min-h-screen p-4 flex flex-col items-center space-y-4">
      <div className="w-full max-w-3xl flex justify-between items-center">
        <Link
          href="/"
          className="text-primary hover:underline"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Camera Mode</h1>
        <div className="w-[60px]" /> {/* Spacer for alignment */}
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={startCamera}
          disabled={isStreaming}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Start Camera
        </button>
        <button
          onClick={stopCamera}
          disabled={!isStreaming}
          className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Stop Camera
        </button>
      </div>

      {error && (
        <p className="text-destructive text-center">{error}</p>
      )}

      <p className="text-muted-foreground text-center max-w-md">
        Point this camera at the area you want to monitor. Make sure you have good lighting and a stable internet connection.
      </p>
    </main>
  )
}
