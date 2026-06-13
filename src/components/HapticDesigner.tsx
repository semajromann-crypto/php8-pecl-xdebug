import React, { useState, useRef, useEffect } from "react";
import { SoundPreset } from "../types";
import { Smartphone, Activity, Play, RefreshCw, Fingerprint, Award, Layers } from "lucide-react";

interface HapticDesignerProps {
  presets: SoundPreset[];
  onUpdatePresets: (updated: SoundPreset[]) => void;
  activePreset: SoundPreset | null;
  onSelectPreset: (preset: SoundPreset) => void;
}

export default function HapticDesigner({
  presets,
  onUpdatePresets,
  activePreset,
  onSelectPreset,
}: HapticDesignerProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || "");
  const [isVibratingSim, setIsVibratingSim] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPattern, setRecordedPattern] = useState<number[]>([]);
  
  const timeoutsRef = useRef<any[]>([]);
  const tapStartTimeRef = useRef<number>(0);
  const lastReleaseTimeRef = useRef<number>(0);
  const recordingPatternRef = useRef<number[]>([]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearVibrationTimeouts();
    };
  }, []);

  const clearVibrationTimeouts = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const handleSelectPresetId = (id: string) => {
    setSelectedPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      onSelectPreset(preset);
    }
  };

  const currentPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];

  // Triggers real phone vibration and starts synced visual mock animation
  const testVibrationPattern = (pattern: number[]) => {
    clearVibrationTimeouts();
    setIsVibratingSim(false);

    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }

    let accumulatedTime = 0;
    pattern.forEach((duration, idx) => {
      const isActiveBuzz = idx % 2 === 0;

      const t = setTimeout(() => {
        setIsVibratingSim(isActiveBuzz);
      }, accumulatedTime);

      timeoutsRef.current.push(t);
      accumulatedTime += duration;
    });

    // Final cleanup timeout to turn off vibration styling
    const finalT = setTimeout(() => {
      setIsVibratingSim(false);
    }, accumulatedTime);
    timeoutsRef.current.push(finalT);
  };

  // Custom Pattern Tap-to-Record Engine
  const startRecordingPattern = () => {
    setIsRecording(true);
    setRecordedPattern([]);
    recordingPatternRef.current = [];
    tapStartTimeRef.current = 0;
    lastReleaseTimeRef.current = 0;
  };

  const stopRecordingPattern = () => {
    setIsRecording(false);
    if (recordingPatternRef.current.length > 0) {
      // Ensure it ends on a completed note
      if (recordingPatternRef.current.length % 2 === 0) {
        recordingPatternRef.current.pop(); // Remove trailing raw gap marker
      }
      setRecordedPattern([...recordingPatternRef.current]);
    }
  };

  const handleTapPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isRecording) return;

    if (navigator.vibrate) {
      navigator.vibrate(100); // Give a quick real tick
    }
    setIsVibratingSim(true);

    const now = Date.now();
    if (tapStartTimeRef.current === 0) {
      // First tap initialization
      tapStartTimeRef.current = now;
    } else {
      // It is a subsequent tap. Calculate the quiet releasegap time first
      const gap = now - lastReleaseTimeRef.current;
      recordingPatternRef.current.push(Math.min(1500, Math.max(50, gap)));
      tapStartTimeRef.current = now;
    }
  };

  const handleTapRelease = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isRecording) return;

    setIsVibratingSim(false);
    const now = Date.now();
    const duration = now - tapStartTimeRef.current;
    
    // Add active buzz duration
    recordingPatternRef.current.push(Math.min(2000, Math.max(50, duration)));
    lastReleaseTimeRef.current = now;

    // Trigger update of recorded list
    setRecordedPattern([...recordingPatternRef.current]);
  };

  const applyRecordedPattern = () => {
    if (recordedPattern.length === 0) return;

    const updated = presets.map((p) => {
      if (p.id === currentPreset.id) {
        return {
          ...p,
          vibrationPattern: [...recordedPattern],
          hapticSignature: "Custom Pattern"
        };
      }
      return p;
    });

    onUpdatePresets(updated);
    setRecordedPattern([]);
    // Auto select & test the new pattern
    const updatedPreset = updated.find((p) => p.id === currentPreset.id);
    if (updatedPreset) {
      onSelectPreset(updatedPreset);
      testVibrationPattern(updatedPreset.vibrationPattern);
    }
  };

  const updateColorTheme = (color: string) => {
    const updated = presets.map((p) => {
      if (p.id === currentPreset.id) {
        return { ...p, visualColor: color };
      }
      return p;
    });
    onUpdatePresets(updated);
    const updatedPreset = updated.find((p) => p.id === currentPreset.id);
    if (updatedPreset) onSelectPreset(updatedPreset);
  };

  const updatePresetDescription = (text: string) => {
    const updated = presets.map((p) => {
      if (p.id === currentPreset.id) {
        return { ...p, descriptionText: text };
      }
      return p;
    });
    onUpdatePresets(updated);
  };

  const getThemeColorClass = (color: string) => {
    switch (color) {
      case "red":
        return "bg-red-500 text-red-100 ring-red-400";
      case "yellow":
        return "bg-yellow-500 text-yellow-950 ring-yellow-400";
      case "blue":
        return "bg-blue-500 text-blue-100 ring-blue-400";
      case "green":
        return "bg-emerald-500 text-emerald-100 ring-emerald-400";
      case "purple":
        return "bg-purple-500 text-purple-100 ring-purple-400";
      default:
        return "bg-slate-500 text-slate-100 ring-slate-400";
    }
  };

  const getGlowShadowClass = (color: string) => {
    switch (color) {
      case "red":
        return "shadow-[0_0_35px_rgba(239,68,68,0.7)] border-red-500";
      case "yellow":
        return "shadow-[0_0_35px_rgba(234,179,8,0.7)] border-yellow-500";
      case "blue":
        return "shadow-[0_0_35px_rgba(59,130,246,0.7)] border-blue-500";
      case "green":
        return "shadow-[0_0_35px_rgba(16,185,129,0.7)] border-emerald-500";
      case "purple":
        return "shadow-[0_0_35px_rgba(168,85,247,0.7)] border-purple-500";
      default:
        return "shadow-[0_0_20px_rgba(148,163,184,0.4)] border-slate-500";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6" id="haptic-designer-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            Tactile Signatures Studio
          </h2>
          <p className="text-slate-400 text-xs">
            Design unique physical vibration signatures and blinking colors for various environmental alarms.
          </p>
        </div>

        <select
          value={selectedPresetId}
          onChange={(e) => handleSelectPresetId(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.soundName} ({preset.dangerLevel.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Editor & Tester */}
        <div className="space-y-5">
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-widest">
                Current Earcon Profile
              </span>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-semibold ${
                currentPreset.dangerLevel === "high"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : currentPreset.dangerLevel === "medium"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}>
                {currentPreset.dangerLevel} alert
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                {currentPreset.soundName}
              </h3>
              <input
                type="text"
                value={currentPreset.descriptionText}
                onChange={(e) => updatePresetDescription(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 mt-2 focus:outline-none focus:ring-1 focus:ring-slate-700 font-sans"
                placeholder="Brief sensory description"
              />
            </div>

            {/* Pattern numbers viz */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono font-medium text-slate-500 uppercase">
                <span>Vibrate sequences (ms)</span>
                <span>Type: {currentPreset.hapticSignature}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentPreset.vibrationPattern.map((time, idx) => (
                  <span
                    key={idx}
                    className={`font-mono text-center text-xs px-2 py-1 rounded ${
                      idx % 2 === 0
                        ? "bg-indigo-505/20 text-indigo-300 border border-indigo-500/30"
                        : "bg-slate-900 text-slate-500 border border-slate-800"
                    }`}
                  >
                    {idx % 2 === 0 ? "⚡" : "💤"} {time}ms
                  </span>
                ))}
              </div>
            </div>

            {/* Visual hue blinking selector */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest">
                Assigned Warning Light Indicator
              </span>
              <div className="flex items-center space-x-3.5">
                {["red", "yellow", "blue", "green", "purple"].map((col) => (
                  <button
                    key={col}
                    onClick={() => updateColorTheme(col)}
                    className={`w-6 h-6 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                      currentPreset.visualColor === col
                        ? "ring-4 scale-110 " + getThemeColorClass(col)
                        : "bg-slate-800 hover:scale-105"
                    }`}
                    style={
                      currentPreset.visualColor !== col
                        ? { backgroundColor: col === "yellow" ? "#eab308" : col }
                        : {}
                    }
                  >
                    {currentPreset.visualColor === col && (
                      <span className="text-[9px] font-bold">✔</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Tap Composer */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                Tap Pattern Composer
              </span>
              {isRecording ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  RECORDING
                </span>
              ) : (
                <button
                  onClick={startRecordingPattern}
                  className="bg-indigo-650/80 hover:bg-indigo-600 text-indigo-100 font-sans text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-all cursor-pointer"
                >
                  Custom Record
                </button>
              )}
            </div>

            {isRecording ? (
              <div className="space-y-4">
                <button
                  onMouseDown={handleTapPress}
                  onMouseUp={handleTapRelease}
                  onTouchStart={handleTapPress}
                  onTouchEnd={handleTapRelease}
                  className="w-full aspect-[4/1.2] bg-slate-900 active:bg-indigo-950/80 rounded-2xl border-2 border-dashed border-indigo-500 flex items-center justify-center text-sm font-semibold select-none cursor-pointer transition-colors text-indigo-300"
                >
                  TAP AND HOLD HERE (RELEASE TO GAP)
                </button>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={stopRecordingPattern}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-red-100 text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Stop Recording
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recordedPattern.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300">
                      Composer finished with <span className="font-bold text-indigo-400">{Math.ceil(recordedPattern.length / 2)}</span> tactile segment cycles.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => testVibrationPattern(recordedPattern)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700"
                      >
                        <Play className="w-3.5 h-3.5" /> Replay Draft
                      </button>
                      <button
                        onClick={applyRecordedPattern}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-550 text-indigo-100 text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Apply to {currentPreset.soundName}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Use our tap feedback engine to manually orchestrate an alert pulse sequence tailored exactly to your touch limits.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Immersive Interactive Vibration Device Sandbox */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center space-y-6">
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-widest text-center">
            Earcon Pulse Simulator
          </span>

          {/* Glowing Animated Phone Frame Mockup */}
          <div
            className={`w-32 aspect-[1/2] rounded-[24px] border-4 bg-slate-900 flex flex-col p-4 relative transition-all duration-75 select-none ${
              isVibratingSim
                ? getGlowShadowClass(currentPreset.visualColor) + " scale-105 animate-[bounce_0.2s_infinite]"
                : "border-slate-800 shadow-xl"
            }`}
          >
            {/* Camera speaker notch */}
            <div className="w-12 h-3.5 bg-slate-950 rounded-full mx-auto mb-4 border border-slate-800 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            </div>

            {/* Simulated active screen flash glowing */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <Activity
                className={`w-10 h-10 transition-transform ${
                  isVibratingSim ? "text-slate-100 scale-125 animate-pulse" : "text-slate-700"
                }`}
              />
              <span className="text-[10px] font-mono font-bold tracking-widest text-center uppercase text-slate-500">
                {isVibratingSim ? "BUZZING" : "IDLE"}
              </span>
            </div>

            {/* Bottom button indicator */}
            <div className="w-7 h-7 bg-slate-950 rounded-full border border-slate-800 mx-auto mt-2 flex items-center justify-center" />
          </div>

          <div className="text-center space-y-2.5 max-w-xs">
            <button
              onClick={() => testVibrationPattern(currentPreset.vibrationPattern)}
              className="w-full bg-indigo-600 hover:bg-indigo-550 active:scale-95 text-indigo-100 font-semibold py-3 px-5 rounded-xl block transition-all shadow-md hover:shadow-indigo-500/20 cursor-pointer"
            >
              Simulate Earcon Alert Trigger
            </button>
            <p className="text-[10px] text-slate-500 leading-normal">
              Does not require native hardware engine on desktop. The simulator visualizes the custom temporal delays safely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
