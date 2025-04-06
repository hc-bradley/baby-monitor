'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'

export default function MonitorPage() {
  const imageRef = useRef<HTMLImageElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string>('')
  const [isReconnecting, setIsReconnecting] = useState(false)

  useEffect(() => {
    let socket: Socket | null = null;

    const connectSocket = () => {
      try {
        if (typeof window === 'undefined') return;

        const socketUrl = window.location.origin;
        console.log('Connecting to socket server at:', socketUrl);

        socket = io(socketUrl, {
          path: '/api/socket',
          addTrailingSlash: false,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
          transports: ['websocket', 'polling'],
          withCredentials: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('Socket connected:', socket?.id);
          setIsConnected(true);
          setError('');
          setIsReconnecting(false);
        });

        socket.on('connect_error', (err: Error) => {
          console.error('Socket connection error:', err);
          setError(`Connection error: ${err.message}. Make sure the camera is running and accessible.`);
          setIsConnected(false);
        });

        socket.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          if (reason === 'io server disconnect') {
            setIsReconnecting(true);
            socket?.connect();
          }
        });

        socket.on('reconnecting', (attemptNumber: number) => {
          console.log('Attempting to reconnect:', attemptNumber);
          setIsReconnecting(true);
          setError(`Attempting to reconnect... (${attemptNumber}/5)`);
        });

        socket.on('reconnect_failed', () => {
          console.log('Reconnection failed');
          setIsReconnecting(false);
          setError('Failed to connect to the camera. Please refresh the page or check if the camera is running.');
        });

        socket.on('camera-frame', (frameData: string) => {
          if (imageRef.current) {
            imageRef.current.src = frameData;
            setLastUpdate(new Date());
          }
        });
      } catch (err) {
        console.error('Error setting up socket:', err);
        setError('Failed to initialize connection. Please refresh the page.');
      }
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
        socketRef.current = null;
      }
    };
  }, []);

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
            {isReconnecting ? 'Reconnecting to camera...' : 'Connecting to camera...'}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {error && (
        <div className="w-full max-w-3xl p-4 bg-destructive/10 text-destructive rounded-lg">
          <p className="text-center">{error}</p>
          <p className="text-sm text-center mt-2">
            Troubleshooting steps:
            <br />1. Make sure the camera page is open and streaming
            <br />2. Check your internet connection
            <br />3. Try refreshing both the camera and monitor pages
          </p>
        </div>
      )}

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
