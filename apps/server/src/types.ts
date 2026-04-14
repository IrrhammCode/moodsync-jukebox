// ============================================================
// MoodSync Jukebox - Shared Type Definitions
// ============================================================

/** The possible moods detected by face-api.js */
export type Mood =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

/** Secure storage for user-provided API keys in-memory */
export interface UserApiKeys {
  gemini?: string;
  elevenlabs?: string;
  groq?: string;
  turbopuffer?: string;
}

/** Represents a single user in a room */
export interface RoomUser {
  socketId: string;
  nickname: string;
  isReady: boolean;
  currentMood: Mood | null;
  lastMoodUpdate: number; // Unix timestamp
  apiKeys?: UserApiKeys;
}

/** A room containing users, their moods, and playback state */
export interface Room {
  code: string;
  hostSocketId: string;
  users: Map<string, RoomUser>;
  aggregatedMood: Mood | null;
  initialVibe: string;
  activityContext: string;
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  createdAt: number;
  latestImage?: string; // Base64 snapshot of the room for Vision 2.0
  cycleCount: number; // Tracks how many times radio looped (for Ads)
  moodHistory: string[]; // Tracks the recent sequence of aggregated moods for AURA Foresight
}

/** Metadata about a track fetched from Turbopuffer */
export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  mood: Mood;
  score: number; // similarity score from vector search
}

// ============================================================
// Socket.io Event Interfaces
// ============================================================

/** Events emitted from CLIENT → SERVER */
export interface ClientToServerEvents {
  "request-create-room": (data: { nickname: string; initialVibe: string; activityContext: string; apiKeys?: UserApiKeys }) => void;
  "join-room": (data: { roomCode: string; nickname: string; activityContext: string; apiKeys?: UserApiKeys }) => void;
  "user-ready": () => void;
  "mood-update": (data: { mood: Mood; confidence: number }) => void;
  "leave-room": () => void;
  "room-visual-telemetry": (data: { imageBase64: string }) => void;
}

/** Events emitted from SERVER → CLIENT */
export interface ServerToClientEvents {
  "room-created": (data: { roomCode: string }) => void;
  "room-joined": (data: {
    roomCode: string;
    users: Array<{ nickname: string; isReady: boolean }>;
  }) => void;
  "user-joined": (data: { nickname: string; userCount: number }) => void;
  "user-left": (data: { nickname: string; userCount: number }) => void;
  "user-ready-update": (data: {
    nickname: string;
    allReady: boolean;
  }) => void;
  "mood-aggregated": (data: {
    aggregatedMood: Mood;
    moodBreakdown: Record<Mood, number>;
  }) => void;

  // === Future Integration Events ===
  // These events will be emitted once Turbopuffer + ElevenLabs are wired up.
  "dj-audio": (data: { audioUrl: string; message: string }) => void;
  "play-track": (data: { track: TrackInfo; djAudioUrl: string; musicAudioUrls: string[]; sfxAudioUrl?: string }) => void;
  "upcoming-track": (data: { track: TrackInfo; djAudioUrl: string; musicAudioUrls: string[]; sfxAudioUrl?: string }) => void;
  "crossfade-now": (data: {}) => void;

  "security-termination": (data: { message: string }) => void;

  error: (data: { message: string }) => void;
}

/** Internal server-side socket data */
export interface InterServerEvents {}

/** Data attached to each socket */
export interface SocketData {
  roomCode: string | null;
  nickname: string;
  ip: string;
  startTime: number | null;
  apiKeys?: UserApiKeys;
}
