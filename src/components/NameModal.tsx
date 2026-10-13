import { useEffect, useRef, useState } from "react";
import { User, X, Check } from "lucide-react";

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

const MAX_NAME = 24;

export default function NameModal({
  onSave,
  onCancel,
  initialName,
  initialAvatar,
}: Props) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock the page behind the sheet. Without this, iOS scrolls the background
  // when the emoji grid is swiped or the on-screen keyboard opens.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), avatar);
  };

  const atLimit = name.length >= MAX_NAME;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative flex w-full flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-zinc-900/90 backdrop-blur-xl shadow-[0_-8px_60px_-12px_rgba(0,0,0,0.9)] animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)] sm:max-w-sm sm:rounded-[26px] sm:shadow-2xl
                   /* dvh tracks the collapsing mobile URL bar; max height leaves
                      the safe-area top clear so the sheet never sits under the
                      notch when the keyboard is closed. */
                   max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[min(90dvh,44rem)]"
      >
        {/* Grab handle — signals drag-to-dismiss on touch. */}
        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-4 pt-3 pb-3 sm:gap-2.5 sm:px-6 sm:pt-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 sm:h-8 sm:w-8">
            <User size={17} className="text-blue-400" />
          </div>
          <span
            id="edit-profile-title"
            className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-zinc-100 sm:text-base"
          >
            Edit Profile
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition active:bg-white/[0.08] active:scale-90 sm:h-9 sm:w-9 sm:-mr-1"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-2 sm:space-y-5 sm:px-6">
          {/* Avatar Preview */}
          <div className="flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-5xl backdrop-blur-sm sm:h-20 sm:w-20">
              {avatar}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label
                htmlFor="display-name"
                className="text-[13px] font-medium text-zinc-400 sm:text-sm"
              >
                Display Name
              </label>
              {/* Also stops the name running under the card edge on narrow screens. */}
              <span
                className={`text-[11px] tabular-nums ${
                  atLimit ? "text-amber-400/80" : "text-zinc-600"
                }`}
              >
                {name.length}/{MAX_NAME}
              </span>
            </div>
            <input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              /* 16px minimum: anything smaller makes iOS Safari zoom on focus. */
              className="glass-input h-12 w-full px-4 text-base text-zinc-100 placeholder-zinc-500 sm:h-11 sm:text-[15px]"
              placeholder="Enter your name..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={MAX_NAME}
            />
          </div>

          {/* Avatar Grid */}
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-zinc-400 sm:text-sm">
                Choose Avatar
              </span>
              <span className="text-[11px] text-zinc-600">40 options</span>
            </div>
            {/* auto-fill with a 46px floor guarantees a >=44pt touch target at
                any width. A fixed column count cannot: 8 columns of 8px gaps in
                a 335px container lands at ~35px cells. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2">
              {AVATARS.map((a, i) => (
                <button
                  key={`${a}-${i}`}
                  type="button"
                  onClick={() => setAvatar(a)}
                  aria-label={`Avatar ${i + 1}`}
                  aria-pressed={avatar === a}
                  className={`flex aspect-square w-full items-center justify-center rounded-2xl text-2xl transition-all duration-150 active:scale-90 sm:text-xl ${
                    avatar === a
                      ? "border border-accent/50 bg-accent/20 shadow-lg shadow-accent/15"
                      : "border border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — sticky, with the home-indicator inset kept clear. */}
        <div className="shrink-0 border-t border-white/[0.06] bg-zinc-900/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:border-0 sm:bg-transparent sm:px-6 sm:pb-5 sm:pt-1 sm:backdrop-blur-none">
          <div className="flex gap-2.5 sm:gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary h-12 flex-1 text-base font-medium active:scale-[0.98] sm:h-11 sm:text-[15px]"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-primary flex h-12 flex-1 items-center justify-center gap-2 text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 sm:h-11 sm:text-[15px]"
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