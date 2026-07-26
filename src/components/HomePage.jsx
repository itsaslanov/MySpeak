import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Lock, LogOut, Mic, RefreshCw, Settings, Users } from "lucide-react";
import { request, SOCKET_URL, grantRoomAccess } from "../lib/api.js";
import NameModal from "./NameModal.jsx";

const GroupCard = React.memo(function GroupCard({ group, displayName, onJoin, index }) {
  return (
    <div
      className={`glass-card p-4 sm:p-5 opacity-0 animate-slide-up stagger-${Math.min(index + 1, 6)}`}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 sm:h-10 sm:w-10">
            <Mic size={16} className="text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-xs sm:text-sm font-semibold text-zinc-100">{group.name}</h3>
              {group.hasPasscode && <Lock size={11} className="shrink-0 text-zinc-600" />}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 sm:text-xs">
              <Users size={11} />
              {group.count}/{group.maxUsers} speaking
            </div>
          </div>
        </div>
        {group.participants.length > 0 && (
          <div className="flex -space-x-1.5">
            {group.participants.slice(0, 3).map((p) => (
              <div
                key={p.socketId}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-3 text-[10px] sm:h-7 sm:w-7"
                title={p.displayName}
              >
                {p.avatar || p.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-[20px]">
        {group.participants.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {group.participants.slice(0, 4).map((p) => (
              <span
                key={p.socketId}
                className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-zinc-400"
              >
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                {p.displayName}
              </span>
            ))}
            {group.participants.length > 4 && (
              <span className="text-[11px] text-zinc-600">+{group.participants.length - 4}</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-600 sm:text-xs">No one speaking</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onJoin(group)}
        disabled={!displayName || group.isFull}
        className="btn-primary mt-3 flex h-9 w-full items-center justify-center gap-1.5 text-xs sm:mt-4"
      >
        {group.hasPasscode ? <Lock size={12} /> : <Mic size={13} />}
        {group.hasPasscode ? "Enter passcode" : "Join room"}
      </button>
    </div>
  );
});

export default function HomePage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("myspeak:display-name") || ""
  );
  const [groups, setGroups] = useState([]);
  const [config, setConfig] = useState({ agoraAppId: "", tokenEnabled: false });
  const [passcodeModal, setPasscodeModal] = useState(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  const visibleGroups = useMemo(() => groups.filter((g) => !g.isFull), [groups]);

  async function loadInitialData() {
    try {
      setError("");
      const [c, g] = await Promise.all([request("/api/config"), request("/api/groups")]);
      setConfig(c);
      setGroups(g.groups || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("groups:update", (next) => {
      setGroups(next || []);
    });
    return () => socket.disconnect();
  }, []);

  function saveDisplayName(name, avatar) {
    localStorage.setItem("myspeak:display-name", name);
    if (avatar) localStorage.setItem("myspeak:avatar", avatar);
    setDisplayName(name);
  }

  function resetDisplayName() {
    localStorage.removeItem("myspeak:display-name");
    localStorage.removeItem("myspeak:avatar");
    setDisplayName("");
  }

  function joinRoom(group, passcode = "") {
    grantRoomAccess(group.id, passcode);
    navigate(`/room/${group.id}`, {
      state: { group, passcode }
    });
  }

  function handleJoinRequest(group) {
    if (group.hasPasscode) {
      setPasscodeModal(group);
      setPasscodeInput("");
      setPasscodeError("");
    } else {
      joinRoom(group);
    }
  }

  function handlePasscodeSubmit(e) {
    e.preventDefault();
    if (!passcodeInput.trim() || !socketRef.current) return;

    const socket = socketRef.current;
    socket.emit(
      "group:verify-passcode",
      { groupId: passcodeModal.id, passcode: passcodeInput.trim() },
      (reply) => {
        if (reply?.ok) {
          joinRoom(passcodeModal, passcodeInput.trim());
          setPasscodeModal(null);
        } else {
          setPasscodeError(reply?.error || "Wrong passcode.");
        }
      }
    );
  }

  return (
    <main className="min-h-screen">
      {!displayName && <NameModal onSave={saveDisplayName} />}

      {passcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <form onSubmit={handlePasscodeSubmit} className="relative w-full max-w-xs animate-scale-in">
            <div className="glass-card p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3">
                <Lock size={16} className="text-zinc-400" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-100">Passcode required</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                Enter the passcode to join <span className="font-medium text-zinc-300">{passcodeModal.name}</span>
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Don't have it? <a href="https://t.me/asesolo" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Ask admin</a>
              </p>
              {passcodeError && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  {passcodeError}
                </div>
              )}
              <input
                autoFocus
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePasscodeSubmit(e); }}
                placeholder="Enter passcode"
                className="glass-input mt-4 h-10 w-full px-3 text-sm"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPasscodeModal(null)}
                  className="btn-secondary h-10 flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passcodeInput.trim()}
                  className="btn-primary h-10 flex-1 text-xs"
                >
                  Join
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-8 sm:pb-10">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <img src="/myspeak.png" alt="MySpeak" className="h-7 w-7 rounded-lg object-cover sm:h-8 sm:w-8" />
            <h1 className="text-sm font-semibold text-zinc-100 sm:text-base">MySpeak</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {displayName && (
              <button
                type="button"
                onClick={resetDisplayName}
                title="Change name"
                className="btn-secondary flex h-8 items-center gap-1.5 px-2.5 text-xs"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-3 text-[10px] font-semibold text-zinc-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
                <LogOut size={12} className="text-zinc-600" />
              </button>
            )}
            <Link to="/admin" className="btn-secondary flex h-8 items-center gap-1.5 px-2.5 text-xs">
              <Settings size={12} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col pb-8">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {!loading && !config.agoraAppId && (
            <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              Add <code className="rounded bg-surface-3 px-1 py-0.5 text-[11px]">AGORA_APP_ID</code> to{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 text-[11px]">.env</code> to enable voice.
            </div>
          )}

          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <p className="text-xs text-zinc-500">
              {visibleGroups.length} open room{visibleGroups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={loadInitialData}
              title="Refresh"
              className="btn-secondary flex h-7 w-7 items-center justify-center !rounded-md p-0"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-36 animate-pulse p-4 sm:h-40 sm:p-5">
                  <div className="space-y-3">
                    <div className="h-3 w-28 rounded bg-surface-3" />
                    <div className="h-3 w-16 rounded bg-surface-3" />
                    <div className="mt-6 h-9 w-full rounded-lg bg-surface-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleGroups.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {visibleGroups.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  displayName={displayName}
                  onJoin={handleJoinRequest}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="glass-card p-6 text-center animate-fade-in sm:p-10">
                <Users className="mx-auto text-zinc-600" size={24} />
                <h2 className="mt-4 text-sm font-semibold text-zinc-200">No rooms available</h2>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Ask an admin to create a room.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
