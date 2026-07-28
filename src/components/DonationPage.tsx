import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Copy, Check, Eye, EyeOff, Coffee, Server, Zap } from "lucide-react";
import { useState } from "react";
import Footer from "./Footer";

const FULL_CARD = "1000 6827 7255";
const MASKED_CARD = "XXXX XXXX 7255";

const recentDonors = [
  { name: "Anvar", amount: "30,000", time: "2 hours ago" },
  { name: "Javokhir", amount: "20,000", time: "5 hours ago" },
  { name: "BigDaddy", amount: "10,000", time: "1 day ago" },
  { name: "Khan", amount: "5,000", time: "1 day ago" },
  { name: "Elnur", amount: "50,000", time: "2 days ago" },
  { name: "Kim", amount: "5,000", time: "3 days ago" },
];

export default function DonationPage() {
  const [copied, setCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);

  function copyCard() {
    navigator.clipboard.writeText(FULL_CARD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10 lg:px-8 flex-1 flex flex-col">
        <Link to="/" className="btn-secondary mb-10 inline-flex h-10 w-fit items-center gap-2 px-4 text-sm">
          <ArrowLeft size={15} />
          Back
        </Link>

        <div className="mb-16 sm:mb-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-1.5 text-sm font-medium text-rose-400 ring-1 ring-rose-500/20">
            <Heart size={14} className="fill-rose-400" />
            Support the project
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
            Buy me a coffee<span className="text-rose-400">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
            If MySpeak saves you from Discord bloat, consider supporting the project.
            Every contribution keeps it running and growing.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6 mb-16 sm:mb-20">
          <div className="glass-card group p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] transition group-hover:bg-amber-500/10">
              <Server size={20} className="text-zinc-400 transition group-hover:text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Keep servers running</h3>
            <p className="mt-2 text-sm text-zinc-500">Voice servers cost money. Your support keeps the lights on.</p>
          </div>
          <div className="glass-card group p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] transition group-hover:bg-violet-500/10">
              <Zap size={20} className="text-zinc-400 transition group-hover:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Ship faster</h3>
            <p className="mt-2 text-sm text-zinc-500">More resources means faster iterations and new features.</p>
          </div>
          <div className="glass-card group p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] transition group-hover:bg-emerald-500/10">
              <Coffee size={20} className="text-zinc-400 transition group-hover:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Buy a coffee</h3>
            <p className="mt-2 text-sm text-zinc-500">Even a small tip keeps the energy going.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:items-stretch mb-16 sm:mb-20">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/[0.06] px-8 py-5 sm:px-10">
              <h2 className="text-lg font-semibold text-zinc-100">Send directly</h2>
              <p className="mt-1 text-sm text-zinc-500">TOSS Bank — instant transfer</p>
            </div>

            <div className="px-8 py-6 sm:px-10">
              <p className="text-xs uppercase tracking-wider text-zinc-600">Card Number</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-mono text-xl font-semibold tracking-wider text-zinc-200 sm:text-2xl">
                  {showCard ? FULL_CARD : MASKED_CARD}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCard(!showCard)}
                    className="btn-secondary flex h-9 w-9 items-center justify-center !rounded-lg p-0"
                    title={showCard ? "Hide" : "Show"}
                  >
                    {showCard ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={copyCard}
                    className="btn-secondary flex h-9 w-9 items-center justify-center !rounded-lg p-0"
                    title="Copy"
                  >
                    {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-5 border-t border-white/[0.06] pt-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Cardholder</p>
                  <p className="mt-1.5 text-sm font-medium text-zinc-300">ASLANOV AZIZBEK</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-600">Bank</p>
                  <p className="mt-1.5 text-sm font-medium text-zinc-300">TOSS</p>
                </div>
              </div>
            </div>

            {copied && (
              <div className="border-t border-white/[0.06] bg-emerald-500/5 px-8 py-3 sm:px-10">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Check size={15} />
                  Card number copied to clipboard
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="glass-card flex flex-col justify-between p-6 sm:p-8">
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
                <Heart size={16} className="text-rose-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-zinc-200">Every bit counts</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                No amount is too small. Your support helps cover server costs,
                domain renewals, and keeps the project alive for everyone.
              </p>
            </div>
            <div className="mt-6 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
              <p className="text-xs text-zinc-500">Most common</p>
              <p className="mt-1 text-lg font-semibold text-zinc-200">₩5,000 <span className="text-sm font-normal text-zinc-500">coffee</span></p>
            </div>
          </div>
          </div>
        </div>

        <div className="mb-16 sm:mb-20">
          <h2 className="mb-6 text-lg font-semibold text-zinc-100">Recent supporters</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentDonors.map((d) => (
              <div key={d.name} className="glass-card flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-zinc-300">
                  {d.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-200">{d.name}</p>
                    <p className="shrink-0 text-sm font-semibold text-emerald-400">₩{d.amount}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600">{d.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
