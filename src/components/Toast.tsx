import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function Toast({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[60] flex w-80 flex-col gap-2.5 sm:top-8 sm:right-8">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [progress, setProgress] = useState(100);
  const duration = 3000;

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    const timer = setTimeout(() => onRemove(toast.id), duration);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [toast.id, onRemove]);

  const isSuccess = toast.type === "success";
  const color = isSuccess ? { bg: "16,185,129", text: "#34d399", border: "#10b981" } : { bg: "239,68,68", text: "#f87171", border: "#ef4444" };

  return (
    <div className="animate-toast-in overflow-hidden rounded-2xl border border-white/[0.08]"
      style={{
        background: "rgba(24, 24, 27, 0.6)",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `rgba(${color.bg},0.12)` }}
        >
          {isSuccess
            ? <CheckCircle size={15} style={{ color: color.text }} />
            : <XCircle size={15} style={{ color: color.text }} />
          }
        </div>
        <span className="flex-1 text-[13px] font-medium text-zinc-200">{toast.message}</span>
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="shrink-0 rounded-lg p-1 text-zinc-600 transition hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-[2px] w-full bg-white/[0.04]">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color.border}, ${color.text})`,
          }}
        />
      </div>
    </div>
  );
}
