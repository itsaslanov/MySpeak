import { useState } from "react";
import { Mic, ArrowRight } from "lucide-react";

const AVATARS = [
  "😀","😎","🤔","🥶","🤯","😴","😈","🤖",
  "🦊","🐱","🐻","🐸","🐙","🦄","🐺","🦅",
  "🔥","⚡","💎","🎮","🎧","🎯","🚀","💡",
  "🎸","🎹","🥁","⚽","🏀","🎨","🧠","💪",
  "👻","💀","🎃","🌈","⭐","🌙","☀️","🌊"
];

export default function NameModal({ onSave }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("😀");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed) onSave(trimmed, avatar);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm animate-scale-in">
        <div className="glass-card p-6 sm:p-8">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 sm:mb-6 sm:h-11 sm:w-11">
            <Mic size={18} className="text-zinc-400 sm:text-zinc-400" />
          </div>
          <h1 className="text-base font-semibold text-zinc-100 sm:text-lg">Welcome to MySpeak</h1>
          <p className="mt-1 text-xs text-zinc-500 sm:mt-1.5 sm:text-sm">
            Pick a display name and avatar to get started.
          </p>

          <div className="mt-4 sm:mt-5">
            <p className="mb-2 text-[11px] font-medium text-zinc-500">Avatar</p>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition ${
                    avatar === emoji
                      ? "bg-accent/20 ring-1 ring-accent scale-110"
                      : "bg-surface-3 hover:bg-zinc-700"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
            maxLength={32}
            placeholder="Your name"
            className="glass-input mt-4 h-11 w-full px-3.5 text-sm sm:mt-5"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm sm:mt-4"
          >
            Continue
            <ArrowRight size={14} />
          </button>
          <p className="mt-3 text-center text-[11px] text-zinc-600 sm:mt-4">
            You can change this anytime.
          </p>
        </div>
      </form>
    </div>
  );
}
