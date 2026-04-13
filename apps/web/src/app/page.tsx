"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { PlayCircle, Users, Video, Music, Mic, Brain, Sparkles, ChevronDown, CheckCircle2 } from "lucide-react"

import { socket } from "@/lib/socket"
import { useMoodDetection } from "@/hooks/useMoodDetection"
import { GlowCard } from "@/components/GlowCard"
import { FloatingNavbar } from "@/components/FloatingNavbar"

import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  
  const [joinCodeInput, setJoinCodeInput] = useState("")
  const [nickname, setNickname] = useState("")
  const [activityContext, setActivityContext] = useState("")
  const [initialVibe, setInitialVibe] = useState("Electronic")
  const [isCreating, setIsCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const { videoRef, startWebcam, currentMood, isInitializing } = useMoodDetection({
    intervalMs: 8000,
    onMoodDetected: (mood, confidence) => {
      if (socket.connected) {
        socket.emit("mood-update", { mood, confidence })
      }
    }
  })

  useEffect(() => {
    socket.on("connect", () => setErrorMsg(""))
    socket.on("error", (data) => {
      setErrorMsg(data.message)
      setIsCreating(false)
    })
    
    socket.on("connect_error", (err) => {
      setErrorMsg(`Connection Error: ${err.message}`)
      setIsCreating(false)
    })

    socket.on("room-created", (data) => {
      router.push(`/room/${data.roomCode}`)
    })
    
    socket.on("room-joined", (data) => {
      router.push(`/room/${data.roomCode}`)
    })

    return () => {
      socket.off("connect"); socket.off("error"); 
      socket.off("room-created"); socket.off("room-joined");
      socket.off("connect_error");
    }
  }, [router])

  const handleCreateRoom = () => {
    if (!nickname) { setErrorMsg("Please provide a Node Identity."); return }
    if (!activityContext) { setErrorMsg("Please provide an Activity Context."); return }
    setIsCreating(true)
    setErrorMsg("")
    
    const timeout = setTimeout(() => {
       if (isCreating) {
         setIsCreating(false);
         setErrorMsg("Request timed out. Is the server running?");
       }
    }, 10000);

    socket.connect()
    
    socket.once("connect", () => {
       socket.emit("request-create-room", { nickname, initialVibe, activityContext })
       clearTimeout(timeout)
    })
  }

  const handleJoinRoom = () => {
    if (!nickname || !joinCodeInput) { setErrorMsg("Identity and Target Code required."); return }
    if (!activityContext) { setErrorMsg("Please provide an Activity Context."); return }
    setErrorMsg("")
    socket.connect()
    
    socket.once("connect", () => {
        socket.emit("join-room", { roomCode: joinCodeInput.toUpperCase(), nickname, activityContext })
    })
  }

  // -------------------------------------------------------------------------
  // LANDING PAGE SECTIONS
  // -------------------------------------------------------------------------
  const renderHero = () => (
    <section className="relative min-h-[100svh] flex flex-col justify-center pt-32 pb-12 px-6 overflow-hidden">
      {/* Ambient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] mix-blend-screen animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[160px] mix-blend-screen animate-float-delayed pointer-events-none" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto text-center z-10 flex-grow flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center mb-12"
        >
          <div className="w-32 h-32 md:w-48 md:h-48 mb-8 rounded-full overflow-hidden border border-white/10 bg-white/5 shadow-[0_0_50px_rgba(99,102,241,0.1)] flex items-center justify-center p-4">
            <img 
               src="/assets/logo.png" 
               alt="MoodSync Jukebox Logo" 
               className="w-full h-full scale-125 object-contain mix-blend-screen" 
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-500/50" />
            <span className="text-zinc-500 font-mono text-[10px] tracking-[0.5em] uppercase font-bold">AURA Protocol</span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-500/50" />
          </div>
        </motion.div>

        <motion.h1 
          className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
        >
          MOODSYNC <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-400 to-pink-500 pb-2 inline-block drop-shadow-[0_0_30px_rgba(168,85,247,0.3)]">
             JUKEBOX
          </span>
        </motion.h1>

        <motion.p 
          className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
        >
          An AI DJ that knows exactly how you feel and plays the perfect music. AURA reads your vibe through the camera and picks the best songs for your energy.
        </motion.p>

        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
        >
          <a href="#join" className="w-full sm:w-auto px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)] text-sm uppercase tracking-wider">
            Start the Party <PlayCircle className="w-4 h-4" />
          </a>
          <a href="#features" className="w-full sm:w-auto px-8 py-4 text-zinc-300 font-medium hover:text-white transition-all flex items-center justify-center gap-2 group text-sm uppercase tracking-wider">
             Learn More <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform opacity-50" />
          </a>
        </motion.div>
      </div>

      <motion.div className="w-full max-w-4xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-wrap justify-center gap-8 md:gap-16 opacity-30 grayscale hover:opacity-70 transition-all duration-700" initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} transition={{ delay: 0.8 }}>
         <div className="text-xs font-bold font-mono tracking-widest uppercase">Next.js Framework</div>
         <div className="text-xs font-bold font-mono tracking-widest uppercase">Turbopuffer Vector DB</div>
         <div className="text-xs font-bold font-mono tracking-widest uppercase">ElevenLabs Neural Voice</div>
      </motion.div>
    </section>
  )

  const renderFeatures = () => (
    <section id="features" className="py-32 px-6 relative z-10 bg-[#020205] border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="mb-24 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">
            Total Privacy. Pure Music.
          </h2>
          <p className="text-zinc-500 text-lg font-light max-w-xl mx-auto">Experience the next generation of music listening with AURA.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[300px]">
          {/* Card 1: Face Detection (Tall) */}
          <GlowCard className="md:col-span-1 md:row-span-2 glass-panel border-white/5 overflow-hidden" delay={0.1} glowColor="rgba(236, 72, 153, 0.1)">
            <div className="h-full flex flex-col justify-end p-8 relative z-10 pointer-events-none">
              <div className="w-20 h-20 mb-auto rounded-full bg-pink-500/5 border border-pink-500/20 shadow-[0_0_20px_rgba(236,72,153,0.1)] flex items-center justify-center p-3 relative overflow-hidden">
                <img src="/assets/video-core.png" alt="Video Core" className="w-full h-full object-contain animate-float hologram-asset" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Private & Secure</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Expressions are processed purely on your device. Your video data never leaves your browser.
              </p>
            </div>
          </GlowCard>

          {/* Card 2: Turbopuffer (Wide) */}
          <GlowCard className="md:col-span-2 glass-panel border-white/5 overflow-hidden" delay={0.2} glowColor="rgba(168, 85, 247, 0.1)">
             <div className="h-full flex flex-col justify-end p-8 pointer-events-none relative">
                <div className="absolute top-8 right-8 w-48 h-48 rounded-full bg-purple-500/5 border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.1)] flex items-center justify-center p-6 opacity-60 overflow-hidden">
                   <img src="/assets/brain-core.png" alt="Brain Core" className="w-full h-full scale-125 object-contain animate-float-delayed hologram-asset" />
                </div>
                <div className="w-16 h-16 mb-auto rounded-full bg-white/5 border border-white/20 flex items-center justify-center p-3 overflow-hidden">
                  <img src="/assets/brain-core.png" alt="Brain Icon" className="w-full h-full object-contain hologram-asset" />
                </div>
               <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Smart Music Brain</h3>
               <p className="text-zinc-400 text-sm leading-relaxed max-w-lg font-light">
                 AURA searches through millions of songs to find the perfect match for your mood and current activity.
               </p>
             </div>
          </GlowCard>

          {/* Card 3: ElevenLabs (Normal) */}
          <GlowCard className="md:col-span-1 glass-panel border-white/5 overflow-hidden" delay={0.3} glowColor="rgba(99, 102, 241, 0.1)">
             <div className="h-full flex flex-col justify-end p-8 pointer-events-none">
                <div className="w-16 h-16 mb-auto rounded-full bg-indigo-500/5 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)] flex items-center justify-center p-3 overflow-hidden">
                  <img src="/assets/mic-core.png" alt="Mic Core" className="w-full h-full object-contain hologram-asset" />
                </div>
               <div>
                 <h3 className="text-xl font-bold text-white mb-2 tracking-tight">AI Voice Host</h3>
                 <p className="text-zinc-500 text-xs font-light leading-relaxed">AURA talks to you and your friends like a real radio DJ in real-time.</p>
               </div>
             </div>
          </GlowCard>

          {/* Card 4: Socket.io (Normal) */}
          <GlowCard className="md:col-span-1 glass-panel border-white/5 overflow-hidden" delay={0.4} glowColor="rgba(16, 185, 129, 0.1)">
             <div className="h-full flex flex-col justify-end p-8 pointer-events-none">
                <div className="w-16 h-16 mb-auto rounded-full bg-emerald-500/5 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] flex items-center justify-center p-3 overflow-hidden">
                  <img src="/assets/users-core.png" alt="Users Core" className="w-full h-full object-contain animate-pulse hologram-asset" />
                </div>
               <div>
                 <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Perfectly Synced</h3>
                 <p className="text-zinc-500 text-xs font-light leading-relaxed">Music plays at the exact same beat for everyone in the room.</p>
               </div>
             </div>
          </GlowCard>
        </div>
      </div>
    </section>
  )

  const renderDemo = () => {
    return (
      <section id="demo" className="py-32 px-6 relative z-10 bg-[#05050A]">
         <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-5/12 space-y-8">
               <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">The Intelligence <br/><span className="text-indigo-400">Matrix.</span></h2>
               <p className="text-zinc-400 text-base font-light leading-relaxed">Observe the system translate visual heuristics into an authoritative acoustic pulse seamlessly in a three-stage automated pipeline.</p>
               
               <ul className="space-y-8 pt-6">
                 {[
                   { label: "1. Capture", desc: "Edge models poll visual landmarks securely." },
                   { label: "2. Aggregate", desc: "Probabilistic weighting constructs emotional vectors." },
                   { label: "3. Synthesize", desc: "Vector search triggers dynamic DJ narration & audio mapping." }
                 ].map((step, i) => (
                   <li key={i} className="flex gap-4 items-start">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono text-zinc-300">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1 text-sm tracking-wide">{step.label}</h4>
                        <p className="text-zinc-500 text-sm font-light">{step.desc}</p>
                      </div>
                   </li>
                 ))}
               </ul>
            </div>

            <div className="lg:w-7/12 w-full">
               <div className="glass-panel rounded-3xl p-6 font-mono text-[11px] text-zinc-500 flex flex-col relative overflow-hidden shadow-2xl min-h-[400px]">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                  
                  <div className="flex gap-2 mb-8 pb-4 border-b border-white/5">
                     <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                     <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                     <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  </div>

                  <div className="space-y-4 flex-1">
                     <div className="flex gap-3 items-start"><span className="text-indigo-400 w-24 shrink-0">[SYS.INIT]</span> <span className="text-zinc-400">Event stream online.</span></div>
                     <div className="flex gap-3 items-start"><span className="text-purple-400 opacity-60 w-24 shrink-0">[NODE_1]</span> <span>Telemetry: {`{"mood":"happy","conf": 0.92}`}</span></div>
                     <div className="flex gap-3 items-start"><span className="text-purple-400 opacity-60 w-24 shrink-0">[NODE_2]</span> <span>Telemetry: {`{"mood":"surprised","conf": 0.81}`}</span></div>
                     <div className="flex gap-3 items-start"><span className="text-indigo-400 w-24 shrink-0">[CORE.VECTOR]</span> <span className="text-zinc-300">Computing space ➔ ['Upbeat', 'Energetic']</span></div>
                     <div className="flex gap-3 items-start"><span className="text-pink-400 w-24 shrink-0">[DB.SEARCH]</span> <span>Vector match established (tk_14992).</span></div>
                     <div className="flex gap-3 items-start"><span className="text-emerald-400 w-24 shrink-0">[AI.TTS]</span> <span>Narrator script compiled successfully.</span></div>
                  </div>
                  
                  <div className="mt-8 text-white bg-[#030305]/80 p-4 rounded-xl border border-white/5 font-sans text-sm italic font-light shadow-inner">
                    "I'm seeing a lot of smiles in there! Let's elevate that energy with this next track..."
                  </div>
               </div>
            </div>
         </div>
      </section>
    )
  }

  const renderJoinAction = () => (
    <section id="join" className="py-32 px-6 relative z-10 flex justify-center bg-[#020205] border-t border-white/5">
       <div className="max-w-lg w-full text-center">
          <div className="inline-block relative mb-6">
             <div className="w-20 h-20 rounded-full bg-indigo-500/5 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)] flex items-center justify-center p-4 overflow-hidden">
                <img src="/assets/music-orb.png" alt="Orb" className="w-full h-full object-contain animate-float hologram-asset" />
             </div>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Join the Party</h2>
          <p className="text-zinc-500 mb-10 font-light text-sm">Create a new room or enter a code to join the crew.</p>
          
          <div className="glass-panel rounded-3xl p-6 md:p-8 text-left border-white/10 shadow-2xl">
            <div className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">Your Name</label>
                  <input
                    type="text"
                    className="w-full bg-[#030305]/50 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:bg-[#030305] transition-all font-medium text-sm"
                    placeholder="e.g. Alex"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">Starting Vibe</label>
                  <select
                    className="w-full bg-[#030305]/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-indigo-500/50 focus:bg-[#030305] transition-all font-medium text-sm appearance-none"
                    value={initialVibe}
                    onChange={(e) => setInitialVibe(e.target.value)}
                  >
                    <option value="Electronic">Electronic / EDM</option>
                    <option value="Lo-Fi">Chill / Lo-Fi</option>
                    <option value="Pop">Upbeat Pop</option>
                    <option value="Rock">Alternative Rock</option>
                    <option value="Jazz">Late Night Jazz</option>
                    <option value="Classical">Classical</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 pl-1">What are you doing? (For AURA)</label>
                  <input
                    type="text"
                    className="w-full bg-[#030305]/50 border border-white/5 rounded-xl px-4 py-3 text-emerald-400 placeholder-emerald-900/50 focus:outline-none focus:border-emerald-500/50 focus:bg-[#030305] transition-all font-medium text-sm"
                    placeholder="e.g., Coding all night, chill with friends..."
                    value={activityContext}
                    onChange={(e) => setActivityContext(e.target.value)}
                  />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-red-500" />
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 gap-3 flex flex-col sm:flex-row">
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className={`w-full sm:w-1/2 flex items-center justify-center gap-2 ${isCreating ? "bg-white/10 text-white/50" : "bg-white text-black hover:bg-zinc-200"} rounded-xl px-4 py-3 font-bold transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] text-xs uppercase tracking-wider`}
                >
                  {isCreating ? "Preparing..." : "Create Room"}
                </button>
                
                <div className="w-full sm:w-1/2 flex gap-2">
                  <input
                    type="text"
                    placeholder="CODE"
                    maxLength={5}
                    className="w-full max-w-[80px] bg-[#030305]/50 border border-white/5 rounded-xl text-center tracking-wider text-white uppercase focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-xs"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                  />
                  <button
                    onClick={handleJoinRoom}
                    className="flex-1 bg-[#101018] border border-white/5 hover:bg-[#1a1a24] text-zinc-300 rounded-xl px-4 font-bold transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    Join
                  </button>
                </div>
              </div>
              
            </div>
          </div>
       </div>
    </section>
  )

  return (
    <main className="min-h-[100svh] selection:bg-indigo-500/30">
      <FloatingNavbar />
      
      <AnimatePresence mode="wait">
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
          {renderHero()}
          {renderFeatures()}
          {renderDemo()}
          {renderJoinAction()}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
