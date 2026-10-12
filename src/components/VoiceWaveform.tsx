import { useEffect, useRef } from "react";

interface VoiceWaveformProps {
  /** Voice activity — ramps the waves up/down smoothly, never snaps. */
  active?: boolean;
  /** Rendered width in CSS px. Ignored when `fill` is true. */
  width?: number;
  /** Rendered height in CSS px. Ignored when `fill` is true. */
  height?: number;
  /** Stretch to the parent box and track its size. Good for backgrounds. */
  fill?: boolean;
  /** Stroke color. */
  color?: string;
  /** Extra opacity factor applied to all strokes (0..1). */
  opacity?: number;
  /** Scale the amplitude to make it tighter around the centre. */
  squeeze?: number;
  /** Class name passed to the canvas element. */
  className?: string;
}

/**
 * Overlapping smooth sine waves that oscillate horizontally at slightly
 * different frequencies, amplitudes, phases and opacities. A gaussian
 * envelope peaks at the centre so the waves converge and diverge around
 * the middle — a minimal voice-activity indicator.
 */
const WAVES = [
  { cycles: 1.5, speed: 1.6, phase: 0.0, amp: 1.0, opacity: 0.95, lineWidth: 1.6 },
  { cycles: 2.4, speed: -1.15, phase: 1.9, amp: 0.72, opacity: 0.6, lineWidth: 1.3 },
  { cycles: 1.05, speed: 0.85, phase: 3.4, amp: 0.88, opacity: 0.42, lineWidth: 1.1 },
  { cycles: 3.2, speed: 1.9, phase: 5.0, amp: 0.4, opacity: 0.28, lineWidth: 1.0 },
];

const IDLE = 0.12;

export default function VoiceWaveform({
  active = false,
  width = 72,
  height = 18,
  fill = false,
  color = "#34d399",
  opacity = 1,
  squeeze = 2.4,
  className = "",
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mid = () => height / 2;
    const maxAmp = () => height / 2 - 1.5;

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let intensity = activeRef.current ? 1 : IDLE;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(fill ? rect.width : width));
      h = Math.max(1, Math.round(fill ? rect.height : height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let observer: ResizeObserver | null = null;
    if (fill && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    }

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      // Exponential ease toward the target so on/off never snaps.
      const target = activeRef.current ? 1 : IDLE;
      intensity += (target - intensity) * (1 - Math.exp(-dt * 4));

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const midY = mid();
      const amp = maxAmp();

      for (const wave of WAVES) {
        ctx.beginPath();
        ctx.lineWidth = wave.lineWidth;
        ctx.globalAlpha = wave.opacity * (0.35 + 0.65 * intensity) * opacity;
        ctx.strokeStyle = color;

        for (let px = 0; px <= w; px += 1) {
          const u = px / w;
          const d = (u - 0.5) * 2; // -1 .. 1 across the width
          // Gaussian envelope: strong at centre, flat at the edges.
          const envelope = Math.exp(-d * d * squeeze);
          const swing = Math.sin(u * wave.cycles * Math.PI * 2 + wave.phase + t * wave.speed);
          const y = midY + swing * wave.amp * envelope * amp * intensity;
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    if (reduced) {
      // Static single frame for reduced-motion users.
      draw(performance.now());
      cancelAnimationFrame(raf);
      return () => {
        cancelAnimationFrame(raf);
        observer?.disconnect();
      };
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [width, height, fill, color, opacity, squeeze]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={fill ? undefined : { width, height }}
    />
  );
}
