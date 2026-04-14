"use client";

import { useState, useEffect } from "react";
import { Music2, Copy, CheckCircle, X, Activity, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ApiKeyModal } from "./ApiKeyModal";

interface FloatingNavbarProps {
  isRoom?: boolean;
  roomCode?: string;
  onLeaveRoom?: () => void;
}

export function FloatingNavbar({ isRoom = false, roomCode, onLeaveRoom }: FloatingNavbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    if (onLeaveRoom) {
      onLeaveRoom();
    }
    router.push("/");
  };

  return (
    <div className="fixed top-6 left-0 right-0 z-[110] flex justify-center px-4 w-full pointer-events-none">
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`pointer-events-auto transition-all duration-500 w-full max-w-4xl rounded-full flex items-center justify-between
          ${scrolled || isRoom
            ? "bg-[#05050A]/80 backdrop-blur-2xl border border-indigo-500/20 shadow-[0_20px_40px_rgba(0,0,0,0.5)] py-3 px-6" 
            : "bg-transparent py-4 px-6 border border-transparent"
          } ${isRoom ? "border-pink-500/20 shadow-[0_10px_30px_rgba(236,72,153,0.1)]" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center p-1 shrink-0 bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
             <img 
               src="/assets/logo.png" 
               alt="MoodSync Logo" 
               className="w-full h-full scale-110 object-contain mix-blend-screen" 
             />
          </div>
          <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
            MoodSync <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isRoom ? 'from-pink-400 to-indigo-400' : 'from-indigo-400 to-purple-400'} font-light`}>Jukebox</span>
          </span>
        </div>

        {/* Dynamic Center Section */}
        <div className="flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!isRoom ? (
              <motion.div 
                key="landing-links"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="hidden md:flex items-center gap-8 text-sm font-medium"
              >
                <a href="/#features" className="text-zinc-400 hover:text-white transition-colors relative group">
                  Features
                  <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
                </a>
                <a href="/#demo" className="text-zinc-400 hover:text-white transition-colors relative group">
                  AI Engine
                  <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
                </a>
                <a href="/analytics" className="text-zinc-400 hover:text-emerald-400 transition-colors relative group flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Analytics
                  <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-emerald-500 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </motion.div>
            ) : (
              <motion.div
                key="room-stats"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-4 sm:gap-6 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                  <span className="font-mono text-[10px] sm:text-xs text-zinc-300 tracking-wider">CONNECTED</span>
                </div>
                
                <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />
                
                <button 
                  onClick={handleCopy}
                  className="hidden sm:flex items-center gap-2 hover:text-white transition-colors text-zinc-400 font-mono text-[10px] sm:text-xs tracking-wider group"
                >
                  <span className="text-pink-400 opacity-60">Room:</span> {roomCode}
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Right Section */}
        <div className="flex items-center gap-4">
           {/* API Key Toggle */}
           <button
             onClick={() => setIsSettingsOpen(true)}
             className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all pointer-events-auto"
             title="API Settings"
           >
             <Settings className="w-4 h-4 text-zinc-400 hover:text-white transition-colors" />
           </button>

           {!isRoom ? (
             <a 
                href="/#join"
                className="px-5 py-2 glass-pill text-white text-sm font-medium rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
               Join Room
             </a>
           ) : (
              <button 
                onClick={handleLeave}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/30 text-red-400 text-xs sm:text-sm font-semibold rounded-full hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] uppercase tracking-wider"
              >
               Leave
              </button>
           )}
        </div>
      </motion.nav>

      {/* Global API Key Modal */}
      <ApiKeyModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
