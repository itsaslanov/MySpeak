import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const HomePage = lazy(() => import("./components/HomePage.jsx"));
const AdminPage = lazy(() => import("./components/AdminPage.jsx"));
const RoomPage = lazy(() => import("./components/RoomPage.jsx"));

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
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
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/room/:id" element={<RoomPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
