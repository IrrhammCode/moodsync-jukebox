import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

// Ensure output directory exists (we serve these statically via Express)
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

export const AudioService = {
  /**
   * Generates TTS using ElevenLabs and saves it to a public folder.
   * Accepts dynamic voice parameters for persona-specific voices.
   */
  async generateDJVoice(
     text: string, 
     voiceId: string = "ErXwobaYiN019PkySvjV",
     stability: number = 0.5,
     similarity: number = 0.75,
     externalApiKey?: string
  ): Promise<string | null> {
    const apiKey = externalApiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.includes('your_elevenlabs_key')) {
      console.warn("[AudioService] Missing ElevenLabs API Key. Using fallback voice audio.");
      return "/audio/fallback_voice.mp3";
    }

    try {
      console.log(`[AudioService] Generating Voice TTS (Voice: ${voiceId}): "${text.substring(0, 30)}..."`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: stability,
            similarity_boost: similarity
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API Error: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fileName = `voice_${crypto.randomBytes(8).toString('hex')}.mp3`;
      const filePath = path.join(AUDIO_DIR, fileName);
      
      fs.writeFileSync(filePath, Buffer.from(buffer));
      
      // Return the public URL path
      return `/audio/${fileName}`;
    } catch (err: any) {
      console.error("[AudioService] Failed TTS Generation:", err.message);
      return "/audio/fallback_voice.mp3";
    }
  },

  /**
   * Generates a single full-length 3-minute mastertrack or a short looped track.
   */
  async generateFullTrack(basePrompt: string, externalApiKey?: string, durationMs: number = 180000): Promise<string[]> {
     const apiKey = externalApiKey || process.env.ELEVENLABS_API_KEY;
     if (!apiKey || apiKey.includes('your_elevenlabs_key')) {
       console.warn("[AudioService] Missing ElevenLabs API Key. Using fallback music.");
       return ["/audio/fallback_music.mp3"];
     }

     const fullPrompt = `${basePrompt}. Create a complete song with natural progression: gentle intro, building energy, powerful climax, and satisfying outro.`;

     console.log(`[AudioService] 🎵 Generating Track (${durationMs / 1000}s)...`);
     console.log(`[AudioService]   Prompt: "${fullPrompt.substring(0, 80)}..."`);

     try {
        const response = await fetch(`https://api.elevenlabs.io/v1/music/compose`, {
           method: "POST",
           headers: {
              "Accept": "audio/mpeg",
              "xi-api-key": apiKey,
              "Content-Type": "application/json"
           },
           body: JSON.stringify({
              prompt: fullPrompt,
              music_length_ms: durationMs,
              force_instrumental: true
           })
        });

        if (!response.ok) {
           throw new Error(`ElevenLabs Music API Error: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const fileSize = buffer.byteLength;
        const fileName = `music_full_${crypto.randomBytes(6).toString('hex')}.mp3`;
        const filePath = path.join(AUDIO_DIR, fileName);
        fs.writeFileSync(filePath, Buffer.from(buffer));

        console.log(`[AudioService] ✅ Track saved: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
        return [`/audio/${fileName}`];
     } catch (err: any) {
        console.error(`[AudioService] ❌ Track generation failed:`, err.message);
        return ["/audio/fallback_music.mp3"];
     }
  },
};
