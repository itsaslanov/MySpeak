import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

/**
 * Transient system-style banner for in-room warnings.
 *
 * Modelled on an iOS system message rather than a web alert: a translucent
 * material pill that slides down from the surface it belongs to, with the
 * hierarchy message > icon > material. The amber accent lives on the icon and
 * nowhere else, so the colour reads as meaning rather than decoration.
 *
 * Non-blocking by construction - the whole subtree is pointer-events-none, so
 * the banner can never swallow a tap meant for the controls behind it.
 *
 * Positioning is left to the caller via `className` because this renders in two
 * different surfaces (the viewport, and inside the chat panel).
 */
export default function SystemToast({
  message,
  className = "",
}: {
  /** Empty string dismisses it; the exit animation plays first. */
  message: string;
  className?: string;
}) {
  const [shown, setShown] = useState(message);
  const [exiting, setExiting] = useState(false);
  // Mirrors `shown` for the effect to read without becoming a dependency -
  // otherwise clearing would re-trigger the effect and loop.
  const shownRef = useRef(message);

  useEffect(() => {
    if (message) {
      shownRef.current = message;
      setShown(message);
      setExiting(false);
      return;
    }
    if (!shownRef.current) return;

    // Hold the last message mounted long enough to fade and lift away.
    setExiting(true);
    const t = window.setTimeout(() => {
      setShown("");
      shownRef.current = "";
    }, 220);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!shown) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none w-full ${className}`}
    >
      <div
        className={`mx-auto flex w-full max-w-md items-center gap-2.5 rounded-[18px] border border-white/[0.09] bg-[#1c1c1e]/70 px-3.5 py-2.5 backdrop-blur-2xl backdrop-saturate-150 ${
          exiting ? "toast-exit" : "toast-enter"
        }`}
        /* Depth comes from a one-pixel top highlight (the lit edge of the
           material) plus a soft contact shadow - no outer glow. */
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 28px -10px rgba(0,0,0,0.7)",
        }}
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.07]">
          <Lock size={12} strokeWidth={1.9} className="text-amber-400/90" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium leading-none tracking-[-0.01em] text-white">
          {shown}
        </p>
      </div>
    </div>
  );
}