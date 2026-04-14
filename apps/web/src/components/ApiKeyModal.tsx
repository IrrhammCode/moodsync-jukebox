"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, ShieldCheck, AlertCircle, Save, Sliders } from "lucide-react";

export interface UserApiKeys {
  gemini?: string;
  elevenlabs?: string;
  groq?: string;
  turbopuffer?: string;
}

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [keys, setKeys] = useState<UserApiKeys>({
    gemini: "",
    elevenlabs: "",
    groq: "",
    turbopuffer: ""
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("aura_byoak_keys");
    if (saved) {
      try {
        setKeys(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved API keys");
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem("aura_byoak_keys", JSON.stringify(keys));
    setShowConfirmation(true);
    setTimeout(() => {
      setShowConfirmation(false);
      onClose();
    }, 1500);
  };

  const handleChange = (id: keyof UserApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [id]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] transition-all"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[151] px-4"
          >
            <div className="bg-[#05050A] border border-white/10 rounded-[32px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)] flex flex-col relative">
              
              {/* Header */}
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Key className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">API Infrastructure</h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-zinc-500">BYOAK - Protocol Phase 11</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors group"
                >
                  <X className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex gap-4 items-start">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Personal keys are stored <span className="text-indigo-300 font-semibold underline decoration-indigo-500/30">locally in your browser</span>. We never save them to our databases. They are only utilized to fund your AI DJ's cognition.
                  </p>
                </div>

                {/* Input Fields */}
                <div className="space-y-4">
                  {[
                    { id: "groq", label: "Groq API Key", placeholder: "gsk_...", hint: "Used for AURA's Intelligence (Llama 3)" },
                    { id: "elevenlabs", label: "ElevenLabs API Key", placeholder: "Enter ElevenLabs Key", hint: "Used for Natural Voice & 3-Min Music" },
                    { id: "gemini", label: "Gemini API Key", placeholder: "Enter Google Gemini Key", hint: "Used for Semantic Mood Foresight" },
                    { id: "turbopuffer", label: "Turbopuffer Key", placeholder: "Enter Token", hint: "Optional: Used for Semantic Memory" },
                  ].map((field) => (
                    <div key={field.id} className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{field.label}</label>
                        <span className="text-[9px] font-mono text-zinc-600">{field.hint}</span>
                      </div>
                      <div className="relative group">
                        <input
                          type="password"
                          placeholder={field.placeholder}
                          value={keys[field.id as keyof UserApiKeys] || ""}
                          onChange={(e) => handleChange(field.id as keyof UserApiKeys, e.target.value)}
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all pr-12"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                         <Sliders className="w-4 h-4 text-indigo-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                   <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-yellow-500/80 leading-relaxed font-medium">
                     Make sure these keys are active. If your limits are reached, AURA will revert to fallback scripts.
                   </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-white/5 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl border border-white/5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                >
                  {showConfirmation ? (
                    <>Success <CheckCircle className="w-4 h-4" /> </>
                  ) : (
                    <>Establish Connection <Save className="w-4 h-4" /></>
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
