import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const TP_BASE_URL = "https://api.turbopuffer.com/v1/namespaces";
const NAMESPACE_FORESIGHT = "aura_foresight";
const NAMESPACE_TRACKS = "aura_track_memory";
const NAMESPACE_EPISODIC = "aura_dj_episodic";
const NAMESPACE_INTERVENTIONS = "aura_interventions";
const GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent";

export const VectorEngine = {
  /**
   * Generates a 768-D vector mapping of a user's emotional trajectory using Gemini.
   */
  async getEmbedding(text: string, externalGeminiKey?: string): Promise<number[]> {
    const apiKey = externalGeminiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[VectorEngine] GEMINI_API_KEY missing. Returning zero vector.");
      return Array(768).fill(0);
    }

    try {
      const res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] }
        })
      });

      if (!res.ok) {
        throw new Error(`Embedding failed: ${res.status}`);
      }

      const data = await res.json();
      return data.embedding.values; // Returns number[]
    } catch(err: any) {
      console.warn("[VectorEngine] Embedding prediction failed. Returning zero vector. ", err.message);
      return Array(768).fill(0);
    }
  },

  /**
   * Memorizes an emotional trajectory into Turbopuffer's Vector DB
   * so AURA can learn from it in the future.
   */
  async memorizeTrajectory(roomCode: string, trajectoryText: string, finalMood: string, externalKeys?: { tp?: string, gemini?: string }) {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) {
      console.warn("[VectorEngine] Skipped: No Turbopuffer Key configured.");
      return;
    }

    try {
      const vector = await this.getEmbedding(trajectoryText, externalKeys?.gemini);
      
      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_FORESIGHT}/upsert`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tpKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          upsert_rows: [{
            id: Date.now(), // Unique integer ID
            vector: vector,
            attributes: {
              room: roomCode,
              result: finalMood,
              trajectory: trajectoryText
            }
          }]
        })
      });

      if (!res.ok) {
        throw new Error(`Turbopuffer Upsert Error: ${await res.text()}`);
      }
      
      console.log(`[VectorEngine] 🧠 Memorized Trajectory: [${trajectoryText}] -> led to: ${finalMood}`);
    } catch (err: any) {
      console.error("[VectorEngine] Failed to memorize trajectory:", err.message);
    }
  },

  /**
   * Queries Turbopuffer to predict what happens based on the current trajectory.
   * If it finds a past scenario, it returns the predicted "Next Mood" and similarity score.
   */
  async predictNextMood(currentTrajectory: string, externalKeys?: { tp?: string, gemini?: string }): Promise<{ predictedMood: string, score: number, memoryText: string } | null> {
    const fallbackResponse = {
       predictedMood: "steady state",
       score: 0.5,
       memoryText: "Fallback heuristic applied: maintaining current atmospheric pressure."
    };

    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return fallbackResponse;

    try {
      const vector = await this.getEmbedding(currentTrajectory, externalKeys?.gemini);

      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_FORESIGHT}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tpKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rank_by: ["vector", "ANN", vector],
          limit: 1,
          include_attributes: ["result", "trajectory"]
        })
      });

      if (!res.ok) {
         return fallbackResponse;
      }

      const data = await res.json();
      if (data && data.length > 0 && data[0].dist < 0.3) {
         // High similarity found!
         return {
            predictedMood: data[0].attributes.result,
            score: data[0].dist,
            memoryText: data[0].attributes.trajectory
         };
      }
      return fallbackResponse;
    } catch (err: any) {
      console.error("[VectorEngine] Prediction error:", err.message);
      return fallbackResponse;
    }
  },

  /**
   * Memorizes a successful track generation to save credits later.
   */
  async memorizeTrack(vibe: string, mood: string, activity: string, urls: string[], externalKeys?: { tp?: string, gemini?: string }, durationMs?: number) {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return;

    try {
      const contextStr = `Activity: ${activity}. Core Feeling: ${mood}. Desired Vibe: ${vibe}.`;
      const vector = await this.getEmbedding(contextStr, externalKeys?.gemini);

      await fetch(`${TP_BASE_URL}/${NAMESPACE_TRACKS}/upsert`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tpKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          upsert_rows: [{
            id: Date.now(),
            vector: vector,
            attributes: {
              vibe, mood, activity,
              durationMs: durationMs || 15000,
              urls: JSON.stringify(urls)
            }
          }]
        })
      });
      console.log(`[VectorEngine] 💾 Saved track mapping to Memory for Activity: "${activity}" (Duration: ${durationMs})`);
    } catch(err) {
      console.error("[VectorEngine] Failed tracking memory:", err);
    }
  },

  /**
   * Searches Turbopuffer for an existing track that perfectly matches the semantic meaning of the current activity/mood.
   */
  async findBestMatchingTrack(activity: string, mood: string, vibe: string, externalKeys?: { tp?: string, gemini?: string }, expectedDurationMs: number = 180000): Promise<string[] | null> {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return null;

    try {
      const contextStr = `Activity: ${activity}. Core Feeling: ${mood}. Desired Vibe: ${vibe}.`;
      const vector = await this.getEmbedding(contextStr, externalKeys?.gemini);

      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_TRACKS}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tpKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rank_by: ["vector", "ANN", vector],
          limit: 3, // Fetch a few to check attributes
          include_attributes: ["urls", "vibe", "durationMs"]
        })
      });

      if (!res.ok) return null;
      
      const data = await res.json();
      // High strictness: must be < 0.15 distance (approx 85%+ exact conceptual match) to reuse
      // We also check duration. A Pro user needs exactly their duration. A Free user can take any duration.
      if (data && data.length > 0) {
         for (let i = 0; i < data.length; i++) {
           const track = data[i];
           if (track.dist < 0.15 && track.attributes.vibe === vibe) {
             const trackDuration = track.attributes.durationMs || 180000;
             // If Pro (180k), only accept 180k tracks. If Free (15k), accept any track.
             if (expectedDurationMs === 180000 && trackDuration !== 180000) continue;
             
             console.log(`[VectorEngine] 💰 CREDIT SAVED: Found semantic match for "${activity}" (Score: ${track.dist})`);
             return JSON.parse(track.attributes.urls);
           }
         }
      }
      return null;
    } catch(err) {
      return null;
    }
  },

  /**
   * Memorizes a DJ script into episodic memory for context in future generations.
   */
  async memorizeDJScript(roomCode: string, scriptText: string, externalKeys?: { tp?: string, gemini?: string }) {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return;

    try {
      const vector = await this.getEmbedding(scriptText, externalKeys?.gemini);
      
      await fetch(`${TP_BASE_URL}/${NAMESPACE_EPISODIC}/upsert`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${tpKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          upsert_rows: [{
            id: Date.now(),
            vector: vector,
            attributes: { room: roomCode, text: scriptText, timestamp: Date.now() }
          }]
        })
      });
      console.log(`[VectorEngine] 🧠 Stored DJ Episodic Memory for room ${roomCode}`);
    } catch (err: any) {
      console.error("[VectorEngine] Failed to memorize DJ script:", err.message);
    }
  },

  /**
   * Recalls the last few DJ scripts for a room to provide continuity to Llama 3.
   */
  async recallEpisodicMemory(roomCode: string, externalKeys?: { tp?: string, gemini?: string }): Promise<string> {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return "";

    try {
      // Query with a zero vector but filter by room ID to get recent memories for this room.
      const vector = Array(768).fill(0);
      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_EPISODIC}/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${tpKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          rank_by: ["vector", "ANN", vector],
          filters: ["room", "Eq", roomCode],
          limit: 3,
          include_attributes: ["text", "timestamp"]
        })
      });

      if (!res.ok) return "";
      const data = await res.json();
      if (!data || data.length === 0) return "";
      
      // Sort by timestamp desc and format
      data.sort((a: any, b: any) => b.attributes.timestamp - a.attributes.timestamp);
      const history = data.map((d: any) => `- You recently said: "${d.attributes.text}"`).join("\n      ");
      return history;

    } catch (err: any) {
      return "";
    }
  },

  /**
   * Memorizes a successful mood intervention (e.g. going from sad to happy).
   */
  async memorizeIntervention(startMood: string, endMood: string, musicPrompt: string, vibe: string, externalKeys?: { tp?: string, gemini?: string }) {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return;

    try {
      const contextStr = `Shifted mood from ${startMood} to ${endMood}`;
      const vector = await this.getEmbedding(contextStr, externalKeys?.gemini);
      
      await fetch(`${TP_BASE_URL}/${NAMESPACE_INTERVENTIONS}/upsert`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${tpKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          upsert_rows: [{
            id: Date.now(),
            vector: vector,
            attributes: { startMood, endMood, musicPrompt, vibe }
          }]
        })
      });
      console.log(`[VectorEngine] 🧠 Learned Intervention: ${startMood} -> ${endMood} using [${vibe}]`);
    } catch (err: any) {
      console.error("[VectorEngine] Failed to memorize intervention:", err.message);
    }
  },

  /**
   * Recommends a music prompt based on past successful interventions for a struggling mood.
   */
  async recommendIntervention(currentMood: string, desiredMood: string, externalKeys?: { tp?: string, gemini?: string }): Promise<{ musicPrompt: string, vibe: string } | null> {
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return null;

    try {
      const contextStr = `Shifted mood from ${currentMood} to ${desiredMood}`;
      const vector = await this.getEmbedding(contextStr, externalKeys?.gemini);

      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_INTERVENTIONS}/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${tpKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          rank_by: ["vector", "ANN", vector],
          limit: 1,
          filters: [ ["startMood", "Eq", currentMood], "And", ["endMood", "Eq", desiredMood] ],
          include_attributes: ["musicPrompt", "vibe"]
        })
      });

      if (!res.ok) return null;
      const data = await res.json();
      
      if (data && data.length > 0 && data[0].dist < 0.25) {
         console.log(`[VectorEngine] 💡 Intervention Recommended: Past memory shows [${data[0].attributes.vibe}] works for ${currentMood}->${desiredMood}`);
         return {
            musicPrompt: data[0].attributes.musicPrompt,
            vibe: data[0].attributes.vibe
         };
      }
      return null;
    } catch (err: any) {
      return null;
    }
  },

  /**
   * Retrieves raw memories for the Analytics Dashboard UI
   */
  async listMemories(externalApiKey?: string): Promise<any[]> {
    const tpKey = externalApiKey || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return [];
    
    try {
      // Due to Turbopuffer query design, we use a zero-vector or just fetch IDs if possible.
      // Since ANN is mandatory, we will send a zero vector.
      const zeroVector = Array(768).fill(0);
      const res = await fetch(`${TP_BASE_URL}/${NAMESPACE_FORESIGHT}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tpKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rank_by: ["vector", "ANN", zeroVector],
          limit: 50,
          include_attributes: ["trajectory", "result"]
        })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data;
    } catch(err) {
      return [];
    }
  }
};
