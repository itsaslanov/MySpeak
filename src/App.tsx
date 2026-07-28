import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
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
