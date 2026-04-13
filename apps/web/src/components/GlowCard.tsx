"use client";

import { useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlowCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  glowColor?: string;
}

export function GlowCard({ 
  children, 
  className = "", 
  delay = 0, 
  glowColor = "rgba(129, 140, 248, 0.15)", // Indigo default
  ...props 
}: GlowCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`glass-panel rounded-[2.5rem] relative overflow-hidden group transition-all duration-500 hover:border-white/10 ${className}`}
      {...props}
    >
      {/* Primary Mouse Tracking Glow */}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-500 ease-in-out pointer-events-none"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`
        }}
      />
      {/* Secondary subtle white highlight */}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-500 ease-in-out pointer-events-none mix-blend-overlay"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.06), transparent 40%)`
        }}
      />
      
      {/* Content wrapper */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </motion.div>
  );
}
