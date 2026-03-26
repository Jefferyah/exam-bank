"use client";

import { useRef, useEffect, useCallback } from "react";

export function ConfettiExplosion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    canvas.width = rect.width;
    canvas.height = rect.height;

    const colors = [
      "#10b981", "#34d399", "#6ee7b7",
      "#3b82f6", "#60a5fa", "#93c5fd",
      "#f59e0b", "#fbbf24", "#fcd34d",
      "#ef4444", "#f87171",
      "#8b5cf6", "#a78bfa",
    ];

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      w: number; h: number;
      color: string;
      rotation: number; rotationSpeed: number;
      gravity: number; opacity: number; decay: number;
    }

    const particles: Particle[] = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 8;
      particles.push({
        x: centerX, y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        gravity: 0.12 + Math.random() * 0.08,
        opacity: 1,
        decay: 0.008 + Math.random() * 0.008,
      });
    }

    let frame = 0;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame++;
      if (alive && frame < 200) {
        requestAnimationFrame(draw);
      }
    }

    requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animate();
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/**
 * Full-screen confetti overlay with a congratulations message.
 * Auto-dismisses after `duration` ms.
 */
export function GoalCelebration({ onDone, message }: { onDone: () => void; message?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = [
      "#10b981", "#34d399", "#6ee7b7",
      "#3b82f6", "#60a5fa", "#93c5fd",
      "#f59e0b", "#fbbf24", "#fcd34d",
      "#ef4444", "#f87171",
      "#8b5cf6", "#a78bfa",
      "#ec4899", "#f472b6",
    ];

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      w: number; h: number;
      color: string;
      rotation: number; rotationSpeed: number;
      gravity: number; opacity: number; decay: number;
    }

    const particles: Particle[] = [];

    // Multiple burst points across the screen
    const burstPoints = [
      { x: canvas.width * 0.3, y: canvas.height * 0.4 },
      { x: canvas.width * 0.7, y: canvas.height * 0.4 },
      { x: canvas.width * 0.5, y: canvas.height * 0.3 },
    ];

    for (const burst of burstPoints) {
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60 + (Math.random() - 0.5) * 0.8;
        const speed = 4 + Math.random() * 10;
        particles.push({
          x: burst.x, y: burst.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          w: 5 + Math.random() * 8,
          h: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.4,
          gravity: 0.1 + Math.random() * 0.06,
          opacity: 1,
          decay: 0.004 + Math.random() * 0.004,
        });
      }
    }

    let frame = 0;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame++;
      if (alive && frame < 300) {
        requestAnimationFrame(draw);
      }
    }

    requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animate();
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [animate, onDone]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-3xl px-8 py-6 shadow-2xl border border-emerald-200 dark:border-emerald-700 animate-[bounceIn_0.5s_ease-out] text-center pointer-events-auto">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-lg font-bold text-gray-900">{message || "每日目標達成！"}</p>
          <p className="text-sm text-gray-500 mt-1">繼續保持學習習慣</p>
        </div>
      </div>
    </div>
  );
}
