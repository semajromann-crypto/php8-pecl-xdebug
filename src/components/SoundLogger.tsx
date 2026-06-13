import React from "react";
import { SoundLogEntry } from "../types";
import { History, Trash2, ShieldAlert, Sparkles, Volume2, Play, BellRing } from "lucide-react";

interface SoundLoggerProps {
  logs: SoundLogEntry[];
  onClearLogs: () => void;
  onReplayPreset: (pattern: number[], color: string) => void;
}

export default function SoundLogger({ logs, onClearLogs, onReplayPreset }: SoundLoggerProps) {
  const playAudio = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.play().catch((err) => console.log("Failed to play audio:", err));
    } catch (e) {
      console.warn(e);
    }
  };

  const getDangerTheme = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  const getColorBubble = (color: string) => {
    switch (color) {
      case "red":
        return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
      case "yellow":
        return "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]";
      case "blue":
        return "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]";
      case "green":
        return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
      case "purple":
        return "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]";
      default:
        return "bg-slate-400";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-4" id="sound-logs-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="bg-slate-800 p-2 rounded-xl">
            <History className="w-5 h-5 text-indigo-400 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-slate-100 tracking-tight text-sm md:text-base flex items-center gap-1.5">
              Earcon Alerts Feed
            </h3>
            <p className="text-slate-400 text-xs">A local log of physical environmental sounds registered.</p>
          </div>
        </div>

        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-slate-500 hover:text-red-400 transition-all font-sans text-xs flex items-center gap-1 cursor-pointer py-1 px-2.5 hover:bg-slate-950 rounded-lg border border-transparent hover:border-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Log
          </button>
        )}
      </div>

      <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {logs.length === 0 ? (
          <div className="text-center py-10 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-2">
            <BellRing className="w-8 h-8 text-slate-700" />
            <p className="text-xs text-slate-500 font-sans">No sound alerts registered yet.</p>
            <p className="text-[10px] text-slate-600 max-w-xs px-4">
              Trigger a simulation preset or activate the microphone listener to begin mapping environmental sound activities.
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-slate-950/80 hover:border-slate-800"
            >
              <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                {/* Warning glow dot */}
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${getColorBubble(log.visualColor)}`} />

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-205 text-sm truncate">{log.soundName}</span>
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full border ${getDangerTheme(log.dangerLevel)}`}>
                      {log.dangerLevel}
                    </span>
                    {log.confidence !== undefined && (
                      <span className="text-[10px] font-mono text-indigo-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {Math.round(log.confidence * 100)}% Match
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-1">{log.descriptionText}</p>
                  
                  <div className="flex items-center gap-3.5 text-[10px] text-slate-500 font-mono">
                    <span>{log.timestamp}</span>
                    <span>•</span>
                    <span className="capitalize flex items-center gap-1 text-slate-400">
                      {log.source === "ai-analysis" ? (
                        <Sparkles className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                      ) : log.source === "mic-detection" ? (
                        <Volume2 className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      )}
                      {log.source.replace("-", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                {log.audioUrl && (
                  <button
                    onClick={() => playAudio(log.audioUrl!)}
                    className="w-full sm:w-auto bg-teal-950/80 hover:bg-teal-900 border border-teal-800/60 text-teal-300 font-sans text-xs px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 shrink-0" /> Play Audio
                  </button>
                )}
                <button
                  onClick={() => onReplayPreset(log.vibrationPattern, log.visualColor)}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-indigo-400 font-sans text-xs px-3 py-1.5 rounded-lg border border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 shrink-0" /> Replay Pulse
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
