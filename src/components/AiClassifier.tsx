import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, Cpu, Loader2, HelpCircle, Send, Play, ShieldAlert, Award, Layers } from "lucide-react";
import { SoundPreset, SoundLogEntry } from "../types";

interface AiClassifierProps {
  onAddLog: (log: Omit<SoundLogEntry, "id" | "timestamp">) => void;
  onReplayPreset: (pattern: number[], color: string) => void;
}

export default function AiClassifier({ onAddLog, onReplayPreset }: AiClassifierProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<any>(null);

  // Steps shown to user during AI loading sequence
  const loadingSteps = [
    "Capturing audio buffer harmonics...",
    "Sending stream packets to Earcon server...",
    "Gemini AI analyzing speech-to-ambient frequencies...",
    "Creating accessible tactile signoffs...",
    "Finalizing vibration patterns..."
  ];

  useEffect(() => {
    return () => {
      cleanupRecordInterval();
    };
  }, []);

  const cleanupRecordInterval = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const startMediaRecording = async () => {
    setErrorStatus(null);
    setAnalysisResult(null);
    audioChunksRef.current = [];
    setRecordDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      // Browser checks to find matching audio container
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        options = { mimeType: "audio/ogg" };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop()); // release mic ASAP
        
        if (audioChunksRef.current.length > 0) {
          await uploadAndClassify(audioBlob);
        } else {
          setErrorStatus("No audio buffer samples captured. Record again.");
        }
      };

      recorder.start();
      setIsRecording(true);

      // Track elapsed seconds
      durationIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 4) {
            // Auto stop when limit reached (perfect 4 seconds clip keeps payloads fast and snappy)
            stopMediaRecording();
            return 4;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (e: any) {
      console.error("Mic record launch error: ", e);
      setErrorStatus("Could not request microphone recording. Check permissions.");
    }
  };

  const stopMediaRecording = () => {
    cleanupRecordInterval();
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Turn recorded blob into base64 payload
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        const rawBase64 = resultString.split(",")[1];
        resolve(rawBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const uploadAndClassify = async (audioBlob: Blob) => {
    setAnalysisLoading(true);
    setLoadingStep(loadingSteps[0]);

    // Visual loading stepper intervals
    let loaderIdx = 1;
    const lInterval = setInterval(() => {
      if (loaderIdx < loadingSteps.length) {
        setLoadingStep(loadingSteps[loaderIdx]);
        loaderIdx++;
      }
    }, 1200);

    try {
      const base64Audio = await blobToBase64(audioBlob);

      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: audioBlob.type
        })
      });

      clearInterval(lInterval);

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Internal Server classification failure.");
      }

      const parsedResult = await response.json();
      setAnalysisResult(parsedResult);

      // Add to main global alerts feed
      onAddLog({
        source: "ai-analysis",
        soundName: parsedResult.soundName,
        dangerLevel: parsedResult.dangerLevel,
        confidence: parsedResult.confidence,
        descriptionText: parsedResult.descriptionText,
        vibrationPattern: parsedResult.vibrationPattern,
        visualColor: parsedResult.visualColor,
        audioUrl: URL.createObjectURL(audioBlob)
      });

      // Auto vibrate to let them feel the sound matches immediately!
      onReplayPreset(parsedResult.vibrationPattern, parsedResult.visualColor);

    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Communication pipeline block. Retry again.");
    } finally {
      clearInterval(lInterval);
      setAnalysisLoading(false);
    }
  };

  const handleTextClassificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textDescription.trim()) return;

    setErrorStatus(null);
    setAnalysisResult(null);
    setAnalysisLoading(true);
    setLoadingStep("Mapping textual semantic cues directly to Earcons...");

    try {
      const response = await fetch("/api/describe-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textDescription: textDescription.trim() })
      });

      if (!response.ok) {
        throw new Error("Failed to process sound description.");
      }

      const parsedResult = await response.json();
      setAnalysisResult(parsedResult);
      setTextDescription("");

      // Add to main logs
      onAddLog({
        source: "text-query",
        soundName: parsedResult.soundName,
        dangerLevel: parsedResult.dangerLevel,
        confidence: parsedResult.confidence || 0.9,
        descriptionText: parsedResult.descriptionText,
        vibrationPattern: parsedResult.vibrationPattern,
        visualColor: parsedResult.visualColor
      });

      // Feel immediately
      onReplayPreset(parsedResult.vibrationPattern, parsedResult.visualColor);

    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Failed to catalog. Try explaining the sound differently.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Matching helper styles
  const getLightBgColor = (color: string) => {
    switch (color) {
      case "red": return "bg-red-500/10 border-red-500/30";
      case "yellow": return "bg-yellow-500/10 border-yellow-500/30";
      case "blue": return "bg-blue-500/10 border-blue-500/30";
      case "green": return "bg-emerald-500/10 border-emerald-500/30";
      case "purple": return "bg-purple-500/10 border-purple-500/30";
      default: return "bg-slate-900 border-slate-800";
    }
  };

  const getIntensityBadge = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high": return "bg-red-500/20 text-red-400 border border-red-500/40";
      case "medium": return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
      default: return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6" id="ai-classifier-card">
      <div>
        <h2 className="text-xl font-sans font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          What was that? &mdash; Gemini Earcon AI
        </h2>
        <p className="text-slate-400 text-xs">
          Record standard background environmental noises or describe them to instantly render a tactile earcon and visual classification map.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Interaction block */}
        <div className="space-y-5">
          {/* Recorder block */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-4">
            <h3 className="text-sm font-sans font-semibold text-slate-200">
              Sensory Audio Capturer
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Click record and let background sound run (fire alarm, doorbell, sirens, washing alarm) for 4 seconds.
            </p>

            <div className="py-4 flex flex-col items-center justify-center space-y-2">
              {isRecording ? (
                <button
                  onClick={stopMediaRecording}
                  className="w-20 h-20 rounded-full bg-red-600/95 hover:bg-red-500 flex items-center justify-center transition-all animate-pulse shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  <Square className="w-8 h-8 text-white" />
                </button>
              ) : (
                <button
                  onClick={startMediaRecording}
                  className="w-20 h-20 rounded-full bg-indigo-650/95 hover:bg-indigo-600 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-indigo-500/20 cursor-pointer"
                  disabled={analysisLoading}
                >
                  <Mic className="w-8 h-8 text-white" />
                </button>
              )}

              <span className="text-xs font-mono font-bold text-slate-400">
                {isRecording ? `RECORDING: ${recordDuration}s / 4s máximo` : "READY"}
              </span>
            </div>
          </div>

          {/* Text input description block */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-sans font-semibold text-slate-200">
              Descriptive Text Mapper
            </h3>
            <p className="text-xs text-slate-500">
              Explain the sound conceptually to generate a synthetic earcon translation signature.
            </p>

            <form onSubmit={handleTextClassificationSubmit} className="flex gap-2">
              <input
                type="text"
                value={textDescription}
                onChange={(e) => setTextDescription(e.target.value)}
                disabled={analysisLoading}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 font-sans"
                placeholder="Example: a rapid high beep-beep alarm sound"
              />
              <button
                type="submit"
                disabled={analysisLoading || !textDescription.trim()}
                className="bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-800 disabled:text-slate-600 text-indigo-100 p-2.5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-500/30 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Display results */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-center min-h-[250px] relative overflow-hidden">
          {analysisLoading && (
            <div className="absolute inset-0 bg-slate-950/90 z-10 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-indigo-300 tracking-wide font-sans">Gemini AI Listening Room</p>
                <p className="text-[10px] font-mono text-slate-500 animate-pulse">{loadingStep}</p>
              </div>
            </div>
          )}

          {errorStatus && (
            <div className="text-center space-y-3 p-4">
              <span className="inline-block bg-red-950 border border-red-800 text-red-400 p-2.5 rounded-full">
                <Cpu className="w-6 h-6" />
              </span>
              <p className="text-xs text-red-200 font-medium font-sans">{errorStatus}</p>
              <p className="text-[10px] text-slate-500">
                Ensure you are close to the computer speaker or make real environment noise.
              </p>
            </div>
          )}

          {!analysisLoading && !errorStatus && !analysisResult && (
            <div className="text-center space-y-2.5 text-slate-600 p-4">
              <HelpCircle className="w-10 h-10 text-slate-800 mx-auto" />
              <p className="text-xs font-semibold text-slate-400 font-sans">Awaiting Sound Event</p>
              <p className="text-[10px] text-slate-600 leading-normal max-w-xs mx-auto">
                No active samples analysed. Trigger a microphone record or search textually to display modern haptic mappings and waveforms here.
              </p>
            </div>
          )}

          {!analysisLoading && !errorStatus && analysisResult && (
            <div className={`space-y-4 p-4 rounded-xl border ${getLightBgColor(analysisResult.visualColor)} transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-indigo-400">
                    AI Classified Sound
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-100 tracking-tight">
                    {analysisResult.soundName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Accuracy</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {Math.round(analysisResult.confidence * 100)}% Match
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${getIntensityBadge(analysisResult.dangerLevel)}`}>
                  {analysisResult.dangerLevel} alert
                </span>
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full capitalize font-mono">
                  Hue: {analysisResult.visualColor}
                </span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed font-sans pt-1 border-t border-slate-850">
                {analysisResult.descriptionText}
              </div>

              {/* Pattern and vibration player */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
                  <span>Earcon Micro Pattern</span>
                  <span>Signature: {analysisResult.hapticSignature}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => onReplayPreset(analysisResult.vibrationPattern, analysisResult.visualColor)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-550 text-indigo-100 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:shadow-indigo-500/10"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" /> Play Haptic Pattern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
