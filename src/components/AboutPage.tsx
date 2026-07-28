import { Link } from "react-router-dom";
import { ArrowLeft, Headphones, Zap, Shield, MessageSquare, Mic, Gamepad2, Clock } from "lucide-react";
import Footer from "./Footer";
import MySpeakLogo from "./MySpeakLogo";

const features = [
  {
    icon: Zap,
    title: "Zero-latency voice",
    description: "Built on Agora's global network. No lag, no delay — comms that keep up when every second counts.",
    color: "text-amber-400",
    bg: "bg-amber-500/10"
  },
  {
    icon: Gamepad2,
    title: "Runs light, stays out of your way",
    description: "Minimal CPU and RAM usage — MySpeak won't eat into your FPS while you're mid-match. Built to run in the background without you noticing it's there.",
    color: "text-violet-400",
    bg: "bg-violet-500/10"
  },
  {
    icon: Mic,
    title: "Push-to-talk, on your terms",
    description: "Mute, unmute, adjust volume — instantly, without breaking your flow mid-match.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10"
  },
  {
    icon: MessageSquare,
    title: "Text without leaving voice",
    description: "Drop a link, a callout, or a strat mid-conversation. No app-switching, no lost context.",
    color: "text-blue-400",
    bg: "bg-blue-500/10"
  },
  {
    icon: Shield,
    title: "Passcode-locked rooms",
    description: "Lock it down. Your team gets in. Nobody else does.",
    color: "text-rose-400",
    bg: "bg-rose-500/10"
  },
  {
    icon: Clock,
    title: "Live in seconds",
    description: "No server to configure, no bots to set up. Click, and you're in the room.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10"
  }
];

const comparisons = [
  { feature: "Voice latency", mySpeak: "Ultra-low (Agora)", telegram: "High (relay)", discord: "Medium (fixed servers)" },
  { feature: "CPU / RAM usage", mySpeak: "Minimal", telegram: "High", discord: "High" },
  { feature: "FPS impact", mySpeak: "Negligible", telegram: "Noticeable", discord: "Noticeable" },
  { feature: "Setup time", mySpeak: "Instant", telegram: "Group + invite", discord: "Server + channels" },
  { feature: "Footprint", mySpeak: "Browser tab", telegram: "Heavy app", discord: "200MB+ app" },
  { feature: "Passcode rooms", mySpeak: "Built-in", telegram: "—", discord: "—" },
  { feature: "Text + voice", mySpeak: "Unified", telegram: "Separate", discord: "Separate channels" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10 lg:px-8 flex-1 flex flex-col">
        <Link to="/" className="btn-secondary mb-10 inline-flex h-10 w-fit items-center gap-2 px-4 text-sm">
          <ArrowLeft size={15} />
          Back
        </Link>

        <div className="mb-14 sm:mb-16">
          <div className="flex items-center gap-4 mb-6">
            <MySpeakLogo className="h-14 w-14 rounded-2xl" />
            <div>
              <h1 className="text-3xl font-bold text-zinc-100 sm:text-4xl">MySpeak</h1>
              <p className="text-base text-zinc-500">Instant voice for gamers. No servers. No setup. No bloat.</p>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Skip the overhead of Discord servers and Telegram groups. Open a tab, join a room,
            and you're talking — in seconds.
          </p>
        </div>

        <section className="mb-14 sm:mb-16">
          <h2 className="mb-7 text-xl font-semibold text-zinc-100 sm:text-2xl">Why MySpeak?</h2>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {features.map((f) => (
              <div key={f.title} className="glass-card p-5 sm:p-6">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${f.bg}`}>
                  <f.icon size={22} className={f.color} />
                </div>
                <h3 className="text-base font-semibold text-zinc-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:text-base">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 sm:mb-16">
          <h2 className="mb-7 text-xl font-semibold text-zinc-100 sm:text-2xl">MySpeak vs the Rest</h2>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-4 font-medium text-zinc-500">Feature</th>
                    <th className="px-5 py-4 font-semibold text-accent">MySpeak</th>
                    <th className="px-5 py-4 font-medium text-zinc-500">Telegram</th>
                    <th className="px-5 py-4 font-medium text-zinc-500">Discord</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr key={row.feature} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3.5 text-zinc-400">{row.feature}</td>
                      <td className="px-5 py-3.5 font-medium text-emerald-400">{row.mySpeak}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{row.telegram}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{row.discord}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-14 text-center sm:mb-16">
          <div className="glass-card mx-auto max-w-md p-8 sm:p-10">
            <Headphones className="mx-auto mb-5 text-accent" size={32} />
            <h2 className="text-xl font-semibold text-zinc-100">Ready to talk?</h2>
            <p className="mt-3 text-base text-zinc-500">
              No downloads. No signups. No friction.
            </p>
            <Link
              to="/"
              className="btn-primary mt-6 inline-flex h-12 items-center justify-center gap-2.5 px-7 text-base"
            >
              <Mic size={17} />
              Start talking
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
