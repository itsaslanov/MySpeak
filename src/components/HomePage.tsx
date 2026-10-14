import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Lock, LogOut, Mic, Pencil, RefreshCw, Users, Info, Settings, Heart, ChevronDown } from "lucide-react";
import { request, SOCKET_URL, grantRoomAccess, getAdminToken, setAdminToken } from "../lib/api";
import MySpeakLogo from "./MySpeakLogo";
import type { Group, Participant } from "../types";
import NameModal from "./NameModal";
import Footer from "./Footer";
import Avatar from "./Avatar";
import { DEFAULT_MEMOJI, coerceAvatar } from "../lib/avatar";

interface GroupCardProps {
  group: Group;
  displayName: string;
  onJoin: (group: Group) => void;
  index: number;
}

const GroupCard = React.memo(function GroupCard({ group, displayName, onJoin, index }: GroupCardProps) {
  const isLive = group.participants.length > 0;
  return (
    <div
      className={`glass-card p-5 sm:p-6 opacity-0 animate-slide-up stagger-${Math.min(index + 1, 6)} ${isLive ? "ring-1 ring-emerald-500/20" : ""}`}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isLive ? "bg-emerald-500/10" : "bg-accent/10"}`}>
            <Mic size={20} className={isLive ? "text-emerald-500" : "text-accent"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm sm:text-base font-semibold text-zinc-100">{group.name}</h3>
              {group.hasPasscode && <Lock size={12} className="shrink-0 text-zinc-600" />}
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <Users size={13} />
              {group.count}/{group.maxUsers} speaking
            </div>
          </div>
        </div>
        {group.participants.length > 0 && (
          <div className="flex -space-x-2">
            {group.participants.slice(0, 3).map((p: Participant) => (
              <div
                key={p.socketId}
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-surface-2 bg-surface-3 text-[11px]"
                title={p.displayName}
              >
                <Avatar value={p.avatar || p.displayName.charAt(0).toUpperCase()} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 min-h-[24px]">
        {group.participants.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {group.participants.slice(0, 4).map((p: Participant) => (
              <span
                key={p.socketId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {p.displayName}
              </span>
            ))}
            {group.participants.length > 4 && (
              <span className="text-xs text-zinc-600">+{group.participants.length - 4}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-600">No one speaking</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onJoin(group)}
        disabled={!displayName || group.isFull}
        className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 text-sm sm:mt-5 sm:h-11"
      >
        {group.hasPasscode ? <Lock size={15} /> : <Mic size={16} />}
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [config, setConfig] = useState<{ agoraAppId: string; tokenEnabled: boolean }>({ agoraAppId: "", tokenEnabled: false });
  const [passcodeModal, setPasscodeModal] = useState<Group | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminToken());
  const [userAvatar, setUserAvatar] = useState(() => coerceAvatar(localStorage.getItem("myspeak:avatar")));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const visibleGroups = useMemo(() => groups.filter((g) => !g.isFull), [groups]);
  const totalOnline = useMemo(() => groups.reduce((sum, g) => sum + g.count, 0), [groups]);

  function handleAdminLogout() {
    setAdminToken("");
    setIsAdmin(false);
  }

  async function loadInitialData() {
    try {
      setError("");
      const [c, g] = await Promise.all([
        request<{ agoraAppId: string; tokenEnabled: boolean }>("/api/config"),
        request<{ groups: Group[] }>("/api/groups")
      ]);
      setConfig(c);
      setGroups(g.groups || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("groups:update", (next: Group[]) => {
      setGroups(next || []);
    });
    return () => { socket.disconnect(); };
  }, []);

  function saveDisplayName(name: string, avatar: string) {
    localStorage.setItem("myspeak:display-name", name);
    if (avatar) {
      localStorage.setItem("myspeak:avatar", avatar);
      setUserAvatar(avatar);
    }
    setDisplayName(name);
    setEditingName(false);
  }

  // Avatar applies the moment it's tapped — not only on Save — so a pick is
  // never lost if the person joins a room without pressing Save first.
  function handleAvatarPick(avatar: string) {
    localStorage.setItem("myspeak:avatar", avatar);
    setUserAvatar(avatar);
  }

  function resetDisplayName() {
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
  }

  function joinRoom(group: Group, passcode = "") {
    grantRoomAccess(group.id, passcode);
    navigate(`/room/${group.id}`, {
      state: { group, passcode }
    });
  }

  function handleJoinRequest(group: Group) {
    if (group.hasPasscode) {
      setPasscodeModal(group);
      setPasscodeInput("");
      setPasscodeError("");
    } else {
      joinRoom(group);
    }
  }

  function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcodeInput.trim() || !socketRef.current) return;

    const socket = socketRef.current;
    socket.emit(
      "group:verify-passcode",
      { groupId: passcodeModal!.id, passcode: passcodeInput.trim() },
      (reply: { ok: boolean; error?: string }) => {
        if (reply?.ok) {
          joinRoom(passcodeModal!, passcodeInput.trim());
          setPasscodeModal(null);
        } else {
          setPasscodeError(reply?.error || "Wrong passcode.");
        }
      }
    );
  }

  return (
    <main className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
      {(!displayName || editingName) && (
        <NameModal
          onSave={saveDisplayName}
          onAvatarPick={handleAvatarPick}
          onCancel={displayName ? cancelEditName : undefined}
          initialName={editingName ? displayName : ""}
          initialAvatar={editingName ? coerceAvatar(localStorage.getItem("myspeak:avatar")) : DEFAULT_MEMOJI}
        />
      )}

      {passcodeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <form onSubmit={handlePasscodeSubmit} className="relative w-full sm:max-w-sm animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card p-7 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05]">
                <Lock size={20} className="text-zinc-400" />
              </div>
              <h2 className="text-base font-semibold text-zinc-100">Passcode required</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Enter the passcode to join <span className="font-medium text-zinc-300">{passcodeModal.name}</span>
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Don't have it? <a href="https://t.me/oazizcc" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Ask admin</a>
              </p>
              {passcodeError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
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
                className="glass-input mt-4 h-12 sm:h-11 w-full px-4 text-base"
              />
              <div className="mt-5 flex gap-3 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => setPasscodeModal(null)}
                  className="btn-secondary h-12 sm:h-11 flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passcodeInput.trim()}
                  className="btn-primary h-12 sm:h-11 flex-1 text-sm"
                >
                  Join
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-8 sm:pb-10 lg:pb-12">
          <div className="flex items-center gap-2.5">
            <MySpeakLogo className="h-8 w-8 rounded-lg" />
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">MySpeak</h1>
            {totalOnline > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400">{totalOnline} online</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/about" className="btn-secondary flex h-10 sm:h-9 items-center gap-2 px-3 text-sm">
              <Info size={14} />
              <span className="hidden sm:inline">About</span>
            </Link>
            <Link to="/donate" className="flex h-10 sm:h-9 items-center gap-2 rounded-[14px] bg-gradient-to-r from-rose-500/20 to-pink-500/20 px-3.5 text-sm ring-1 ring-inset ring-rose-500/20 transition hover:from-rose-500/30 hover:to-pink-500/30 hover:ring-rose-500/30">
              <Heart size={15} className="animate-[heart-beat_1.5s_ease-in-out_infinite] text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.6)]" />
              <span className="hidden sm:inline font-medium text-rose-300">Donate</span>
            </Link>
            {displayName && !isAdmin && (
              <button
                type="button"
                onClick={() => resetDisplayName()}
                className="btn-secondary flex h-10 sm:h-9 items-center gap-2 px-3 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  <Avatar value={userAvatar} className="text-base" />
                </span>
                <span className="hidden sm:inline">{displayName}</span>
                <Pencil size={11} className="text-zinc-600" />
              </button>
            )}
            {isAdmin && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn-secondary flex h-10 sm:h-9 items-center gap-2 px-3 text-sm"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <Avatar value={userAvatar} className="text-base" />
                  </span>
                  <span className="hidden sm:inline">{displayName}</span>
                  <ChevronDown size={13} className={`text-zinc-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[rgba(24,24,27,0.9)] p-1 shadow-xl backdrop-blur-xl">
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Settings size={14} />
                      Admin Panel
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); resetDisplayName(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
                        <Avatar value={userAvatar} className="text-base" />
                      </span>
                      Change Name
                    </button>
                    <div className="my-1 h-px bg-white/[0.06]" />
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); handleAdminLogout(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-red-400"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="flex flex-1 flex-col pb-8">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[13px] sm:text-xs text-red-400">
              {error}
            </div>
          )}

          {!loading && !config.agoraAppId && (
            <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[13px] sm:text-xs text-amber-400">
              Add <code className="rounded bg-surface-3 px-1 py-0.5 text-[11px]">AGORA_APP_ID</code> to{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 text-[11px]">.env</code> to enable voice.
            </div>
          )}

          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <p className="text-sm text-zinc-500">
              {visibleGroups.length} open room{visibleGroups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={loadInitialData}
              title="Refresh"
              className="btn-secondary flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center !rounded-xl p-0"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-44 sm:h-40 animate-pulse p-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
                    <div className="h-3.5 w-20 rounded bg-white/[0.06]" />
                    <div className="mt-8 h-12 sm:h-11 w-full rounded-xl bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleGroups.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
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
              <div className="glass-card p-8 text-center animate-fade-in sm:p-12">
                <Users className="mx-auto text-zinc-600" size={28} />
                <h2 className="mt-5 text-lg sm:text-xl font-semibold text-zinc-200">No rooms available</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Ask an admin to create a room.
                </p>
              </div>
            </div>
          )}
        </section>

        <Footer />
      </div>
    </main>
  );
}
