"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Users, Video, Music, Copy, Terminal, Activity, CheckCircle } from "lucide-react"

import { socket } from "@/lib/socket"
import { useMoodDetection } from "@/hooks/useMoodDetection"
import { FloatingNavbar } from "@/components/FloatingNavbar"
import { GlowCard } from "@/components/GlowCard"

function getVibeColor(mood: string | null) {
  switch (mood) {
    case "happy": return "bg-yellow-500/30 shadow-[0_0_80px_rgba(234,179,8,0.4)]";
    case "sad": return "bg-blue-600/30 shadow-[0_0_80px_rgba(37,99,235,0.4)]";
    case "angry": return "bg-red-500/30 shadow-[0_0_80px_rgba(239,68,68,0.4)]";
    case "surprised": return "bg-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.4)]";
    case "fearful": return "bg-zinc-500/30 shadow-[0_0_80px_rgba(113,113,122,0.4)]";
    case "disgusted": return "bg-emerald-500/30 shadow-[0_0_80px_rgba(16,185,129,0.4)]";
    case "neutral":
    default: return "bg-indigo-500/20 shadow-[0_0_80px_rgba(99,102,241,0.2)]";
  }
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [nickname, setNickname] = useState("")
  const [usersInRoom, setUsersInRoom] = useState<any[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [localReady, setLocalReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [copied, setCopied] = useState(false)
  
  // Console Logs
  const [logs, setLogs] = useState<{ id: number; prefix: string; text: string; color: string }[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // AURA Audio State Machine
  const [isAuraThinking, setIsAuraThinking] = useState(false)
  const [isAuraSpeaking, setIsAuraSpeaking] = useState(false)
  const [auraThought, setAuraThought] = useState("")
  const [currentTrack, setCurrentTrack] = useState<{ title: string; artist: string } | null>(null)
  
  // Audio Refs for Full Track Architecture
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const sfxRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentGainRef = useRef<GainNode | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  // Pre-buffered upcoming song for gapless crossfade
  const upcomingBufferRef = useRef<AudioBuffer | null>(null)
  const upcomingDataRef = useRef<any>(null)

  const addLog = (prefix: string, text: string, color: string = "text-indigo-400") => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), prefix, text, color }].slice(-15))
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const { videoRef, startWebcam, currentMood } = useMoodDetection({
    intervalMs: 8000,
    onMoodDetected: (mood, confidence) => {
      if (socket.connected) {
        socket.emit("mood-update", { mood, confidence })
        addLog("TELEMETRY", `Detected ${mood} (${(confidence * 100).toFixed(1)}%)`, "text-pink-400")
        
        // --- AURA Vision Snapshot ---
        if (videoRef.current && videoRef.current.readyState >= 2) {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageBase64 = canvas.toDataURL("image/jpeg", 0.5);
                socket.emit("room-visual-telemetry", { imageBase64 });
            }
        }
      }
    }
  })

  useEffect(() => {
    if (!socket.connected) {
      document.body.style.overflow = "hidden"; 
    } else {
      setHasJoined(true)
      addLog("SYSTEM", `Connected to Node. Restoring state...`)
    }

    socket.on("room-joined", (data) => {
      setUsersInRoom(data.users)
      setHasJoined(true)
      setErrorMsg("")
      document.body.style.overflow = "auto";
      addLog("SYSTEM", `Joined cluster ${data.roomCode} successfully.`, "text-emerald-400")
    })

    socket.on("user-joined", (data) => {
      setUsersInRoom(prev => [...prev, { nickname: data.nickname, isReady: false }])
      addLog("NETWORK", `Node [${data.nickname}] assimilated online.`, "text-purple-400")
    })

    socket.on("user-left", (data) => {
      setUsersInRoom(prev => prev.filter(u => u.nickname !== data.nickname))
      addLog("NETWORK", `Node [${data.nickname}] disconnected.`, "text-red-400")
    })
    
    socket.on("user-ready-update", (data) => {
      setUsersInRoom(prev => prev.map(u => u.nickname === data.nickname ? { ...u, isReady: data.allReady ? true : true } : u))
      addLog("SYNC", `Node [${data.nickname}] telemetry active.`, "text-indigo-400")
    })

    socket.on("error", (data) => {
      setErrorMsg(data.message)
      addLog("ERROR", data.message, "text-red-500")
    })

    // --- AURA Audio Integration (Megamix Playlist Engine) ---
    socket.on("dj-audio", (data) => {
      setIsAuraThinking(true)
      setAuraThought(data.message)
      addLog("AURA", `Processing mood resonance... ("${data.message}")`, "text-pink-400")
    })

    const getCtx = async (): Promise<AudioContext> => {
       if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
       }
       if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
       return audioCtxRef.current;
    };

    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"
    const getAudioUrl = (url: string) => url.startsWith("http") || url.startsWith("data:") ? url : `${baseUrl}${url}`;


     /** Downloads and decodes a single music URL into an AudioBuffer */
     const fetchTrackBuffer = async (url: string): Promise<AudioBuffer | null> => {
        if (url === "SKIP_MUSIC") return null;
        const ctx = await getCtx();
        const response = await fetch(getAudioUrl(url));
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const durationMin = Math.floor(audioBuffer.duration / 60);
        const durationSec = Math.floor(audioBuffer.duration % 60);
        console.log(`[AudioEngine] Track loaded: ${durationMin}:${durationSec.toString().padStart(2, '0')} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
        addLog("AURA", `📊 Track loaded: ${durationMin}:${durationSec.toString().padStart(2, '0')}`, "text-cyan-400");
        return audioBuffer;
     };

     /** Plays a full track with DJ voice ducking and crossfade from previous track */
     const playFullTrack = async (data: any) => {
        try {
           const urls = data.musicAudioUrls || [];
           if (urls.length === 0) return;

           const buffer = await fetchTrackBuffer(urls[0]);
           if (!buffer) return;

           const ctx = await getCtx();
           const CROSSFADE_DURATION = 1.5;
           const now = ctx.currentTime;

           // Kill previous Voice and SFX
           if (voiceRef.current) { voiceRef.current.pause(); voiceRef.current = null; }
           if (sfxRef.current) { sfxRef.current.pause(); sfxRef.current = null; }

           // Seamless fade-out of any currently playing track
           if (currentGainRef.current && currentSourceRef.current) {
              const oldGain = currentGainRef.current;
              const oldSource = currentSourceRef.current;
              oldGain.gain.cancelScheduledValues(now);
              oldGain.gain.setValueAtTime(oldGain.gain.value, now);
              oldGain.gain.linearRampToValueAtTime(0.0, now + CROSSFADE_DURATION);
              try { oldSource.stop(now + CROSSFADE_DURATION + 0.1); } catch(e) {}
           }

           // Create audio channel for the new full track
           const gainNode = ctx.createGain();
           gainNode.connect(ctx.destination);
           const source = ctx.createBufferSource();
           source.buffer = buffer;
           source.loop = true;
           source.connect(gainNode);

           const fadeUp = () => {
              gainNode.gain.cancelScheduledValues(ctx.currentTime);
              gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
              gainNode.gain.linearRampToValueAtTime(1.0, ctx.currentTime + CROSSFADE_DURATION);
           };

           if (data.djAudioUrl !== "SKIP_VOICE") {
              const voice = new Audio(getAudioUrl(data.djAudioUrl));
              voiceRef.current = voice;

              if (data.sfxAudioUrl) {
                 const sfx = new Audio(getAudioUrl(data.sfxAudioUrl));
                 sfxRef.current = sfx;
                 sfx.play().catch(() => {});
              }

              // Music starts quietly during voice (ducking)
              gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
              source.start(now);
              setIsAuraSpeaking(true);
              voice.play().catch(() => fadeUp());
              voice.onended = () => { fadeUp(); setIsAuraSpeaking(false); };
              voice.onerror = () => { fadeUp(); setIsAuraSpeaking(false); };
           } else {
              // No voice: music fades in smoothly
              gainNode.gain.setValueAtTime(0.0, now);
              source.start(now);
              gainNode.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_DURATION);
           }

           currentGainRef.current = gainNode;
           currentSourceRef.current = source;

           const trackMin = Math.floor(buffer.duration / 60);
           const trackSec = Math.floor(buffer.duration % 60);
           addLog("AURA", `🎶 Full track playing (${trackMin}:${trackSec.toString().padStart(2, '0')})`, "text-violet-400");

        } catch (err) {
           console.error("[RadioEngine] Full Track Error:", err);
        }
     };

     // --- Event: First track (or new track) ---
     socket.on("play-track", (data) => {
        setIsAuraThinking(false)
        setCurrentTrack({ title: data.track.title, artist: data.track.artist })
        addLog("AURA", `🎵 Now playing: ${data.track.title}`, "text-emerald-400")
        playFullTrack(data);
     })

     // --- Event: Pre-buffer the NEXT song (arrives ~60s before crossfade) ---
     socket.on("upcoming-track", async (data) => {
        addLog("AURA", `⏭ Pre-loading next song...`, "text-cyan-400")
        try {
           const urls = data.musicAudioUrls || [];
           if (urls.length > 0) {
              const buffer = await fetchTrackBuffer(urls[0]);
              upcomingBufferRef.current = buffer;
              upcomingDataRef.current = data;
              addLog("AURA", `✅ Next song buffered and ready!`, "text-emerald-400")
           }
        } catch (err) {
           console.warn("[RadioEngine] Pre-buffer failed:", err);
           upcomingDataRef.current = data;
           upcomingBufferRef.current = null;
        }
     })

     // --- Event: Execute the crossfade to the pre-buffered song ---
     socket.on("crossfade-now", async () => {
        addLog("AURA", `🔀 Crossfading to next song...`, "text-purple-400")
        const nextData = upcomingDataRef.current;
        if (!nextData) return;

        setCurrentTrack({ title: nextData.track.title, artist: nextData.track.artist })

        // If we have a pre-buffered song, use it directly for instant crossfade
        if (upcomingBufferRef.current && nextData) {
           try {
              const ctx = await getCtx();
              const CROSSFADE_DURATION = 1.5;
              const now = ctx.currentTime;
              const buffer = upcomingBufferRef.current;

              // Kill previous voice/SFX
              if (voiceRef.current) { voiceRef.current.pause(); voiceRef.current = null; }
              if (sfxRef.current) { sfxRef.current.pause(); sfxRef.current = null; }

              // Fade out current track
              if (currentGainRef.current && currentSourceRef.current) {
                 const oldGain = currentGainRef.current;
                 const oldSource = currentSourceRef.current;
                 oldGain.gain.cancelScheduledValues(now);
                 oldGain.gain.setValueAtTime(oldGain.gain.value, now);
                 oldGain.gain.linearRampToValueAtTime(0.0, now + CROSSFADE_DURATION);
                 try { oldSource.stop(now + CROSSFADE_DURATION + 0.1); } catch(e) {}
              }

              // Start new track
              const gainNode = ctx.createGain();
              gainNode.connect(ctx.destination);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.loop = true;
              source.connect(gainNode);

              const fadeUp = () => {
                 gainNode.gain.cancelScheduledValues(ctx.currentTime);
                 gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
                 gainNode.gain.linearRampToValueAtTime(1.0, ctx.currentTime + CROSSFADE_DURATION);
              };

              if (nextData.djAudioUrl !== "SKIP_VOICE") {
                 const voice = new Audio(getAudioUrl(nextData.djAudioUrl));
                 voiceRef.current = voice;

                 if (nextData.sfxAudioUrl) {
                    const sfx = new Audio(getAudioUrl(nextData.sfxAudioUrl));
                    sfxRef.current = sfx;
                    sfx.play().catch(() => {});
                 }

                 gainNode.gain.setValueAtTime(0.1, now);
                 source.start(now);
                 setIsAuraSpeaking(true);
                 voice.play().catch(() => fadeUp());
                 voice.onended = () => { fadeUp(); setIsAuraSpeaking(false); };
                 voice.onerror = () => { fadeUp(); setIsAuraSpeaking(false); };
              } else {
                 gainNode.gain.setValueAtTime(0.0, now);
                 source.start(now);
                 gainNode.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_DURATION);
              }

              currentGainRef.current = gainNode;
              currentSourceRef.current = source;

              const trackMin = Math.floor(buffer.duration / 60);
              const trackSec = Math.floor(buffer.duration % 60);
              addLog("AURA", `🎶 New song playing (${trackMin}:${trackSec.toString().padStart(2, '0')})`, "text-violet-400");

           } catch (err) {
              console.error("[RadioEngine] Crossfade Error:", err);
           }
        } else {
           // Fallback: no pre-buffer, play from scratch
           playFullTrack(nextData);
        }

        // Clear pre-buffer
        upcomingBufferRef.current = null;
        upcomingDataRef.current = null;
     })


    // --- Security Integration ---
    socket.on("security-termination", (data) => {
      alert(data.message)
      socket.disconnect()
      window.location.href = "/"
    })

    return () => {
      socket.off("room-joined")
      socket.off("user-joined")
      socket.off("user-left")
      socket.off("user-ready-update")
      socket.off("error")
      socket.off("dj-audio")
      socket.off("play-track")
      socket.off("upcoming-track")
      socket.off("crossfade-now")
      socket.off("security-termination")
      document.body.style.overflow = "auto";
    }
  }, [])

  const handleDirectJoin = () => {
    if (!nickname) {
       setErrorMsg("Please enter a Node Identity.");
       return;
    }
    setErrorMsg("");

    // Load personal API keys from LocalStorage
    const savedKeys = localStorage.getItem("aura_byoak_keys");
    const apiKeys = savedKeys ? JSON.parse(savedKeys) : undefined;

    socket.connect()
    
    // Ensure we are connected before emitting
    socket.once("connect", () => {
       socket.emit("join-room", { roomCode, nickname, apiKeys })
    })
  }

  const handleReadyUp = async () => {
      try {
        await startWebcam()
        addLog("SYSTEM", "Camera is live! Waiting for tactical readiness.", "text-emerald-400")
      } catch (err) {
        addLog("ERROR", "Camera bridge failed. Check permissions.", "text-red-500")
      }
  }

  const handleConfirmReady = () => {
    socket.emit("user-ready")
    setLocalReady(true)
    setUsersInRoom(prev => prev.map(u => u.nickname === nickname ? { ...u, isReady: true } : u))
    addLog("SYSTEM", "User signal: READY. Awaiting cluster sync...", "text-indigo-400")
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addLog("SYSTEM", "Cluster URI copied to clipboard.", "text-zinc-400")
  }

  if (!hasJoined) {
    return (
      <main className="min-h-[100svh] bg-[#05050A] text-zinc-50 flex items-center justify-center p-6 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]">
        <GlowCard className="max-w-md w-full bg-[#0C0C14]/90 backdrop-blur-2xl p-8 text-center" glowColor="rgba(99, 102, 241, 0.2)">
           <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Join the Party</h2>
           <p className="text-indigo-400 font-mono text-xl mb-6 tracking-widest bg-indigo-500/10 py-2 border border-indigo-500/20 rounded-lg">{roomCode}</p>
           
           <div className="space-y-4">
             <input
               type="text"
               placeholder="Your Name (e.g. Alex)"
               value={nickname}
               onChange={(e) => setNickname(e.target.value)}
               className="w-full bg-[#030305]/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-medium text-center shadow-inner tracking-wide"
             />
             {errorMsg && <p className="text-red-400 text-sm font-mono">{errorMsg}</p>}
               <button
                onClick={handleDirectJoin}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-4 font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 uppercase tracking-widest text-sm"
              >
                Join now
              </button>
           </div>
        </GlowCard>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-[#05050A] text-zinc-50 pt-24 px-4 sm:px-6 pb-24 selection:bg-indigo-500/30 overflow-x-hidden relative flex flex-col">
      <FloatingNavbar isRoom roomCode={roomCode} onLeaveRoom={() => socket.disconnect()} />
      
      {/* Background Grid & Vibe Orb */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_100%)]"></div>
         <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] mix-blend-screen opacity-50 transition-all duration-1000 animate-float ${getVibeColor(currentMood)}`} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 flex-grow"
      >
        {/* Left Column: Camera Matrix & Acoustic Engine */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Neural Interface Video Feed */}
          <div className="relative aspect-video rounded-3xl overflow-hidden group flex-grow min-h-[300px] flex flex-col items-center justify-center">
             
            {/* HUD Scanline */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-20 bg-[linear-gradient(transparent_0%,rgba(99,102,241,0.2)_50%,transparent_100%)] h-[20%] w-full animate-float" />
            
            {/* HUD Decorative Corners */}
            <svg className="absolute top-4 left-4 w-8 h-8 text-indigo-500/50 z-20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="square" strokeLinejoin="miter" d="M4 10V4h6" /></svg>
            <svg className="absolute top-4 right-4 w-8 h-8 text-indigo-500/50 z-20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="square" strokeLinejoin="miter" d="M20 10V4h-6" /></svg>
            <svg className="absolute bottom-4 left-4 w-8 h-8 text-indigo-500/50 z-20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="square" strokeLinejoin="miter" d="M4 14v6h6" /></svg>
            <svg className="absolute bottom-4 right-4 w-8 h-8 text-indigo-500/50 z-20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="square" strokeLinejoin="miter" d="M20 14v6h-6" /></svg>
            
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-40 transition-opacity duration-1000 group-hover:opacity-70 scale-x-[-1]" />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30">
              {!videoRef.current?.srcObject ? (
                <div className="space-y-4 backdrop-blur-3xl bg-[#05050A]/80 p-8 rounded-3xl border border-white/10 pointer-events-auto max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/30">
                      <Video className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider font-mono">Join the Vibe</h3>
                  <p className="text-zinc-400 text-sm font-mono">Turn on your camera so AURA can see your mood.</p>
                  <button onClick={handleReadyUp} className="mt-4 w-full bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-indigo-100 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] uppercase tracking-wider text-sm flex justify-center items-center gap-2">
                    <Video className="w-4 h-4" /> Start Camera
                  </button>
                </div>
              ) : !localReady ? (
                <div className="space-y-4 backdrop-blur-3xl bg-[#05050A]/80 p-8 rounded-3xl border border-indigo-500/30 pointer-events-auto max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider font-mono">Visuals Synced</h3>
                  <p className="text-zinc-400 text-sm font-mono">Ready to join the frequency?</p>
                  <button onClick={handleConfirmReady} className="mt-4 w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.3)] uppercase tracking-wider text-sm flex justify-center items-center gap-2">
                    <Activity className="w-4 h-4" /> I'M READY
                  </button>
                </div>
              ) : (
                <>
                  {/* Status overlay for when ready but waiting for others */}
                  {!currentTrack && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                       <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
                       <p className="text-indigo-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Waiting for others to ready up...</p>
                    </div>
                  )}
                  <div className="absolute top-6 left-12 font-mono text-[10px] text-indigo-400/80 tracking-widest hidden sm:block">
                    <p>SYS.LATENCY: 24ms</p>
                    <p>SYS.BUFFER: 100%</p>
                    <p>NET.BANDWIDTH: 4.2 MB/s</p>
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
                    <div className="px-4 py-2 bg-[#05050A]/80 backdrop-blur-md rounded-xl border border-white/10 font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-2 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> TX_ACTIVE
                    </div>
                    {currentMood && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} key={currentMood}
                          className="px-6 py-2 bg-indigo-900/40 backdrop-blur-md rounded-xl border border-indigo-400 font-mono uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(99,102,241,0.6)] font-bold text-white"
                        >
                          VIBE: {currentMood}
                        </motion.div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Acoustic Engine Dashboard */}
          <div className="glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 border-white/10">
            <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
            
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shrink-0 relative overflow-hidden transition-all duration-500 border border-white/10 bg-white/5 shadow-inner ${isAuraThinking ? 'border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.5)]' : ''} ${isAuraSpeaking ? 'border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.8)]' : ''}`}>
               <img src="/assets/music-orb.png" alt="Orb" className={`w-full h-full object-contain hologram-asset transition-all duration-300 ${isAuraThinking ? 'scale-110' : ''} ${isAuraSpeaking ? 'scale-125' : ''}`} />
               <div className={`absolute inset-0 animate-pulse ${isAuraThinking ? 'bg-pink-500/10' : (isAuraSpeaking ? 'bg-cyan-400/20 animate-ping' : 'bg-indigo-500/5')}`} />
            </div>
            
            <div className="text-center md:text-left flex-1 relative z-10 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 w-full">
                <div>
                    <p className={`font-mono text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-2 ${isAuraThinking ? 'text-pink-400' : (isAuraSpeaking ? 'text-cyan-400' : 'text-indigo-400')}`}>
                       {isAuraSpeaking ? 'AURA is speaking...' : (isAuraThinking ? 'AURA is thinking...' : (currentTrack ? 'Now Playing' : 'Finding your vibe...'))}
                    </p>
                    <h4 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">
                       {isAuraSpeaking ? 'Broadcasting live to room...' : (isAuraThinking ? 'Processing Room Vibe...' : (currentTrack ? currentTrack.title : 'Waiting for your vibe'))}
                    </h4>
                    <p className="text-zinc-400 text-sm font-light italic">
                       {isAuraThinking ? (auraThought || 'Analyzing room patterns...') : (currentTrack && !isAuraSpeaking ? currentTrack.artist : (isAuraSpeaking ? 'Voice frequency modulating...' : 'AURA is waiting to see how you feel.'))}
                    </p>
                </div>
                
                {/* Fake Glass EQ */}
                <div className="flex items-end gap-1 h-12 w-32 shrink-0 justify-center">
                  {[...Array(12)].map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: ["20%", "100%", "40%", "80%", "30%"] }}
                      transition={{ duration: 1.5 + Math.random(), repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                      className="w-1.5 bg-indigo-500/80 rounded-t-sm shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Console & Cluster Status */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Cluster Roster Component */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col max-h-[300px]">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                <img src="/assets/users-core.png" alt="Users" className="w-full h-full object-contain hologram-asset" />
              </div>
              <h3 className="font-bold text-lg tracking-wide uppercase font-mono text-white">Friends in Room</h3>
              <span className="ml-auto bg-white/10 text-[10px] px-2 py-1 rounded font-mono text-zinc-400">{usersInRoom.length} ONLINE</span>
            </div>
            
            <ul className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <AnimatePresence>
                {usersInRoom.map((u, i) => (
                  <motion.li 
                    key={u.nickname || i}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="flex justify-between items-center bg-[#030305]/70 border border-white/5 hover:border-white/10 px-4 py-3 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                      <span className="font-mono text-sm tracking-wide text-zinc-300">{u.nickname}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${u.isReady ? "bg-indigo-500/20 text-indigo-300" : "bg-white/10 text-zinc-500 group-hover:bg-white/20"}`}>
                      {u.isReady ? "ON" : "WAIT"}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>

          {/* Activity Console Component */}
          <div className="glass-panel rounded-3xl p-0 flex flex-col flex-1 min-h-[350px] relative overflow-hidden border-white/10">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />
             
             <div className="bg-[#030305]/60 px-6 py-4 flex items-center gap-3 border-b border-white/5">
                <Terminal className="w-5 h-5 text-pink-400" />
                 <h3 className="font-monospace text-sm font-bold tracking-widest text-zinc-300">ACTIVITY FEED</h3>
             </div>
             
             <div className="p-6 overflow-y-auto flex-1 font-mono text-[11px] sm:text-xs leading-relaxed space-y-2 custom-scrollbar">
               {logs.map((log) => (
                 <div key={log.id} className="flex gap-3 items-start hover:bg-white/5 p-1 rounded transition-colors -mx-1 px-2 pb-2 border-b border-white/5 last:border-0">
                    <span className={`shrink-0 font-bold ${log.color} opacity-80`}>[{log.prefix}]</span>
                    <span className="text-zinc-400 break-words">{log.text}</span>
                 </div>
               ))}
               <div ref={logEndRef} className="h-4" />
             </div>
          </div>

        </div>
      </motion.div>
    </main>
  )
}
