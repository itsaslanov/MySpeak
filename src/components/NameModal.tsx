import { useState } from "react";
import {
  User,
  X,
  Check,
} from "lucide-react";

interface Props {
  onSave: (name: string, avatar: string) => void;
  onCancel?: () => void;
  initialName: string;
  initialAvatar: string;
}

const AVATARS = [
  "🔥","⚡","🌊","🚀","💎","🎯","🎮","🎧",
  "🎸","🎹","⚽","🏀","🎨","🧠","💪","👻",
  "💀","🎃","🌈","⭐","🌙","☀️","❄️","🌊",
  "🐱","🐶","🦊","🐻","🦁","🐸","🦄","🐧",
  "🦅","🐺","🐙","🦋","🐢","🐝","👑","🫡",
];

export default function NameModal({
  onSave,
  onCancel,
  initialName,
  initialAvatar,
}: Props) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), avatar);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-zinc-900/80 backdrop-blur-xl border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-[slideUp_0.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              <User size={18} className="text-blue-400" />
            </div>
            <span className="font-semibold text-lg text-zinc-100">
              Edit Profile
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-colors text-zinc-400"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 pb-6 space-y-5 overflow-y-auto">
          {/* Avatar Preview */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-white/[0.06] backdrop-blur-sm border-2 border-white/[0.1] flex items-center justify-center text-5xl">
              {avatar}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="text-sm font-medium text-zinc-400 mb-2 block">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="glass-input w-full h-13 sm:h-12 px-5 text-base text-zinc-100 placeholder-zinc-500"
              placeholder="Enter your name..."
              autoFocus
            />
          </div>

          {/* Avatar Grid */}
          <div>
            <label className="text-sm font-medium text-zinc-400 mb-3 block">
              Choose Avatar
            </label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((a, i) => (
                <button
                  key={`${a}-${i}`}
                  onClick={() => setAvatar(a)}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-150 min-h-[42px] ${
                    avatar === a
                      ? "bg-accent/20 border border-accent/50 scale-110 shadow-lg shadow-accent/15"
                      : "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
          <div className="flex gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="btn-secondary flex-1 h-13 sm:h-12 text-base font-medium"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-primary flex-1 h-13 sm:h-12 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check size={17} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
