'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Pusher from 'pusher-js'
import type { Channel } from 'pusher-js'

export default function MonitorPage() {
  const imageRef = useRef<HTMLImageElement>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<Channel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string>('')
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true
    });

    pusherRef.current = pusher;

    // Subscribe to the camera feed channel
    const channel = pusher.subscribe('camera-feed');
    channelRef.current = channel;

    pusher.connection.bind('connected', () => {
      console.log('Pusher connected');
      setIsConnected(true);
      setError('');
      setIsReconnecting(false);
    });

    pusher.connection.bind('disconnected', () => {
      console.log('Pusher disconnected');
      setIsConnected(false);
      setIsReconnecting(true);
    });

    pusher.connection.bind('error', (err: any) => {
      console.error('Pusher error:', err);
      setError(`Connection error: ${err.message}. Retrying...`);
      setIsConnected(false);
      setIsReconnecting(true);
    });

    channel.bind('camera-frame', (data: string) => {
      console.log('Received frame data');
      if (imageRef.current) {
        try {
          imageRef.current.src = data;
          setLastUpdate(new Date());
          setHasReceivedFrame(true);
        } catch (err) {
          console.error('Error setting frame data:', err);
        }
      }
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current = null;
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
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
        <div className="w-[60px]" />
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
        <img
          ref={imageRef}
          className={`w-full h-full object-contain ${!hasReceivedFrame ? 'hidden' : ''}`}
          alt="Video feed"
          onError={(e) => {
            console.error('Error loading image:', e);
            setError('Error displaying video feed');
          }}
        />

        {(!isConnected || !hasReceivedFrame) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            {!isConnected ? 'Connecting to camera...' :
             isReconnecting ? 'Reconnecting to camera...' :
             'Waiting for video feed...'}
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
