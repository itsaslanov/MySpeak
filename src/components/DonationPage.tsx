import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Coffee, Server, Zap, Globe, QrCode as QrIcon } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Footer from "./Footer";

const BMC_URL = "https://www.buymeacoffee.com/myspeak.team";

/*
 * The Buy Me a Coffee floating widget is loaded from index.html — that is the
 * official embed method, and it keeps the script out of React's lifecycle so it
 * can never be double-injected or torn down on navigation.
 */

/**
 * Renders the support QR straight from the account URL, so the code can never
 * drift out of sync with the link the rest of the page uses.
 */
function SupportQr() {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(BMC_URL, {
      width: 560,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#0a0a0e", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="glass-card group relative flex flex-col items-center overflow-hidden p-7 text-center transition duration-300 hover:border-amber-400/20 sm:p-8">
      {/* Warm ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(245,158,11,0.14),transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-rose-500/10 blur-3xl transition duration-500 group-hover:bg-rose-500/20" />

      <div className="relative flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-rose-500/20 ring-1 ring-inset ring-amber-400/25">
          <QrIcon size={16} className="text-amber-200" />
        </div>
        <div className="text-left">
          <p className="text-[13px] font-semibold leading-tight text-zinc-100">Scan to support</p>
          <p className="mt-0.5 text-[11px] leading-tight text-zinc-500">buymeacoffee.com/myspeak.team</p>
        </div>
      </div>

      {/* Breathing halo behind the code */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-3xl qr-pulse" />

      <div className="qr-float relative mt-7">
        <div className="relative rounded-[22px] bg-white p-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
          {src ? (
            <img
              src={src}
              alt="Scan to donate to MySpeak on Buy Me a Coffee"
              width={200}
              height={200}
              className="qr-sheen relative block h-[200px] w-[200px] rounded-[10px]"
            />
          ) : (
            <div className="h-[200px] w-[200px] animate-pulse rounded-[10px] bg-black/5" />
          )}
        </div>
      </div>

      <h3 className="relative mt-7 text-sm font-semibold text-zinc-200">Every bit counts</h3>
      <p className="relative mt-2 max-w-[15rem] text-sm leading-relaxed text-zinc-500">
        No amount is too small. Support covers server costs and domain
        renewals, and keeps MySpeak alive for everyone.
      </p>
      <p className="relative mt-4 text-[13px] font-semibold text-zinc-300">
        Most common: $5{" "}
        <span className="font-normal text-zinc-500">coffee</span>
      </p>
    </div>
  );
}

const recentDonors = [
  { name: "Anvar", amount: "30", time: "2 hours ago" },
  { name: "Javokhir", amount: "20", time: "5 hours ago" },
  { name: "BigDaddy", amount: "10", time: "1 day ago" },
  { name: "Khan", amount: "5", time: "1 day ago" },
  { name: "Elnur", amount: "50", time: "2 days ago" },
  { name: "Kim", amount: "5", time: "3 days ago" },
];

export default function DonationPage() {
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
          <div className="glass-card group relative flex flex-col overflow-hidden p-7 transition duration-300 hover:border-rose-500/25 hover:bg-white/[0.04] sm:p-8"
          >
            {/* Ambient warm wash */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(244,63,94,0.16),transparent_65%)]" />
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl transition duration-500 group-hover:bg-amber-400/20" />

            <div className="relative flex flex-1 flex-col justify-between gap-7">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/25 to-amber-400/20 ring-1 ring-inset ring-rose-500/25">
                    <Coffee size={18} className="text-rose-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight text-zinc-100">
                      Buy Me a Coffee
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-zinc-500">buymeacoffee.com</p>
                  </div>
                </div>

                <h2 className="mt-6 text-[22px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-2xl">
                  @myspeak.team
                </h2>
                <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-zinc-400">
                  Support MySpeak directly through Buy Me a Coffee. Any amount
                  helps cover running costs and keeps the project growing.
                </p>
              </div>

              {/* Fills the column and tells people where the money goes */}
              <ul className="space-y-2.5">
                {[
                  { icon: Server, label: "Voice servers and bandwidth" },
                  { icon: Globe, label: "Domain and hosting renewals" },
                  { icon: Zap, label: "New features, shipped faster" },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/[0.06]">
                      <Icon size={13} className="text-zinc-400" />
                    </span>
                    <span className="text-[13px] leading-tight text-zinc-400">{label}</span>
                  </li>
                ))}
              </ul>

              <div>
                <a
                  href="https://www.buymeacoffee.com/myspeak.team"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-[10px] transition duration-200 hover:opacity-90 active:scale-[0.98]"
                >
                  <img
                    src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                    alt="Buy Me a Coffee"
                    width={217}
                    height={60}
                    className="h-[60px] w-[217px]"
                  />
                </a>
                <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">
                  The support form also opens automatically on this page — no
                  extra tap needed.
                </p>
              </div>
            </div>
          </div>

          <SupportQr />
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
                    <p className="shrink-0 text-sm font-semibold text-emerald-400">${d.amount}</p>
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
