import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "myspeak:chime-id";
const SR = 44100;

function wavUrl(samples: Float32Array): string {
  const len = samples.length * 2 + 44;
  const buf = new ArrayBuffer(len);
  const dv = new DataView(buf);
  const w = (off: number, v: number, size: number) => { if (size === 2) dv.setInt16(off, v, true); else dv.setUint32(off, v, true); };
  w(0, 0x46464952, 4); w(4, len - 8, 4); w(8, 0x45564157, 4);
  w(12, 0x20746d66, 4); w(16, 16, 4); w(20, 1, 2); w(22, 1, 2);
  w(24, SR, 4); w(28, SR * 2, 4); w(32, 2, 2); w(34, 16, 2);
  w(36, 0x61746164, 4); w(40, samples.length * 2, 4);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

function genSamples(fn: (t: number, i: number) => number, durSec: number): Float32Array {
  const len = Math.floor(SR * durSec);
  const s = new Float32Array(len);
  for (let i = 0; i < len; i++) s[i] = fn(i / SR, i);
  return s;
}

function genChime(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 8) * 0.4;
    let v = 0;
    v += Math.sin(2 * Math.PI * 523.25 * t) * 0.3;
    v += Math.sin(2 * Math.PI * 659.25 * t) * 0.25;
    v += Math.sin(2 * Math.PI * 783.99 * t) * 0.15;
    v += Math.sin(2 * Math.PI * 1046.5 * t) * 0.08;
    v += Math.sin(2 * Math.PI * 1308 * t) * 0.04;
    const click = Math.exp(-t * 200) * 0.15;
    return (v * env + click) * 0.7;
  }, 0.8);
}

function genClassic(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 6);
    let v = 0;
    v += Math.sin(2 * Math.PI * 880 * t) * 0.35;
    v += Math.sin(2 * Math.PI * 1320 * t) * 0.12;
    v += Math.sin(2 * Math.PI * 1760 * t) * 0.06;
    return (v * env) * 0.6;
  }, 0.6);
}

function genPop(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 30);
    const f = 600 + 600 * Math.exp(-t * 20);
    return Math.sin(2 * Math.PI * f * t) * 0.5 * env;
  }, 0.15);
}

function genBell(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 3);
    let v = 0;
    v += Math.sin(2 * Math.PI * 1318.5 * t) * 0.25;
    v += Math.sin(2 * Math.PI * 1975.5 * t) * 0.1;
    v += Math.sin(2 * Math.PI * 2637 * t) * 0.05;
    v += Math.sin(2 * Math.PI * 3951 * t) * 0.03;
    return (v * env) * 0.5;
  }, 1.2);
}

function genSignal(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 4);
    const beat = Math.sin(2 * Math.PI * 8 * t) > 0 ? 1 : 0;
    let v = 0;
    v += Math.sin(2 * Math.PI * 440 * t) * 0.2;
    v += Math.sin(2 * Math.PI * 660 * t) * 0.1;
    v += Math.sin(2 * Math.PI * 880 * t) * 0.07;
    return (v * env * (0.5 + 0.5 * beat)) * 0.6;
  }, 1);
}

function genDrop(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 10);
    const f = 800 - 600 * Math.exp(-t * 8);
    return Math.sin(2 * Math.PI * f * t) * 0.4 * env;
  }, 0.4);
}

function genChord(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 5);
    let v = 0;
    [261.63, 329.63, 392, 523.25].forEach((f) => {
      v += Math.sin(2 * Math.PI * f * t) * 0.12;
    });
    return v * env * 0.6;
  }, 0.8);
}

function genNotification(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 12);
    let v = 0;
    v += Math.sin(2 * Math.PI * 800 * t) * 0.25;
    if (t > 0.12 && t < 0.4) {
      v += Math.sin(2 * Math.PI * 1000 * t) * 0.2;
    }
    const click = Math.exp(-t * 300) * 0.1;
    return (v + click) * env * 0.6;
  }, 0.5);
}

function genTone(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 5);
    let v = 0;
    v += Math.sin(2 * Math.PI * 660 * t) * 0.3;
    v += Math.sin(2 * Math.PI * 990 * t) * 0.1;
    v += Math.sin(2 * Math.PI * 1320 * t) * 0.05;
    return v * env * 0.5;
  }, 0.7);
}

function genMellow(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 7);
    let v = 0;
    v += Math.sin(2 * Math.PI * 440 * t) * 0.2;
    v += Math.sin(2 * Math.PI * 550 * t) * 0.15;
    v += Math.sin(2 * Math.PI * 660 * t) * 0.1;
    return v * env * 0.5;
  }, 0.6);
}

function genTap(): Float32Array {
  return genSamples((t) => {
    const env = Math.exp(-t * 80);
    const f = 1200 - 400 * Math.exp(-t * 30);
    return Math.sin(2 * Math.PI * f * t) * 0.3 * env;
  }, 0.08);
}

const SOUNDS: Record<string, string> = {};

function defineSound(id: string, fn: () => Float32Array) {
  SOUNDS[id] = wavUrl(fn());
}

defineSound("chime", genChime);
defineSound("classic", genClassic);
defineSound("pop", genPop);
defineSound("bell", genBell);
defineSound("signal", genSignal);
defineSound("drop", genDrop);
defineSound("chord", genChord);
defineSound("notif", genNotification);
defineSound("tone", genTone);
defineSound("mellow", genMellow);
defineSound("tap", genTap);

export const SOUND_LIST = Object.keys(SOUNDS);

function loadChime(): string {
  try { return localStorage.getItem(STORAGE_KEY) || "mellow"; } catch { return "mellow"; }
}
function saveChime(v: string) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch {}
}

export function useVoiceAnnounce() {
  const [chimeId, setChimeIdState] = useState(loadChime);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);

  const setChimeId = useCallback((id: string) => {
    setChimeIdState(id);
    saveChime(id);
  }, []);

  const playNext = useCallback(() => {
    if (playingRef.current) return;
    const q = queueRef.current;
    if (!q.length) return;
    const url = q.shift()!;
    playingRef.current = true;
    const a = new Audio(url);
    a.onended = () => { playingRef.current = false; playNext(); };
    a.volume = 0.5;
    a.play().catch(() => { playingRef.current = false; playNext(); });
  }, []);

  const announce = useCallback(() => {
    const url = SOUNDS[chimeId];
    if (!url) return;
    queueRef.current.push(url);
    playNext();
  }, [chimeId, playNext]);

  const testChime = useCallback((id: string) => {
    const url = SOUNDS[id];
    if (!url) return;
    const a = new Audio(url);
    a.volume = 0.5;
    a.play().catch(() => {});
  }, []);

  return { chimeId, setChimeId, announce, testChime, soundList: SOUND_LIST };
}
