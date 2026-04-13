import { Room, RoomUser, Mood } from "./types";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "rooms_db.json");

// In-memory store for active rooms
let activeRooms = new Map<string, Room>();

export const PersistenceManager = {
  save() {
    try {
      const data: Record<string, any> = {};
      for (const [code, room] of activeRooms.entries()) {
         data[code] = { ...room, users: Array.from(room.users.entries()) };
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch(err) {
      console.error("[Persistence] Failed to save rooms_db.json", err);
    }
  },
  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
         const fileData = fs.readFileSync(DB_FILE, "utf-8");
         const data = JSON.parse(fileData);
         activeRooms.clear();
         for (const [code, raw] of Object.entries(data)) {
            const r = raw as any;
            activeRooms.set(code, { ...r, users: new Map(r.users) });
         }
      }
    } catch(err) {
      console.error("[Persistence] Failed to load rooms", err);
    }
  }
};

// Load on boot, save every 5 seconds
PersistenceManager.load();
setInterval(() => PersistenceManager.save(), 5000);

/**
 * Generates a random 5-character alphanumeric code (e.g., "A7X9Q")
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (activeRooms.has(code));
  return code;
}

export const RoomManager = {
  /** Creates a new room and sets the host */
  createRoom(hostSocketId: string, nickname: string, initialVibe: string, activityContext: string): Room {
    const code = generateRoomCode();
    
    const hostUser: RoomUser = {
      socketId: hostSocketId,
      nickname,
      isReady: false,
      currentMood: null,
      lastMoodUpdate: Date.now(),
    };

    const newRoom: Room = {
      code,
      hostSocketId,
      users: new Map([[hostSocketId, hostUser]]),
      aggregatedMood: null,
      initialVibe,
      activityContext,
      currentTrack: null,
      isPlaying: false,
      createdAt: Date.now(),
      cycleCount: 0,
    };

    activeRooms.set(code, newRoom);
    return newRoom;
  },

  /** Adds a user to an existing room if valid */
  joinRoom(roomCode: string, socketId: string, nickname: string): Room | null {
    const room = activeRooms.get(roomCode);
    if (!room) return null;

    // Optional: Check if user already in room or if room is locked/full
    
    const newUser: RoomUser = {
      socketId,
      nickname,
      isReady: false,
      currentMood: null,
      lastMoodUpdate: Date.now(),
    };

    room.users.set(socketId, newUser);
    return room;
  },

  getRoom(roomCode: string): Room | undefined {
    return activeRooms.get(roomCode);
  },

  /** Removes a user from a room. If room becomes empty, deletes it. */
  leaveRoom(roomCode: string, socketId: string): void {
    const room = activeRooms.get(roomCode);
    if (!room) return;

    room.users.delete(socketId);

    // If room is empty, clean it up
    if (room.users.size === 0) {
      activeRooms.delete(roomCode);
      console.log(`Room ${roomCode} destroyed (empty)`);
      return;
    }

    // If host left, reassign host (simple pick: first available)
    if (room.hostSocketId === socketId) {
      const nextHostId = Array.from(room.users.keys())[0];
      if (nextHostId) {
        room.hostSocketId = nextHostId;
      }
    }
  },

  /** Updates user mood and calculates the new room aggregate */
  updateUserMood(roomCode: string, socketId: string, mood: Mood): Mood | null {
    const room = activeRooms.get(roomCode);
    if (!room) return null;

    const user = room.users.get(socketId);
    if (user) {
      user.currentMood = mood;
      user.lastMoodUpdate = Date.now();
    }

    return this.calculateAggregatedMood(room);
  },

  /** Marks a user as ready and checks if all users are ready */
  setUserReady(roomCode: string, socketId: string): { room: Room, allReady: boolean } | null {
    const room = activeRooms.get(roomCode);
    if (!room) return null;

    const user = room.users.get(socketId);
    if (user) {
      user.isReady = true;
    }

    const allReady = Array.from(room.users.values()).every(u => u.isReady);
    return { room, allReady };
  },

  /**
   * Calculates the dominant mood in the room based on current user states.
   * Simple majority vote for now. In production, this might weight recent updates higher
   * or consider confidence thresholds.
   */
  calculateAggregatedMood(room: Room): Mood | null {
    if (room.users.size === 0) return null;

    const moodCounts: Record<string, number> = {};
    let dominantMood: Mood | null = null;
    let maxCount = 0;
    const now = Date.now();

    for (const user of room.users.values()) {
      // Ignore stale mood updates (e.g. frozen camera > 60 seconds)
      if (user.currentMood && (now - user.lastMoodUpdate < 60000)) {
        moodCounts[user.currentMood] = (moodCounts[user.currentMood] || 0) + 1;
        
        if (moodCounts[user.currentMood] > maxCount) {
          maxCount = moodCounts[user.currentMood];
          dominantMood = user.currentMood;
        }
      }
    }
    
    room.aggregatedMood = dominantMood;
    return dominantMood;
  },

  /** Converts the Map of users to a primitive Array for Socket emitting */
  getUsersList(roomCode: string) {
    const room = activeRooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.users.values()).map(u => ({
      nickname: u.nickname,
      isReady: u.isReady
    }));
  }
};
