import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, ShieldAlert, Wifi, Sparkles } from "lucide-react";

interface AudioVisualizerProps {
  isActive: boolean;
  sensitivityThreshold: number; // 0 to 100
  onThresholdExceeded: (volume: number) => void;
  onListeningStateChange: (listening: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onPitchChange?: (pitch: { low: number; mid: number; high: number }) => void;
}

export default function AudioVisualizer({
  isActive,
  sensitivityThreshold,
  onThresholdExceeded,
  onListeningStateChange,
  onVolumeChange,
  onPitchChange,
}: AudioVisualizerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [pitchDetails, setPitchDetails] = useState({ low: 30, mid: 40, high: 30 });
  const [usingSimulation, setUsingSimulation] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastThresholdTriggerRef = useRef<number>(0);

  // Initialize or terminate microphone capture based on isActive parameter
  useEffect(() => {
    if (isActive) {
      startMicrophone();
    } else {
      stopMicrophone();
    }
    return () => {
      stopMicrophone();
    };
  }, [isActive]);

  const startMicrophone = async () => {
    try {
      stopMicrophone();
      setUsingSimulation(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setHasPermission(true);
      onListeningStateChange(true);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      // Start the canvas rendering loop
      renderVisualsRealtime(true);
    } catch (err) {
      console.warn("Could not initiate real microphone input, entering clean simulation sandbox model: ", err);
      setHasPermission(false);
      setUsingSimulation(true);
      onListeningStateChange(true);
      // Fallback: draw with simulation
      renderVisualsRealtime(false);
    }
  };

  const stopMicrophone = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    onListeningStateChange(false);
    setCurrentVolume(0);
  };

  // The primary rendering animation frame loop
  const renderVisualsRealtime = (useRealMic: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let simTime = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Highly clean styling theme
      ctx.clearRect(0, 0, width, height);

      let volume = 0;
      let lowFreq = 0;
      let midFreq = 0;
      let highFreq = 0;

      if (useRealMic && analyserRef.current && dataArrayRef.current) {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        analyser.getByteFrequencyData(dataArray);

        // Calculate Average Volume/Decibel and frequencies
        let sum = 0;
        const totalSamples = dataArray.length;

        for (let i = 0; i < totalSamples; i++) {
          const val = dataArray[i];
          sum += val;

          // Split samples roughly into low, mid, and high bands
          if (i < totalSamples * 0.25) {
            lowFreq += val;
          } else if (i < totalSamples * 0.7) {
            midFreq += val;
          } else {
            highFreq += val;
          }
        }

        const avgVal = sum / totalSamples;
        // Normalize the volumetric level (0 to 100)
        volume = Math.min(100, Math.floor((avgVal / 255) * 100 * 1.5));

        // Normalize frequencies
        const totalFreqSum = lowFreq + midFreq + highFreq || 1;
        lowFreq = Math.round((lowFreq / totalFreqSum) * 100);
        midFreq = Math.round((midFreq / totalFreqSum) * 100);
        highFreq = Math.round((highFreq / totalFreqSum) * 100);

        setCurrentVolume(volume);
        setPitchDetails({ low: lowFreq, mid: midFreq, high: highFreq });
        onVolumeChange?.(volume);
        onPitchChange?.({ low: lowFreq, mid: midFreq, high: highFreq });

        // Draw dynamic high contrast soundwave bars
        const barWidth = (width / totalSamples) * 1.5;
        let x = 0;

        for (let i = 0; i < totalSamples / 1.5; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = Math.max(4, percent * height * 0.85);

          // Hue shifts elegantly from teal -> indigo depending on frequency
          const hue = 180 + (i / (totalSamples / 1.5)) * 100;
          ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.85)`;

          // Rounded bars for architectural aesthetics
          const yPos = (height - barHeight) / 2;
          ctx.beginPath();
          ctx.roundRect(x, yPos, barWidth - 2, barHeight, 4);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // Render stylized wave patterns for simulation mode
        simTime += 0.05;

        // Generate dynamic fluctuation peaks over time to look like environmental speech
        const ambientFluctuation = Math.sin(simTime * 0.3) * Math.cos(simTime * 0.7);
        const baseVol = 8 + Math.max(0, ambientFluctuation * 18);
        const randomSpike = Math.random() > 0.98 ? Math.random() * 45 : 0;
        volume = Math.round(baseVol + randomSpike);
        setCurrentVolume(volume);

        // Static balanced low, mid, high distribution
        lowFreq = Math.round(35 + Math.sin(simTime) * 10);
        midFreq = Math.round(45 + Math.cos(simTime * 0.8) * 8);
        highFreq = 100 - lowFreq - midFreq;
        setPitchDetails({ low: lowFreq, mid: midFreq, high: highFreq });
        onVolumeChange?.(volume);
        onPitchChange?.({ low: lowFreq, mid: midFreq, high: highFreq });

        // Draw dual flowing architectural sine waves (layered ambient UI styling)
        ctx.lineWidth = 3;

        // Wave Layer 1
        ctx.beginPath();
        ctx.strokeStyle = "rgba(45, 212, 191, 0.6)"; // Soft teal
        for (let x = 0; x < width; x++) {
          const y =
            height / 2 +
            Math.sin(x * 0.01 + simTime) * (15 + volume * 0.5) +
            Math.cos(x * 0.02 - simTime * 0.5) * 8;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Wave Layer 2
        ctx.beginPath();
        ctx.strokeStyle = "rgba(99, 102, 241, 0.45)"; // Soft indigo
        for (let x = 0; x < width; x++) {
          const y =
            height / 2 +
            Math.sin(x * 0.015 - simTime * 1.2) * (10 + volume * 0.4) +
            Math.sin(x * 0.005 + simTime * 0.8) * 15;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Check sensitivity threshold
      // Sensitivity limit is 0-100.
      if (volume >= sensitivityThreshold) {
        const now = Date.now();
        // Debounce alert dispatching (minimum 3 seconds between alerts to prevent notification storm)
        if (now - lastThresholdTriggerRef.current > 3000) {
          lastThresholdTriggerRef.current = now;
          onThresholdExceeded(volume);
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5" id="visualizer-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <span className={`absolute -top-1 -right-1 flex h-3.5 w-3.5`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${usingSimulation ? "bg-amber-400" : "bg-teal-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${usingSimulation ? "bg-amber-500" : "bg-teal-500"}`}></span>
            </span>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              {usingSimulation ? (
                <MicOff className="w-5 h-5 text-amber-400" />
              ) : (
                <Mic className="w-5 h-5 text-teal-400" />
              )}
            </div>
          </div>
          <div>
            <h3 className="font-sans font-semibold text-slate-100 tracking-tight text-sm md:text-base">
              {usingSimulation ? "Simulator Stream Mode" : "Real-time Live Audio Ear"}
            </h3>
            <p className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-slate-500" />
              {usingSimulation
                ? "Ambient flow active (Connect mic)"
                : "Active micro-decibel listener"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="text-xs font-mono font-medium text-slate-400 tracking-wider uppercase mb-1">
            Environment Gain
          </div>
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-lg font-bold text-slate-100 w-12 text-right">
              {currentVolume}%
            </span>
          </div>
        </div>
      </div>

      {/* Render Canvas Visualizer */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 h-36">
        <canvas
          ref={canvasRef}
          width={640}
          height={144}
          className="w-full h-full block"
          id="canvas-frequency-scope"
        />

        {/* Dynamic Warning overlay when threshold is crossed */}
        {currentVolume >= sensitivityThreshold && (
          <div className="absolute inset-0 bg-red-950/20 border border-red-500/30 flex items-center justify-center pointer-events-none animate-pulse">
            <div className="bg-red-900/90 text-red-100 font-sans text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-2 border border-red-700/50 shadow-lg">
              <ShieldAlert className="w-4 h-4 text-red-200 animate-bounce" />
              LOUD DECIBLE DETECTED &gt; {sensitivityThreshold}%
            </div>
          </div>
        )}
      </div>

      {/* Pitch analytics counters (essential sensory details mapping) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] font-mono font-medium text-cyan-400 uppercase tracking-widest mb-1">
            Low Pitch
          </span>
          <span className="text-sm font-semibold text-slate-200 font-mono">
            {pitchDetails.low}%
          </span>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-300"
              style={{ width: `${pitchDetails.low}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] font-mono font-medium text-teal-400 uppercase tracking-widest mb-1">
            Medium Mid
          </span>
          <span className="text-sm font-semibold text-slate-200 font-mono">
            {pitchDetails.mid}%
          </span>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-teal-400 h-full transition-all duration-300"
              style={{ width: `${pitchDetails.mid}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] font-mono font-medium text-pink-400 uppercase tracking-widest mb-1">
            High Pitch
          </span>
          <span className="text-sm font-semibold text-slate-200 font-mono">
            {pitchDetails.high}%
          </span>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-pink-400 h-full transition-all duration-300"
              style={{ width: `${pitchDetails.high}%` }}
            />
          </div>
        </div>
      </div>

      {/* Manual Start Banner if Denied Permission */}
      {hasPermission === false && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-400">Microphone input denied or unavailable.</span>
            {" We've switched back to an environmental simulation engine. Make sure to allow microphone permission for real ambient alerts."}
          </div>
        </div>
      )}
    </div>
  );
}
