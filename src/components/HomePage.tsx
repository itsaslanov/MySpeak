import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Lock, LogOut, Mic, RefreshCw, Users, Info, Settings, Heart } from "lucide-react";
import { request, SOCKET_URL, grantRoomAccess, getAdminToken, setAdminToken } from "../lib/api";
import type { Group, Participant } from "../types";
import NameModal from "./NameModal";
import Footer from "./Footer";

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
      className={`glass-card p-4 sm:p-5 opacity-0 animate-slide-up stagger-${Math.min(index + 1, 6)} ${isLive ? "ring-1 ring-emerald-500/20" : ""}`}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isLive ? "bg-emerald-500/10" : "bg-accent/10"}`}>
            <Mic size={17} className={isLive ? "text-emerald-500" : "text-accent"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[13px] sm:text-sm font-semibold text-zinc-100">{group.name}</h3>
              {group.hasPasscode && <Lock size={11} className="shrink-0 text-zinc-600" />}
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 sm:text-xs">
              <Users size={11} />
              {group.count}/{group.maxUsers} speaking
            </div>
          </div>
        </div>
        {group.participants.length > 0 && (
          <div className="flex -space-x-1.5">
            {group.participants.slice(0, 3).map((p: Participant) => (
              <div
                key={p.socketId}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-3 text-[10px]"
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
            {group.participants.slice(0, 4).map((p: Participant) => (
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
          <p className="text-[11px] text-zinc-600">No one speaking</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onJoin(group)}
        disabled={!displayName || group.isFull}
        className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-1.5 text-[13px] sm:mt-4 sm:h-9 sm:text-xs"
      >
        {group.hasPasscode ? <Lock size={13} /> : <Mic size={14} />}
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
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("myspeak:avatar") || "😀");

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
          onCancel={displayName ? cancelEditName : undefined}
          initialName={editingName ? displayName : ""}
          initialAvatar={editingName ? (localStorage.getItem("myspeak:avatar") || "😀") : "😀"}
        />
      )}

      {passcodeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <form onSubmit={handlePasscodeSubmit} className="relative w-full sm:max-w-xs animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card p-6 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3">
                <Lock size={18} className="text-zinc-400" />
              </div>
              <h2 className="text-[15px] sm:text-sm font-semibold text-zinc-100">Passcode required</h2>
              <p className="mt-1.5 text-[13px] sm:text-xs leading-relaxed text-zinc-500">
                Enter the passcode to join <span className="font-medium text-zinc-300">{passcodeModal.name}</span>
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Don't have it? <a href="https://t.me/asesolo" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Ask admin</a>
              </p>
              {passcodeError && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[13px] sm:text-xs text-red-400">
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
                className="glass-input mt-4 h-12 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
              />
              <div className="mt-4 flex gap-2.5 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => setPasscodeModal(null)}
                  className="btn-secondary h-12 sm:h-10 flex-1 text-[13px] sm:text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passcodeInput.trim()}
                  className="btn-primary h-12 sm:h-10 flex-1 text-[13px] sm:text-xs"
                >
                  Join
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-6 sm:pb-8 lg:pb-10">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <img src="/myspeak.png" alt="MySpeak" className="h-8 w-8 rounded-lg object-cover sm:h-8 sm:w-8" />
            <h1 className="text-[15px] sm:text-base font-semibold text-zinc-100">MySpeak</h1>
            {totalOnline > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 ring-1 ring-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-400">{totalOnline} online</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/about" className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs">
              <Info size={12} />
              <span className="hidden sm:inline">About</span>
            </Link>
            <Link to="/donate" className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs">
              <Heart size={12} />
              <span className="hidden sm:inline">Donate</span>
            </Link>
            {displayName && (
              <button
                type="button"
                onClick={resetDisplayName}
                title="Change name"
                className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs"
              >
                <span className="text-[13px]">{userAvatar}</span>
                <span className="hidden sm:inline">{displayName}</span>
                <LogOut size={12} className="text-zinc-600" />
              </button>
            )}
            {isAdmin && (
              <>
                <Link to="/admin" className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs">
                  <Settings size={12} />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs"
                >
                  <LogOut size={12} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
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

          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <p className="text-[13px] sm:text-xs text-zinc-500">
              {visibleGroups.length} open room{visibleGroups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={loadInitialData}
              title="Refresh"
              className="btn-secondary flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center !rounded-md p-0"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-40 sm:h-36 animate-pulse p-4 sm:p-5">
                  <div className="space-y-3">
                    <div className="h-3 w-28 rounded bg-surface-3" />
                    <div className="h-3 w-16 rounded bg-surface-3" />
                    <div className="mt-6 h-10 sm:h-9 w-full rounded-lg bg-surface-3" />
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
                <h2 className="mt-4 text-[15px] sm:text-sm font-semibold text-zinc-200">No rooms available</h2>
                <p className="mt-1.5 text-[13px] sm:text-xs text-zinc-500">
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
