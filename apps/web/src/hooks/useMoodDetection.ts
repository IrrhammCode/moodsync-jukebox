"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

interface MoodDetectionOptions {
  intervalMs?: number;
  onMoodDetected?: (mood: string, confidence: number) => void;
}

export function useMoodDetection({ intervalMs = 5000, onMoodDetected }: MoodDetectionOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMood, setCurrentMood] = useState<string | null>(null);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
        
        // We only need detection and expressions for mood mapping
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        
        setIsInitializing(false);
      } catch (err: any) {
        setError(`Failed to load face detection models: ${err.message}`);
        setIsInitializing(false);
      }
    };
    
    loadModels();
  }, []);

  // Request Webcam Access
  const startWebcam = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    } catch (err: any) {
      setError(`Webcam access denied: ${err.message}`);
    }
  }, []);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Mood Polling Loop
  useEffect(() => {
    if (isInitializing || !!error) return;

    const interval = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        // Detect single face and expressions using tiny detector (faster)
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detection) {
          // Find the expression with the highest probability
          const expressions = detection.expressions;
          const dominantExpression = Object.entries(expressions).reduce((a, b) => (a[1] > b[1] ? a : b));
          
          const mood = dominantExpression[0];
          const confidence = dominantExpression[1];
          
          setCurrentMood(mood);
          
          if (onMoodDetected) {
             onMoodDetected(mood, confidence);
          }
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isInitializing, error, intervalMs, onMoodDetected]);

  return {
    videoRef,
    isInitializing,
    error,
    currentMood,
    startWebcam,
    stopWebcam
  };
}
