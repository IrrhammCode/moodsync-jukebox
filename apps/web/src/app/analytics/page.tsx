"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Database, TrendingUp, Music, BarChart2, Clock, Globe, BrainCircuit } from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"

interface VaultTrack {
  vibe: string
  mood: string
  track_urls: string[]
  created_at: string
}

export default function AnalyticsPage() {
  const [data, setData] = useState<VaultTrack[]>([])
  const [memories, setMemories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics`)
        const result = await res.json()
        if (result.success) {
          setData(result.data)
          if (result.memories) {
            setMemories(result.memories)
          }
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
    // Poll every 30s
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate aggregates
  const totalTracks = data.length
  
  const vibeCounts = data.reduce((acc, track) => {
    acc[track.vibe] = (acc[track.vibe] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const moodCounts = data.reduce((acc, track) => {
    acc[track.mood] = (acc[track.mood] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const dominantVibe = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0]
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <main className="min-h-screen bg-[#030305] text-white p-6 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row shadow-2xl justify-between items-start md:items-center mb-8 glass-panel rounded-3xl p-6 border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
               <Database className="text-indigo-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-widest uppercase">AURA Analytics</h1>
              <p className="text-zinc-400 text-sm font-mono flex items-center gap-2">
                <Globe className="w-3 h-3 text-emerald-400" /> ETERNAL VAULT CONNECTED
              </p>
            </div>
          </div>
          <Link href="/" className="mt-4 md:mt-0 text-sm flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg font-mono font-bold tracking-widest text-zinc-300 transition-colors border border-white/10">
            RETURN TO TERMINAL
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 font-mono text-indigo-400">
            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-indigo-400 animate-spin mb-4" />
            <p className="animate-pulse tracking-widest text-sm">SYNCHRONIZING DATABANKS...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="glass-panel text-center p-12 rounded-3xl border-white/10 border border-dashed">
            <p className="text-zinc-500 font-mono tracking-widest">VAULT IS CURRENTLY EMPTY.</p>
            <p className="text-zinc-600 text-sm mt-2 font-mono">Create a room to start recording data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Aggregates */}
            <div className="flex flex-col gap-6">
              
              {/* Stat Card 1 */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border-white/10 group hover:border-indigo-500/30 transition-colors">
                <div className="absolute right-[-10%] top-[-20%] text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors">
                   <Music className="w-32 h-32" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">Total Mastertracks</h3>
                <p className="text-5xl font-bold text-white tracking-tighter">{totalTracks}</p>
                <div className="mt-4 text-[10px] uppercase font-mono tracking-widest flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="w-3 h-3" /> Syncing Live
                </div>
              </div>

              {/* Stat Card 2 */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border-white/10 group hover:border-pink-500/30 transition-colors">
                <div className="absolute right-[-10%] top-[-20%] text-pink-500/5 group-hover:text-pink-500/10 transition-colors">
                   <Activity className="w-32 h-32" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">Dominant Frequency</h3>
                <p className="text-3xl font-bold text-white tracking-tighter capitalize">{dominantVibe?.[0] || 'N/A'}</p>
                <div className="mt-4 bg-white/5 w-full h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-indigo-500" style={{ width: `${(dominantVibe?.[1]! / totalTracks) * 100}%` }} />
                </div>
                <p className="mt-2 text-[10px] font-mono text-zinc-500 text-right">{dominantVibe?.[1]} Tracks</p>
              </div>

              {/* Stat Card 3 */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border-white/10 group hover:border-cyan-500/30 transition-colors">
                <div className="absolute right-[-10%] top-[-20%] text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors">
                   <BarChart2 className="w-32 h-32" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">Dominant Mood</h3>
                <p className="text-3xl font-bold text-white tracking-tighter capitalize">{dominantMood?.[0] || 'N/A'}</p>
                <div className="mt-4 bg-white/5 w-full h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${(dominantMood?.[1]! / totalTracks) * 100}%` }} />
                </div>
                <p className="mt-2 text-[10px] font-mono text-zinc-500 text-right">{dominantMood?.[1]} Tracks</p>
              </div>

            </div>

            {/* Right Column: Ledger Log */}
            <div className="md:col-span-2 glass-panel p-6 rounded-3xl border-white/10 flex flex-col max-h-[600px]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="font-mono text-sm uppercase tracking-widest font-bold text-zinc-200">The Vault Ledger</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                <AnimatePresence>
                  {data.map((track, i) => {
                    const date = new Date(track.created_at);
                    const isNew = Date.now() - date.getTime() < 300000; // Less than 5 mins ago
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={`${track.created_at}-${i}`} 
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${isNew ? 'bg-indigo-900/20 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                      >
                        <div className="flex flex-col gap-1 mb-3 sm:mb-0">
                          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{date.toLocaleString()}</span>
                          <span className="font-bold text-white">{track.vibe}</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-[#030305] border border-white/10 text-cyan-400">
                              {track.mood}
                           </span>
                           <span className="text-[10px] font-mono text-zinc-600 bg-white/5 px-2 py-1 rounded">
                              {track.track_urls.length} Tracks Array
                           </span>
                        </div>
                        
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
            
          </div>
          
          {/* AURA Foresight Stream (Turbopuffer Memories) */}
          <div className="mt-6 glass-panel p-6 rounded-3xl border-white/10 flex flex-col">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <BrainCircuit className="w-5 h-5 text-pink-400" />
                <h3 className="font-mono text-sm uppercase tracking-widest font-bold text-zinc-200">AURA's Foresight Stream <span className="text-pink-400/50 text-[10px] ml-2 animate-pulse">(Turbopuffer Live Sync)</span></h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {memories.map((mem, i) => (
                    <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.05 }}
                       key={`mem-${mem.id}`}
                       className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between"
                    >
                       <div className="mb-4">
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Trajectory Pattern</p>
                          <div className="flex flex-wrap gap-1">
                             {mem.attributes.trajectory.split('->').map((step: string, idx: number) => (
                                <span key={idx} className="bg-white/10 text-zinc-300 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider">{step.trim()}</span>
                             ))}
                          </div>
                       </div>
                       
                       <div className="mt-auto pt-3 border-t border-white/10">
                          <p className="text-[10px] font-mono text-pink-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                             Predicted Outcome
                          </p>
                          <p className="text-sm font-bold text-white capitalize">{mem.attributes.result}</p>
                       </div>
                    </motion.div>
                 ))}
                 
                 {memories.length === 0 && (
                    <div className="col-span-full py-8 text-center text-zinc-500 font-mono text-sm tracking-widest">
                       Awaiting cognitive patterns...
                    </div>
                 )}
              </div>
          </div>
          
        </>
        )}
      </div>
    </main>
  )
}
