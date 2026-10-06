import { Volume2, X, Play } from "lucide-react";
import { SOUND_LIST } from "../hooks/useVoiceAnnounce";

interface Props {
  current: string;
  onChange: (id: string) => void;
  onTest: (id: string) => void;
  onClose: () => void;
}

export default function VoiceSettings({ current, onChange, onTest, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-scale-in rounded-2xl border border-white/[0.06] bg-[#0c0c10]/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
              <Volume2 size={13} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-zinc-200">Notification Sounds</span>
          </div>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-600 hover:text-zinc-400 transition-colors">
            <X size={12} />
          </button>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-medium text-zinc-500 block">Pick a sound and tap play to preview</span>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {SOUND_LIST.map((id) => (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition cursor-pointer ${
                  current === id
                    ? "bg-accent/10 ring-1 ring-accent/20"
                    : "hover:bg-white/[0.02]"
                }`}
                onClick={() => onChange(id)}
              >
                <span className={`flex-1 text-xs font-medium capitalize ${current === id ? "text-accent" : "text-zinc-300"}`}>
                  {id}
                </span>
                <span className={`text-[10px] ${current === id ? "text-accent/60" : "text-zinc-600"}`}>
                  {current === id ? "Active" : ""}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTest(id); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-500 hover:text-accent hover:bg-accent/10 transition-colors"
                  title="Preview"
                >
                  <Play size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
