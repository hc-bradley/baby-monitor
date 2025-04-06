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

  const [error, setError] = useState<string>('')
  const [isAttemptingStreaming, setIsAttemptingStreaming] = useState(false);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    }
    return false
  })

  // Derived state for UI feedback
  const isActuallyStreaming = isAttemptingStreaming && videoTrack !== null && isConnected;

  // Effect to initialize Pusher connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true
    });

    pusherRef.current = pusher;

    pusher.connection.bind('connected', () => {
      console.log('Pusher connected');
      setError('');
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      console.log('Pusher disconnected');
      setError('Connection lost. Trying to reconnect...');
      setIsConnected(false);
      stopCamera();
    });

    pusher.connection.bind('error', (err: any) => {
      console.error('Pusher error:', err);
      setError(`Connection error: ${err.message}. Retrying...`);
      setIsConnected(false);
      stopCamera();
    });

    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current = null;
      }
    };
  }, []);

  // Function to send frame data
  const sendFrame = useCallback(async (frameData: string) => {
    if (!isAttemptingStreaming || !videoTrack || !isConnected) return;

    try {
      const response = await fetch('/api/socket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'camera-feed',
          event: 'camera-frame',
          data: frameData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send frame');
      }
    } catch (err) {
      console.error('Error sending frame:', err);
    }
  }, [isAttemptingStreaming, videoTrack, isConnected]);

  // Recursive frame sending loop
  const sendFrameLoop = useCallback(async () => {
    if (!isAttemptingStreaming || !videoTrack || !isConnected) {
      console.log('sendFrameLoop: Stopping condition met.');
      if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
      return;
    }

    try {
      const blob = await captureFrame(videoTrack);
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isAttemptingStreaming && videoTrack && isConnected && reader.result) {
            sendFrame(reader.result as string);
            frameTimerRef.current = setTimeout(sendFrameLoop, 50);
          } else {
            console.log('sendFrameLoop: Conditions changed before emit/schedule, stopping this path.');
            if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
            frameTimerRef.current = null;
          }
        };
        reader.onerror = () => {
          console.error('FileReader error, attempting next frame...');
          if (isAttemptingStreaming && videoTrack && isConnected) {
            frameTimerRef.current = setTimeout(sendFrameLoop, 50);
          }
        };
        reader.readAsDataURL(blob);
      }
    } catch (err) {
      console.error('Error in sendFrameLoop:', err);
      if (isAttemptingStreaming && videoTrack && isConnected) {
        frameTimerRef.current = setTimeout(sendFrameLoop, 50);
      }
    }
  }, [isAttemptingStreaming, videoTrack, isConnected, sendFrame]);

  // Capture frame function
  const captureFrame = useCallback(async (track: MediaStreamTrack | null) => {
    if (!track || !videoRef.current || !canvasRef.current || videoRef.current.readyState < videoRef.current.HAVE_METADATA || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return null;
    }
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob && blob.size > 0 ? blob : null);
        }, 'image/jpeg', 0.8);
      });
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  }, []);

   // Stop camera function (made stable with useCallback)
  const stopCamera = useCallback(() => {
    console.log('Stopping camera and clearing timer...');
    setIsAttemptingStreaming(false);
    setVideoTrack(null);

    if (frameTimerRef.current) {
      clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []); // No dependencies, safe

  // Effect to manage the start/stop of the frame sending loop
  useEffect(() => {
    if (isAttemptingStreaming && videoTrack && isConnected) {
      console.log('>>> Effect: Starting sendFrameLoop because conditions met <<< ');
      // Clear any existing timer before starting a new loop instance
      if (frameTimerRef.current) {
        clearTimeout(frameTimerRef.current);
      }
      sendFrameLoop(); // Start the loop
    } else {
       console.log('>>> Effect: Conditions NOT met, ensuring loop is stopped <<< ', {isAttemptingStreaming, videoTrack:!!videoTrack, isConnected});
       // If conditions aren't met, ensure any stray timer is cleared.
       // stopCamera also clears it, but this adds robustness.
       if (frameTimerRef.current) {
         clearTimeout(frameTimerRef.current);
         frameTimerRef.current = null;
       }
    }

    // Cleanup function for the effect
    return () => {
      console.log('>>> Effect Cleanup: Clearing frame timer <<< ');
      if (frameTimerRef.current) {
        clearTimeout(frameTimerRef.current);
        frameTimerRef.current = null;
      }
    };
  // Dependencies: The effect should re-run if the intent, track, connection status, or loop function changes
  }, [isAttemptingStreaming, videoTrack, isConnected, sendFrameLoop]);

  // Start camera function
  const startCamera = async () => {
    if (isAttemptingStreaming) return;
    setError('');
    setIsAttemptingStreaming(true); // Signal intent
    console.log('Attempting to start camera...');

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access not supported');
      if (!isConnected) throw new Error('Pusher not connected');

      // Ensure previous stream is stopped
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
       if (videoRef.current) videoRef.current.srcObject = null;

      const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: isMobile ? { ideal: 'environment' } : undefined }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained');

      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video element not available');
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
         if (!videoRef.current) return reject(new Error('Video ref lost'));
         videoRef.current.onloadedmetadata = () => { console.log('onloadedmetadata fired'); resolve(); };
         videoRef.current.onerror = (e) => reject(new Error(`Video metadata error: ${e}`));
         setTimeout(() => reject(new Error('Video metadata load timed out')), 5000);
       });
      console.log('Video metadata loaded');

      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track found');
      setVideoTrack(track); // Set the track -> This will trigger the useEffect to start the loop

    } catch (err: any) {
      console.error('Camera start error:', err);
      setError(`Failed to start camera: ${err.message || err.name}`);
      stopCamera(); // Cleanup on error
    }
  };

  return (
     <main className="min-h-screen p-4 flex flex-col items-center space-y-4">
       <div className="w-full max-w-3xl flex justify-between items-center">
        <Link href="/" className="text-primary hover:underline"> ← Back </Link>
        <h1 className="text-2xl font-bold">Camera Mode</h1>
        <div className="w-[60px]" />
      </div>
      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="w-full h-full object-cover"
          onLoadedData={() => console.log('Video element loaded data')}
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* Use isActuallyStreaming for overlay text, provides better feedback */}
        {!isActuallyStreaming && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-semibold">
             { !isConnected ? 'Connecting...' :
               error ? 'Error Occurred' :
               isAttemptingStreaming ? 'Starting Camera...':
               'Press Start Camera' }
           </div>
        )}
      </div>
      <div className="flex gap-4">
        <button
          onClick={startCamera}
          disabled={isAttemptingStreaming || !isConnected} // Disable if trying or not connected
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* More descriptive button text */}
          {isAttemptingStreaming && !videoTrack ? 'Starting...' : isActuallyStreaming ? 'Streaming...' : 'Start Camera'}
        </button>
        <button
          onClick={stopCamera}
          disabled={!isAttemptingStreaming} // Only enable stop if an attempt is active
          className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop Camera
        </button>
      </div>
      {error && (
        <div className="w-full max-w-3xl p-4 bg-destructive/10 text-destructive rounded-lg">
          <p className="text-center font-semibold">Error:</p>
          <p className="text-center">{error}</p>
        </div>
      )}
      <p className="text-muted-foreground text-center max-w-md">
         {isMobile ? "Using back camera." : "Using default camera."} Ensure good lighting and stable connection.
      </p>
    </main>
  )
}
