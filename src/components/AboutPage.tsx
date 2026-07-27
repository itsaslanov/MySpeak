import { Link } from "react-router-dom";
import { ArrowLeft, Headphones, Zap, Shield, Globe, MessageSquare, Users, Mic, Gamepad2, Radio } from "lucide-react";
import Footer from "./Footer";

const features = [
  {
    icon: Zap,
    title: "Zero Latency Voice",
    description: "Crystal clear voice powered by Agora's global network. No lag, no delay — just instant communication when every second counts.",
    color: "text-amber-400",
    bg: "bg-amber-500/10"
  },
  {
    icon: Gamepad2,
    title: "Built for Gamers",
    description: "Low overhead, lightweight, and always running in the background. Talk to your squad without alt-tabbing or dealing with heavy apps.",
    color: "text-violet-400",
    bg: "bg-violet-500/10"
  },
  {
    icon: Mic,
    title: "Push-to-Talk Ready",
    description: "Quick mic toggle with volume control. Mute, unmute, and adjust on the fly without interrupting your gameplay.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10"
  },
  {
    icon: MessageSquare,
    title: "In-Game Text Chat",
    description: "Send messages without leaving the voice room. Type while talking — perfect for sharing links, callouts, or quick strats.",
    color: "text-blue-400",
    bg: "bg-blue-500/10"
  },
  {
    icon: Shield,
    title: "Private Rooms with Passcodes",
    description: "Lock your room with a passcode. Only your team gets in — no randoms, no leaks, no drama.",
    color: "text-rose-400",
    bg: "bg-rose-500/10"
  },
  {
    icon: Users,
    title: "Instant Room Creation",
    description: "Create a room in seconds. No server setup, no bots, no configurations. Just click and go.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10"
  }
];

const comparisons = [
  { feature: "Voice latency", mySpeak: "Ultra-low (Agora)", telegram: "High (server relay)", discord: "Medium (fixed servers)" },
  { feature: "Setup time", mySpeak: "Instant", telegram: "Create group + invite", discord: "Create server + channels" },
  { feature: "Lightweight", mySpeak: "Browser tab", telegram: "Heavy app", discord: "200MB+ app" },
  { feature: "Passcode rooms", mySpeak: "Built-in", telegram: "No", discord: "No" },
  { feature: "Text + Voice", mySpeak: "Together", telegram: "Separate", discord: "Separate channels" },
  { feature: "Background usage", mySpeak: "Minimal", telegram: "High", discord: "High" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10 lg:px-8 flex-1 flex flex-col">
        <Link to="/" className="btn-secondary mb-8 inline-flex h-9 w-fit items-center gap-1.5 px-3 text-xs">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <Radio size={22} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">MySpeak</h1>
              <p className="text-sm text-zinc-500">Voice rooms for gamers. No bloat. Just talk.</p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Built for gamers who want instant, lag-free voice communication without the overhead of
            Discord servers or Telegram groups. Open a tab, join a room, start talking.
          </p>
        </div>

        <section className="mb-12 sm:mb-16">
          <h2 className="mb-6 text-lg font-semibold text-zinc-100 sm:text-xl">Why MySpeak?</h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {features.map((f) => (
              <div key={f.title} className="glass-card p-4 sm:p-5">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${f.bg}`}>
                  <f.icon size={18} className={f.color} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="mb-6 text-lg font-semibold text-zinc-100 sm:text-xl">MySpeak vs the Rest</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 pr-4 font-medium text-zinc-500">Feature</th>
                  <th className="pb-3 pr-4 font-semibold text-accent">MySpeak</th>
                  <th className="pb-3 pr-4 font-medium text-zinc-500">Telegram</th>
                  <th className="pb-3 font-medium text-zinc-500">Discord</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.feature} className="border-b border-zinc-800/50">
                    <td className="py-3 pr-4 text-zinc-400">{row.feature}</td>
                    <td className="py-3 pr-4 font-medium text-emerald-400">{row.mySpeak}</td>
                    <td className="py-3 pr-4 text-zinc-500">{row.telegram}</td>
                    <td className="py-3 text-zinc-500">{row.discord}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12 text-center sm:mb-16">
          <div className="glass-card mx-auto max-w-md p-6 sm:p-8">
            <Headphones className="mx-auto mb-4 text-accent" size={28} />
            <h2 className="text-lg font-semibold text-zinc-100">Ready to talk?</h2>
            <p className="mt-2 text-sm text-zinc-500">
              No downloads. No signups. Just open and talk.
            </p>
            <Link
              to="/"
              className="btn-primary mt-5 inline-flex h-11 items-center justify-center gap-2 px-6 text-sm"
            >
              <Mic size={15} />
              Start Talking
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
