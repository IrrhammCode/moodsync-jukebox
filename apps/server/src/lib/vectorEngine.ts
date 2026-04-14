import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const TP_BASE_URL = "https://api.turbopuffer.com/v1/namespaces";
const NAMESPACE_FORESIGHT = "aura_foresight";
const NAMESPACE_TRACKS = "aura_track_memory";
const GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent";

export const VectorEngine = {
  /**
   * Generates a 768-D vector mapping of a user's emotional trajectory using Gemini.
   */
  async getEmbedding(text: string, externalGeminiKey?: string): Promise<number[]> {
    const apiKey = externalGeminiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding failed: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.embedding.values; // Returns number[]
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
    const tpKey = externalKeys?.tp || process.env.TURBOPUFFER_API_KEY;
    if (!tpKey || tpKey.includes("your_turbopuffer")) return null;

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
         return null;
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
      return null;
    } catch (err: any) {
      console.error("[VectorEngine] Prediction error:", err.message);
      return null;
    }
  },

  /**
   * Memorizes a successful track generation to save credits later.
   */
  async memorizeTrack(vibe: string, mood: string, activity: string, urls: string[], externalKeys?: { tp?: string, gemini?: string }) {
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
              urls: JSON.stringify(urls)
            }
          }]
        })
      });
      console.log(`[VectorEngine] 💾 Saved track mapping to Memory for Activity: "${activity}"`);
    } catch(err) {
      console.error("[VectorEngine] Failed tracking memory:", err);
    }
  },

  /**
   * Searches Turbopuffer for an existing track that perfectly matches the semantic meaning of the current activity/mood.
   */
  async findBestMatchingTrack(activity: string, mood: string, vibe: string, externalKeys?: { tp?: string, gemini?: string }): Promise<string[] | null> {
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
          limit: 1,
          include_attributes: ["urls", "vibe"]
        })
      });

      if (!res.ok) return null;
      
      const data = await res.json();
      // High strictness: must be < 0.15 distance (approx 85%+ exact conceptual match) to reuse
      if (data && data.length > 0 && data[0].dist < 0.15 && data[0].attributes.vibe === vibe) {
         console.log(`[VectorEngine] 💰 CREDIT SAVED: Found semantic match for "${activity}" (Score: ${data[0].dist})`);
         return JSON.parse(data[0].attributes.urls);
      }
      return null;
    } catch(err) {
      return null;
    }
  },

  /**
   * Retrieves raw memories for the Analytics Dashboard UI
   */
  async listMemories(): Promise<any[]> {
    const tpKey = process.env.TURBOPUFFER_API_KEY;
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
