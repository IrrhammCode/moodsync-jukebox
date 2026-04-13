import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { RoomManager } from "./rooms";
import { DJEngine } from "./lib/djEngine";
import { AudioService } from "./lib/audioService";
import { SecurityManager } from "./lib/securityManager";
import { getPersona } from "./lib/personas";
import { VaultManager } from "./lib/vaultManager";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./types";

// Load environment variables (relative to server app or workspace root)
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const app = express();
app.use(cors());

// Serve generated audio files as static assets
const publicPath = path.join(process.cwd(), "public");
const audioPath = path.join(publicPath, "audio");
[publicPath, audioPath].forEach(p => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});
app.use(express.static(publicPath));

const port = process.env.PORT || 3005;

const server = http.createServer(app);

// Initialize Socket.io with strict typing
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Strict CORS
    methods: ["GET", "POST"],
  },
});

const roomLoops = new Map<string, NodeJS.Timeout>();

/** Vibe-Specific Fallbacks for 429 / API Errors */
const VIBE_FALLBACKS: Record<string, string> = {
  "Electronic / EDM": "https://audio.jukehost.co.uk/U978gH5f8Q6fB5V3vA5C2sO9mK4gL1oP",
  "Chill / Lo-Fi": "https://audio.jukehost.co.uk/gKq9Zc41v9o9Yk04I83gW8D2pM7LzT4b",
  "Upbeat Pop": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "Alternative Rock": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  "Late Night Jazz": "https://audio.jukehost.co.uk/6S5V3nN9rL7M4pZ1vB5C2sO8k04I83gW",
  "Classical": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
};

// Track duration constant (in ms). Each track loops for this long before crossfading.
const TRACK_DURATION_MS = 180000; // 3 minutes
const PRE_GEN_LEAD_TIME_MS = 30000; // Start generating next track 30s before end

/**
 * Full Radio Cycle for a room:
 * 1. Immediately generate & play the first track.
 * 2. At (TRACK_DURATION - 30s), pre-generate the NEXT track.
 * 3. At TRACK_DURATION, emit crossfade-now to smoothly transition.
 * 4. Repeat forever.
 */
const startRadioCycle = async (roomCode: string) => {
   const room = RoomManager.getRoom(roomCode);
   if (!room) return;

   // --- Generate the current track ---
   room.isPlaying = true;
   const trackData = await generateTrackPayload(roomCode);
   if (!trackData) return;

   // Emit the first track immediately (play-track)
   io.to(roomCode).emit("play-track", trackData);
   console.log(`[Room ${roomCode}] Track dispatched. Next crossfade in ${TRACK_DURATION_MS / 1000}s.`);

   // --- Schedule the next crossfade ---
   // At T-30s: Pre-generate next track in background
   const preGenTimer = setTimeout(async () => {
      if (!RoomManager.getRoom(roomCode)) return;
      console.log(`[Room ${roomCode}] Pre-generating next track (30s before crossfade)...`);
      const nextTrack = await generateTrackPayload(roomCode);
      if (nextTrack) {
         // Send the upcoming track data so the browser can pre-download
         io.to(roomCode).emit("upcoming-track", nextTrack);
      }
   }, TRACK_DURATION_MS - PRE_GEN_LEAD_TIME_MS);

   // At T=3min: Signal the crossfade and restart the cycle
   const crossfadeTimer = setTimeout(async () => {
      const liveRoom = RoomManager.getRoom(roomCode);
      if (!liveRoom) return;
      io.to(roomCode).emit("crossfade-now", {});
      console.log(`[Room ${roomCode}] Crossfade signal sent. Incrementing cycle count.`);
      
      // Reset and start the next cycle
      liveRoom.isPlaying = false;
      liveRoom.cycleCount += 1;
      startRadioCycle(roomCode);
   }, TRACK_DURATION_MS);

   // Store timers for cleanup
   roomLoops.set(roomCode, crossfadeTimer as any);
};

/** Generates the AI DJ script + 3-track Megamix and returns the payload */
const generateTrackPayload = async (roomCode: string) => {
   const room = RoomManager.getRoom(roomCode);
   if (!room) return null;

   const mood = room.aggregatedMood || "neutral";
   const roomUserNames = Array.from(room.users.values()).map(u => u.nickname);

   // Resolve the persona for this room's vibe
   const persona = getPersona(room.initialVibe);
   console.log(`[Room ${roomCode}] 🎭 Persona: ${persona.name} (Voice: ${persona.voiceId})`);

   io.to(roomCode).emit("dj-audio", { audioUrl: "", message: `${persona.name} is cooking up a 3-track Megamix...` });

   // 1. Check THE ETERNAL VAULT first (80% reuse, 20% fresh discovery)
   const vaultedSets = await VaultManager.findMatches(room.initialVibe, mood);
   const reuseProbability = 0.8;
   const wantFresh = Math.random() > reuseProbability;

   let finalMusicUrls: string[] = [];

   if (vaultedSets.length > 0 && !wantFresh) {
      // BINGO! Reuse existing music to save credits
      const randomIndex = Math.floor(Math.random() * vaultedSets.length);
      finalMusicUrls = vaultedSets[randomIndex];
      console.log(`[Room ${roomCode}] 🏦 VAULT HIT: Reusing set of ${finalMusicUrls.length} tracks to save credits.`);
   }

   if (finalMusicUrls.length === 0) {
      console.log(`[Room ${roomCode}] ⚡ VAULT MISS/FRESH: Calling AURA to compose new music.`);
      const aiData = await DJEngine.generateTransition(
          room.activityContext,
          mood,
          room.initialVibe,
          room.latestImage,
          room.cycleCount,
          roomUserNames,
          persona.name,
          persona.toneInstructions
      );

      // Generate Voice, 3-Track Megamix, and SFX in parallel
      const [voiceUrl, megamixUrls, sfxUrl] = await Promise.all([
         AudioService.generateDJVoice(aiData.djScript, persona.voiceId, persona.stability, persona.similarity),
         AudioService.generateMegamix(aiData.musicPrompt),
         aiData.sfxPrompt ? AudioService.generateSFX(aiData.sfxPrompt) : Promise.resolve(null)
      ]);

      const finalVoiceUrl = voiceUrl || "SKIP_VOICE";
      
      // If generation succeeded, save to vault!
      if (megamixUrls.length > 0) {
         VaultManager.addToVault(room.initialVibe, mood, megamixUrls);
         finalMusicUrls = megamixUrls;
      } else {
         // Deep Fallback: Look in vault one last time if API failed
         if (vaultedSets.length > 0) {
            console.warn(`[Room ${roomCode}] API Failed but Vault has backups! Rescuing the vibe...`);
            finalMusicUrls = vaultedSets[Math.floor(Math.random() * vaultedSets.length)];
         } else {
            finalMusicUrls = [VIBE_FALLBACKS[room.initialVibe] || "SKIP_MUSIC"];
         }
      }

      console.log(`[Room ${roomCode}] ${persona.name} generation complete. Megamix: ${finalMusicUrls.length} segments.`);

      return {
         track: {
            id: `gen-${Date.now()}-cycle-${room.cycleCount}`,
            title: `AURA Phase: ${mood}`,
            artist: "AURA Core",
            youtubeId: "",
            mood: mood as any,
            score: 1.0
         },
         djAudioUrl: finalVoiceUrl,
         musicAudioUrls: finalMusicUrls,
         sfxAudioUrl: sfxUrl || undefined
      };
   }

   // If we reached here, we are using vaulted music but we still need a fresh voice transition
   // because the context (time, username) changes every cycle! 
   const aiData = await DJEngine.generateTransition(
      room.activityContext,
      mood,
      room.initialVibe,
      room.latestImage,
      room.cycleCount,
      roomUserNames,
      persona.name,
      persona.toneInstructions
   );

   const [voiceUrl, sfxUrl] = await Promise.all([
      AudioService.generateDJVoice(aiData.djScript, persona.voiceId, persona.stability, persona.similarity),
      aiData.sfxPrompt ? AudioService.generateSFX(aiData.sfxPrompt) : Promise.resolve(null)
   ]);

   return {
      track: {
         id: `vault-${Date.now()}-cycle-${room.cycleCount}`,
         title: `AURA Vault: ${mood}`,
         artist: "AURA Core",
         youtubeId: "",
         mood: mood as any,
         score: 1.0
      },
      djAudioUrl: voiceUrl || "SKIP_VOICE",
      musicAudioUrls: finalMusicUrls,
      sfxAudioUrl: sfxUrl || undefined
   };
};

io.on("connection", (socket) => {
  const clientIp = socket.handshake.address || "unknown";
  socket.data.ip = clientIp;
  socket.data.startTime = null;
  console.log(`[Socket] User connected: ${socket.id} (IP: ${clientIp})`);

  // Helper to check bans
  const checkBan = (): boolean => {
    const { banned, remainingMs } = SecurityManager.isIPBanned(clientIp);
    if (banned) {
      socket.emit("error", { message: `Usage limit reached. Safety cooldown active for ${Math.ceil(remainingMs / 60000)} more minutes.` });
      return true;
    }
    return false;
  };

  // 1. Create a Room
  socket.on("request-create-room", ({ nickname, initialVibe, activityContext }) => {
    if (checkBan()) return;
    try {
      const room = RoomManager.createRoom(socket.id, nickname, initialVibe, activityContext);
      
      socket.data.roomCode = room.code;
      socket.data.nickname = nickname;
      
      socket.join(room.code);
      console.log(`[Room ${room.code}] Created by host ${socket.id} (${nickname}) with vibe '${initialVibe}'`);

      socket.emit("room-created", { roomCode: room.code });
    } catch (err: any) {
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // 2. Join a Room
  socket.on("join-room", ({ roomCode, nickname, activityContext }) => {
    if (checkBan()) return;
    try {
      const room = RoomManager.joinRoom(roomCode, socket.id, nickname);
      
      if (!room) {
        socket.emit("error", { message: "Room not found or invalid code." });
        return;
      }
      
      // Update room's context with the joining user's context for a combined experience
      if (activityContext && room.activityContext !== activityContext) {
         room.activityContext = `${room.activityContext} and ${activityContext}`;
      }

      socket.data.roomCode = roomCode;
      socket.data.nickname = nickname;
      socket.join(roomCode);
      
      console.log(`[Room ${roomCode}] User ${socket.id} (${nickname}) joined.`);

      // Send current state to new user
      socket.emit("room-joined", {
        roomCode,
        users: RoomManager.getUsersList(roomCode),
      });

      // Broadcast to others in the room
      socket.to(roomCode).emit("user-joined", {
        nickname,
        userCount: room.users.size,
      });

    } catch (err: any) {
      socket.emit("error", { message: "Failed to join room." });
    }
  });

  // 3. User is "Ready" (Camera on, ready to sync)
  socket.on("user-ready", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    
    // Start tracking playtime
    socket.data.startTime = Date.now();

    const result = RoomManager.setUserReady(code, socket.id);
    if (result) {
      io.to(code).emit("user-ready-update", {
        nickname: socket.data.nickname || "Unknown",
        allReady: result.allReady,
      });

      if (result.allReady) {
         console.log(`[Room ${code}] All users ready! Starting Radio Crossfade Cycle...`);
         
         // Start the infinite radio cycle
         if (!roomLoops.has(code)) {
            startRadioCycle(code);
         }
      }
    }
  });

  // 4. Receives mood data from client webcam (Polled ~every 5-10s)
  socket.on("mood-update", ({ mood, confidence }) => {
    const code = socket.data.roomCode;
    if (!code) return;

    // Filter out low confidence?
    if(confidence < 0.3) return;

    const aggregatedMood = RoomManager.updateUserMood(code, socket.id, mood);
    
    // Periodically, when the mood changes or hits a threshold, we will emit an event back 
    // to trigger the AI DJ. For now, just log or broadcast the current status.
    console.log(`[Room ${code}] ${socket.data.nickname} mood: ${mood} (${Math.round(confidence * 100)}%) | Aggregate: ${aggregatedMood || 'unknown'}`);
  });

  // 4b. Receives visual telemetry (Webcam Snapshots for AURA Vision)
  socket.on("room-visual-telemetry", ({ imageBase64 }) => {
     const code = socket.data.roomCode;
     if (!code) return;
     const room = RoomManager.getRoom(code);
     if (room) {
        room.latestImage = imageBase64;
     }
  });

  // 5. Disconnection Handling
  const handleDisconnect = () => {
    const code = socket.data.roomCode;
    const name = socket.data.nickname;
    const ip = socket.data.ip;
    
    // Accumulate playtime on leave
    if (socket.data.startTime) {
       const sessionDuration = Date.now() - socket.data.startTime;
       SecurityManager.addPlaytime(ip, sessionDuration);
       socket.data.startTime = null;
    }
    
    if (code) {
      RoomManager.leaveRoom(code, socket.id);
      console.log(`[Room ${code}] User ${socket.id} (${name}) left/disconnected.`);
      
      const currentUsers = RoomManager.getRoom(code)?.users.size || 0;
      io.to(code).emit("user-left", { nickname: name, userCount: currentUsers });
      
      if (currentUsers === 0) {
         const loop = roomLoops.get(code);
         if (loop) clearInterval(loop);
         roomLoops.delete(code);
      }
    }
  };

  socket.on("leave-room", () => {
    handleDisconnect();
    socket.leave(socket.data.roomCode as string);
    socket.data.roomCode = null;
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    handleDisconnect();
  });
});

app.get("/system/health", async (req, res) => {
  const memory = process.memoryUsage();
  
  // Calculate total connected socket users
  const sockets = await io.fetchSockets();
  
  // Get rooms info
  // Since we don't expose activeRooms directly, we can read from the persistent file 
  // or add a method to RoomManager. For simplicity, we'll read the count from RoomManager if we add a getter,
  // or we can just count socket rooms.
  
  // Quick file check for audio count
  let audioFileCount = 0;
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (fs.existsSync(audioDir)) {
       audioFileCount = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).length;
    }
  } catch(e) {}

  res.status(200).json({ 
     status: "Operational",
     uptimeSeconds: Math.floor(process.uptime()),
     connectedClients: sockets.length,
     memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`
     },
     storage: {
        mp3FilesCached: audioFileCount
     }
  });
});

// 6. Security Background Worker
// Periodically checks if active users have exceeded their limit
setInterval(async () => {
   const sockets = await io.fetchSockets();
   for (const s of sockets) {
      if (s.data.startTime) {
         const currentSessionPlaytime = Date.now() - s.data.startTime;
         // Simulate adding time to see if it triggers a ban
         const isNowBanned = SecurityManager.addPlaytime(s.data.ip, currentSessionPlaytime);
         
         if (isNowBanned) {
            console.log(`[Security] Kicking ${s.id} mid-session for exceeding playtime.`);
            s.emit("security-termination", { message: "Usage limit reached. You have been disconnected. Cooldown 15 minutes." });
            s.disconnect();
         } else {
            // Reset start time so we don't double count next tick
            s.data.startTime = Date.now();
         }
      }
   }
}, 60000); // Check every minute

// 7. Audio Cleanup Worker
// Periodically removes generated mp3 files older than 1 hour to free disk space
setInterval(() => {
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) return;
    
    const files = fs.readdirSync(audioDir);
    const now = Date.now();
    const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
    const vaultedFiles = VaultManager.getVaultedFiles();

    let deletedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.mp3')) continue;
      // Exclude fallback audio files
      if (file.startsWith('fallback_')) continue;
      // CRITICAL: Protect files that are in the Eternal Vault
      if (vaultedFiles.has(file)) continue;

      const filePath = path.join(audioDir, file);
      const stats = fs.statSync(filePath);
      
      const age = now - stats.mtimeMs;
      if (age > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[Maintenance] Cleaned up ${deletedCount} old audio files.`);
    }
  } catch (err) {
    console.error("[Maintenance] Audio cleanup failed:", err);
  }
}, 15 * 60 * 1000); // Check every 15 minutes

server.listen(port, () => {
  console.log(`🚀 MoodSync Socket Server running on port ${port}`);
});
