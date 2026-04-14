/**
 * AURA Cloud Pulse — Supabase-backed Online Music Vault
 * 
 * Uploads generated audio to Supabase Storage for permanent cloud access,
 * and indexes track metadata in Supabase Database (Postgres) for fast lookup.
 * 
 * Falls back gracefully to local-only vault when Supabase keys are not configured.
 * 
 * Required environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (for server-side upload)
 * 
 * Required Supabase setup:
 *   1. Storage Bucket: "aura-vault" (public)
 *   2. Database Table: "aura_tracks" (see schema below)
 * 
 * Table SQL:
 *   CREATE TABLE aura_tracks (
 *     id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *     vibe       TEXT NOT NULL,
 *     mood       TEXT NOT NULL,
 *     track_urls TEXT[] NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX idx_aura_vibe_mood ON aura_tracks(vibe, mood);
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const BUCKET_NAME = 'aura-vault';

let supabase: SupabaseClient | null = null;

/**
 * Lazily initializes the Supabase client.
 * Returns null if credentials are not configured.
 */
function getClient(): SupabaseClient | null {
   if (supabase) return supabase;

   const url = process.env.SUPABASE_URL;
   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

   if (!url || !key || url.includes('your_supabase') || key.includes('your_supabase')) {
      return null;
   }

   supabase = createClient(url, key);
   console.log('[CloudVault] ☁️ Supabase connected.');
   return supabase;
}

export const CloudVault = {
   /**
    * Returns true if cloud vault is configured and available.
    */
   isAvailable(): boolean {
      return getClient() !== null;
   },

   /**
    * Uploads a local MP3 file to Supabase Storage.
    * Returns the public URL of the uploaded file.
    */
   async uploadFile(localFilePath: string, fileName: string): Promise<string | null> {
      const client = getClient();
      if (!client) return null;

      try {
         const fileBuffer = fs.readFileSync(localFilePath);

         const { data, error } = await client.storage
            .from(BUCKET_NAME)
            .upload(`tracks/${fileName}`, fileBuffer, {
               contentType: 'audio/mpeg',
               upsert: true  // Overwrite if exists
            });

         if (error) {
            console.error('[CloudVault] Upload failed:', error.message);
            return null;
         }

         // Get public URL
         const { data: urlData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(`tracks/${fileName}`);

         console.log(`[CloudVault] ☁️ Uploaded: ${fileName}`);
         return urlData.publicUrl;
      } catch (err: any) {
         console.error('[CloudVault] Upload error:', err.message);
         return null;
      }
   },

   /**
    * Uploads a full Megamix set (3 local file URLs) to the cloud.
    * Returns an array of public cloud URLs.
    */
   async uploadMegamix(localUrls: string[]): Promise<string[]> {
      const client = getClient();
      if (!client) return [];

      const audioDir = path.join(process.cwd(), 'public');
      const cloudUrls: string[] = [];

      console.log(`[CloudVault] ☁️ Uploading ${localUrls.length}-track Megamix to cloud...`);

      for (const localUrl of localUrls) {
         // localUrl looks like "/audio/music_seg0_xxx.mp3"
         const fileName = localUrl.split('/').pop();
         if (!fileName) continue;

         const filePath = path.join(audioDir, 'audio', fileName);
         if (!fs.existsSync(filePath)) {
            console.warn(`[CloudVault] File not found locally: ${filePath}`);
            continue;
         }

         const publicUrl = await this.uploadFile(filePath, fileName);
         if (publicUrl) {
            cloudUrls.push(publicUrl);
         }
      }

      console.log(`[CloudVault] ☁️ Upload complete: ${cloudUrls.length}/${localUrls.length} tracks.`);
      return cloudUrls;
   },

   /**
    * Saves track metadata to the Supabase database.
    */
   async indexTrack(vibe: string, mood: string, trackUrls: string[]): Promise<void> {
      const client = getClient();
      if (!client) return;

      try {
         const { error } = await client
            .from('aura_tracks')
            .insert({ vibe, mood, track_urls: trackUrls });

         if (error) {
            console.error('[CloudVault] DB index failed:', error.message);
         } else {
            console.log(`[CloudVault] 📋 Indexed: Vibe=${vibe}, Mood=${mood}, Tracks=${trackUrls.length}`);
         }
      } catch (err: any) {
         console.error('[CloudVault] DB error:', err.message);
      }
   },

   /**
    * Finds matching track sets from the cloud database.
    * Returns an array of track URL arrays.
    */
   async findMatches(vibe: string, mood: string): Promise<string[][]> {
      const client = getClient();
      if (!client) return [];

      try {
         const { data, error } = await client
            .from('aura_tracks')
            .select('track_urls')
            .eq('vibe', vibe)
            .eq('mood', mood);

         if (error) {
            console.error('[CloudVault] DB query failed:', error.message);
            return [];
         }

         return (data || []).map(row => row.track_urls);
      } catch (err: any) {
         console.error('[CloudVault] Query error:', err.message);
         return [];
      }
   },

   /**
    * Full pipeline: Upload files to Storage + Index metadata in DB.
    * This is the main method called after a fresh Megamix is generated.
    */
   async saveMegamix(vibe: string, mood: string, localUrls: string[]): Promise<void> {
      if (!this.isAvailable()) return;

      // 1. Upload MP3 files to Supabase Storage
      const cloudUrls = await this.uploadMegamix(localUrls);
      
      // 2. Index the cloud URLs in the database
      if (cloudUrls.length > 0) {
         await this.indexTrack(vibe, mood, cloudUrls);
      }
   },

   /**
    * Fetches global analytics data from the Supabase vault.
    */
   async getGlobalStats(): Promise<any[]> {
      const client = getClient();
      if (!client) return [];

      try {
         // Get the most recent 100 tracks to calculate stats + show ledger
         const { data, error } = await client
            .from('aura_tracks')
            .select('vibe, mood, track_urls, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

         if (error) {
            console.error('[CloudVault] Analytics query failed:', error.message);
            return [];
         }

         return data || [];
      } catch (err: any) {
         console.error('[CloudVault] Analytics error:', err.message);
         return [];
      }
   }
};
