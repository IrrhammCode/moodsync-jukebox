---
title: MoodSync Jukebox Backend
sdk: docker
emoji: 📻
colorFrom: indigo
colorTo: pink
pinned: false
---

# 🎧 AURA Radio Engine (MoodSync Jukebox)

> A premium, AI-driven shared music experience that listens to your emotions and adapts in real-time. Powered by the AURA Protocol.

![AURA Hero](https://generative-placeholders.vercel.app/api/music-visualizer?width=1200&height=400&colors=indigo,purple,pink)

## 📡 The AURA Protocol
AURA (Acoustic User Resonance Architecture) is not just a jukebox; it's a sentient radio host. It utilizes computer vision and neural intelligence to synchronize the mood of every listener in the room.

### 🔑 Key Modules

#### 🛡️ BYOAK Infrastructure (Bring Your Own API Key)
Decentralized credit consumption. Room hosts can provide their own Gemini, ElevenLabs, and Groq credentials, ensuring the system remains sustainable and high-performance.

#### 🔮 Emotional Foresight
Utilizing **Turbopuffer Vector DB** and **Google Gemini**, AURA predicts the emotional trajectory of a room. If the system detects a shift towards negative energy (stress, sadness), it triggers an "Emergency Intervention" to pivot the music and DJ tone.

#### 💰 Semantic Credit Saver
Aura doesn't waste credits. It uses semantic memory to reuse previously generated high-quality tracks if the current room's vibe and activity match a past successful session.

#### 🛡️ Safety Blanket Fallbacks
A robust error-handling layer. If any API service is reached, AURA gracefully falls back to pre-recorded "AURA Legacy" frequencies and system chimes, ensuring the broadcast never stops.

---

## 🛠️ Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Express, Socket.io (Real-time Sync), Node.js.
- **Intelligence**: 
  - **Llama 3 (Groq)**: High-speed reasoning and DJ scripting.
  - **Google Gemini**: Vision analysis & semantic embeddings.
  - **ElevenLabs**: Neural voice synthesis & mastertrack generation.
- **Database/Memory**: 
  - **Turbopuffer**: High-performance semantic vector search.
  - **Supabase**: Persistent vaulting and analytics.

---

## 🚀 Getting Started

### 1. Repository Setup
```bash
git clone https://github.com/aydenchain/musicsync-jukebox.git
cd musicsync-jukebox
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (use `.env.example` as a template):
```env
# AI API Keys
GROQ_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
GEMINI_API_KEY=your_key
TURBOPUFFER_API_KEY=your_key

# Infrastructure
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
FRONTEND_URL=http://localhost:3000
```

### 3. Local Development
Start both the Frontend and Backend concurrently:
```bash
npm run dev
```
- **Web UI**: `http://localhost:3000`
- **AURA Engine**: `http://localhost:3005`

---

## ☁️ Deployment

### Backend (Railway)
1. Set Root Directory to `apps/server`.
2. Configure all environment variables.
3. Railway handles the `PORT` automatically.

### Frontend (Vercel)
1. Set Root Directory to `apps/web`.
2. Add `NEXT_PUBLIC_SOCKET_URL` pointing to your Railway endpoint.

---

## 📄 License
MIT © Adyen Chain & MoodSync Authors
