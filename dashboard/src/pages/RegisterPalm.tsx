import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CameraOff, Download } from 'lucide-react';

// MediaPipe types
declare global {
  interface Window {
    Hands: any;
  }
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandResults {
  multiHandLandmarks: Landmark[][];
}

const RegisterPalm: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const overlaySpaceRef = useRef<SVGGElement>(null);
  const palmOutlineRef = useRef<SVGPathElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState('📷 Camera ready - match the green outline');
  const [statusType, setStatusType] = useState<'ready' | 'error' | 'default'>('ready');
  const [hands, setHands] = useState<any>(null);
  const [rafId, setRafId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const tipIds = [4, 8, 12, 16, 20, 0]; // thumb -> pinky + palm
  const MATCH_FRACTION = 0.10;

  // Initialize MediaPipe Hands
  const initializeHands = useCallback(() => {
    console.log('🤖 Initializing MediaPipe Hands...');
    console.log('Window.Hands available:', typeof window !== 'undefined' && !!window.Hands);
    
    if (typeof window !== 'undefined' && window.Hands) {
      console.log('✅ Creating Hands instance...');
      const handsInstance = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      
      console.log('⚙️ Setting Hands options...');
      handsInstance.setOptions({
        selfieMode: true,
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      handsInstance.onResults((results: HandResults) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
          palmOutlineRef.current?.classList.remove('good');
          cameraContainerRef.current?.classList.remove('good');
          setCountdown(null); // Reset countdown if no hand detected
          return;
        }

        drawLiveTipDots(results.multiHandLandmarks);
        
        if (allTipsClose(results.multiHandLandmarks)) {
          palmOutlineRef.current?.classList.add('good');
          cameraContainerRef.current?.classList.add('good');
          
          // Start countdown if hand is properly positioned and not already counting/capturing
          if (countdown === null && !isCapturing) {
            startCountdown();
          }
        } else {
          palmOutlineRef.current?.classList.remove('good');
          cameraContainerRef.current?.classList.remove('good');
          setCountdown(null); // Reset countdown if hand not properly positioned
        }
      });

      console.log('✅ Hands instance created and configured');
      setHands(handsInstance);
    } else {
      console.error('❌ MediaPipe Hands not available');
    }
  }, []);

  // Get video content rectangle
  const getVideoContentRect = useCallback(() => {
    if (!videoRef.current) return { x: 0, y: 0, width: 0, height: 0 };
    
    const r = videoRef.current.getBoundingClientRect();
    const vw = videoRef.current.videoWidth || 1280;
    const vh = videoRef.current.videoHeight || 720;
    
    if (!vw || !vh) return { x: r.left, y: r.top, width: r.width, height: r.height };

    const elAR = r.width / r.height;
    const vidAR = vw / vh;

    if (vidAR > elAR) {
      const contentW = r.width;
      const contentH = r.width / vidAR;
      const y = r.top + (r.height - contentH) / 2;
      return { x: r.left, y, width: contentW, height: contentH };
    } else {
      const contentH = r.height;
      const contentW = r.height * vidAR;
      const x = r.left + (r.width - contentW) / 2;
      return { x, y: r.top, width: contentW, height: contentH };
    }
  }, []);

  // Convert landmark to screen coordinates
  const lmToScreenXY = useCallback((lm: Landmark) => {
    const box = getVideoContentRect();
    return { x: box.x + lm.x * box.width, y: box.y + lm.y * box.height };
  }, [getVideoContentRect]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvgXY = useCallback((x: number, y: number) => {
    if (!svgRef.current || !overlaySpaceRef.current) return { x: 0, y: 0 };
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = x;
    pt.y = y;
     const ctm = overlaySpaceRef.current.getScreenCTM();
     return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
  }, []);

  // Convert SVG coordinates to screen coordinates
  const svgToScreenXY = useCallback((x: number, y: number) => {
    if (!svgRef.current || !overlaySpaceRef.current) return { x: 0, y: 0 };
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = x;
    pt.y = y;
     const ctm = overlaySpaceRef.current.getScreenCTM();
     return ctm ? pt.matrixTransform(ctm) : { x: 0, y: 0 };
  }, []);

  // Draw live fingertip dots
  const drawLiveTipDots = useCallback((landmarks: Landmark[][]) => {
    const lm = landmarks[0];
    if (!lm) return;

    const debugDots = document.getElementById('debug-dots');
    if (!debugDots) return;

    // Ensure we have enough dots
    while (debugDots.childElementCount < 6) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '6');
      circle.setAttribute('class', 'finger-dot');
      debugDots.appendChild(circle);
    }

    const dots = debugDots.children;
    for (let i = 0; i < tipIds.length; i++) {
      const tip = lm[tipIds[i]];
      if (!tip) continue;
      
      const sp = lmToScreenXY(tip);
      const vp = screenToSvgXY(sp.x, sp.y);
      const dot = dots[i] as SVGCircleElement;
      dot.setAttribute('cx', vp.x.toString());
      dot.setAttribute('cy', vp.y.toString());
    }
  }, [lmToScreenXY, screenToSvgXY]);

  // Calculate tip distances in pixels
  const tipDistancesPX = useCallback((landmarks: Landmark[][]) => {
    const lm = landmarks[0];
    if (!lm) return [];
    
    const dists = [];
    for (let i = 0; i < tipIds.length; i++) {
      const tip = lm[tipIds[i]];
      if (!tip) continue;
      
      const p1 = lmToScreenXY(tip);
      const targetEl = document.getElementById(`t${i}`);
      if (!targetEl) continue;
      
      const cx = parseFloat(targetEl.getAttribute('cx') || '0');
      const cy = parseFloat(targetEl.getAttribute('cy') || '0');
      const p2 = svgToScreenXY(cx, cy);
      dists.push(Math.hypot(p1.x - p2.x, p1.y - p2.y));
    }
    return dists;
  }, [lmToScreenXY, svgToScreenXY]);

  // Check if all tips are close enough
  const allTipsClose = useCallback((landmarks: Landmark[][]) => {
    const dists = tipDistancesPX(landmarks);
    if (dists.length < 6) return false;

    const box = cameraContainerRef.current?.getBoundingClientRect();
    if (!box) return false;
    
    const threshold = Math.min(box.width, box.height) * MATCH_FRACTION;
    return dists.every(d => d <= threshold);
  }, [tipDistancesPX]);

  // Start countdown when hand is detected
  const startCountdown = useCallback(() => {
    if (countdown !== null || isCapturing) return; // Already counting down or capturing
    
    console.log('⏰ Starting 2-second countdown...');
    setCountdown(2);
    setStatus('⏰ Hand detected! Capturing in 2 seconds...');
    setStatusType('ready');
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Auto-capture after countdown
          setTimeout(() => {
            autoCaptureImage();
          }, 100);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdown, isCapturing]);

  // Auto-capture image and send to server
  const autoCaptureImage = useCallback(async () => {
    if (!stream || !videoRef.current || isCapturing) {
      console.log('❌ Cannot capture - missing stream, video, or already capturing');
      return;
    }

    console.log('📸 Auto-capturing image...');
    setIsCapturing(true);
    setStatus('📸 Capturing palm image...');
    setStatusType('default');

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas not available');
      setIsCapturing(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Canvas context not available');
      setIsCapturing(false);
      return;
    }

    // Capture the image
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Flip horizontally to match the mirrored video
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
    
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.9);
      });

      // Send to Python server
      await sendImageToServer(blob);
      
      setStatus('✅ Palm captured and registered successfully!');
      setStatusType('ready');
      
    } catch (error) {
      console.error('❌ Error capturing image:', error);
      setStatus('❌ Failed to capture palm image');
      setStatusType('error');
    } finally {
      setIsCapturing(false);
    }
  }, [stream, isCapturing]);

  // Send image to Python server
  const sendImageToServer = useCallback(async (imageBlob: Blob) => {
    if (!phoneNumber) {
      throw new Error('Phone number not available');
    }

    console.log('📤 Sending image to Python server...');
    
    const formData = new FormData();
    formData.append('image', imageBlob, 'palm_image.jpg');
    formData.append('phone_number', phoneNumber);

    const response = await fetch('http://localhost:5000/register_palm', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Server response:', result);
    return result;
  }, [phoneNumber]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      console.log('🎥 Starting camera...');
      setStatus('🔄 Starting camera...');
      setStatusType('default');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported');
        throw new Error('Camera not supported in this browser');
      }
      
      console.log('📱 Requesting camera access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'user' 
        }
      });
      
      console.log('✅ Camera access granted, stream:', mediaStream);
      setStream(mediaStream);
      
      if (videoRef.current) {
        console.log('📺 Setting video source...');
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('📊 Video metadata loaded:', {
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
            duration: videoRef.current?.duration
          });
          
          setStatus('📷 Camera ready - match the green outline');
          setStatusType('ready');
          setIsCameraActive(true);
          
          if (videoRef.current && cameraContainerRef.current) {
            cameraContainerRef.current.style.aspectRatio = 
              `${videoRef.current.videoWidth} / ${videoRef.current.videoHeight}`;
            console.log('📐 Set aspect ratio:', cameraContainerRef.current.style.aspectRatio);
          }
          
          console.log('🤖 Initializing hands...');
          // Initialize hands after a short delay to ensure MediaPipe is loaded
          setTimeout(() => {
            initializeHands();
            console.log('🔄 Starting highlight loop...');
            startHighlightLoop();
          }, 1000);
        };
        
        videoRef.current.onerror = (e) => {
          console.error('❌ Video error:', e);
          setStatus('❌ Video stream error');
          setStatusType('error');
        };
        
        videoRef.current.oncanplay = () => {
          console.log('▶️ Video can play');
        };
        
        videoRef.current.onplay = () => {
          console.log('▶️ Video started playing');
        };
      } else {
        console.error('❌ Video ref not available');
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      let errorMessage = '❌ Camera access denied or not available';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = '❌ Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '❌ No camera found. Please connect a camera.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = '❌ Camera not supported in this browser.';
        }
      }
      
      setStatus(errorMessage);
      setStatusType('error');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    console.log('🛑 Stopping camera...');
    // Get current stream from video element instead of state
    const currentStream = videoRef.current?.srcObject as MediaStream;
    if (currentStream) {
      console.log('🛑 Stopping stream tracks...');
      currentStream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    stopHighlightLoop();
    setStatus('📷 Camera stopped');
    setStatusType('default');
    setIsCameraActive(false);
  }, []);

  // Start highlight loop
  const startHighlightLoop = useCallback(() => {
    console.log('🔄 Starting highlight loop...', { hands: !!hands, video: !!videoRef.current });
    if (!hands || !videoRef.current) {
      console.error('❌ Cannot start highlight loop - missing hands or video');
      return;
    }
    
    const tick = async () => {
      if (videoRef.current) {
        try {
          await hands.send({ image: videoRef.current });
        } catch (error) {
          console.error('❌ Error sending frame to MediaPipe:', error);
        }
      }
      const newRafId = requestAnimationFrame(tick);
      setRafId(newRafId);
    };
    
    if (rafId) {
      console.log('🛑 Cancelling existing animation frame');
      cancelAnimationFrame(rafId);
    }
    const newRafId = requestAnimationFrame(tick);
    setRafId(newRafId);
    console.log('✅ Highlight loop started with RAF ID:', newRafId);
  }, [hands, rafId]);

  // Stop highlight loop
  const stopHighlightLoop = useCallback(() => {
    console.log('🛑 Stopping highlight loop...', { rafId });
    if (rafId) {
      cancelAnimationFrame(rafId);
      setRafId(null);
      console.log('✅ Highlight loop stopped');
    }
  }, [rafId]);

  // Capture image
  const captureImage = useCallback(() => {
    if (!stream || !videoRef.current) {
      setStatus('❌ Camera not started');
      setStatusType('error');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Flip horizontally to match the mirrored video
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `palm_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        setStatus('✅ Captured');
        setStatusType('ready');
      }
    }, 'image/jpeg', 0.9);
  }, [stream]);

  // Position targets on outline
  const positionTargetsOnOutline = useCallback(() => {
    const path = palmOutlineRef.current;
    if (!path) return;

    const L = path.getTotalLength();
    const N = 2400;
    const pts = new Array(N);

    // Sample points along the path
    for (let i = 0; i < N; i++) {
      const p = path.getPointAtLength((i / (N - 1)) * L);
      pts[i] = { x: p.x, y: p.y, i };
    }

    // Smooth y coordinates
    const k = 7;
    const ys = pts.map(p => p.y);
    const ysm = ys.slice();
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let j = -k; j <= k; j++) {
        const t = i + j;
        if (t >= 0 && t < N) { s += ys[t]; c++; }
      }
      ysm[i] = s / c;
    }

    const box = path.getBBox();
    const topGate = box.y + box.height * 0.72;

    // Find local minima (finger tips)
    const cand = [];
    for (let i = 1; i < N - 1; i++) {
      if (ysm[i] < ysm[i - 1] && ysm[i] < ysm[i + 1] && ysm[i] < topGate) {
        cand.push({ x: pts[i].x, y: pts[i].y, score: -ysm[i], i });
      }
    }

    // Sort and pick best candidates
    cand.sort((a, b) => a.score - b.score);
    const minDx = box.width * 0.12;
     const picked: Array<{x: number, y: number, score: number, i: number}> = [];
    for (const c of cand) {
      if (picked.every(p => Math.abs(p.x - c.x) > minDx)) picked.push(c);
      if (picked.length === 5) break;
    }

    // Sort by x position (thumb to pinky)
    picked.sort((a, b) => a.x - b.x);

    // Position target circles
    const dy = 4;
    for (let i = 0; i < 5; i++) {
      const p = picked[4 - i] || { x: box.x, y: box.y };
      const targetEl = document.getElementById(`t${i}`);
      if (targetEl) {
        targetEl.setAttribute('cx', p.x.toString());
        targetEl.setAttribute('cy', (p.y + dy).toString());
      }
    }

    // Position palm target
    const middle = document.getElementById('t2');
    const midX = middle ? parseFloat(middle.getAttribute('cx') || '0') : (box.x + box.width * 0.5);
    const palmY = box.y + box.height * 0.63;
    const palmTarget = document.getElementById('t5');
    if (palmTarget) {
      palmTarget.setAttribute('cx', midX.toString());
      palmTarget.setAttribute('cy', palmY.toString());
    }
  }, []);

  // Load MediaPipe scripts
  useEffect(() => {
    console.log('📦 Loading MediaPipe scripts...');
    const loadMediaPipe = () => {
      if (typeof window !== 'undefined' && !window.Hands) {
        console.log('📥 Loading MediaPipe Hands script...');
        const script1 = document.createElement('script');
        script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script1.onload = () => {
          console.log('✅ MediaPipe Hands script loaded');
          const script2 = document.createElement('script');
          script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
          script2.onload = () => {
            console.log('✅ MediaPipe Drawing Utils script loaded');
          };
          script2.onerror = () => {
            console.error('❌ Failed to load MediaPipe Drawing Utils');
          };
          document.head.appendChild(script2);
        };
        script1.onerror = () => {
          console.error('❌ Failed to load MediaPipe Hands script');
        };
        document.head.appendChild(script1);
      } else {
        console.log('✅ MediaPipe Hands already available');
      }
    };

    loadMediaPipe();
  }, []);

  // Initialize on mount
  useEffect(() => {
    console.log('🚀 Component mounted, starting camera...');
    startCamera();
    return () => {
      console.log('🧹 Component unmounting, stopping camera...');
      stopCamera();
    };
  }, []); // Empty dependency array to run only on mount/unmount

  // Position targets when component mounts
  useEffect(() => {
    const timer = setTimeout(positionTargetsOnOutline, 1000);
    return () => clearTimeout(timer);
  }, [positionTargetsOnOutline]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ Page hidden, stopping camera...');
        stopCamera();
      } else {
        console.log('👁️ Page visible, checking camera...');
        // Check if camera is not active and start it
        if (!isCameraActive) {
          startCamera();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isCameraActive]); // Only depend on isCameraActive

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
         {/* Header */}
         <div className="flex items-center justify-between mb-6">
           <button
             onClick={() => navigate('/dashboard')}
             className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
           >
             <ArrowLeft className="w-4 h-4" />
             Back to Dashboard
           </button>
           <h1 className="text-2xl font-bold">Register New Palm</h1>
         </div>

         {/* Phone Number Input */}
         <div className="mb-6 p-4 bg-gray-800 rounded-lg">
           <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
             Phone Number (for palm registration)
           </label>
           <input
             id="phone"
             type="tel"
             value={phoneNumber}
             onChange={(e) => setPhoneNumber(e.target.value)}
             placeholder="Enter your phone number"
             className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
             disabled={isCapturing}
           />
           <p className="text-xs text-gray-400 mt-1">
             This will be used as your unique palm ID
           </p>
         </div>

        {/* Camera Container */}
        <div className="relative w-full max-w-3xl mx-auto">
          <div 
            ref={cameraContainerRef}
            className="relative w-full aspect-video rounded-xl overflow-hidden bg-black"
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-contain scale-x-[-1]"
            />

            {/* Hand Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 316.8 430.41"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="b"/>
                    <feMerge>
                      <feMergeNode in="b"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <g ref={overlaySpaceRef} transform="translate(-320,-20)">
                  {/* Live fingertip debug dots */}
                  <g id="debug-dots"></g>

                  {/* Fingertip targets */}
                  <g id="targets" fill="black">
                    <circle id="t0" cx="123" cy="238" r="12"/>
                    <circle id="t1" cx="123" cy="238" r="12"/>
                    <circle id="t2" cx="123" cy="238" r="12"/>
                    <circle id="t3" cx="123" cy="238" r="12"/>
                    <circle id="t4" cx="123" cy="238" r="12"/>
                    <circle id="t5" cx="123" cy="238" r="14"/>
                  </g>

                  {/* Palm outline */}
                  <path
                    ref={palmOutlineRef}
                    className="palm-outline"
                    fill="none"
                    stroke="rgba(0,255,0,0.8)"
                    strokeWidth="3"
                    strokeDasharray="8 4"
                    filter="url(#glow)"
                    d="m293.12 154.31c-1.187-0.007-2.4908 0.14375-3.9062 0.46875-1.654 0.381-5.9352 3.7758-7.1562 5.7188-5.857 9.331-3.3628 32.779-3.5938 47.281 0.39025 15.233 2.9204 30.087 0.71875 44.438-5.7953 18.424 6.6761 79.039-10.719 55.906-3.865-13.098-3.7128-26.528-6.4688-39.438-2.313-10.837-7.553-18.441-10.75-29.375-3.253-11.125-4.0165-23.033-6.4375-36.531-2.5845-11.757-4.192-30.66-16.469-30.094-4.235 0.313-11.087 7.5565-12.906 12.188-2.338 5.955-2.7642 15.3-2.1562 24.344 0.506 7.548 2.6182 16.95 5.0312 26.531 2.226 8.834 2.6592 18.112 4.2812 27.219 1.958 11.007 3.6798 24.304 6.4688 35.844 1.106 4.581 1.4818 10.123 2.8438 16.469 1.735 8.072 3.9748 15.122-4.2812 17.906-9.868-4.702-13.419-16.71-17.473-27.228-4.0209-6.8333-15.709-23.025-19.808-31.522-5.5156-10.571-9.433-34.282-20.062-34.406-10.618 0.127-13.053 15.803-10.75 29.375 2.9086 13.013 10.359 23.442 15.781 34.406 7.894 15.721 15.691 34.516 24.344 50.875-0.27973 24.311 3.3662 45.243 5.75 68.062 1.189 9.402 3.8988 21.991 5.7188 32.25 4.8748 20.737 11.765 41.04 16.623 61.234 1.8913 7.8614 7.4745 15.706 8.511 23.553 0.49491 3.747 0.86513 7.4946 1.0846 11.245 0.291 4.541 0.13202 26.932 0.64102 31.6 2.7381 0.60062 2.6746 0.73178 4.3902 0.77474 1.344-12.563-0.56775-32.846-0.71875-44.562-1.5202-7.0776-7.273-14.302-9.1449-21.59-7.3446-28.597-16.522-58.18-20.668-83.753-0.826-5.373-1.4532-9.7765-2.1562-17.188-1.7211-16.896-6.8855-33.727-5.3125-49.594l-1.0938-13.5c-0.0109 0.01-0.0204 0.0215-0.0312 0.0312-2.315-5.895-5.7368-11.104-8.5938-17.188-2.664-5.674-4.2822-12.188-7.1562-18.625-6.6482-6.9826-8.3089-16.538-12.188-23.656-7.3226-9.9401-13.434-26.327-12.188-37.25 0.613-4.46 2.1814-11.269 5-12.188 2.8402-0.50157 4.2424 0.49634 5.75 1.4375 4.059 5.17 5.495 11.468 7.875 17.906 2.651 7.18 5.8822 16.75 10.031 22.938 5.1781 6.8446 9.7482 13.941 14.263 20.594 4.324 6.734 6.7994 14.572 10.83 21.688 1.192 2.1023 3.0563 3.4189 4.1562 5.375 9.0863 2.9243 11.891 1.7205 16.625-5.4062 0.362-14.783-7.3795-31.402-9.3125-50.156-1.2274-10.367-3.1456-19.472-4.3125-27.938-0.20887-11.874-3.267-19.981-5-30.812-0.918-5.314-3.398-14.044-2.875-21.5 0.567-8.118 5.351-21.686 13.625-20.781 4.803 0.526 6.009 5.2872 7.1174 9.3514 3.599 14.671 4.8939 27.899 7.9139 41.524 2.8767 11.755 4.8374 20.948 8.5938 28.656 1.987 4.551 5.2518 11.769 6.4688 19.375 2.0606 12.892 2.1181 25.7 7.875 37.938 0.004 0.009-0.004 0.0226 0 0.0312h0.1875c6.0305 4.5999 10.519 3.3961 12.719-2.1562 4.759-16.692-2.0885-41.966 3.5625-60.188 2.2701-11.357-0.80138-43.253-1.4375-65.938-0.26546-9.4663-1.1262-18.122 3.5938-25.062 12.967-8.424 19.108 7.4128 20.781 19.344 1.974 14.08 0.81525 30.2 2.1562 46.562 0.339 4.108 1.6302 8.2215 2.1562 12.188 0.573 4.313 1.522 7.9995 2.125 12.188 2.9867 20.715-3.1271 42.028 0.6875 60 6.5388 24.952 23.743-22.153 26.562-29.906 5.219-12.997 11.593-26.931 16.469-39.406 1.469-3.844 2.6248-7.6298 3.5938-11.469 2.8923-12.511 8.8459-35.173 19.344-39.406 8.092-0.758 11.395 3.1538 10.031 16.469-1.543 14.897-7.9702 31.998-10.781 48-1.0999 10.395-4.4316 19.755-7.1562 29.375-4.198 12.434-13.396 28.433-15.062 43-1.1686 27.23 0.97779 54.387 8.4062 75.562 7.8574 4.3914 13.184-1.8571 18.125-6.4688 3.185-2.94 5.8708-6.4565 8.5938-9.3125 6.367-6.681 12.485-11.41 17.094-17.906 4.1315-8.2934 10.768-13.988 18.031-18.625 7.211-4.657 12.308-7.127 20.781-7.875 6.6039-1.8383 11.742 0.8728 18.625 2.125 1.872 1.525 3.3758 2.0725 3.5938 4.3125 0.5 5.127-4.7832 6.0317-10.031 9.0357-18.749 12.648-36.516 28.751-48.031 46.839-2.078 12.971-7.6342 22.472-15.031 30.125-1.521 2.229-9.1468 8.717-10.969 10-9.633 15.924-13.071 23.526-22 40.156-20.587 12.661-21.009 51.245-11.281 75.656 1.017 9.016 5.303 17.38 9.125 22.938 1.6772-"
                  />
                </g>
              </svg>
            </div>
          </div>

           {/* Status */}
           <div className={`mt-4 p-4 rounded-lg font-semibold ${
             statusType === 'ready' ? 'bg-green-900/20 border border-green-500 text-green-400' :
             statusType === 'error' ? 'bg-red-900/20 border border-red-500 text-red-400' :
             'bg-gray-800 border border-gray-600 text-gray-300'
           }`}>
             {countdown !== null ? (
               <div className="text-center">
                 <div className="text-4xl font-bold text-yellow-400 mb-2">{countdown}</div>
                 <div>Capturing in {countdown} second{countdown !== 1 ? 's' : ''}...</div>
               </div>
             ) : (
               status
             )}
           </div>

           {/* Debug Info */}
           <div className="mt-2 p-3 bg-gray-800/50 rounded text-xs text-gray-400">
             <div>Debug: Camera Active: {isCameraActive ? '✅' : '❌'} | Stream: {stream ? '✅' : '❌'} | Hands: {hands ? '✅' : '❌'} | RAF: {rafId ? '✅' : '❌'}</div>
             <div>Video: {videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : 'Not loaded'}</div>
             <div>MediaPipe: {typeof window !== 'undefined' && window.Hands ? '✅ Available' : '❌ Not loaded'}</div>
             <div>Countdown: {countdown !== null ? `⏰ ${countdown}s` : '❌'} | Capturing: {isCapturing ? '📸' : '❌'} | Phone: {phoneNumber ? '✅' : '❌'}</div>
           </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => {
                console.log('🔧 Manual camera start triggered');
                startCamera();
              }}
              disabled={isCameraActive}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
            >
              <Camera className="w-4 h-4" />
              {isCameraActive ? 'Camera Active' : 'Start Camera'}
            </button>
            
            <button
              onClick={captureImage}
              disabled={!isCameraActive}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
            >
              <Download className="w-4 h-4" />
              Capture
            </button>
            
            <button
              onClick={stopCamera}
              disabled={!isCameraActive}
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Instructions */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Position your hand so that your fingertips align with the green outline</li>
            <li>Wait for the outline to turn cyan - this means your hand is properly positioned</li>
            <li>Click "Capture" to take a photo of your palm</li>
            <li>The image will be automatically downloaded</li>
          </ol>
        </div>
      </div>

       <style>{`
        .palm-outline {
          transition: stroke 0.12s ease, stroke-width 0.12s ease, filter 0.12s ease;
        }
        .palm-outline.good {
          stroke: #00fff2;
          stroke-width: 5;
          stroke-dasharray: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(0,255,242,0.35));
        }
        .camera-container.good video {
          filter: brightness(0.55) contrast(1.25) saturate(1.1);
        }
        .finger-dot {
          fill: #00e5ff;
          stroke: #fff;
          stroke-width: 1;
        }
      `}</style>
    </div>
  );
};

export default RegisterPalm;
