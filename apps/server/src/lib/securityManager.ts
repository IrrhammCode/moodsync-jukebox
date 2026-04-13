import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'security_db.json');

const PLAYTIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface IPRecord {
  totalPlaytimeMs: number;
  banExpiration: number | null; // Timestamp when ban ends
}

let securityData: Record<string, IPRecord> = {};

// Initial Load
if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    securityData = JSON.parse(raw);
  } catch (err) {
    console.error('[SecurityManager] Failed to load DB, starting fresh.', err);
  }
}

const saveDB = () => {
  try {
     fs.writeFileSync(DB_PATH, JSON.stringify(securityData, null, 2));
  } catch(e) {
     console.error("[SecurityManager] Failed to save DB", e);
  }
};

export const SecurityManager = {
  /** Check if IP is currently banned */
  isIPBanned(ip: string): { banned: boolean; remainingMs: number } {
    const record = securityData[ip];
    if (!record || !record.banExpiration) return { banned: false, remainingMs: 0 };

    const remaining = record.banExpiration - Date.now();
    if (remaining > 0) {
      return { banned: true, remainingMs: remaining };
    } else {
      // Ban expired, reset playtime to 0
      record.banExpiration = null;
      record.totalPlaytimeMs = 0;
      saveDB();
      return { banned: false, remainingMs: 0 };
    }
  },

  /** Adds playtime to an IP. Returns true if they just crossed the threshold to be banned. */
  addPlaytime(ip: string, timeMs: number): boolean {
    if (!securityData[ip]) {
      securityData[ip] = { totalPlaytimeMs: 0, banExpiration: null };
    }

    const record = securityData[ip];
    
    // Ignore if already banned
    if (record.banExpiration && record.banExpiration > Date.now()) return true;

    record.totalPlaytimeMs += timeMs;

    if (record.totalPlaytimeMs >= PLAYTIME_LIMIT_MS) {
      record.banExpiration = Date.now() + COOLDOWN_DURATION_MS;
      console.log(`[SecurityManager] IP ${ip} has been BANNED for 15 minutes.`);
      saveDB();
      return true; // Indicates they just got banned
    }

    saveDB();
    return false;
  },
  
  getRemainingPlaytime(ip: string): number {
     const used = securityData[ip]?.totalPlaytimeMs || 0;
     return Math.max(0, PLAYTIME_LIMIT_MS - used);
  }
};
