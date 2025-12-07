import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// ADAPTATION FOR HYBRID ENVIRONMENTS (PC/Vite vs Cloud Sandbox):
// 1. We safely check if 'import.meta.env' exists before accessing 'VITE_API_KEY'.
// 2. If not found, we fallback to 'process.env.API_KEY'.
const getApiKey = () => {
  try {
    // Check for Vite environment
    if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore errors if import.meta is not supported
  }
  
  // Fallback to standard process.env (Sandbox / Node)
  try {
    return process.env.API_KEY;
  } catch (e) {
    console.error("Process environment not available");
    return undefined;
  }
};

const apiKey = getApiKey();

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Brief summary of the visual scene." },
    personCount: { type: Type.INTEGER, description: "Estimated number of people in the frame." },
    threatLevel: { 
      type: Type.STRING, 
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      description: "Security threat level assessment."
    },
    detectedObjects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of key objects identified (e.g., backpack, car, knife)."
    },
    anomalies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of potential security anomalies (e.g., unattended bag, running person, fire)."
    }
  },
  required: ["summary", "personCount", "threatLevel", "detectedObjects", "anomalies"]
};

export const analyzeFrame = async (base64Image: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    return {
      timestamp: new Date().toISOString(),
      summary: "API Key Missing. Please check your .env file.",
      personCount: 0,
      threatLevel: "LOW",
      detectedObjects: [],
      anomalies: ["Configuration Error"]
    };
  }

  try {
    // Remove header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: "Analyze this CCTV surveillance frame. Identify security threats, count people, and describe the scene strictly for a security dashboard."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        systemInstruction: "You are an advanced AI Security Analyst monitoring CCTV feeds. Be precise, concise, and focused on safety and security anomalies."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const data = JSON.parse(text);
    
    return {
      timestamp: new Date().toISOString(),
      ...data
    };

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || '';
    
    // Specific handling for Rate Limits / Quota Exceeded (429)
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        console.warn("Gemini API Rate Limit hit. Returning fallback.");
        return {
            timestamp: new Date().toISOString(),
            summary: "Service busy (Quota). Retrying...",
            personCount: 0,
            threatLevel: "LOW",
            detectedObjects: [],
            anomalies: ["Rate Limit Reached"]
        };
    }

    console.error("Gemini Analysis Failed:", error);
    // Return a fallback result to prevent app crash
    return {
      timestamp: new Date().toISOString(),
      summary: "Analysis failed due to API error.",
      personCount: 0,
      threatLevel: "LOW",
      detectedObjects: [],
      anomalies: ["System Error"]
    };
  }
};