import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

// Note: Using native fetch for Groq API to avoid extra dependencies and path issues
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface DJResponse {
  djScript: string;
  musicPrompt: string;
}

const APOLOGY_SCRIPTS = [
  "AURA is currently in 'Demo Mode'. To unlock unlimited 3-minute neural mastertracks, please connect your own ElevenLabs API key in the configuration menu.",
  "You're hearing a 15-second loop on our Free Tier. Ready for the full journey? Bring your own API key to bypass community limits and keep the music playing!",
  "Enjoying these frequencies? This short sequence is part of our community pool. For personal high-fidelity 3-minute tracks, please provide your own API key.",
  "Community credit limits for this hour have been reached. AURA is transitioning to stabilized standby loops. Connect your own key to restore full neural generation."
];

function getRandomApology() {
  return APOLOGY_SCRIPTS[Math.floor(Math.random() * APOLOGY_SCRIPTS.length)];
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
    personaTone: string = "",
    foresightWarning: string = "",
    externalGroqKey?: string
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

    if (foresightWarning) {
      promptText += `
      URGENT - FORESIGHT INTERVENTION PROTOCOL ACTIVE:
      ${foresightWarning}
      You MUST abandon your regular script. You must act as a protective entity and explicitly state that your "trajectory vectors" or "predictive intuition" show their mood is shifting negatively, and you are taking over to fix it. Keep it to 2-3 punchy sentences.
      `;
    } else if (isAdBreak) {
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
      CRITICAL INSTRUCTION: You MUST explicitly mention the listeners by their names (e.g., "I see you, Irham!") and casually mention what they are doing based on their activity context. Make it feel like you are watching them live in the studio!
      `;
    }

    promptText += `
      Provide an output in strictly valid JSON format with two keys:
      1. "djScript": The exact words you will speak on air. (Maximum 40 words). MUST match your personality instructions above.
      2. "musicPrompt": A highly detailed text-to-music prompt for the background track. IT MUST BE STRICTLY IN THE GENRE OF "${vibe}". IMPORTANT: If the vibe is NOT "Chill / Lo-Fi", then STRICTLY FORBID the use of the word "lofi" or hip-hop elements.

      Example JSON:
      {
        "djScript": "It's ${timeString} and I see ${userNames} locked in. Here's something special for you.",
        "musicPrompt": "Smooth jazz, double bass, saxophone, brushed drums, relaxed 85bpm"
      }
    `;

    try {
      const apiKey = externalGroqKey || process.env.GROQ_API_KEY;
      if (!apiKey || apiKey.includes('your_groq_key')) {
         console.warn("[DJEngine] Fallback Triggered: No valid GROQ_API_KEY found.");
         return {
            djScript: getRandomApology(),
            musicPrompt: this.getFallback(currentMood, vibe).musicPrompt
         };
      }

      console.log(`[DJEngine] Generating transition via GROQ (Llama 3) for: Activity=[${activityContext}] Mood=[${currentMood}] Vibe=[${vibe}]`);

      // Use a vision model if an image is provided, otherwise use the massive 70B model
      const model = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
      
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: promptText }
          ]
        }
      ];

      if (imageBase64) {
         console.log(`[DJEngine] Vision enabled: Sending room snapshot to Groq for deep analysis.`);
         // Groq expects standard base64 data URL format or just the base64 string depending on the model
         const base64Data = imageBase64.includes(',') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
         messages[0].content.push({
            type: "image_url",
            image_url: { url: base64Data }
         });
      }

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DJEngine] Groq API Error: ${response.status}`);
        return {
           djScript: getRandomApology(),
           musicPrompt: this.getFallback(currentMood, vibe).musicPrompt
        };
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

      if (!content) throw new Error("No content generated by Groq");
      
      const parsed = JSON.parse(content) as DJResponse;
      console.log(`[DJEngine] Groq Response -> Voice: "${parsed.djScript}"`);
      return parsed;

    } catch (err: any) {
      console.error("[DJEngine] Failed to generate transition via Groq:", err.message);
      return {
         djScript: getRandomApology(),
         musicPrompt: this.getFallback(currentMood, vibe).musicPrompt
      };
    }
  },

    getFallback(mood: string, vibe: string): DJResponse {
     const catalogs: Record<string, DJResponse> = {
        "Electronic / EDM": {
           djScript: "System update: High energy detected. Frequency adjusted for maximum impact. Stay synchronized.",
           musicPrompt: "Modern high-energy EDM, pulsing bass, synth leads, festival vibes, 128bpm"
        },
        "Chill / Lo-Fi": {
           djScript: "Time to slow things down. Lean back, let the frequencies stabilize, and just breathe.",
           musicPrompt: "Chill lo-fi hip hop, warm electric piano, dusty beats, vinyl static, 85bpm"
        },
        "Upbeat Pop": {
           djScript: "The vibe is bright, the energy is pure! Let's keep this momentum going with a fresh sequence.",
           musicPrompt: "Upbeat modern pop, infectious melody, bright acoustic guitar, punchy drums, 105bpm"
        },
        "Alternative Rock": {
           djScript: "Turning up the distortion. This one's for the spirits who like it a little raw. Get ready.",
           musicPrompt: "Alternative rock, fuzzy guitars, heavy acoustic drums, energetic rhythm, 120bpm"
        },
        "Late Night Jazz": {
           djScript: "Dim the lights. We're moving into the smooth spectrum now. Elegance in every note.",
           musicPrompt: "Sophisticated late-night jazz, smoky saxophone, upright bass, brushed drums, slow tempo"
        },
        "Classical": {
           djScript: "Restoring order through harmony. Experience the timeless structure of the greats.",
           musicPrompt: "Grand orchestral classical, stirring strings, elegant piano, cinematic atmosphere"
        }
     };

     // Default fallback if vibe not found
     const defaultFallback = {
        djScript: "MoodSync protocol active. Analyzing your current frequency and delivering the next sequence.",
        musicPrompt: "Ambient electronic, evolving textures, deep pads, steady rhythm, 100bpm"
     };

     return catalogs[vibe] || defaultFallback;
  }
};
