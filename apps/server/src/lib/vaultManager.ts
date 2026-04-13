/**
 * AURA Eternal Vault — Unified Music Library Manager
 * 
 * Priority order:
 *   1. Cloud (Supabase) — Global, persistent, shared across all instances
 *   2. Local (vault.json) — Fast, works offline, instance-specific
 * 
 * When saving: Writes to BOTH local and cloud (if available)
 * When reading: Tries cloud first, falls back to local
 */

import fs from 'fs';
import path from 'path';
import { CloudVault } from './cloudVault';

const VAULT_PATH = path.join(process.cwd(), 'data', 'vault.json');

interface VaultEntry {
   vibe: string;
   mood: string;
   trackUrls: string[];
   createdAt: number;
}

export const VaultManager = {
   /**
    * Internal: Loads the local vault from disk
    */
   _loadLocalVault(): VaultEntry[] {
      try {
         if (!fs.existsSync(VAULT_PATH)) return [];
         const data = fs.readFileSync(VAULT_PATH, 'utf-8');
         return JSON.parse(data);
      } catch (e) {
         console.error("[VaultManager] Failed to load local vault:", e);
         return [];
      }
   },

   /**
    * Internal: Saves the local vault to disk
    */
   _saveLocalVault(entries: VaultEntry[]) {
      try {
         const dir = path.dirname(VAULT_PATH);
         if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
         fs.writeFileSync(VAULT_PATH, JSON.stringify(entries, null, 2));
      } catch (e) {
         console.error("[VaultManager] Failed to save local vault:", e);
      }
   },

   /**
    * Adds a new Megamix to BOTH local vault and cloud.
    * Cloud upload runs in the background (non-blocking) so it doesn't slow down playback.
    */
   addToVault(vibe: string, mood: string, trackUrls: string[]) {
      // 1. Save locally (instant)
      const entries = this._loadLocalVault();
      entries.push({
         vibe,
         mood,
         trackUrls,
         createdAt: Date.now()
      });
      this._saveLocalVault(entries);
      console.log(`[VaultManager] 💾 Saved locally: Vibe=${vibe}, Mood=${mood}`);

      // 2. Save to cloud (background, non-blocking)
      if (CloudVault.isAvailable()) {
         CloudVault.saveMegamix(vibe, mood, trackUrls)
            .then(() => console.log(`[VaultManager] ☁️ Cloud sync complete for: ${vibe}/${mood}`))
            .catch(err => console.warn(`[VaultManager] ☁️ Cloud sync failed (non-critical):`, err.message));
      }
   },

   /**
    * Finds all track sets matching a specific vibe and mood.
    * Tries cloud first (if available), then falls back to local.
    */
   async findMatches(vibe: string, mood: string): Promise<string[][]> {
      // 1. Try cloud first (global library)
      if (CloudVault.isAvailable()) {
         try {
            const cloudResults = await CloudVault.findMatches(vibe, mood);
            if (cloudResults.length > 0) {
               console.log(`[VaultManager] ☁️ CLOUD HIT: ${cloudResults.length} sets found for ${vibe}/${mood}`);
               return cloudResults;
            }
         } catch (err: any) {
            console.warn(`[VaultManager] Cloud query failed, falling back to local:`, err.message);
         }
      }

      // 2. Fall back to local vault
      const localEntries = this._loadLocalVault();
      const localResults = localEntries
         .filter(e => e.vibe === vibe && e.mood === mood)
         .map(e => e.trackUrls);

      if (localResults.length > 0) {
         console.log(`[VaultManager] 💾 LOCAL HIT: ${localResults.length} sets found for ${vibe}/${mood}`);
      }
      return localResults;
   },

   /**
    * Gets a list of ALL file names currently in the local vault (for cleanup protection).
    */
   getVaultedFiles(): Set<string> {
      const entries = this._loadLocalVault();
      const files = new Set<string>();
      entries.forEach(e => {
         e.trackUrls.forEach(url => {
            const parts = url.split('/');
            files.add(parts[parts.length - 1]);
         });
      });
      return files;
   }
};
