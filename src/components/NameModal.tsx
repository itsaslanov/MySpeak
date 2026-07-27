import { useState, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), avatar);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-zinc-900 border border-white/[0.06] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-[slideUp_0.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          <div className="flex items-center gap-2">
            <User size={18} className="text-blue-400" />
            <span className="font-semibold text-[15px] text-zinc-100">
              Edit Profile
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors text-zinc-400"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 pb-5 space-y-4 overflow-y-auto">
          {/* Avatar Preview */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-white/[0.08] flex items-center justify-center text-4xl">
              {avatar}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
              Display Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full h-12 sm:h-11 px-4 bg-zinc-800/80 border border-white/[0.08] rounded-xl text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors"
              placeholder="Enter your name..."
              autoFocus
            />
          </div>

          {/* Avatar Grid */}
          <div>
            <label className="text-[13px] font-medium text-zinc-400 mb-2 block">
              Choose Avatar
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a, i) => (
                <button
                  key={`${a}-${i}`}
                  onClick={() => setAvatar(a)}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-150 min-w-[38px] min-h-[38px] ${
                    avatar === a
                      ? "bg-blue-500/20 border border-blue-500/50 scale-110"
                      : "bg-zinc-800/60 border border-white/[0.04] hover:bg-zinc-700/60 hover:border-white/[0.08]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
          <div className="flex gap-2.5">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 h-12 sm:h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-[14px] font-medium hover:bg-white/[0.07] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 h-12 sm:h-11 rounded-xl bg-blue-500 text-white text-[14px] font-semibold hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
