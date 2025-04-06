'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Socket } from 'socket.io-client'

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [error, setError] = useState<string>('')
  const [isAttemptingStreaming, setIsAttemptingStreaming] = useState(false);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    }
    return false
  })

  // Derived state for UI feedback (more accurate)
  const isActuallyStreaming = isAttemptingStreaming && videoTrack !== null && isSocketConnected;

  // Effect to initialize socket connection
  useEffect(() => {
    let socket: Socket | null = null;
    const initSocket = async () => {
      try {
        if (typeof window === 'undefined') return;
        const socketUrl = window.location.origin;
        console.log('Connecting to socket server at:', socketUrl);
        const io = (await import('socket.io-client')).io;
        socket = io(socketUrl, {
          path: '/api/socket', addTrailingSlash: false, reconnection: true,
          reconnectionAttempts: 5, reconnectionDelay: 1000, timeout: 10000,
          transports: ['websocket'], forceNew: true, withCredentials: true, autoConnect: true // Connect automatically
        });
        socketRef.current = socket;
        socket.on('connect', () => {
          console.log('Socket connected:', socket?.id);
          setError('');
          setIsSocketConnected(true);
        });
        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setError('Socket disconnected. Trying to reconnect...');
            setIsSocketConnected(false);
            stopCamera();
        });
        socket.on('connect_error', (err: Error) => {
          console.error('Socket connection error:', err);
          setError(`Connection error: ${err.message}`);
          setIsSocketConnected(false);
          stopCamera();
        });
      } catch (err) {
        console.error('Error initializing socket:', err);
        setError('Failed to initialize connection');
        setIsSocketConnected(false);
        stopCamera();
      }
    };
    initSocket();
    return () => {
      stopCamera();
      if (socketRef.current) {
        console.log('Disconnecting socket on unmount...');
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
        setIsSocketConnected(false);
      }
    }
  }, [])

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

  // Recursive frame sending loop
  const sendFrameLoop = useCallback(async () => {
    // Check conditions using state
    if (!isAttemptingStreaming || !videoTrack || !isSocketConnected) {
      console.log('sendFrameLoop: Stopping condition met.', { isAttemptingStreaming, videoTrack: !!videoTrack, isSocketConnected });
      // Don't call stopCamera here, let the effect handle cleanup based on state change
       if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
       frameTimerRef.current = null;
      return;
    }

    try {
      const blob = await captureFrame(videoTrack);
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Re-check conditions *just before* emitting and scheduling next frame
          if (isAttemptingStreaming && videoTrack && isSocketConnected && reader.result) {
            socketRef.current?.emit('camera-frame', reader.result as string);
            // Schedule next frame with a shorter interval (50ms for ~20 FPS)
            frameTimerRef.current = setTimeout(sendFrameLoop, 50);
          } else {
             console.log('sendFrameLoop: Conditions changed before emit/schedule, stopping this path.');
              if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
              frameTimerRef.current = null;
             // Do not call stopCamera here, rely on state changes
          }
        };
        reader.onerror = () => {
          console.error('FileReader error, attempting next frame...');
          if (isAttemptingStreaming && videoTrack && isSocketConnected) {
             // Retry with the shorter interval
             frameTimerRef.current = setTimeout(sendFrameLoop, 50);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        // console.log('No valid frame captured, retrying...');
        if (isAttemptingStreaming && videoTrack && isSocketConnected) {
           // Retry with the shorter interval
           frameTimerRef.current = setTimeout(sendFrameLoop, 50);
        }
      }
    } catch (err) {
      console.error('Error in sendFrameLoop:', err);
       if (isAttemptingStreaming && videoTrack && isSocketConnected) {
         // Retry with the shorter interval
         frameTimerRef.current = setTimeout(sendFrameLoop, 50);
       }
    }
  // Dependencies that influence the loop's behavior or recreation
  }, [isAttemptingStreaming, videoTrack, isSocketConnected, captureFrame]);

  // Effect to manage the start/stop of the frame sending loop
  useEffect(() => {
    if (isAttemptingStreaming && videoTrack && isSocketConnected) {
      console.log('>>> Effect: Starting sendFrameLoop because conditions met <<< ');
      // Clear any existing timer before starting a new loop instance
      if (frameTimerRef.current) {
        clearTimeout(frameTimerRef.current);
      }
      sendFrameLoop(); // Start the loop
    } else {
       console.log('>>> Effect: Conditions NOT met, ensuring loop is stopped <<< ', {isAttemptingStreaming, videoTrack:!!videoTrack, isSocketConnected});
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
  }, [isAttemptingStreaming, videoTrack, isSocketConnected, sendFrameLoop]);

  // Start camera function
  const startCamera = async () => {
    if (isAttemptingStreaming) return;
    setError('');
    setIsAttemptingStreaming(true); // Signal intent
    console.log('Attempting to start camera...');

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access not supported');
      if (!isSocketConnected) throw new Error('Socket not connected');

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
             { !isSocketConnected ? 'Connecting...' :
               error ? 'Error Occurred' :
               isAttemptingStreaming ? 'Starting Camera...':
               'Press Start Camera' }
           </div>
        )}
      </div>
      <div className="flex gap-4">
        <button
          onClick={startCamera}
          disabled={isAttemptingStreaming || !isSocketConnected} // Disable if trying or not connected
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
