import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Copy, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Footer from "./Footer";

const FULL_CARD = "1000 6827 7255";
const MASKED_CARD = "XXXX XXXX 7255";

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
        <Link to="/" className="btn-secondary mb-8 inline-flex h-9 w-fit items-center gap-1.5 px-3 text-xs">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="mx-auto max-w-md text-center">
          <div className="glass-card p-6 sm:p-8">
            <div className="mb-5 flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-rose-500/10">
              <Heart size={24} className="text-rose-400" />
            </div>

            <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Support MySpeak</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              If you enjoy using MySpeak, consider buying me a coffee. Every contribution helps keep the servers running.
            </p>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-surface-1 p-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-600">Bank Card</p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-zinc-200">
                    {showCard ? FULL_CARD : MASKED_CARD}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCard(!showCard)}
                    className="btn-secondary flex h-9 w-9 items-center justify-center !rounded-lg p-0"
                    title={showCard ? "Hide card number" : "Show card number"}
                  >
                    {showCard ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={copyCard}
                    className="btn-secondary flex h-9 w-9 items-center justify-center !rounded-lg p-0"
                    title="Copy card number"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="mt-3 border-t border-zinc-800 pt-3 text-left">
                <p className="text-[11px] uppercase tracking-wider text-zinc-600">Bank</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-300">TOSS</p>
              </div>
              <div className="mt-3 border-t border-zinc-800 pt-3 text-left">
                <p className="text-[11px] uppercase tracking-wider text-zinc-600">Cardholder</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-300">ASLANOV AZIZBEK</p>
              </div>
            </div>

            <p className="mt-5 text-[11px] text-zinc-600">
              Thank you for your support! Your generosity means a lot.
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
