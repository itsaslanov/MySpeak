import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import MySpeakLogo from "./components/MySpeakLogo";

const HomePage = lazy(() => import("./components/HomePage"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const RoomPage = lazy(() => import("./components/RoomPage"));
const AboutPage = lazy(() => import("./components/AboutPage"));
const DonationPage = lazy(() => import("./components/DonationPage"));

function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ background: "#09090b" }}>
      <div className="flex items-center gap-2 loader-pulse">
        <MySpeakLogo className="h-8 w-8 rounded-[8px]" />
        <span className="text-white font-semibold text-base tracking-tight leading-none">MySpeak</span>
      </div>
    </div>
  );
}

/**
 * The Buy Me a Coffee widget is loaded by index.html so the vendor script is
 * present before DOMContentLoaded. This gate reveals it on /donate (auto-opening
 * the donation form) and hides it on every other route.
 *
 * The vendor builds its DOM once and exposes no re-render API, so we toggle
 * visibility instead of unmounting — that keeps it restorable when navigating
 * back to /donate without reloading the page.
 */
function BmcGate() {
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const apply = (onDonate: boolean) => {
      if (cancelled) return;
      const btn = document.getElementById("bmc-wbtn");
      const frame = document.getElementById("bmc-iframe");
      // The vendor wraps the iframe in an unlabelled overlay div.
      const overlay = frame?.parentElement ?? null;

      if (!btn) {
        // Script blocked or still loading — retry briefly.
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => apply(onDonate), 150);
        return;
      }

      if (onDonate) {
        btn.style.display = "flex";
        if (overlay) overlay.style.display = "";
        // Idempotent: the vendor guards its own handler with a one-shot flag.
        btn.click();
      } else {
        btn.style.display = "none";
        if (overlay) overlay.style.display = "none";
      }
    };

    apply(pathname === "/donate");

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <BmcGate />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/donate" element={<DonationPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/room/:id" element={<RoomPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
