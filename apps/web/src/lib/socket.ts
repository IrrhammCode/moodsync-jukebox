"use client";

import { io } from "socket.io-client";

// In production, ensure this points to the deployed Express backend
const URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005";

export const socket = io(URL, {
  autoConnect: false, // Wait until we explicitly connect when joining/creating a room
});

socket.on("connect_error", (err) => {
  console.error("Socket Connection Error:", err.message);
});
