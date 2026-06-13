import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Maximum request body size for recorded audio payloads (e.g., 10MB)
app.use(express.json({ limit: "10mb" }));

// Initialize the Gemini SDK
// Always check for GEMINI_API_KEY before executing
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Preset Sounds list for simulation and fallback lookup
const PRESETS = [
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

// Endpoint to list environmental presets
app.get("/api/presets", (req, res) => {
  res.json({ presets: PRESETS });
});

// Primary Endpoint: Classify audio recorded by the device via Gemini API
app.post("/api/classify", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Missing 'audio' base64 payload in request body." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not defined. Using high-fidelity local simulation mode.");
      // We will select a preset item dynamically to resemble direct classification
      const randomPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      return res.json({
        soundName: `${randomPreset.soundName} (Simulated)`,
        confidence: parseFloat((0.82 + Math.random() * 0.15).toFixed(2)),
        dangerLevel: randomPreset.dangerLevel,
        hapticSignature: randomPreset.hapticSignature,
        vibrationPattern: randomPreset.vibrationPattern,
        visualColor: randomPreset.visualColor,
        descriptionText: `${randomPreset.descriptionText} (Note: Configure GEMINI_API_KEY in Settings to enable real-time multimodal generative classification).`
      });
    }

    const ai = getGeminiClient();

    const audioPart = {
      inlineData: {
        data: audio,
        mimeType: mimeType || "audio/webm",
      },
    };

    const promptText = `
      You are Earcon Sono, an assistive AI agent that acts as real-time auditory ears for the deaf and hard of hearing.
      Analyze this environmental audio sample. Identify what the primary environmental sound is (e.g. fire alarm, police siren, knocking, crying child, dog barking, running tap, washing machine cycle, microwave beep, thunder, clapping).
      Determine if it represents danger, require notification, and detail a custom, sensory physical vibration trigger (vibrationPattern array of active buzz vs inactive periods in ms) to make the user clearly distinguish this category.
      Provide response strictly in the structured schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        audioPart,
        { text: promptText }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            soundName: {
              type: Type.STRING,
              description: "The identified sound category (e.g., 'Emergency Alarm', 'Doorbell Bell', 'Heavy Clapping'). Maximum 4 words."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Float confidence rating from 0.0 to 1.0 based on clarity."
            },
            dangerLevel: {
              type: Type.STRING,
              description: "How critical is this sound: 'low' (casual), 'medium' (important to notice), 'high' (immediate danger)."
            },
            hapticSignature: {
              type: Type.STRING,
              description: "Haptic descriptor identifier: 'long-alert', 'rapid-pulses', 'double-tap', 'gentle-glow', 'staccato'."
            },
            vibrationPattern: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Vibration pattern millisecond intervals, alternating [vibrate, sleep, vibrate, sleep...]. Example: [300, 100, 300]."
            },
            visualColor: {
              type: Type.STRING,
              description: "Visual hue to blink for this alert: 'red' (emergency), 'yellow' (attention), 'blue' (visits), 'green' (calls), 'purple' (general/nature)."
            },
            descriptionText: {
              type: Type.STRING,
              description: "A friendly, ultra-short summary helper text (max 15 words) describing the noise event to a deaf user."
            }
          },
          required: [
            "soundName",
            "confidence",
            "dangerLevel",
            "hapticSignature",
            "vibrationPattern",
            "visualColor",
            "descriptionText"
          ]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No readable text output generated from Gemini API.");
    }

    const result = JSON.parse(textOutput.trim());
    return res.json(result);

  } catch (error: any) {
    console.error("Gemini Classify Error: ", error);
    return res.status(500).json({
      error: "Unable to classify sound sample.",
      details: error.message || "Unknown error occurred."
    });
  }
});

// Fallback Endpoint: Describe a physical sound (e.g., if user writes a query like 'someone drumming on the desk' or 'a sharp bell ringing')
app.post("/api/describe-text", async (req, res) => {
  try {
    const { textDescription } = req.body;
    if (!textDescription) {
      return res.status(400).json({ error: "Missing 'textDescription' query parameters." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not defined. Matching query string filters offline.");
      const descriptionNormalized = (textDescription || "").toLowerCase();

      let matchedPreset = PRESETS[2]; // Default to Door Knocking
      if (descriptionNormalized.includes("siren") || descriptionNormalized.includes("fire") || descriptionNormalized.includes("alarm") || descriptionNormalized.includes("smoke")) {
        matchedPreset = PRESETS[4]; // Smoke/Fire Detector
      } else if (descriptionNormalized.includes("cry") || descriptionNormalized.includes("baby") || descriptionNormalized.includes("scream") || descriptionNormalized.includes("child")) {
        matchedPreset = PRESETS[1]; // Baby Crying
      } else if (descriptionNormalized.includes("dog") || descriptionNormalized.includes("bark") || descriptionNormalized.includes("howl")) {
        matchedPreset = PRESETS[3]; // Dog Barking
      } else if (descriptionNormalized.includes("phone") || descriptionNormalized.includes("ring") || descriptionNormalized.includes("call")) {
        matchedPreset = PRESETS[5]; // Phone Ringing
      } else if (descriptionNormalized.includes("knock") || descriptionNormalized.includes("door") || descriptionNormalized.includes("gate")) {
        matchedPreset = PRESETS[2]; // Door Knocking
      }

      return res.json({
        soundName: `${matchedPreset.soundName} (Offline Match)`,
        confidence: 0.95,
        dangerLevel: matchedPreset.dangerLevel,
        hapticSignature: matchedPreset.hapticSignature,
        vibrationPattern: matchedPreset.vibrationPattern,
        visualColor: matchedPreset.visualColor,
        descriptionText: `Filtered query matched: "${textDescription}". (Note: Connect GEMINI_API_KEY to trigger custom, unstructured generative haptic patterns).`
      });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        The user wants to generate an tactile-haptic earcon signature and visual cues for the following written description of a sound: "${textDescription}".
        Map this sound description to custom visual flashing colors, alert levels, and vibration pulses.
        Respond in JSON conforming to the structural specifications.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            soundName: { type: Type.STRING, description: "Normalized sound label." },
            confidence: { type: Type.NUMBER },
            dangerLevel: { type: Type.STRING },
            hapticSignature: { type: Type.STRING },
            vibrationPattern: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER }
            },
            visualColor: { type: Type.STRING },
            descriptionText: { type: Type.STRING }
          },
          required: [
            "soundName",
            "confidence",
            "dangerLevel",
            "hapticSignature",
            "vibrationPattern",
            "visualColor",
            "descriptionText"
          ]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    return res.json(result);

  } catch (error: any) {
    console.error("Describe text sound error: ", error);
    return res.status(500).json({
      error: "Unable to analyze textual sound query.",
      details: error.message || "Unknown error occurred"
    });
  }
});

// Real-time voice transcript summarizer & analysis endpoint for accessibility assist
app.post("/api/analyze-speech", async (req, res) => {
  try {
    const { conversationText } = req.body;
    if (!conversationText || conversationText.trim().length === 0) {
      return res.status(400).json({ error: "Missing or empty 'conversationText' to analyze." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not defined. Distilling dialogue text simulation.");
      const textLower = conversationText.toLowerCase();

      let summary = "The speaker mentioned standard room updates and greeting words.";
      let sentiment = "casual";
      let keywords = ["hello", "captioning", "room"];
      let actionItems = ["Listen comfortably", "No loud noises detected"];
      let visualColor = "purple";

      if (textLower.includes("smoke") || textLower.includes("fire") || textLower.includes("alarm") || textLower.includes("detector")) {
        summary = "Emergency siren or fire combustion detector activation warning!";
        sentiment = "urgent";
        keywords = ["alarm", "detector", "safety", "hazard"];
        actionItems = ["Verify exit vectors immediately", "Acknowledge alert flash strobe"];
        visualColor = "red";
      } else if (textLower.includes("cry") || textLower.includes("baby") || textLower.includes("crying")) {
        summary = "An infant or baby is calling out or crying needing comfort.";
        sentiment = "tense";
        keywords = ["baby", "distress", "crying", "crib"];
        actionItems = ["Inspect the kitchen or cradle area", "Check the nanny monitor"];
        visualColor = "yellow";
      } else if (textLower.includes("knock") || textLower.includes("door") || textLower.includes("gate")) {
        summary = "An alert stating a knock or visual entry door sound has been noticed.";
        sentiment = "professional";
        keywords = ["doorbell", "visitor", "knock", "entry"];
        actionItems = ["Head to the front vestibule or outer entry gate"];
        visualColor = "blue";
      } else if (textLower.includes("hello") || textLower.includes("welcome")) {
        summary = "Warm friendly room introductions and greetings were spoken.";
        sentiment = "cheerful";
        keywords = ["welcome", "social", "friendly"];
        actionItems = ["Provide friendly visual sign gestures or greetings"];
        visualColor = "green";
      }

      return res.json({
        summary,
        sentiment,
        keywords,
        actionItems,
        visualColor
      });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        Analyze the following real-time environmental speaking transcript:
        "${conversationText}"

        Summarize the key core context beautifully in short high-level plain words.
        Estimate the general emotional sentiment/tension involved ('cheerful', 'urgent', 'casual', 'tense', 'professional').
        Identify up to 5 key topical words (keywords).
        Highlight up to 3 helpful action items or things the user (who is hard of hearing) should notice.
        Choose a corresponding color accent ('red' for urgent, 'yellow' for tense, 'blue' for professional/visiting, 'green' for cheerful, 'purple' for general casual).

        Provide output formatted strictly to responseSchema.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A beautifully composed 1-sentence summary of the transcript (max 20 words)." },
            sentiment: { type: Type.STRING, description: "One of: cheerful, urgent, casual, tense, professional." },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Up to 5 highly relevant keyword terms extracted from the transcript."
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Up to 3 clear, concise action items to keep the user secure and well-informed."
            },
            visualColor: { type: Type.STRING, description: "Pick one: 'red', 'yellow', 'blue', 'green', 'purple'." }
          },
          required: [
            "summary",
            "sentiment",
            "keywords",
            "actionItems",
            "visualColor"
          ]
        }
      }
    });

    const parsedResult = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsedResult);

  } catch (error: any) {
    console.error("Analyze speech transcript error: ", error);
    return res.status(500).json({
      error: "Unable to analyze transcribed speech segments.",
      details: error.message || "Unknown error occurred"
    });
  }
});

async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Earcon Sono backend service booted successfully on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});
