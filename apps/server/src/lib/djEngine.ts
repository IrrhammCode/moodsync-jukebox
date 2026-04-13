import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface DJResponse {
  djScript: string;
  musicPrompt: string;
  sfxPrompt?: string; // Prompt for the Sound Effects API
}

export const DJEngine = {
  /**
   * Generates a conversational script for AURA and a corresponding music prompt via Google Gemini.
   */
   async generateTransition(
    activityContext: string,
    currentMood: string,
    vibe: string,
    imageBase64?: string,
    cycleCount: number = 0,
    roomUsers: string[] = [],
    personaName: string = "AURA",
    personaTone: string = ""
  ): Promise<DJResponse> {
    const isAdBreak = cycleCount % 4 === 3;
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userNames = roomUsers.length > 0 ? roomUsers.join(", ") : "Listeners";

    let promptText = `
      You are "${personaName}", the AI radio host for "MoodSync Jukebox".
      
      === YOUR PERSONALITY (FOLLOW THIS EXACTLY) ===
      ${personaTone || "You are a cool, hip radio DJ. Speak in English with a relatable tone."}
      === END PERSONALITY ===
      
      Here is your live studio telemetry:
      - Listeners in the room right now: ${userNames}
      - Listeners Activity: "${activityContext}"
      - Current Local Time: ${timeString}
      - Absolute Core Music Vibe: "${vibe}" (CRITICAL RULE: The music prompt MUST strictly follow this genre).
      - Detected Listener Mood: "${currentMood}"
      ${imageBase64 ? "- You have just received a LIVE snapshot of the room/listener. Use visual details (colors, lighting, clothes) to amaze them!" : "- No camera feed available right now."}
    `;

    if (isAdBreak) {
      promptText += `
      COMMERCIAL BREAK MODE:
      Instead of your usual music intro, you must perform a hilarious, satirical "AI Cyberpunk Parody Ad".
      Create a 2-3 sentence ad for a fake, futuristic tech product related to their activity.
      Make it funny and ON-BRAND with your personality above.
      `;
    } else {
      promptText += `
      REGULAR BROADCAST MODE:
      Provide a punchy 1-2 sentence script. Stay IN CHARACTER with your personality above!
      Acknowledge the time, their mood, or give a shoutout to a specific listener by name!
      `;
    }

    promptText += `
      Provide an output in strictly valid JSON format with three keys:
      1. "djScript": The exact words you will speak on air. (Maximum 40 words). MUST match your personality instructions above.
      2. "musicPrompt": A highly detailed text-to-music prompt for the background track. IT MUST BE STRICTLY IN THE GENRE OF "${vibe}". IMPORTANT: If the vibe is NOT "Chill / Lo-Fi", then STRICTLY FORBID the use of the word "lofi" or hip-hop elements.
      3. "sfxPrompt": (Optional) If you make a joke, say something hype, or do a parody ad, provide a 3-5 word prompt for a sound effect to play *during* your speech! (e.g., "audience laugh track", "airhorn", "ba dum tss drum", "futuristic whoosh"). Match it to your persona!

      Example JSON:
      {
        "djScript": "It's ${timeString} and I see ${userNames} locked in. Here's something special for you.",
        "musicPrompt": "Smooth jazz, double bass, saxophone, brushed drums, relaxed 85bpm",
        "sfxPrompt": "crowd cheering"
      }
    `;

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini_key')) {
         console.warn("[DJEngine] Fallback Triggered: No valid GEMINI_API_KEY found.");
         return this.getFallback(currentMood);
      }

      console.log(`[DJEngine] Generating transition via GEMINI for: Activity=[${activityContext}] Mood=[${currentMood}] Vibe=[${vibe}]`);

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      let payload: any = promptText;

      if (imageBase64) {
         try {
            // Strip data:image/jpeg;base64, prefix if present
            const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            const imagePart = {
               inlineData: {
                  data: base64Data,
                  mimeType: "image/jpeg"
               }
            };
            payload = [promptText, imagePart];
            console.log(`[DJEngine] Vision enabled: Sending room snapshot to Gemini for deep analysis.`);
         } catch (e) {
            console.warn(`[DJEngine] Failed to parse image base64, falling back to text only.`);
            payload = promptText;
         }
      }

      const result = await model.generateContent(payload);
      const content = result.response.text();

      if (!content) throw new Error("No content generated");
      
      const parsed = JSON.parse(content) as DJResponse;
      console.log(`[DJEngine] Output -> Voice: "${parsed.djScript}"`);
      return parsed;

    } catch (err: any) {
      console.error("[DJEngine] Failed to generate transition via Gemini:", err.message);
      return this.getFallback(currentMood);
    }
  },

  getFallback(mood: string): DJResponse {
     if (mood === "sad" || mood === "tired") {
        return {
           djScript: "Hey everyone, energy feels a bit low right now. Let's lift those spirits up with this next track!",
           musicPrompt: "Uplifting energetic EDM, bright synths, driving bassline, 128bpm",
           sfxPrompt: "magic sparkle transition"
        }
     }
     return {
        djScript: "MoodSync is running smoothly! Keep that great energy going, here is your next track.",
        musicPrompt: "Chill lo-fi hip hop, warm pads, vinyl crackle, 85bpm",
        sfxPrompt: "short record scratch"
     }
  }
};
