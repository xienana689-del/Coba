import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraType, AnalysisResult } from '../types';
import { analyzeFrame } from '../services/geminiService';
import { 
  AlertTriangle, ShieldCheck, Activity, Wifi, WifiOff, 
  Clock, CameraOff, Eye, Zap, Disc 
} from 'lucide-react';

interface CameraUnitProps {
  camera: Camera;
  onAnalyze: (cameraId: string, result: AnalysisResult, frame: string) => void;
  autoMonitor: boolean;
}

const CameraUnit: React.FC<CameraUnitProps> = ({ camera, onAnalyze, autoMonitor }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasError, setHasError] = useState(false);
  const [durationString, setDurationString] = useState('');

  // Calculate duration string (e.g., "2d 4h 10m")
  useEffect(() => {
    const updateDuration = () => {
      const diff = Date.now() - camera.statusChangedAt;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let str = '';
      if (days > 0) str += `${days}d `;
      if (hours > 0) str += `${hours}h `;
      str += `${minutes}m`;
      setDurationString(str || '< 1m');
    };
    
    updateDuration();
    const interval = setInterval(updateDuration, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [camera.statusChangedAt]);

  // Initialize camera feed
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    if (camera.isOnline && camera.type === CameraType.WEBCAM) {
      setHasError(false);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          if (!isMounted) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          activeStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          if (isMounted) {
            console.warn("Webcam access denied or device not found:", err);
            setHasError(true);
          }
        });
    }

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.type, camera.isOnline]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  const handleManualAnalyze = async () => {
    if (isAnalyzing || !camera.isOnline || hasError) return;
    setIsAnalyzing(true);
    
    const frame = captureFrame();
    if (frame) {
      const result = await analyzeFrame(frame);
      onAnalyze(camera.id, result, frame);
    } else {
      console.warn("Could not capture frame");
    }
    
    setIsAnalyzing(false);
  };

  // Auto-monitor effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoMonitor && camera.isOnline && !hasError) {
      // Increased delay to 30-60 seconds to prevent hitting API Rate Limits (429)
      const delay = 30000 + Math.random() * 30000; 
      interval = setInterval(async () => {
        if (!isAnalyzing) {
           handleManualAnalyze();
        }
      }, delay);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMonitor, isAnalyzing, camera.isOnline, hasError]);


  const getThreatColor = (level?: string) => {
    switch(level) {
      case 'CRITICAL': return 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-emerald-600 text-white';
      default: return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  const isSignalLost = !camera.isOnline || hasError;

  // Visual State Helpers
  const getStatusColor = () => {
    if (hasError) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (!camera.isOnline) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const getBorderClass = () => {
    if (hasError) return 'border-amber-900/50 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]';
    if (!camera.isOnline) return 'border-rose-900/50 shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]';
    if (camera.lastAnalysis?.threatLevel === 'CRITICAL') return 'border-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.6)] animate-pulse';
    if (camera.lastAnalysis?.threatLevel === 'HIGH') return 'border-orange-500 shadow-[0_0_15px_-5px_rgba(249,115,22,0.5)]';
    return 'border-gray-800 hover:border-gray-700';
  };

  const StatusIcon = hasError ? AlertTriangle : (!camera.isOnline ? WifiOff : Wifi);
  const statusStyles = getStatusColor();

  return (
    <div className={`relative flex flex-col h-full rounded-xl border bg-gray-900 overflow-hidden transition-all duration-300 group ${getBorderClass()}`}>
      
      {/* --- HEADER OVERLAY --- */}
      <div className="absolute top-0 inset-x-0 z-20 p-2.5 flex justify-between items-start bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
        
        {/* Left: Identity & Status Icon */}
        <div className="flex items-center gap-2">
           <div className={`p-1.5 rounded-lg backdrop-blur-md border ${statusStyles}`}>
              <StatusIcon size={14} strokeWidth={2.5} />
           </div>
           <div className="flex flex-col">
              <span className="text-xs font-bold text-white leading-none drop-shadow-md tracking-tight">
                {camera.name}
              </span>
              <span className="text-[10px] text-gray-300 font-mono mt-0.5 opacity-90">
                {camera.location}
              </span>
           </div>
        </div>

        {/* Right: Status Badges */}
        <div className="flex flex-col gap-1.5 items-end">
           {/* Recording Badge */}
           {camera.isRecording && !isSignalLost && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/30 backdrop-blur-md shadow-lg shadow-red-900/20">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
                 <span className="text-[9px] font-bold text-red-200 tracking-wider">REC</span>
              </div>
           )}

           {/* AI Active Badge */}
           {autoMonitor && !isSignalLost && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-md shadow-lg shadow-cyan-900/20">
                 <Eye size={10} className="text-cyan-400" />
                 <span className="text-[9px] font-bold text-cyan-200 tracking-wider">AI ON</span>
              </div>
           )}

           {/* Uptime / Duration */}
           <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/5 backdrop-blur-sm">
               <Clock size={10} className="text-gray-400" />
               <span className="text-[9px] font-mono text-gray-400">{durationString}</span>
           </div>
        </div>
      </div>

      {/* --- VIDEO FEED AREA --- */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {isSignalLost ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-red-500/50">
             {/* Static Noise Background */}
             <div className="absolute inset-0 opacity-20" style={{ 
                 backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
             }}></div>
             
             {/* Offline Icon */}
             <div className="z-10 bg-gray-900/80 p-4 rounded-full border border-gray-800 mb-3 backdrop-blur-sm">
                {hasError ? <CameraOff className="w-8 h-8 text-amber-500" /> : <WifiOff className="w-8 h-8 text-rose-500" />}
             </div>
             
             <div className="z-10 text-center">
                 <span className={`block text-lg font-bold tracking-widest ${hasError ? 'text-amber-500' : 'text-rose-500'}`}>
                    {hasError ? 'DEVICE ERROR' : 'NO SIGNAL'}
                 </span>
                 <span className="text-[10px] font-mono text-gray-500 mt-1 block">
                    {hasError ? 'HARDWARE_FAILURE_0x4' : 'NETWORK_TIMEOUT_503'}
                 </span>
             </div>
             
             {/* Diagonal Stripes Overlay */}
             <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #222 10px, #222 20px)' }}></div>
          </div>
        ) : camera.type === CameraType.WEBCAM ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-[1.02]" // slight scale to hide edges
          />
        ) : (
          <img 
            ref={videoRef as any}
            src={camera.sourceUrl} 
            className="w-full h-full object-cover opacity-90"
            alt={camera.name}
            crossOrigin="anonymous"
          />
        )}
        
        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Indicator (Bottom Left) */}
        {!isSignalLost && (
             <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/60 border border-emerald-500/20 backdrop-blur-sm">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-emerald-500/90 tracking-wider">LIVE</span>
             </div>
        )}

        {/* Scanning Overlay Effect */}
        {isAnalyzing && !isSignalLost && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute inset-x-0 h-0.5 bg-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,1)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
            <div className="absolute inset-0 bg-cyan-500/5 mix-blend-screen"></div>
          </div>
        )}
      </div>

      {/* --- FOOTER: ANALYSIS --- */}
      <div className="bg-gray-900 border-t border-gray-800 p-2.5 flex justify-between items-center h-[50px]">
        <div className="flex-1 mr-2 min-w-0">
             {!isSignalLost && camera.lastAnalysis ? (
                 <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border border-white/5 ${getThreatColor(camera.lastAnalysis.threatLevel)}`}>
                         {camera.lastAnalysis.threatLevel}
                       </span>
                       <span className="text-[10px] text-gray-400 truncate">
                         {camera.lastAnalysis.anomalies.length > 0 ? camera.lastAnalysis.anomalies[0] : camera.lastAnalysis.summary}
                       </span>
                    </div>
                 </div>
             ) : (
                 <div className="flex items-center gap-2 opacity-50">
                    <Activity size={12} className="text-gray-500" />
                    <span className="text-[10px] text-gray-500 italic">
                        {isSignalLost ? 'System Offline' : 'Waiting for analysis...'}
                    </span>
                 </div>
             )}
        </div>
        
        <button 
          onClick={handleManualAnalyze}
          disabled={isAnalyzing || isSignalLost}
          className={`shrink-0 pointer-events-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed group/btn ${
            isAnalyzing 
            ? 'bg-cyan-950 text-cyan-400 border border-cyan-900' 
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600'
          }`}
        >
          {isAnalyzing ? (
            <Zap className="w-3 h-3 animate-pulse" />
          ) : (
            <ShieldCheck className="w-3 h-3 group-hover/btn:text-cyan-400" />
          )}
          {isAnalyzing ? 'SCANNING' : 'SCAN'}
        </button>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraUnit;