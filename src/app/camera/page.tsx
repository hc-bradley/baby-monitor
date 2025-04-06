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
  const [isMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    }
    return false
  })

  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : ''
    socketRef.current = io(socketUrl, {
      path: '/api/socket',
      addTrailingSlash: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      withCredentials: true
    })

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
      setError('') // Clear any previous errors

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser')
      }

      // Different constraints for mobile and desktop
      const constraints = {
        video: isMobile ? {
          facingMode: { ideal: 'environment' }, // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false // We don't need audio for the baby monitor
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Check if component is still mounted
      if (!videoRef.current) return

      streamRef.current = stream
      videoRef.current.srcObject = stream

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = resolve
        }
      })

      const videoTrack = stream.getVideoTracks()[0]
      console.log('Camera capabilities:', videoTrack.getCapabilities())

      const sendFrame = async () => {
        if (!isStreaming) return

        try {
          const blob = await captureFrame(videoTrack)
          if (!blob) return

          const reader = new FileReader()
          reader.onloadend = () => {
            socketRef.current?.emit('camera-frame', reader.result)
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
      console.error('Camera access error:', err)
      let errorMessage = 'Failed to access camera'

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera access was denied. Please grant permission and try again.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on your device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Your camera is in use by another application.'
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Could not find a camera matching the requirements.'
      }

      setError(errorMessage)
      setIsStreaming(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
    setError('')
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
        <div className="w-full max-w-3xl p-4 bg-destructive/10 text-destructive rounded-lg">
          <p className="text-center">{error}</p>
          {error.includes('denied') && (
            <p className="text-sm text-center mt-2">
              To fix this, please:
              <br />1. Check your browser settings
              <br />2. Look for the camera icon in the address bar
              <br />3. Make sure this site has camera permissions
            </p>
          )}
        </div>
      )}

      <p className="text-muted-foreground text-center max-w-md">
        {isMobile ?
          "Using the back camera for monitoring. Make sure you have good lighting and a stable internet connection." :
          "Point this camera at the area you want to monitor. Make sure you have good lighting and a stable internet connection."
        }
      </p>
    </main>
  )
}
