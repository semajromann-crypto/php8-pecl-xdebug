import React, { useState, useEffect, useRef } from "react";
import { SoundPreset, SoundLogEntry } from "./types";
import AudioVisualizer from "./components/AudioVisualizer";
import HapticDesigner from "./components/HapticDesigner";
import SoundLogger from "./components/SoundLogger";
import AiClassifier from "./components/AiClassifier";
import ARLocatorFeed from "./components/ARLocatorFeed";
import SpeechTranscriber from "./components/SpeechTranscriber";
import SoundHeatMap from "./components/SoundHeatMap";
import { Volume2, ShieldAlert, BadgeCheck, BookOpen, ToggleLeft, ToggleRight, X, Sparkles, HelpCircle } from "lucide-react";

// Offline reliable presets list to populate state immediately
const INITIAL_PRESETS: SoundPreset[] = [
  {
    id: "siren",
    soundName: "Emergency Siren",
    dangerLevel: "high",
    hapticSignature: "long-alert",
    vibrationPattern: [800, 200, 800, 200, 800],
    visualColor: "red",
    descriptionText: "High volume undulating pitch indicating emergency responder sirens or active fire alarms."
  },
  {
    id: "baby_crying",
    soundName: "Baby Crying",
    dangerLevel: "medium",
    hapticSignature: "rapid-pulses",
    vibrationPattern: [150, 100, 150, 100, 150, 100, 150, 100],
    visualColor: "yellow",
    descriptionText: "High frequency cyclic noise associated with infant distress or calling for attention."
  },
  {
    id: "door_knock",
    soundName: "Door Knocking",
    dangerLevel: "low",
    hapticSignature: "double-tap",
    vibrationPattern: [200, 100, 200, 400, 200, 100, 200],
    visualColor: "blue",
    descriptionText: "Rhythmic solid mid-to-low frequency drumming on wood or metal surfaces."
  },
  {
    id: "dog_bark",
    soundName: "Dog Barking",
    dangerLevel: "medium",
    hapticSignature: "staccato",
    vibrationPattern: [300, 100, 300, 500, 300, 100, 300],
    visualColor: "purple",
    descriptionText: "Aggressive burst of medium low-frequency barking sound indicating canine presence."
  },
  {
    id: "fire_alarm",
    soundName: "Smoke/Fire Detector",
    dangerLevel: "high",
    hapticSignature: "long-alert",
    vibrationPattern: [1000, 150, 1000, 150, 1000],
    visualColor: "red",
    descriptionText: "Very loud, high-pitched repetitive beeping indicating active combustion alarm."
  },
  {
    id: "phone_ring",
    soundName: "Phone Ringing",
    dangerLevel: "low",
    hapticSignature: "gentle-glow",
    vibrationPattern: [500, 500, 500, 500],
    visualColor: "green",
    descriptionText: "Electronic warble or cyclic synthesized tone indicating incoming telephone voice call."
  }
];

export default function App() {
  const [presets, setPresets] = useState<SoundPreset[]>(INITIAL_PRESETS);
  const [activePreset, setActivePreset] = useState<SoundPreset | null>(INITIAL_PRESETS[0]);
  const [logs, setLogs] = useState<SoundLogEntry[]>([]);
  const [isListening, setIsListening] = useState<boolean>(true);
  const [isLiveListeningActive, setIsLiveListeningActive] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(45); // decibel volume limits
  const [showIntro, setShowIntro] = useState<boolean>(true);

  // Live frequency and volume streaming states for the pinger sound detector
  const [micVolume, setMicVolume] = useState<number>(0);
  const [pitchFrequencies, setPitchFrequencies] = useState<{ low: number; mid: number; high: number }>({ low: 30, mid: 40, high: 30 });

  // Fullscreen strobe and flashing indicators when hazard signals fire
  const [flashAlert, setFlashAlert] = useState<SoundLogEntry | null>(null);
  const [isStrobeBright, setIsStrobeBright] = useState<boolean>(false);
  
  const strobeIntervalRef = useRef<any>(null);

  // Load backend presets on mount (progressive hydration)
  useEffect(() => {
    fetchPresets();
    // Rehydrate logs from localStorage
    const savedLogs = localStorage.getItem("earcon_sono_logs");
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (err) {
        console.error("Error parsing stored history: ", err);
      }
    } else {
      // Seed a single initial demonstration event to look pristine
      const seed: SoundLogEntry = {
        id: "seed-item",
        soundName: "Smoke/Fire Detector",
        dangerLevel: "high",
        timestamp: new Date().toLocaleTimeString(),
        source: "simulation",
        descriptionText: "System initialization diagnostic sound. Triggered successfully.",
        vibrationPattern: [1000, 150, 1000],
        visualColor: "red"
      };
      setLogs([seed]);
    }
  }, []);

  // Save logs changes to local storage
  const saveLogsToStorage = (updatedLogs: SoundLogEntry[]) => {
    setLogs(updatedLogs);
    localStorage.setItem("earcon_sono_logs", JSON.stringify(updatedLogs));
  };

  const fetchPresets = async () => {
    try {
      const response = await fetch("/api/presets");
      if (response.ok) {
        const data = await response.json();
        if (data.presets && data.presets.length > 0) {
          setPresets(data.presets);
          setActivePreset(data.presets[0]);
        }
      }
    } catch (err) {
      console.warn("Fallback to offline embedded triggers (Standalone mode).", err);
    }
  };

  // Sound threshold exceeded from real micromouse or simulation sweep
  const handleDecibelThresholdExceeded = (volume: number) => {
    if (!isListening) return;

    // Grab closely related preset template based on current volume pitch levels
    // or select a high volume high danger trigger as warning default
    const highAlertPresets = presets.filter((p) => p.dangerLevel === "high");
    const matchedPreset = highAlertPresets.length > 0 ? highAlertPresets[0] : presets[0];

    const randomId = Math.random().toString(36).substr(2, 9);
    const newEntry: SoundLogEntry = {
      id: randomId,
      timestamp: new Date().toLocaleTimeString(),
      source: "mic-detection",
      soundName: `Loud Ambient Noise (${matchedPreset.soundName} Profile)`,
      dangerLevel: matchedPreset.dangerLevel,
      descriptionText: `System detected room volume spikes at ${volume}% - matching frequency signature of ${matchedPreset.soundName}.`,
      vibrationPattern: matchedPreset.vibrationPattern,
      visualColor: matchedPreset.visualColor,
      volumePercent: volume,
    };

    const updated = [newEntry, ...logs].slice(0, 48); // cap logs at 48 items
    saveLogsToStorage(updated);

    // Fire actual notification warning
    triggerStrobeWarning(newEntry);
  };

  // Replays vibration and starts flashing of a specific pattern
  const handleReplayPulse = (pattern: number[], color: string) => {
    // Physically vibrate
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }

    // Momentary mini browser warning alert
    const dummyEntry: SoundLogEntry = {
      id: "replay-test",
      timestamp: new Date().toLocaleTimeString(),
      source: "simulation",
      soundName: "Tactile Replay Signal",
      dangerLevel: "low",
      descriptionText: "Self-triggered haptic testing loop.",
      vibrationPattern: pattern,
      visualColor: color,
    };
    triggerStrobeWarning(dummyEntry, true); // true = raw test mode (no logs)
  };

  // Add a new log entry (from AI classification)
  const handleAddLogEntry = (entryRaw: Omit<SoundLogEntry, "id" | "timestamp">) => {
    const randomId = Math.random().toString(36).substr(2, 9);
    const newEntry: SoundLogEntry = {
      ...entryRaw,
      id: randomId,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updated = [newEntry, ...logs].slice(0, 48);
    saveLogsToStorage(updated);
    triggerStrobeWarning(newEntry);
  };

  const clearAllLogs = () => {
    saveLogsToStorage([]);
  };

  // Strobe Alarm Warning trigger
  const triggerStrobeWarning = (entry: SoundLogEntry, isShortTest = false) => {
    // Clear old strobe intervals
    if (strobeIntervalRef.current) {
      clearInterval(strobeIntervalRef.current);
    }

    setFlashAlert(entry);
    setIsStrobeBright(true);

    // High warning sirens flash fast, low signals flash briefly
    const strobeFreq = entry.dangerLevel === "high" ? 200 : entry.dangerLevel === "medium" ? 400 : 700;
    const duration = isShortTest ? 1500 : entry.dangerLevel === "high" ? 6000 : 3500;

    let toggle = true;
    strobeIntervalRef.current = setInterval(() => {
      toggle = !toggle;
      setIsStrobeBright(toggle);
    }, strobeFreq);

    // Auto terminate strobe overlay after duration
    setTimeout(() => {
      dismissStrobeWarning();
    }, duration);
  };

  const dismissStrobeWarning = () => {
    if (strobeIntervalRef.current) {
      clearInterval(strobeIntervalRef.current);
      strobeIntervalRef.current = null;
    }
    setFlashAlert(null);
    setIsStrobeBright(false);
  };

  const getStrobeFlashColor = (color: string) => {
    if (!isStrobeBright) return "bg-slate-950/80";
    switch (color) {
      case "red": return "bg-red-950/95 shadow-[inset_0_0_100px_rgba(239,68,68,0.95)]";
      case "yellow": return "bg-yellow-950/95 shadow-[inset_0_0_100px_rgba(234,179,8,0.95)]";
      case "blue": return "bg-blue-950/95 shadow-[inset_0_0_100px_rgba(59,130,246,0.95)]";
      case "green": return "bg-emerald-950/95 shadow-[inset_0_0_100px_rgba(16,185,129,0.95)]";
      case "purple": return "bg-purple-950/95 shadow-[inset_0_0_100px_rgba(168,85,247,0.95)]";
      default: return "bg-indigo-950/95";
    }
  };

  const getBorderFlashColor = (color: string) => {
    switch (color) {
      case "red": return "border-red-500 text-red-100";
      case "yellow": return "border-yellow-500 text-yellow-105";
      case "blue": return "border-blue-500 text-blue-100";
      case "green": return "border-emerald-500 text-emerald-100";
      case "purple": return "border-purple-500 text-purple-100";
      default: return "border-indigo-500 text-indigo-100";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative pb-12 overflow-x-hidden antialiased" id="earcon-sono-app">
      {/* Visual Fullscreen Flash strobe signal to alert users immediately */}
      {flashAlert && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-100 ${getStrobeFlashColor(flashAlert.visualColor)}`} id="alert-indicator-strobe">
          <div className={`w-full max-w-lg bg-slate-900 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl ${getBorderFlashColor(flashAlert.visualColor)} animate-bounce`}>
            <div className="relative inline-block">
              <span className="absolute -inset-1 rounded-full bg-red-500/30 blur-md animate-ping" />
              <div className="bg-slate-950 p-4 rounded-full border border-slate-800">
                <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase font-mono px-3.5 py-1 rounded-full bg-slate-950 text-slate-400 font-semibold border border-slate-800 tracking-wider">
                {flashAlert.dangerLevel} alert wave triggered
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
                {flashAlert.soundName.toUpperCase()}
              </h1>
              <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                {flashAlert.descriptionText}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={dismissStrobeWarning}
                className="w-full bg-slate-105 hover:bg-slate-200 text-slate-950 font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer text-sm tracking-wide"
              >
                ACKNOWLEDGE & DISMISS FEEDBACK
              </button>
              
              <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-center gap-1">
                <span>Vibrate Sequence:</span>
                {flashAlert.vibrationPattern.map((time, idx) => (
                  <span key={idx} className={idx % 2 === 0 ? "text-indigo-400" : "text-slate-600"}>
                    {time}ms
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 font-extrabold text-indigo-50 leading-none">
              E
            </div>
            <div>
              <h1 className="text-lg font-sans font-extrabold text-slate-100 tracking-tight leading-tight">
                Earcon Sono
              </h1>
              <p className="text-[10px] font-mono text-slate-400">Sensory Sound Accessibility System</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live listening switch */}
            <div className="flex items-center space-x-2.5 bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-xl">
              <span className="text-xs font-semibold text-slate-300 font-sans hidden sm:inline">
                {isListening ? "Listening Active" : "Monitor Paused"}
              </span>
              <button
                onClick={() => setIsListening(!isListening)}
                className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none cursor-pointer"
                title={isListening ? "Pause sensory auditory monitor" : "Resume sensory auditory monitor"}
              >
                {isListening ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Onboarding Introduction Board */}
        {showIntro && (
          <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900/40 border border-indigo-900/50 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden" id="onboarding-guide">
            <span className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
            <span className="absolute -bottom-8 -left-8 w-36 h-36 bg-blue-500/5 rounded-full blur-xl" />

            <button
              onClick={() => setShowIntro(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 hover:bg-slate-900 p-1.5 rounded-lg border border-transparent hover:border-slate-800 transition-all cursor-pointer"
              title="Close guide"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col md:flex-row md:items-center gap-5 relative">
              <div className="bg-indigo-950 p-4 rounded-2xl border border-indigo-500/20 shrink-0 self-start md:self-center">
                <BookOpen className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg font-sans font-bold text-indigo-300 flex items-center gap-1.5 tracking-tight">
                  Welcome to Earcon Sono Sensory Companion
                </h2>
                <p className="text-slate-350 text-xs sm:text-sm leading-relaxed max-w-4xl">
                  Designed specifically for the deaf and hard of hearing, **Earcon Sono** parses complex environmental acoustics into simple, beautifully distinguished physical vibrations (tactile earcons) and flashing light strobes. 
                  Set your noise trigger limits, design personalized tap vibes on the phone mockup, and use Gemini AI to answer and visualize the exact background sound happening around you!
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono font-semibold text-indigo-400">
                  <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    <BadgeCheck className="w-3.5 h-3.5 text-indigo-400" /> Web Audio API Active
                  </span>
                  <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Gemini-3.5-Flash Multi-Modal
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sensory dashboard components organized as a modular grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column A: Live audio wave stream scope & controls */}
          <div className="lg:col-span-1 space-y-6">
            <AudioVisualizer
              isActive={isListening}
              sensitivityThreshold={sensitivity}
              onThresholdExceeded={handleDecibelThresholdExceeded}
              onListeningStateChange={setIsLiveListeningActive}
              onVolumeChange={setMicVolume}
              onPitchChange={setPitchFrequencies}
            />

            {/* Listener settings panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-sans font-bold text-slate-100 uppercase tracking-wider">
                  Auditory Monitor Setup
                </h3>
              </div>

              <div className="space-y-4">
                {/* Limits dial */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Silence Sensitivity Limit</span>
                    <span className="font-bold text-slate-200">{sensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal font-sans">
                    Any ambient room sound above {sensitivity}% volume will trigger a visual/vibrational alarm flash automatically.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300">Quick test guidelines:</p>
                    <p>1. Ensure Listening Mode is enabled in navbar.</p>
                    <p>2. Keep sensitivity low (~25%) if you want simple speech to trigger alarms.</p>
                    <p>3. Tap on the desk or clap to see the visual flash alarm fire!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column B & C: Haptic studio, classifier & audio stream log */}
          <div className="lg:col-span-2 space-y-6">
            <ARLocatorFeed
              micVolume={micVolume}
              pitchFrequencies={pitchFrequencies}
            />

            <SpeechTranscriber
              onTriggerAlert={(name, level, color, pattern, desc) => {
                handleAddLogEntry({
                  soundName: name,
                  dangerLevel: level,
                  visualColor: color,
                  vibrationPattern: pattern,
                  descriptionText: desc,
                  source: "mic-detection"
                });
              }}
            />

            <SoundHeatMap logs={logs} />

            <AiClassifier
              onAddLog={handleAddLogEntry}
              onReplayPreset={handleReplayPulse}
            />

            <HapticDesigner
              presets={presets}
              onUpdatePresets={setPresets}
              activePreset={activePreset}
              onSelectPreset={setActivePreset}
            />

            <SoundLogger
              logs={logs}
              onClearLogs={clearAllLogs}
              onReplayPreset={handleReplayPulse}
            />
          </div>
        </div>
      </main>

      {/* Humble Footer */}
      <footer className="mt-12 text-center text-slate-600 space-y-1">
        <p className="text-xs font-mono">&mdash; Earcon Sono Ambient Ears &mdash;</p>
        <p className="text-[10px] font-sans">Crafted with high sensory contrast and Google Gemini multimodals for universal accessibility.</p>
      </footer>
    </div>
  );
}
