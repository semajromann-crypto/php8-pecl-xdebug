import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { SoundLogEntry } from "../types";
import { Calendar, Volume2, Clock, ShieldAlert, Sparkles, RefreshCw, BarChart2, ListCollapse, Play } from "lucide-react";

interface SoundHeatMapProps {
  logs: SoundLogEntry[];
}

interface HistoricalSoundEvent {
  id: string;
  hour: number;        // 0-23
  dayIndex: number;    // 0-6 (Mon-Sun)
  category: string;    // "Emergency Siren", "Baby Crying", "Door Knocking", "Dog Barking", "Smoke/Fire Detector", "Phone Ringing", "Other Ambient"
  intensity: number;   // 10-100 (decibel volume equivalence)
  timestamp: string;   // readable date string
  dangerLevel: "low" | "medium" | "high";
}

// Pre-seeded authentic historical sound logs spanning the last 7 days
// This provides a highly illustrative "Recurring Noisemaker" footprint from the get-go!
const INITIAL_HISTORICAL_DATA: HistoricalSoundEvent[] = [
  // Fire alarm/Sirens - recurring late night/afternoon
  { id: "h1", hour: 14, dayIndex: 0, category: "Emergency Siren", intensity: 85, timestamp: "Monday, 2:15 PM", dangerLevel: "high" },
  { id: "h2", hour: 14, dayIndex: 2, category: "Emergency Siren", intensity: 90, timestamp: "Wednesday, 2:40 PM", dangerLevel: "high" },
  { id: "h3", hour: 14, dayIndex: 5, category: "Emergency Siren", intensity: 82, timestamp: "Saturday, 2:05 PM", dangerLevel: "high" },
  { id: "h4", hour: 3, dayIndex: 1, category: "Emergency Siren", intensity: 75, timestamp: "Tuesday, 3:10 AM", dangerLevel: "high" },
  { id: "h5", hour: 3, dayIndex: 4, category: "Emergency Siren", intensity: 88, timestamp: "Friday, 3:22 AM", dangerLevel: "high" },

  // Baby Crying - peak around morning (7-9 AM) and evening bedtimes (7-9 PM)
  { id: "b1", hour: 8, dayIndex: 0, category: "Baby Crying", intensity: 65, timestamp: "Monday, 8:12 AM", dangerLevel: "medium" },
  { id: "b2", hour: 8, dayIndex: 1, category: "Baby Crying", intensity: 70, timestamp: "Tuesday, 8:05 AM", dangerLevel: "medium" },
  { id: "b3", hour: 8, dayIndex: 2, category: "Baby Crying", intensity: 62, timestamp: "Wednesday, 8:30 AM", dangerLevel: "medium" },
  { id: "b4", hour: 8, dayIndex: 3, category: "Baby Crying", intensity: 68, timestamp: "Thursday, 8:15 AM", dangerLevel: "medium" },
  { id: "b5", hour: 8, dayIndex: 4, category: "Baby Crying", intensity: 74, timestamp: "Friday, 8:40 AM", dangerLevel: "medium" },
  { id: "b6", hour: 20, dayIndex: 0, category: "Baby Crying", intensity: 65, timestamp: "Monday, 8:10 PM", dangerLevel: "medium" },
  { id: "b7", hour: 20, dayIndex: 2, category: "Baby Crying", intensity: 60, timestamp: "Wednesday, 8:15 PM", dangerLevel: "medium" },
  { id: "b8", hour: 20, dayIndex: 5, category: "Baby Crying", intensity: 72, timestamp: "Saturday, 8:45 PM", dangerLevel: "medium" },
  { id: "b9", hour: 20, dayIndex: 6, category: "Baby Crying", intensity: 74, timestamp: "Sunday, 8:50 PM", dangerLevel: "medium" },

  // Dog barking - afternoon peaks (mainly weekends or weekday post-work 5-7 PM)
  { id: "d1", hour: 17, dayIndex: 0, category: "Dog Barking", intensity: 50, timestamp: "Monday, 5:40 PM", dangerLevel: "medium" },
  { id: "d2", hour: 17, dayIndex: 1, category: "Dog Barking", intensity: 55, timestamp: "Tuesday, 5:15 PM", dangerLevel: "medium" },
  { id: "d3", hour: 17, dayIndex: 3, category: "Dog Barking", intensity: 62, timestamp: "Thursday, 5:35 PM", dangerLevel: "medium" },
  { id: "d4", hour: 13, dayIndex: 5, category: "Dog Barking", intensity: 75, timestamp: "Saturday, 1:20 PM", dangerLevel: "medium" },
  { id: "d5", hour: 13, dayIndex: 6, category: "Dog Barking", intensity: 80, timestamp: "Sunday, 1:45 PM", dangerLevel: "medium" },
  { id: "d6", hour: 15, dayIndex: 5, category: "Dog Barking", intensity: 68, timestamp: "Saturday, 3:10 PM", dangerLevel: "medium" },
  { id: "d7", hour: 15, dayIndex: 6, category: "Dog Barking", intensity: 70, timestamp: "Sunday, 3:30 PM", dangerLevel: "medium" },

  // Door knocking - business hours peaks, deliveries usually 11 AM - 1 PM and 4 PM - 5 PM
  { id: "dk1", hour: 12, dayIndex: 1, category: "Door Knocking", intensity: 45, timestamp: "Tuesday, 12:05 PM", dangerLevel: "low" },
  { id: "dk2", hour: 12, dayIndex: 3, category: "Door Knocking", intensity: 50, timestamp: "Thursday, 12:15 PM", dangerLevel: "low" },
  { id: "dk3", hour: 12, dayIndex: 4, category: "Door Knocking", intensity: 48, timestamp: "Friday, 12:45 PM", dangerLevel: "low" },
  { id: "dk4", hour: 16, dayIndex: 0, category: "Door Knocking", intensity: 52, timestamp: "Monday, 4:20 PM", dangerLevel: "low" },
  { id: "dk5", hour: 16, dayIndex: 2, category: "Door Knocking", intensity: 40, timestamp: "Wednesday, 4:10 PM", dangerLevel: "low" },

  // Phone Ringing - daytime work intervals
  { id: "pr1", hour: 10, dayIndex: 0, category: "Phone Ringing", intensity: 45, timestamp: "Monday, 10:30 AM", dangerLevel: "low" },
  { id: "pr2", hour: 10, dayIndex: 1, category: "Phone Ringing", intensity: 50, timestamp: "Tuesday, 10:15 AM", dangerLevel: "low" },
  { id: "pr3", hour: 10, dayIndex: 3, category: "Phone Ringing", intensity: 45, timestamp: "Thursday, 10:45 AM", dangerLevel: "low" },
  { id: "pr4", hour: 15, dayIndex: 1, category: "Phone Ringing", intensity: 48, timestamp: "Tuesday, 3:40 PM", dangerLevel: "low" },
  { id: "pr5", hour: 15, dayIndex: 4, category: "Phone Ringing", intensity: 52, timestamp: "Friday, 3:15 PM", dangerLevel: "low" },

  // Smoke alarm drill
  { id: "sa1", hour: 11, dayIndex: 2, category: "Smoke/Fire Detector", intensity: 95, timestamp: "Wednesday, 11:00 AM", dangerLevel: "high" },
  
  // Other ambient (appliance hum, chatter)
  { id: "oa1", hour: 7, dayIndex: 4, category: "Other Ambient", intensity: 35, timestamp: "Friday, 7:15 AM", dangerLevel: "low" },
  { id: "oa2", hour: 22, dayIndex: 5, category: "Other Ambient", intensity: 40, timestamp: "Saturday, 10:30 PM", dangerLevel: "low" }
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CATEGORIES = [
  "Emergency Siren",
  "Baby Crying",
  "Door Knocking",
  "Dog Barking",
  "Smoke/Fire Detector",
  "Phone Ringing",
  "Other Ambient"
];

export default function SoundHeatMap({ logs }: SoundHeatMapProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalSoundEvent[]>(INITIAL_HISTORICAL_DATA);
  const [yAxisType, setYAxisType] = useState<"days" | "categories">("days");
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    label: string;
    hour: number;
    count: number;
    peakIntensity: number;
    events: HistoricalSoundEvent[];
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // Resize listener to ensure pixel perfect d3 layout fluidity
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        setContainerWidth(width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync incoming real-time logs into our historical pool when they contain compatible metrics!
  useEffect(() => {
    if (logs.length === 0) return;
    
    // We Map live logs to HistoricalSoundEvents
    const formatted: HistoricalSoundEvent[] = logs.map((log) => {
      // Determine hour & day index from now or parsing timestamp
      const now = new Date();
      const currentHour = now.getHours();
      // Sunday is 0 in getDay(), we want Mon-Sun mapped to 0-6
      const dayIndex = (now.getDay() + 6) % 7; 

      // Attempt to map names to Categories
      let mappedCategory = "Other Ambient";
      const nameLower = log.soundName.toLowerCase();
      if (nameLower.includes("siren") || nameLower.includes("ambulance") || nameLower.includes("police")) {
        mappedCategory = "Emergency Siren";
      } else if (nameLower.includes("crying") || nameLower.includes("baby")) {
        mappedCategory = "Baby Crying";
      } else if (nameLower.includes("knock") || nameLower.includes("door")) {
        mappedCategory = "Door Knocking";
      } else if (nameLower.includes("bark") || nameLower.includes("dog")) {
        mappedCategory = "Dog Barking";
      } else if (nameLower.includes("detector") || nameLower.includes("fire") || nameLower.includes("alarm")) {
        mappedCategory = "Smoke/Fire Detector";
      } else if (nameLower.includes("ring") || nameLower.includes("phone")) {
        mappedCategory = "Phone Ringing";
      }

      return {
        id: log.id,
        hour: currentHour,
        dayIndex,
        category: mappedCategory,
        intensity: log.volumePercent || (log.dangerLevel === "high" ? 85 : log.dangerLevel === "medium" ? 60 : 35),
        timestamp: `${DAYS_OF_WEEK[dayIndex]}, ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        dangerLevel: log.dangerLevel
      };
    });

    // Remove duplicates by ID to avoid loading infinitely
    setHistoricalData((prev) => {
      const merged = [...formatted, ...prev];
      const uniqueMap = new Map<string, HistoricalSoundEvent>();
      merged.forEach(item => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      return Array.from(uniqueMap.values());
    });
  }, [logs]);

  // Compute aggregated cell scores
  const aggregates = useMemo(() => {
    const grid: { [key: string]: HistoricalSoundEvent[] } = {};

    // Initialize all grid cells
    if (yAxisType === "days") {
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          grid[`${d}-${h}`] = [];
        }
      }
    } else {
      CATEGORIES.forEach((cat) => {
        for (let h = 0; h < 24; h++) {
          grid[`${cat}-${h}`] = [];
        }
      });
    }

    // Populate actual logs
    historicalData.forEach((event) => {
      const key = yAxisType === "days" ? `${event.dayIndex}-${event.hour}` : `${event.category}-${event.hour}`;
      if (grid[key]) {
        grid[key].push(event);
      }
    });

    return grid;
  }, [historicalData, yAxisType]);

  // Find most active hour of day
  const busiestTimeStats = useMemo(() => {
    const hourCounts = Array(24).fill(0);
    
    historicalData.forEach((evt) => {
      hourCounts[evt.hour]++;
    });

    let maxHour = 0;
    let maxCount = 0;
    hourCounts.forEach((cnt, hr) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        maxHour = hr;
      }
    });

    const label = maxHour === 0 ? "12 AM" : maxHour === 12 ? "12 PM" : maxHour > 12 ? `${maxHour - 12} PM` : `${maxHour} AM`;
    return { hour: maxHour, label, count: maxCount };
  }, [historicalData]);

  // Rank the noisemakers by total weight occurrences
  const noisemakerRanks = useMemo(() => {
    const counts: { [key: string]: { count: number; totalIntensity: number; danger: string; peakHour: number } } = {};
    
    CATEGORIES.forEach(cat => {
      counts[cat] = { count: 0, totalIntensity: 0, danger: "low", peakHour: 12 };
    });

    historicalData.forEach((evt) => {
      const cat = evt.category;
      if (counts[cat]) {
        counts[cat].count++;
        counts[cat].totalIntensity += evt.intensity;
        if (evt.dangerLevel === "high") counts[cat].danger = "high";
        else if (evt.dangerLevel === "medium" && counts[cat].danger !== "high") counts[cat].danger = "medium";
      }
    });

    return Object.entries(counts)
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        avgIntensity: stat.count ? Math.round(stat.totalIntensity / stat.count) : 0,
        danger: stat.danger,
      }))
      .filter((n) => n.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [historicalData]);

  // Draw heatmap inside SVG using standard D3 manipulation
  useEffect(() => {
    if (!svgRef.current || containerWidth <= 0) return;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Responsive margins & canvas spacing
    const margin = { top: 30, right: 20, bottom: 40, left: 110 };
    const width = containerWidth - margin.left - margin.right;
    const height = yAxisType === "days" ? 220 : 260;

    svg
      .attr("width", containerWidth)
      .attr("height", height + margin.top + margin.bottom);

    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // X scale - 24 Hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const xScale = d3.scaleBand<number>()
      .domain(hours)
      .range([0, width])
      .padding(0.12);

    // Y scale depends on active axis view
    const yDomain = yAxisType === "days" 
      ? Array.from({ length: 7 }, (_, i) => i) 
      : CATEGORIES;

    const yScale = d3.scaleBand<any>()
      .domain(yDomain)
      .range([0, height])
      .padding(0.14);

    // X Axis Label formatting
    const xAxis = d3.axisBottom<number>(xScale)
      .tickFormat((d) => {
        if (d === 0) return "12a";
        if (d === 12) return "12p";
        if (d % 4 === 0) return d > 12 ? `${d - 12}p` : `${d}a`;
        return "";
      });

    // Y Axis representation formatters
    const yAxisStr = yAxisType === "days"
      ? d3.axisLeft<number>(yScale).tickFormat((d) => DAYS_OF_WEEK[d].substring(0, 3))
      : d3.axisLeft<string>(yScale);

    // Draw X Axis
    chartGroup.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(xAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#334155"))
      .call((g) => g.selectAll(".tick text").attr("fill", "#64748b").style("font-size", "9px").style("font-family", "monospace"));

    // Draw Y Axis
    chartGroup.append("g")
      .call(yAxisStr)
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#334155"))
      .call((g) => {
        g.selectAll(".tick text")
          .attr("fill", "#94a3b8")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .style("font-family", "sans-serif")
          // Left align offset
          .attr("dx", "-8px");
      });

    // Construct a custom dynamic color interpolator
    // We go from slate-950 (no data), to low sound density (teal/blue), medium (indigo), up to red/pink warning highlight peaks!
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 1, 3, 5])
      .range(["#030712", "#0f766e", "#4f46e5", "#ec4899"]);

    // Draw grid cells
    yDomain.forEach((yVal: any) => {
      hours.forEach((hour) => {
        const key = yAxisType === "days" ? `${yVal}-${hour}` : `${yVal}-${hour}`;
        const events = aggregates[key] || [];
        const count = events.length;
        const peakIntensity = count > 0 ? d3.max<HistoricalSoundEvent, number>(events, (e) => e.intensity) || 0 : 0;

        // Draw structural cell card rect
        const rect = chartGroup.append("rect")
          .attr("x", xScale(hour) || 0)
          .attr("y", yScale(yVal) || 0)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("rx", 3)
          .attr("fill", count === 0 ? "#020617" : colorScale(count))
          .attr("stroke", count === 0 ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.1)")
          .attr("stroke-width", 0.5)
          .style("cursor", "pointer")
          .style("transition", "all 150ms ease-out");

        // Hover effect styles
        rect.on("mouseover", function () {
          d3.select(this)
            .attr("stroke", "#38bdf8")
            .attr("stroke-width", 1.5)
            .attr("transform", "scale(1.05)")
            // raise to prevent overlapping borders
            .raise();
        })
        .on("mouseout", function () {
          d3.select(this)
            .attr("stroke", count === 0 ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.1)")
            .attr("stroke-width", 0.5)
            .attr("transform", "style(null)");
        })
        .on("click", () => {
          const label = yAxisType === "days" 
            ? `${DAYS_OF_WEEK[yVal]} at ${hour === 0 ? "12 AM" : hour === 12 ? "12 PM" : hour > 12 ? `${hour-12} PM` : `${hour} AM`}`
            : `${yVal} sound spikes near ${hour === 0 ? "12 AM" : hour === 12 ? "12 PM" : hour > 12 ? `${hour-12} PM` : `${hour} AM`}`;
          
          setSelectedCellInfo({
            label,
            hour,
            count,
            peakIntensity,
            events
          });
        });
      });
    });

  }, [aggregates, containerWidth, yAxisType]);

  const handleSimulateOccurrence = () => {
    // Inject a random historical sound entry to show interactive updates instantly
    const randomHr = Math.floor(Math.random() * 24);
    const randomDay = Math.floor(Math.random() * 7);
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const randomInt = Math.floor(40 + Math.random() * 55);
    const newId = `sim-${Date.now()}`;

    const newSimEvent: HistoricalSoundEvent = {
      id: newId,
      hour: randomHr,
      dayIndex: randomDay,
      category: randomCategory,
      intensity: randomInt,
      timestamp: `${DAYS_OF_WEEK[randomDay]}, ${randomHr === 0 ? '12:00 AM' : randomHr === 12 ? '12:00 PM' : randomHr > 12 ? `${randomHr-12}:00 PM` : `${randomHr}:00 AM`} (Simulation)`,
      dangerLevel: randomInt > 80 ? "high" : randomInt > 50 ? "medium" : "low"
    };

    setHistoricalData((prev) => [newSimEvent, ...prev]);
    
    // Auto-select latest triggered cell info to highlight updates
    setSelectedCellInfo({
      label: `${DAYS_OF_WEEK[randomDay]} at ${randomHr}:00`,
      hour: randomHr,
      count: 1,
      peakIntensity: randomInt,
      events: [newSimEvent]
    });
  };

  const handleClearHistory = () => {
    setHistoricalData([]);
    setSelectedCellInfo(null);
  };

  const currentMaxCategory = useMemo(() => {
    if (noisemakerRanks.length === 0) return { name: "Awaiting logs", count: 0 };
    return noisemakerRanks[0];
  }, [noisemakerRanks]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6" id="d3-sound-historical-heatmap">
      {/* Header section detailing goals */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-sans font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400 animate-pulse" />
            Environmental Sound Heatmap
          </h2>
          <p className="text-slate-400 text-xs text-left max-w-2xl">
            A comprehensive D3-powered analytical calendar matching cumulative noise spikes. Spot hourly cycles and determine the loudest recurring noisemakers inside your residential room.
          </p>
        </div>

        {/* View toggles & Action Simulation controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-xl items-center gap-1">
            <button
              onClick={() => setYAxisType("days")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                yAxisType === "days" ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Weekly Rhythm
            </button>
            <button
              onClick={() => setYAxisType("categories")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                yAxisType === "categories" ? "bg-indigo-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Noise Categories
            </button>
          </div>

          <button
            onClick={handleSimulateOccurrence}
            className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-305 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-bold"
            title="Inject simulated sound entry directly into the calendar matrices"
          >
            <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Simulate Ping
          </button>
        </div>
      </div>

      {/* Primary stats overview blocks layout  */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric A: Primary Loudest recurring culprit */}
        <div className="bg-slate-950 p-4 border border-slate-850/80 rounded-2xl flex items-center space-x-3.5 text-left">
          <div className="w-11 h-11 rounded-xl bg-pink-950/50 border border-pink-850/40 flex items-center justify-center text-pink-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase text-slate-500 font-bold">Loudest Culprit</p>
            <p className="text-sm font-extrabold text-slate-100 truncate">{currentMaxCategory.name}</p>
            <p className="text-[10px] text-slate-400 font-medium">
              Recorded <span className="text-pink-400 font-bold">{currentMaxCategory.count}x</span> this session
            </p>
          </div>
        </div>

        {/* Metric B: High density active hours */}
        <div className="bg-slate-950 p-4 border border-slate-850/80 rounded-2xl flex items-center space-x-3.5 text-left">
          <div className="w-11 h-11 rounded-xl bg-indigo-950/50 border border-indigo-850/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-500 font-bold">Loudest Hour Frame</p>
            <p className="text-sm font-extrabold text-slate-100">{busiestTimeStats.label || "No data"}</p>
            <p className="text-[10px] text-slate-400 font-medium">
              Peak density: <span className="text-indigo-400 font-bold">{busiestTimeStats.count} alerts</span> total
            </p>
          </div>
        </div>

        {/* Metric C: Clean summary of status */}
        <div className="bg-slate-950 p-4 border border-slate-850/80 rounded-2xl flex items-center space-x-3.5 text-left">
          <div className="w-11 h-11 rounded-xl bg-teal-950/50 border border-teal-850/40 flex items-center justify-center text-teal-400 shrink-0">
            <BarChart2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-500 font-bold">Environment Log Pool</p>
            <p className="text-sm font-extrabold text-slate-100">{historicalData.length} Incidents</p>
            <p className="text-[10px] text-slate-400 font-medium">
              Aggregate records analyzed over time
            </p>
          </div>
        </div>
      </div>

      {/* D3 Heatmap grid rendering parent */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 md:p-6 overflow-hidden relative">
        {/* Dynamic color scalar indicator gauge */}
        <div className="absolute top-4 right-6 flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
          <span>Quiet</span>
          <span className="w-2.5 h-2.5 rounded bg-[#020617] border border-slate-800" />
          <span className="w-2.5 h-2.5 rounded bg-[#0f766e]" />
          <span className="w-2.5 h-2.5 rounded bg-[#4f46e5]" />
          <span className="w-2.5 h-2.5 rounded bg-[#ec4899]" />
          <span>Active Noise</span>
        </div>

        <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold text-left mb-4">
          {yAxisType === "days" ? "X-Axis: Hour scale | Y-Axis: Calendar Day" : "X-Axis: Hour scale | Y-Axis: Decibel Category"}
        </div>

        {historicalData.length === 0 ? (
          <div className="py-24 text-center text-slate-600 space-y-3">
            <Volume2 className="w-10 h-10 mx-auto text-slate-700 animate-pulse" />
            <div>
              <p className="text-xs font-semibold text-slate-400">Heatmap Data Clean</p>
              <p className="text-[10px] text-slate-550 max-w-sm mx-auto leading-relaxed">
                No telemetry alerts found in buffer database. Use the "Simulate Ping" button or sound classifier to watch active hourly cells highlight with colors!
              </p>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="w-full overflow-x-auto overflow-y-hidden">
            <svg ref={svgRef} className="mx-auto block" />
          </div>
        )}
      </div>

      {/* Bottom columns: Cell specific reports & Rank table */}
      {historicalData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Detailed analysis on SELECTED CELL */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between text-left">
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-2 flex items-center gap-1.5">
                <ListCollapse className="w-4 h-4 text-indigo-400" />
                Interpreted Cell Details
              </h3>

              {!selectedCellInfo ? (
                <div className="py-12 text-center text-slate-600 space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-800 mx-auto animate-pulse" />
                  <p className="text-xs">Interactive Tooltip Grid</p>
                  <p className="text-[10px] text-slate-550 max-w-xs mx-auto">
                    Click onto any colored pixel cell in the D3 matrix map coordinate above to inspect exact noise entries logged during that hour.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-indigo-400 uppercase font-black">Coordinates Target</span>
                    <p className="text-sm font-extrabold text-slate-100">{selectedCellInfo.label}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Occurrences</span>
                      <p className="text-lg font-black text-slate-205">{selectedCellInfo.count} times</p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Peak Volume</span>
                      <p className="text-lg font-black text-pink-400">{selectedCellInfo.peakIntensity ? `${selectedCellInfo.peakIntensity}%` : "0%"}</p>
                    </div>
                  </div>

                  {/* List of simulated details */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Logged Sub-events ({selectedCellInfo.events.length})</span>
                    {selectedCellInfo.events.length === 0 ? (
                      <p className="text-[10px] text-slate-550 italic">Quiet room period. No acoustic triggers registered.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                        {selectedCellInfo.events.map((evt, idx) => (
                          <div key={evt.id || idx} className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-[10px] text-slate-355 space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className="font-bold text-slate-200">{evt.category}</span>
                              <span className="text-slate-500">{evt.timestamp}</span>
                            </div>
                            <p className="text-[9px] text-slate-450">Peak Decibel Weight Equivalent: <span className="text-indigo-400 font-bold">{evt.intensity}%</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedCellInfo && (
              <div className="pt-2">
                <p className="text-[9px] text-slate-600 italic">
                  *Piles correspond to frequency overlaps detected near this precise interval.
                </p>
              </div>
            )}
          </div>

          {/* Ranks of most recurring noisemakers */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-pink-400" />
                  Identified Recurring Noisemakers
                </h3>

                <button
                  onClick={handleClearHistory}
                  className="text-[9px] font-mono text-slate-550 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Reset Heat Database
                </button>
              </div>

              {noisemakerRanks.length === 0 ? (
                <div className="py-12 text-center text-slate-650 text-xs">
                  No recurring noisemakers recognized. Activate sound input or seed events.
                </div>
              ) : (
                <div className="space-y-2 max-h-[190px] overflow-y-auto scrollbar-thin pr-1">
                  {noisemakerRanks.map((item, idx) => {
                    const mappedColor = item.danger === "high" ? "bg-red-500" : item.danger === "medium" ? "bg-yellow-500" : "bg-blue-500";
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900 border border-slate-850/60 rounded-xl flex items-center justify-between gap-3 transition-colors hover:border-slate-800"
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          {/* Circle matching rank index */}
                          <div className="w-6 h-6 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono font-black text-slate-400 flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-205 truncate">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${mappedColor}`} />
                              <span className="text-[9px] font-mono text-slate-500 capitalize">Danger: {item.danger}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-indigo-400 font-mono">{item.count} detections</p>
                          <p className="text-[9px] font-mono text-slate-550">Avg Intensity: {item.avgIntensity}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-850/30 text-[10px] text-slate-500 leading-normal mt-3">
              💡 **Insight**: Environmental sound mapping enables hearing-impaired users to quickly detect cyclic patterns, such as morning delivery door knocks or regular afternoon dog activities.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
