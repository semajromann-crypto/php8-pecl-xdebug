export interface SoundPreset {
  id: string;
  soundName: string;
  dangerLevel: "low" | "medium" | "high";
  hapticSignature: "long-alert" | "rapid-pulses" | "double-tap" | "gentle-glow" | "staccato" | string;
  vibrationPattern: number[]; // e.g. [500, 200, 500]
  visualColor: "red" | "yellow" | "blue" | "green" | "purple" | string;
  descriptionText: string;
}

export interface SoundLogEntry {
  id: string;
  timestamp: string; // ISO or human string
  source: "mic-detection" | "ai-analysis" | "simulation" | "text-query";
  soundName: string;
  dangerLevel: "low" | "medium" | "high";
  confidence?: number;
  descriptionText: string;
  vibrationPattern: number[];
  visualColor: string;
  volumePercent?: number;
  audioUrl?: string; // For audio playback support
}
