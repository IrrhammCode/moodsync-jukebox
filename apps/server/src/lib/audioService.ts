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
     similarity: number = 0.75
  ): Promise<string | null> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.includes('your_elevenlabs_key')) {
      console.warn("[AudioService] Missing ElevenLabs API Key. Using fallback voice audio.");
      return null;
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
      return null;
    }
  },

  /**
   * Generates a "Megamix" of 3 unique 30-second music segments SEQUENTIALLY.
   * Sequential generation avoids ElevenLabs 429 rate limits and ensures
   * all 3 segments are consistently delivered at full quality.
   */
  async generateMegamix(basePrompt: string): Promise<string[]> {
     const apiKey = process.env.ELEVENLABS_API_KEY;
     if (!apiKey || apiKey.includes('your_elevenlabs_key')) {
       console.warn("[AudioService] Missing ElevenLabs API Key. Using fallback music.");
       return [];
     }

     const variations = [
        `${basePrompt}. Section A: Gentle intro with soft melody.`,
        `${basePrompt}. Section B: Build up energy with stronger rhythm and fuller instruments.`,
        `${basePrompt}. Section C: Climax section with rich harmonies and powerful dynamics.`
     ];

     console.log(`[AudioService] 🎚️ Generating 3-Track Megamix (sequential, 30s each)...`);

     const urls: string[] = [];

     for (let i = 0; i < variations.length; i++) {
        const prompt = variations[i];
        try {
           console.log(`[AudioService]   Segment ${i + 1}/3: "${prompt.substring(0, 60)}..."`);

           const response = await fetch(`https://api.elevenlabs.io/v1/music/compose`, {
              method: "POST",
              headers: {
                 "Accept": "audio/mpeg",
                 "xi-api-key": apiKey,
                 "Content-Type": "application/json"
              },
              body: JSON.stringify({
                 prompt: prompt,
                 music_length_ms: 30000, // 30 seconds each
                 force_instrumental: true
              })
           });

           if (!response.ok) {
              throw new Error(`ElevenLabs Music API Error: ${response.status} ${response.statusText}`);
           }

           const buffer = await response.arrayBuffer();
           const fileSize = buffer.byteLength;
           const fileName = `music_seg${i}_${crypto.randomBytes(6).toString('hex')}.mp3`;
           const filePath = path.join(AUDIO_DIR, fileName);
           fs.writeFileSync(filePath, Buffer.from(buffer));

           console.log(`[AudioService]   ✅ Segment ${i + 1}/3 saved (${(fileSize / 1024).toFixed(0)} KB)`);
           urls.push(`/audio/${fileName}`);

           // Breather delay between requests (skip after the last one)
           if (i < variations.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500));
           }
        } catch (err: any) {
           console.error(`[AudioService]   ❌ Segment ${i + 1} failed:`, err.message);
        }
     }

     console.log(`[AudioService] ✅ Megamix complete: ${urls.length}/3 segments generated.`);
     return urls;
  },

  /**
   * Generates a short Sound Effect (SFX) using ElevenLabs.
   */
  async generateSFX(prompt: string): Promise<string | null> {
     const apiKey = process.env.ELEVENLABS_API_KEY;
     if (!apiKey || apiKey.includes('your_elevenlabs_key')) {
         return null;
     }

     try {
         console.log(`[AudioService] Generating SFX for prompt: "${prompt}"`);
         const response = await fetch(`https://api.elevenlabs.io/v1/sound-generation`, {
            method: "POST",
            headers: {
               "Accept": "audio/mpeg",
               "xi-api-key": apiKey,
               "Content-Type": "application/json"
            },
            body: JSON.stringify({
               text: prompt,
               duration_seconds: 3, // Keep SFX short and punchy
               prompt_influence: 0.8
            })
         });

         if (!response.ok) {
            throw new Error(`ElevenLabs SFX Error: ${response.status} ${response.statusText}`);
         }

         const buffer = await response.arrayBuffer();
         const fileName = `sfx_${crypto.randomBytes(8).toString('hex')}.mp3`;
         const filePath = path.join(AUDIO_DIR, fileName);
         fs.writeFileSync(filePath, Buffer.from(buffer));
         return `/audio/${fileName}`;
     } catch (err: any) {
         console.error("[AudioService] Failed SFX Generation:", err.message);
         return null;
     }
  }
};
