'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Pusher from 'pusher-js'
import type { Channel } from 'pusher-js'

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<Channel | null>(null)
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string>('')
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [connectionState, setConnectionState] = useState<string>('initializing')
  const [frameCount, setFrameCount] = useState(0)
  const [isMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    }
    return false
  })

  // Derived state for UI feedback
  const isActuallyStreaming = isStreaming && streamRef.current !== null && isConnected;

  const sendFrame = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !channelRef.current || !isConnected) {
      console.log('Cannot send frame:', {
        hasCanvas: !!canvasRef.current,
        hasVideo: !!videoRef.current,
        hasChannel: !!channelRef.current,
        isConnected,
        isStreaming
      });
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const channel = channelRef.current;

    try {
      // Check if video is ready
      if (video.readyState < video.HAVE_METADATA || video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('Video not ready:', {
          readyState: video.readyState,
          width: video.videoWidth,
          height: video.videoHeight
        });
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL('image/jpeg', 0.5);

      console.log(`Sending frame ${frameCount + 1} (${canvas.width}x${canvas.height})`);
      channel.trigger('client-camera-frame', {
        frame: frameData,
        timestamp: Date.now(),
        dimensions: {
          width: video.videoWidth,
          height: video.videoHeight
        }
      });
      setFrameCount(prev => prev + 1);
    } catch (err) {
      console.error('Error sending frame:', err);
    }
  }, [isConnected, frameCount, isStreaming]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('Initializing Pusher with key:', process.env.NEXT_PUBLIC_PUSHER_KEY);
    console.log('Using cluster:', process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      authEndpoint: '/api/socket',
      auth: {
        params: {
          user_id: 'camera'
        }
      },
      disableStats: true,
      activityTimeout: 30000,
      pongTimeout: 10000
    });

    pusherRef.current = pusher;

    // Subscribe to the camera feed channel
    console.log('Subscribing to camera-feed channel');
    const channel = pusher.subscribe('camera-feed');
    channelRef.current = channel;

    // Handle connection state changes
    pusher.connection.bind('state_change', (states: { current: string, previous: string }) => {
      console.log('Pusher state changed:', states);
      setConnectionState(states.current);
      setIsConnected(states.current === 'connected');
      setIsReconnecting(states.current === 'connecting');
    });

    pusher.connection.bind('connected', () => {
      console.log('Pusher connected');
      setIsConnected(true);
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

    // Enable client events
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('Successfully subscribed to camera-feed channel');
      console.log('Client events enabled for camera-feed channel');
    });

    channel.bind('pusher:subscription_error', (err: any) => {
      console.error('Failed to subscribe to camera-feed channel:', err);
      setError(`Failed to subscribe to camera feed: ${err.message}`);
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

  useEffect(() => {
    if (!isStreaming || !isConnected) {
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      return;
    }

    console.log('Starting frame capture');
    frameTimerRef.current = setInterval(sendFrame, 1000 / 30); // 30 FPS

    return () => {
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
    };
  }, [isStreaming, isConnected, sendFrame]);

  const startCamera = async () => {
    try {
      console.log('Requesting camera access');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: isMobile ? { ideal: 'environment' } : undefined
        }
      });

      if (videoRef.current) {
        console.log('Setting video stream');
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please make sure you have granted camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      console.log('Stopping camera stream');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
  };

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
        <div className="w-[60px]" />
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onLoadedData={() => console.log('Video loaded data')}
          onLoadedMetadata={() => console.log('Video loaded metadata')}
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        {!isActuallyStreaming && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-semibold">
             { !isConnected ? 'Connecting...' :
               error ? 'Error Occurred' :
               isStreaming ? 'Starting Camera...':
               'Press Start Camera' }
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
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={startCamera}
          disabled={isStreaming}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isStreaming ? 'Streaming...' : 'Start Camera'}
        </button>
        <button
          onClick={stopCamera}
          disabled={!isStreaming}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
        >
          Stop Camera
        </button>
      </div>

      <p className="text-muted-foreground text-center max-w-md">
        {isStreaming ? 'Camera is streaming. Open the monitor page to view the feed.' : 'Click "Start Camera" to begin streaming.'}
      </p>

      <div className="text-sm text-muted-foreground">
        <p>Connection state: {connectionState}</p>
        <p>Frames sent: {frameCount}</p>
        <p>Streaming: {isStreaming ? 'Yes' : 'No'}</p>
      </div>
    </main>
  )
}
