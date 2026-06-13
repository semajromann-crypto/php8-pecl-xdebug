import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, MessageSquare, Keyboard, Sparkles, RefreshCw, Volume2, ShieldCheck, ArrowRight, HelpCircle, AlertCircle, History } from "lucide-react";

interface SpeechTranscriberProps {
  onTriggerAlert: (soundName: string, level: "low" | "medium" | "high", color: string, pattern: number[], desc: string) => void;
}

interface TranscribedSegment {
  id: string;
  source: "voice" | "keyboard-simulation";
  text: string;
  timestamp: string;
  speaker: string;
}

interface SpeechAnalysisResult {
  summary: string;
  sentiment: string;
  keywords: string[];
  actionItems: string[];
  visualColor: string;
}

export default function SpeechTranscriber({ onTriggerAlert }: SpeechTranscriberProps) {
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [useKeyboard, setUseKeyboard] = useState<boolean>(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  
  // Real-time subtitles text buffer
  const [currentSegmentText, setCurrentSegmentText] = useState<string>("");
  const [transcriptHistory, setTranscriptHistory] = useState<TranscribedSegment[]>([
    {
      id: "demo-seg-1",
      source: "keyboard-simulation",
      text: "Hello! Welcome to the live captioning panel. Speak near your microphone to watch subtitles print.",
      timestamp: new Date(Date.now() - 40000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      speaker: "System Guide"
    },
    {
      id: "demo-seg-2",
      source: "keyboard-simulation",
      text: "Warning, please look out for the baby crying alarm in the kitchen area.",
      timestamp: new Date(Date.now() - 10000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      speaker: "Assistant Care"
    }
  ]);

  // Simulated keyboard transcription field
  const [manualInput, setManualInput] = useState<string>("");
  const [manualSpeaker, setManualSpeaker] = useState<string>("Roommate");

  // Gemini summary analysis states
  const [analysis, setAnalysis] = useState<SpeechAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Stop capturing on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Web Speech recognition initialization
  const startSpeechRecognition = () => {
    try {
      setRecognitionError(null);
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechClass) {
        setRecognitionError("Web Speech API recognition is not supported in this browser context. Please use our smart keyboard simulator feed below!");
        setIsCapturing(false);
        return;
      }

      const rec = new SpeechClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsCapturing(true);
      };

      rec.onresult = (event: any) => {
        let interimText = "";
        let finalSegment = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (finalSegment) {
          const textCleaned = finalSegment.trim();
          addTranscriptSegment(textCleaned, "voice", "Speaker (Voice)");
          setCurrentSegmentText("");
          
          // Sound Alert mappings within spoken text
          scanTextForEmergencyWords(textCleaned);
        } else {
          setCurrentSegmentText(interimText);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setRecognitionError("Microphone permissions denied for Web Speech Captions.");
        } else {
          setRecognitionError(`Captions error: ${event.error}. Use keyboard fallback.`);
        }
        setIsCapturing(false);
      };

      rec.onend = () => {
        setIsCapturing(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      setRecognitionError(e.message || "Failed to initialize subtitles engine.");
      setIsCapturing(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsCapturing(false);
  };

  const toggleSubtitlesCapture = () => {
    if (isCapturing) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const addTranscriptSegment = (text: string, source: "voice" | "keyboard-simulation", speakerName: string) => {
    if (!text.trim()) return;
    const newSeg: TranscribedSegment = {
      id: Math.random().toString(36).substr(2, 7),
      source,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      speaker: speakerName || "User"
    };

    setTranscriptHistory(prev => [...prev, newSeg]);
    setAnalysis(null); // Reset stale summaries to encourage new analysis
  };

  // Maps spoken text keyword prompts to immediate sensory alerts
  const scanTextForEmergencyWords = (text: string) => {
    const textLower = text.toLowerCase();
    
    // Quick map triggers
    if (textLower.includes("smoke") || textLower.includes("fire") || textLower.includes("detector") || textLower.includes("alarm")) {
      onTriggerAlert(
        "Voice Alert: Alarm Warning",
        "high",
        "red",
        [1000, 200, 1000, 200, 1000],
        `Recognized critical alarm keywords in spoken voice transcript: "${text}"`
      );
    } else if (textLower.includes("crying") || textLower.includes("baby") || textLower.includes("screaming")) {
      onTriggerAlert(
        "Voice Alert: Baby Distress",
        "medium",
        "yellow",
        [150, 100, 150, 100, 150, 100, 150],
        `Recognized distress keywords in spoken voice transcript: "${text}"`
      );
    } else if (textLower.includes("knock") || textLower.includes("door") || textLower.includes("gate")) {
      onTriggerAlert(
        "Voice Alert: Entry/Visitor",
        "low",
        "blue",
        [200, 100, 200],
        `Recognized doorbell/knocking context in voice transcript: "${text}"`
      );
    } else if (textLower.includes("siren") || textLower.includes("police") || textLower.includes("danger")) {
      onTriggerAlert(
        "Voice Alert: Emergency Hazard",
        "high",
        "red",
        [800, 100, 800, 100, 800],
        `Recognized high priority hazard keywords in spoken transcript: "${text}"`
      );
    } else if (textLower.includes("call") || textLower.includes("ring") || textLower.includes("phone")) {
      onTriggerAlert(
        "Voice Alert: Contact Ring",
        "low",
        "green",
        [500, 500, 500],
        `Recognized calling tone cue words in transcript: "${text}"`
      );
    }
  };

  const handleSendManualText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    
    addTranscriptSegment(manualInput, "keyboard-simulation", manualSpeaker);
    scanTextForEmergencyWords(manualInput);
    setManualInput("");
  };

  // Queries our express backend to run Gemini semantic analysis over live dialogue transcript
  const handleAnalyzeWithAI = async () => {
    if (transcriptHistory.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    // Combine current transcript items
    const fullText = transcriptHistory.map(seg => `[${seg.speaker}]: ${seg.text}`).join("\n");

    try {
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationText: fullText })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis({
          summary: data.summary || "No summary available",
          sentiment: data.sentiment || "casual",
          keywords: data.keywords || [],
          actionItems: data.actionItems || [],
          visualColor: data.visualColor || "purple"
        });
      } else {
        const errData = await response.json();
        throw new Error(errData.error || "Server failed to process summarization.");
      }
    } catch (err: any) {
      console.warn("AI transcription analysis failed:", err);
      setAnalysisError(err.message || "Failed to analyze chat transcription. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentStyling = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case "urgent":
        return "bg-red-950/80 border-red-800 text-red-400";
      case "tense":
        return "bg-yellow-950/80 border-yellow-800 text-yellow-400";
      case "cheerful":
        return "bg-emerald-950/80 border-emerald-800 text-emerald-400";
      case "professional":
        return "bg-blue-950/80 border-blue-800 text-blue-400";
      default:
        return "bg-slate-900 border-slate-800 text-purple-400";
    }
  };

  const handleClearTranscript = () => {
    setTranscriptHistory([]);
    setAnalysis(null);
    setCurrentSegmentText("");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5" id="speech-transcriber-hud">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-sans font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400 animate-pulse" />
            Live Voice Transcriber & Closed Captions
          </h2>
          <p className="text-slate-400 text-xs text-left">
            Convert incoming speech to subtitles, trigger sensory vibrating alerts from keyword patterns, or analyze key dialogue notes with Gemini.
          </p>
        </div>

        <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-xl items-center gap-1 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setUseKeyboard(false)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !useKeyboard ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Voice Mic
          </button>
          <button
            onClick={() => setUseKeyboard(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              useKeyboard ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Keyboard Feed
          </button>
        </div>
      </div>

      {recognitionError && (
        <div className="p-3 bg-yellow-950/50 border border-yellow-800/40 rounded-xl flex items-start gap-2 text-yellow-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{recognitionError}</p>
        </div>
      )}

      {/* Main display panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Subtitles Overlay Screen */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950 rounded-2xl border border-slate-850 p-4 min-h-[300px]">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-2 shrink-0">
            <span className="text-[10px] font-mono tracking-widest text-teal-400 font-bold uppercase flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isCapturing ? "bg-red-500 animate-ping" : "bg-slate-700"}`} />
              {isCapturing ? "CAPTURING LIVE SPEECH CC..." : "Subtitles HUD Display"}
            </span>

            {transcriptHistory.length > 0 && (
              <button
                onClick={handleClearTranscript}
                className="text-[10px] font-mono hover:text-red-400 text-slate-550 border border-transparent hover:border-slate-800 px-2 py-0.5 rounded cursor-pointer"
              >
                Clear Transcripts
              </button>
            )}
          </div>

          {/* Scrolling Transcript Bubbles */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 my-2 scrollbar-thin max-h-[200px]" style={{ display: 'flex', flexDirection: 'column' }}>
            {transcriptHistory.length === 0 && !currentSegmentText ? (
              <div className="my-auto py-12 text-center text-slate-650 space-y-2">
                <Mic className="w-10 h-10 mx-auto text-slate-800" />
                <p className="text-xs">Subtitles dashboard is clean.</p>
                <p className="text-[10px] max-w-xs mx-auto text-slate-500 leading-relaxed">
                  Toggle Voice Mic above, or type in sentences below to instantly test haptic alarm matches!
                </p>
              </div>
            ) : (
              <>
                {transcriptHistory.map((seg) => (
                  <div key={seg.id} className="text-left space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="font-bold text-teal-500">{seg.speaker}</span>
                      <span>{seg.timestamp}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 border border-slate-850/60 rounded-xl text-xs text-slate-200 leading-normal font-sans">
                      {seg.text}
                    </div>
                  </div>
                ))}

                {/* Live Interim Subtitle Stream display bubble */}
                {currentSegmentText && (
                  <div className="text-left space-y-1 opacity-75 animate-pulse">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="font-bold text-red-400">Speaker (Typing/Streaming...)</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 border border-red-900/30 rounded-xl text-xs text-slate-300 italic font-medium leading-normal font-sans">
                      {currentSegmentText}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-900 pt-3 flex items-center gap-3 shrink-0">
            {!useKeyboard ? (
              /* Voice activator mic button */
              <button
                onClick={toggleSubtitlesCapture}
                className={`w-full py-3.5 px-4 rounded-xl font-bold font-sans text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                  isCapturing
                    ? "bg-red-650 hover:bg-red-600 text-red-50 border border-red-500/20 shadow-red-950/30"
                    : "bg-indigo-600 hover:bg-indigo-550 text-indigo-50 border border-indigo-500/20 shadow-indigo-950/20"
                }`}
              >
                {isCapturing ? (
                  <>
                    <MicOff className="w-4 h-4 shrink-0 animate-bounce" /> STOP SUBTITLES STREAMING
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" /> ACTIVATE VOICE MIC SUBTITLES
                  </>
                )}
              </button>
            ) : (
              /* Manual simulator input card overlay */
              <form onSubmit={handleSendManualText} className="w-full flex items-center gap-2">
                <select
                  value={manualSpeaker}
                  onChange={(e) => setManualSpeaker(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-350 focus:outline-none focus:border-indigo-600 shrink-0 cursor-pointer"
                >
                  <option value="Roommate">Roommate 🤝</option>
                  <option value="Visitor">Visitor 🚪</option>
                  <option value="Mic Simulator">Mic Sim 🎤</option>
                  <option value="Emergency Alert">Alarm Cue 🚨</option>
                </select>

                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type speaking phrases (try 'baby crying' or 'smoke alarm')..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-205 placeholder-slate-550 focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-850 disabled:text-slate-600 border border-indigo-500/20 text-indigo-100 rounded-xl p-2.5 transition-all text-xs cursor-pointer shrink-0 font-bold"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Gemini dialogue summary review panel */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950 rounded-2xl border border-slate-850 p-4 min-h-[300px]">
          <div className="space-y-4 flex-1">
            <h3 className="text-xs font-mono font-medium text-indigo-400 uppercase tracking-widest border-b border-slate-900 pb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              Gemini Text Insights
            </h3>

            {analysisError && (
              <div className="p-2.5 bg-red-950/40 border border-red-900/30 rounded-xl flex items-start gap-1.5 text-red-400 text-[10px] leading-normal">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>{analysisError}</p>
              </div>
            )}

            {!analysis ? (
              <div className="py-8 text-center text-slate-600 space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Dialogue Analysis Idle</p>
                  <p className="text-[10px] text-slate-550 max-w-xs px-2 leading-relaxed">
                    Once there is captured text in the display, click the button below to generate context summaries, sentiments, and safety check items with Google Gemini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-left text-xs">
                {/* Summary */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-slate-500 uppercase font-black">AI Dialogue Abstract</span>
                  <p className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-850/60 font-sans text-slate-200 leading-normal italic">
                    "{analysis.summary}"
                  </p>
                </div>

                {/* Sentiment & keywords */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Sentiment Level</span>
                    <div className={`p-2 border rounded-xl text-center text-[10px] font-mono font-bold capitalize ${getSentimentStyling(analysis.sentiment)}`}>
                      {analysis.sentiment}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Key Topics</span>
                    <div className="flex flex-wrap gap-1">
                      {analysis.keywords.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">None</span>
                      ) : (
                        analysis.keywords.slice(0, 3).map((kw, i) => (
                          <span key={i} className="text-[9px] font-mono text-indigo-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-bold">
                            #{kw}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Safety Action items */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Actionable Priority Items</span>
                  <ul className="space-y-1 font-sans text-slate-350 text-[10px]">
                    {analysis.actionItems.length === 0 ? (
                      <li className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-650" /> Speak naturally. No priority alarms detected.
                      </li>
                    ) : (
                      analysis.actionItems.map((item, id) => (
                        <li key={id} className="flex items-start gap-1.5 p-1.5 bg-slate-900/70 border border-slate-850 rounded-lg text-slate-300">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                          <span className="text-[10px] leading-snug">{item}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-900">
            <button
              onClick={handleAnalyzeWithAI}
              disabled={isAnalyzing || transcriptHistory.length === 0}
              className="w-full bg-indigo-650/80 hover:bg-indigo-650 border border-indigo-500/30 text-indigo-100 disabled:bg-slate-900 disabled:text-slate-700 disabled:border-transparent py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Distilling subtitles...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Analyze Dialogue with Gemini AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Helpful Info Guide */}
      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50 flex items-start gap-2 select-none">
        <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 leading-relaxed text-left">
          **Subtitles Accessibility Helper**: Matches and intercepts spoken acoustic words to fire tactile vibration feedback profiles immediately. High-contrast overlays keep users updated on background speaker dialogue.
        </p>
      </div>
    </div>
  );
}
