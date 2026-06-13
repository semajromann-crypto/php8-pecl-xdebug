import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Compass, Disc, RefreshCw, Volume2, ShieldAlert, Radio, HelpCircle, Eye } from "lucide-react";

interface ARLocatorFeedProps {
  micVolume: number;
  pitchFrequencies: { low: number; mid: number; high: number };
}

interface SoundTarget {
  id: string;
  angle: number;       // Radar representation angle in degrees
  distance: number;    // Normalized distance from center (0 to 100)
  size: number;
  color: string;
  soundName: string;
  intensity: number;
  timestamp: string;
  pingAge: number;     // Decays over time
}

export default function ARLocatorFeed({ micVolume, pitchFrequencies }: ARLocatorFeedProps) {
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const [cameraHasPermission, setCameraHasPermission] = useState<boolean | null>(null);
  const [radarTargets, setRadarTargets] = useState<SoundTarget[]>([]);
  const [radarSweepAngle, setRadarSweepAngle] = useState<number>(0);
  const [pingerMode, setPingerMode] = useState<"radar" | "hud">("radar");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const radarIntervalRef = useRef<any>(null);

  // Auto trigger a ping whenever the mic volume spikes
  useEffect(() => {
    if (micVolume > 35) {
      // Calculate where to place the sound on the circle depending on low vs high frequency distribution!
      // High pitch -> top (around 0/360 degrees)
      // Mid pitch -> right (around 90 degrees)
      // Low pitch -> left (around 270 degrees)
      const biasLow = pitchFrequencies.low;
      const biasHigh = pitchFrequencies.high;
      const biasMid = pitchFrequencies.mid;

      let angle = 0;
      if (biasHigh > biasLow && biasHigh > biasMid) {
        angle = Math.floor(330 + Math.random() * 60) % 360; // top
      } else if (biasMid > biasLow) {
        angle = Math.floor(60 + Math.random() * 90); // right side
      } else {
        angle = Math.floor(180 + Math.random() * 90); // left side
      }

      const id = Math.random().toString(36).substr(2, 5);
      const intensity = micVolume;
      const primaryColors = ["#ef4444", "#eab308", "#3b82f6", "#10b981", "#a855f7"];
      const randomColor = primaryColors[Math.floor(Math.random() * primaryColors.length)];

      const freshTarget: SoundTarget = {
        id,
        angle,
        distance: Math.max(30, 100 - micVolume), // Closer means louder
        size: Math.max(10, Math.floor(micVolume * 0.4)),
        color: randomColor,
        soundName: micVolume > 65 ? "High Decibel Spike" : "Ambient sound alert",
        intensity,
        timestamp: new Date().toLocaleTimeString(),
        pingAge: 1.0, // Decay start
      };

      setRadarTargets((prev) => [freshTarget, ...prev.slice(0, 5)]);

      // Audio feedback pinger sound beep! Uses sound synthesis to make a sweet sonar echo sound
      playSonarSynthBeep(pitchFrequencies.high > 50 ? 980 : 540, micVolume / 100);
    }
  }, [micVolume, pitchFrequencies]);

  // Rotates the radar sweeps in a separate clean client-side loop
  useEffect(() => {
    radarIntervalRef.current = setInterval(() => {
      setRadarSweepAngle((prev) => (prev + 3) % 360);

      // Gracefully decay ages of existing radar targets so they fade out beautifully
      setRadarTargets((prev) =>
        prev
          .map((target) => ({
            ...target,
            pingAge: target.pingAge - 0.04,
          }))
          .filter((target) => target.pingAge > 0)
      );
    }, 50);

    return () => {
      if (radarIntervalRef.current) clearInterval(radarIntervalRef.current);
    };
  }, []);

  const startCamera = async () => {
    try {
      if (streamRef.current) stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false, // Avoid internal resonance loops
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraHasPermission(true);
      setUseCamera(true);
    } catch (err) {
      console.warn("Could not activate client camera feed: ", err);
      setCameraHasPermission(false);
      setUseCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setUseCamera(false);
  };

  const toggleCameraState = () => {
    if (useCamera) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Sonar sound generator using standard Web Audio oscillator (perfect for sensory identification)
  const playSonarSynthBeep = (freq: number, gainValue: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      // Sweeping exponential frequency decline to make a gorgeous 'sonar down-sweep ping' sound
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6);

      gainNode.gain.setValueAtTime(Math.min(0.25, gainValue * 0.35), ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch (e) {
      // Audio autoplay restrictions might block this on first turn, fail gracefully
    }
  };

  // Compute 2D pixel offsets for circular radar display targets
  const getRadarCoords = (angle: number, distancePercentage: number, centerX: number, centerY: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180); // convert to radians and offset to match top clock zero direction
    const radius = (centerX * 0.82) * (distancePercentage / 100);
    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY + radius * Math.sin(angleRad);
    return { x, y };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5" id="pinger-sound-detector">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-sans font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-teal-400 animate-pulse" />
            Visual Sonar &amp; Pinger HUD
          </h2>
          <p className="text-slate-400 text-xs text-left">
            Real-time direction map tracking, audio beacon echoes, and live camera feed with sound HUD overlay constraints.
          </p>
        </div>

        <div className="flex border border-slate-800 bg-slate-950 p-1 rounded-xl items-center gap-1 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setPingerMode("radar")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              pingerMode === "radar" ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Tactical Sonar
          </button>
          <button
            onClick={() => setPingerMode("hud")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              pingerMode === "hud" ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Camera HUD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Sonar Canvas Visualizer Grid Area */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-850 p-4 shrink-0 flex items-center justify-center min-h-[300px] relative overflow-hidden select-none">
          {pingerMode === "radar" ? (
            /* RENDER SONAR POLAR VIEW SCREEN */
            <div className="relative w-72 h-72 rounded-full border border-teal-900/30 bg-slate-950 flex items-center justify-center p-3 animate-fade-in my-2">
              {/* Concentric reference distance sound target rings */}
              <div className="absolute w-[80%] h-[80%] rounded-full border border-dashed border-teal-900/40 pointer-events-none" />
              <div className="absolute w-[55%] h-[55%] rounded-full border border-teal-900/30 pointer-events-none" />
              <div className="absolute w-[30%] h-[30%] rounded-full border border-dashed border-teal-900/25 pointer-events-none" />

              {/* Angle axis degree labels */}
              <div className="absolute top-2 font-mono text-[9px] text-teal-600/70 select-none">0° HIGH</div>
              <div className="absolute right-2 font-mono text-[9px] text-teal-600/70 select-none">90° MID</div>
              <div className="absolute bottom-2 font-mono text-[9px] text-teal-600/70 select-none">180° LOW</div>
              <div className="absolute left-2 font-mono text-[9px] text-teal-600/70 select-none">270° MID</div>

              {/* Sonar sweep overlay element in motion */}
              <div
                className="absolute inset-0 rounded-full transition-transform duration-75 pointer-events-none"
                style={{
                  transform: `rotate(${radarSweepAngle}deg)`,
                  background: `conic-gradient(from 0deg, rgba(20, 184, 166, 0.22) 0%, rgba(20, 184, 166, 0.0) 45%)`,
                }}
              />

              {/* Dynamic Sound Pings displaying on sonar radar surface */}
              {radarTargets.map((target) => {
                const coords = getRadarCoords(target.angle, target.distance, 144, 144);
                return (
                  <div
                    key={target.id}
                    className="absolute rounded-full flex items-center justify-center duration-150"
                    style={{
                      left: `${coords.x}px`,
                      top: `${coords.y}px`,
                      width: `${target.size + 14}px`,
                      height: `${target.size + 14}px`,
                      transform: "translate(-50%, -50%)",
                      opacity: target.pingAge,
                    }}
                  >
                    {/* Ring ripple */}
                    <span
                      className="absolute inset-0 rounded-full animate-ping border opacity-75"
                      style={{ borderColor: target.color }}
                    />
                    {/* Glowing solid ping core dot */}
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block shadow-lg"
                      style={{
                        backgroundColor: target.color,
                        boxShadow: `0 0 15px ${target.color}`,
                      }}
                    />
                    {/* Floating brief label helper tag below item */}
                    <span className="absolute -bottom-4 text-[9px] font-mono text-teal-400 font-bold tracking-tight bg-slate-950/90 px-1 rounded-sm border border-slate-800 whitespace-nowrap">
                      PING {target.intensity}%
                    </span>
                  </div>
                );
              })}

              {/* Center blinking target receptor (current user position) */}
              <div className="w-5 h-5 rounded-full bg-slate-900 border-2 border-teal-400 flex items-center justify-center shadow-lg relative z-20">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping absolute" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              </div>
            </div>
          ) : (
            /* RENDER LIVE CAMERA VIDEO STREAM HUD COVERAGE OVERLAY */
            <div className="w-full h-full min-h-[300px] flex items-center justify-center relative bg-slate-950 select-none">
              {useCamera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover rounded-xl scale-x-[-1]"
                  id="ar-locator-video"
                />
              ) : (
                /* Cinematic AR Camera placeholder overlay */
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-950/90 border-2 border-dashed border-slate-800 rounded-xl">
                  <CameraOff className="w-10 h-10 text-slate-700 animate-pulse" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-400">Live Video Feed Offline</p>
                    <p className="text-[10px] text-slate-600 max-w-xs px-4">
                      Enable augmented reality sound locator HUD overlay by activating your device webcam stream.
                    </p>
                  </div>
                  <button
                    onClick={toggleCameraState}
                    className="bg-indigo-650/80 hover:bg-indigo-650 text-indigo-100 text-xs px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all cursor-pointer font-sans"
                  >
                    Enable Camera
                  </button>
                </div>
              )}

              {/* Camera Overlaid Heads Up Display (HUD) System */}
              {useCamera && (
                <div className="absolute inset-0 flex flex-col justify-between p-4 bg-slate-950/20 pointer-events-none border border-teal-500/10 rounded-xl z-20">
                  <div className="flex justify-between items-start">
                    <div className="bg-slate-950/90 border border-teal-500/30 p-2.5 rounded-xl text-teal-400 font-mono text-[10px] flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-teal-400 animate-spin-slow" />
                      <span>AR LOCATOR STATUS: ACTIVE</span>
                    </div>

                    <button
                      onClick={toggleCameraState}
                      className="bg-red-950/90 hover:bg-red-900 border border-red-800 text-red-200 pointer-events-auto p-2 rounded-lg transition-all text-[10px] font-sans flex items-center gap-1"
                    >
                      Disable Cam
                    </button>
                  </div>

                  {/* Concentric overlay HUD target rings that expand dynamically with micVolume! */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div
                      className="rounded-full border-2 border-teal-400/40 transition-all flex items-center justify-center shadow-inner"
                      style={{
                        width: `${110 + micVolume * 1.5}px`,
                        height: `${110 + micVolume * 1.5}px`,
                        borderColor: micVolume > 65 ? "#ef4444" : "#2dd4bf",
                        backgroundColor: micVolume > 65 ? "rgba(239, 68, 68, 0.05)" : "transparent",
                      }}
                    >
                      <div className="w-10 h-10 rounded-full border border-teal-400/20 flex items-center justify-center">
                        <Disc className={`w-3 h-3 text-teal-400 ${micVolume > 20 ? "animate-pulse" : ""}`} />
                      </div>
                    </div>
                  </div>

                  {/* Bottom tracking coordinates */}
                  <div className="flex justify-between items-end">
                    <div className="bg-slate-950/90 border border-dashed border-slate-700 p-2 rounded-xl text-slate-400 font-mono text-[9px] flex flex-col">
                      <span>MIC AMPLITUDE: {micVolume}%</span>
                      <span>FREQ SHIFT: L:{pitchFrequencies.low} M:{pitchFrequencies.mid} H:{pitchFrequencies.high}</span>
                    </div>

                    {micVolume > 50 && (
                      <div className="bg-red-550 text-white font-bold text-xs px-3 py-1 rounded-lg animate-bounce mr-2">
                        PEAK HAZARD DECTECTED
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-time Target Events List & Description */}
        <div className="lg:col-span-4 bg-slate-950 rounded-2xl border border-slate-850 p-4 shrink-0 flex flex-col justify-between min-h-[300px]">
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <h3 className="text-xs font-mono font-medium text-teal-400 uppercase tracking-widest border-b border-slate-900 pb-2">
              Sonar Detections Feed
            </h3>

            {radarTargets.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Radio className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-[11px] font-sans">Awaiting acoustical frequencies...</p>
                <p className="text-[9px] text-slate-650 px-2 leading-relaxed">
                  Make high-frequency clicks (like a pen tap or beeper clock) to view pings populate instantly on the radar scope coordinates.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                {radarTargets.map((target) => (
                  <div
                    key={target.id}
                    onClick={() => playSonarSynthBeep(target.angle * 2 + 100, target.intensity / 100)}
                    className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl flex items-center justify-between gap-2.5 transition-all hover:border-slate-700 cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: target.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-205 truncate">
                          {target.angle}° Sound Echo
                        </p>
                        <p className="text-[9px] font-mono text-slate-505 truncate">
                          High: {pitchFrequencies.high}% | {target.timestamp}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-teal-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      -{Math.round(target.distance)}dB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-900 mt-2">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-850/50 flex items-start gap-2">
              <Eye className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-normal">
                **Pinger Sound Detection**: Synthesizes custom sweep waves to simulate sonar reflection. High-frequency click alarms map to top polar markers directly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
