import React, { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { AlertCircle, ArrowLeft, Crown, LogOut, MessageSquare, Mic, MicOff, Phone, PhoneOff, UserMinus, Users, Volume2, X, Clipboard } from "lucide-react";
import { request, getAdminToken } from "../lib/api";
import { useVoiceAnnounce } from "../hooks/useVoiceAnnounce";
import type { Group, Participant, ChatMessage, Config, AgoraTokenResponse } from "../types";
import type { Socket } from "socket.io-client";
import MySpeakLogo from "./MySpeakLogo";
import VoiceWaveform from "./VoiceWaveform";

AgoraRTC.setLogLevel(4);

function createUid() {
  return Math.floor(100000 + Math.random() * 900000000);
}

/**
 * Every user gets a consistent gradient identity derived from their name,
 * the way Slack / Discord / iMessage assign profile colors.
 *
 * Deliberately muted: dark, low-saturation tones so the emoji carries the
 * personality and the UI stays calm instead of rainbow.
 */
const IDENTITY_GRADIENTS: Array<[string, string]> = [
  ["#3e4256", "#474b63"],
  ["#374552", "#3f5060"],
  ["#36484a", "#3e5457"],
  ["#4a4539", "#544e41"],
  ["#4c3f49", "#574852"],
  ["#3c4739", "#445143"],
  ["#4d413b", "#584a42"],
  ["#453f52", "#4f485d"],
  ["#3a4550", "#434f5c"],
  ["#49443f", "#544e48"],
];

function identityFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const [from, to] = IDENTITY_GRADIENTS[hash % IDENTITY_GRADIENTS.length];
  return {
    from,
    to,
    /** whisper of tint for card backgrounds */
    tint: `linear-gradient(145deg, ${from}26 0%, ${to}1a 55%, #0d0d1100 100%)`,
    /** dark muted bubble for avatars */
    solid: `linear-gradient(145deg, ${from}, ${to})`,
  };
}

interface ParticipantBubbleProps {
  participant: Participant;
  isSelf: boolean;
  speaking: boolean;
}

const ParticipantBubble = React.memo(function ParticipantBubble({ participant, isSelf, speaking }: ParticipantBubbleProps) {
  const isParticipantAdmin = participant.admin;
  return (
    <div className="flex flex-col items-center gap-2 animate-scale-in">
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold transition duration-300 ${
            speaking ? "speaking-glow" : ""
          } ${
            isSelf
              ? "bg-gradient-to-br from-blue-500/25 to-indigo-600/15 text-blue-300 ring-1 ring-blue-500/25"
              : isParticipantAdmin
                ? "bg-amber-500/8 text-amber-400 ring-1 ring-amber-500/15"
                : "bg-white/[0.04] text-zinc-500 ring-1 ring-white/[0.05]"
          }`}
        >
          {participant.avatar || participant.displayName.charAt(0).toUpperCase()}
        </div>
        {isParticipantAdmin && (
          <div className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-amber-500">
            <Crown size={9} className="text-white" />
          </div>
        )}
      </div>
      <span className={`max-w-[4.5rem] truncate text-[11px] font-medium ${isParticipantAdmin ? "text-amber-400" : "text-zinc-500"}`}>
        {participant.displayName}
      </span>
      {isSelf && (
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">You</span>
      )}
    </div>
  );
});

interface CallRoomProps {
  group: Group;
  displayName: string;
  avatar: string;
  socket: Socket | null;
  config: Config;
  passcode: string;
  onLeave: () => void;
}

interface TypingPayload {
  displayName: string;
  typing: boolean;
}


export default function CallRoom({ group, displayName, avatar, socket, config, passcode, onLeave }: CallRoomProps) {
  const uid = useMemo(createUid, []);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const [participants, setParticipants] = useState<Participant[]>(group.participants || []);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [micStatus, setMicStatus] = useState("Checking microphone");
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState("");
  const [micVolume, setMicVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const showChatRef = useRef(showChat);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimersRef = useRef<{ self?: ReturnType<typeof setTimeout> }>({});
  const isAdmin = !!getAdminToken();
  const [unreadCount, setUnreadCount] = useState(0);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
  const [callSeconds, setCallSeconds] = useState(0);
  const { announce } = useVoiceAnnounce();

  const micActive = !error && !/error|denied|unavailable|failed/i.test(micStatus) && micEnabled;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  useEffect(() => {
    if (joining || /disconnect|error/i.test(status)) return;
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [joining, status]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowChat(false);
        setShowMembers(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat]);

  async function cleanupAgora() {
    const client = clientRef.current;
    const tracks = [audioTrackRef.current].filter(Boolean) as IMicrophoneAudioTrack[];
    if (client) {
      if (tracks.length) {
        try { await client.unpublish(tracks); } catch {}
      }
      try { await client.leave(); } catch {}
      client.removeAllListeners?.();
    }
    tracks.forEach((track) => {
      try { track.stop(); track.close(); } catch {}
    });
    clientRef.current = null;
    audioTrackRef.current = null;
    setJoined(false);
  }

  function handleChatMessage(msg: ChatMessage) {
    if (msg?.system || msg?.displayName) {
      setMessages((prev) => [...prev, msg]);
      if (!showChatRef.current) setUnreadCount((c) => c + 1);
    }
    if (msg?.system && msg.type) {
      announce();
    }
  }

  function handleTyping({ displayName: name, typing }: TypingPayload) {
    setTypingUsers((prev) => {
      if (typing) {
        if (prev.includes(name)) return prev;
        return [...prev, name];
      }
      return prev.filter((n) => n !== name);
    });
  }

  function handleCleared() {
    setMessages([]);
    setTypingUsers([]);
  }

  function clearChat() {
    if (!socket || !isAdmin) return;
    socket.emit("chat:clear", { token: getAdminToken() });
  }

  function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed || !socket) return;
    socket.emit("presence:rename", { displayName: trimmed }, (reply: { ok?: boolean }) => {
      if (reply?.ok) {
        localStorage.setItem("myspeak:display-name", trimmed);
        setEditingName(false);
      }
    });
  }

  function handleKick(targetSocketId: string) {
    if (!socket || !isAdmin) return;
    socket.emit("kick:user", { socketId: targetSocketId, adminToken: getAdminToken() });
  }

  useEffect(() => {
    let disposed = false;
    let deleteTimer: ReturnType<typeof setTimeout> | null = null;

    function updatePresence(nextGroup: Group) {
      if (nextGroup?.id === group.id) {
        setParticipants(nextGroup.participants || []);
      }
    }

    function handleDeleted(payload: { id: string }) {
      if (payload?.id === group.id) {
        setError("This room was closed by the admin.");
        cleanupAgora();
        deleteTimer = setTimeout(() => onLeave(), 1500);
      }
    }

    function joinPresence(): Promise<{ ok: boolean; error?: string; group?: Group }> {
      if (!socket) {
        return Promise.resolve({ ok: false, error: "Presence server is not ready." });
      }
      return new Promise<{ ok: boolean; error?: string; group?: Group }>((resolve) => {
        const timer = window.setTimeout(
          () => resolve({ ok: false, error: "Could not reach the presence server." }), 5000
        );
        socket.emit("presence:join", { groupId: group.id, displayName, uid, passcode, adminToken: getAdminToken(), avatar }, (reply: { ok: boolean; error?: string; group?: Group }) => {
          window.clearTimeout(timer);
          resolve(reply);
        });
      });
    }

    async function loadChatHistory() {
      if (!socket) return;
      socket.emit("chat:history", { groupId: group.id }, (reply: { ok: boolean; messages?: ChatMessage[] }) => {
        if (reply?.ok && reply.messages) {
          // Merge instead of replace: messages can stream in between the join
          // ack and this reply, and a blind set would drop them.
          setMessages((prev) => {
            const byId = new Map<string, ChatMessage>();
            for (const m of reply.messages as ChatMessage[]) if (m?.id) byId.set(m.id, m);
            for (const m of prev) if (m?.id) byId.set(m.id, m);
            return Array.from(byId.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      });
    }

    async function startCall() {
      if (!socket) {
        setStatus("Waiting for server");
        setJoining(true);
        return;
      }
      try {
        setJoining(true);
        setError("");
        setStatus("Connecting");
        const presence = await joinPresence();
        if (!presence.ok) throw new Error(presence.error || "Could not join this room.");
        setParticipants(presence.group?.participants || []);
        loadChatHistory();
        if (!config.agoraAppId) { setStatus("Waiting for Agora"); return; }
        setStatus("Starting voice");
        const tokenResponse = await request<AgoraTokenResponse>("/api/agora/token", {
          method: "POST",
          body: { groupId: group.id, uid }
        });
        if (disposed) return;
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8", logLevel: 4 });
        client.enableAudioVolumeIndicator();
        clientRef.current = client;
        client.on("user-published", async (user, mediaType) => {
          if (mediaType !== "audio") return;
          await client.subscribe(user, mediaType);
          user.audioTrack?.play();
        });
        client.on("volume-indicator", (volumes: Array<{ uid: string | number; level: number }>) => {
          if (disposed) return;
          const next: Record<string, boolean> = {};
          volumes.forEach((v) => {
            if (v.level > 5) next[String(v.uid)] = true;
          });
          const localTrack = audioTrackRef.current;
          if (localTrack) {
            try {
              if (localTrack.getVolumeLevel() > 0.05) next[String(uid)] = true;
            } catch {}
          }
          setSpeakingMap(next);
        });
        let audioTrack: IMicrophoneAudioTrack | null = null;
        try {
          setMicStatus("Requesting mic permission");
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
          setMicStatus("");
        } catch (err) {
          setMicEnabled(false);
          setMicStatus((err as Error)?.message ? `Mic error: ${(err as Error).message}` : "Microphone unavailable");
        }
        if (disposed) { audioTrack?.close(); return; }
        await client.join(tokenResponse.appId, tokenResponse.channelName, tokenResponse.token || null, tokenResponse.uid);
        if (audioTrack) {
          audioTrackRef.current = audioTrack;
          await client.publish([audioTrack]);
          setMicEnabled(true);
        }
        setJoined(true);
        setStatus("Connected");
      } catch (err) {
        setError((err as Error).message);
        setStatus("Disconnected");
      } finally {
        if (!disposed) setJoining(false);
      }
    }

    function handleKicked() {
      setError("You have been kicked by the admin.");
      cleanupAgora();
      setTimeout(() => onLeave(), 1500);
    }

    socket?.on("presence:update", updatePresence);
    socket?.on("group:deleted", handleDeleted);
    socket?.on("chat:message", handleChatMessage);
    socket?.on("chat:typing", handleTyping);
    socket?.on("chat:cleared", handleCleared);
    socket?.on("kicked", handleKicked);
    startCall();
    return () => {
      disposed = true;
      if (deleteTimer) clearTimeout(deleteTimer);
      if (typingTimersRef.current.self) clearTimeout(typingTimersRef.current.self);
      socket?.off("presence:update", updatePresence);
      socket?.off("group:deleted", handleDeleted);
      socket?.off("chat:message", handleChatMessage);
      socket?.off("chat:typing", handleTyping);
      socket?.off("chat:cleared", handleCleared);
      socket?.off("kicked", handleKicked);
      socket?.emit("presence:leave", { groupId: group.id });
      socket?.emit("chat:typing", { typing: false });
      cleanupAgora();
    };
  }, [group.id, socket]);

  async function handleLeave() {
    await cleanupAgora();
    socket?.emit("presence:leave", { groupId: group.id });
    onLeave();
  }

  async function toggleMic() {
    const track = audioTrackRef.current;
    if (!track) return;
    const next = !micEnabled;
    try {
      await track.setEnabled(next);
      setMicEnabled(next);
      setMicStatus("");
    } catch (err) {
      setError((err as Error).message || "Could not change mic state.");
      setMicStatus("Mic control failed");
    }
  }

  async function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const level = Number(e.target.value);
    setMicVolume(level);
    const track = audioTrackRef.current;
    if (track) {
      try { await track.setVolume(level); } catch {}
    }
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket) return;
    socket.emit("chat:send", { text }, (reply: { ok?: boolean; error?: string }) => {
      if (!reply?.ok) setError(reply?.error || "Failed to send.");
    });
    socket.emit("chat:typing", { typing: false });
    if (typingTimersRef.current.self) clearTimeout(typingTimersRef.current.self);
    setChatInput("");
    if (chatInputRef.current) chatInputRef.current.style.height = "auto";
  }

  function renderMessageText(text: string, onBlue: boolean) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`chat-link [overflow-wrap:anywhere] ${
              onBlue
                ? "text-white decoration-white/55 hover:decoration-white"
                : "text-[#0A84FF] decoration-[#0A84FF]/50 hover:decoration-[#0A84FF]"
            }`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setChatInput((prev) => prev + text);
      }
    } catch {}
  }

  const [allGroups, setAllGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handler = (groups: Group[]) => setAllGroups(groups);
    socket.on("groups:update", handler);
    return () => { socket.off("groups:update", handler); };
  }, [socket]);

  const [showMembers, setShowMembers] = useState(false);

  function renderVoiceControls(size: "sm" | "lg" = "sm") {
    const lg = size === "lg";
    const height = lg ? "h-9" : "h-9";
    const square = lg ? "h-9 w-9" : "h-9 w-9";
    const radius = lg ? "rounded-full" : "rounded-lg";
    const iconSize = lg ? 16 : 14;

    return (
      <div className="flex w-full flex-col">
        {showVolume && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <Volume2 size={12} className="shrink-0 text-zinc-600" />
            <input
              type="range"
              min="0"
              max="200"
              value={micVolume}
              onChange={handleVolumeChange}
              className="h-[3px] w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-accent"
            />
            <span className="w-8 shrink-0 text-right text-[9px] text-zinc-600">{micVolume}%</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!audioTrackRef.current || joining}
            aria-label={micEnabled ? "Mute" : "Unmute"}
            className={`flex ${lg ? `${square} shrink-0` : "flex-1"} items-center justify-center gap-1.5 ${height} ${radius} ${lg ? "" : ""} font-semibold transition ${
              micActive
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/25"
                : "bg-white/[0.06] text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.1]"
            } disabled:opacity-30`}
          >
            {micEnabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
            {!lg && (micEnabled ? "Mute" : "Unmute")}
          </button>
          <button
            type="button"
            onClick={() => setShowVolume((v) => !v)}
            aria-label="Volume"
            className={`flex ${square} shrink-0 items-center justify-center ${radius} transition ${
              showVolume
                ? "bg-white/[0.12] text-zinc-200 ring-1 ring-white/[0.12]"
                : "bg-white/[0.05] text-zinc-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200"
            }`}
          >
            <Volume2 size={iconSize} />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            aria-label="Leave room"
            className={`flex ${square} shrink-0 items-center justify-center ${radius} bg-red-500/15 text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/25 hover:ring-red-500/35`}
          >
            <PhoneOff size={iconSize} />
          </button>
        </div>
      </div>
    );
  }

  const statusTone = /disconnect|error/i.test(status)
    ? "red"
    : /connected/i.test(status)
      ? "emerald"
      : "amber";

  function renderStatusPill() {
    const tone =
      statusTone === "emerald"
        ? "text-emerald-400/80"
        : statusTone === "red"
          ? "text-red-400/80"
          : "text-amber-400/80";
    const dot =
      statusTone === "emerald"
        ? "bg-emerald-400/70"
        : statusTone === "red"
          ? "bg-red-400/70"
          : "animate-pulse bg-amber-400/70";
    return (
      <span className={`flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${tone}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="max-w-[7rem] truncate">{status}</span>
      </span>
    );
  }

  /** Voice participation state, phrased the way a person would say it. */
  const voiceStatusLine = (() => {
    const speakers = participants.filter((p) => speakingMap[String(p.uid)]);
    if (speakers.length === 1) return `${speakers[0].displayName} speaking`;
    if (speakers.length > 1) return `${speakers.length} speaking`;
    const n = participants.length;
    return `${n} ${n === 1 ? "person" : "people"} in voice`;
  })();

  /** Compact two-line room identity: name over voice state. */
  function renderRoomIdentity() {
    const roomMe = identityFor(group.name);
    return (
      <button
        type="button"
        onClick={() => setShowMembers(true)}
        aria-label={`${group.name}. ${voiceStatusLine}. Show participants`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 text-left transition active:opacity-60"
      >
        <span className="relative shrink-0">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[14px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-inset ring-white/10"
            style={{ background: roomMe.solid }}
          >
            {group.name.charAt(0).toUpperCase()}
          </span>
          {/* Live conversation indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070709]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-[18px] tracking-[-0.01em] text-zinc-50">
            {group.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-[13px] text-zinc-500">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
            <span className="truncate">{voiceStatusLine}</span>
          </span>
        </span>
      </button>
    );
  }

  /** Call duration + live mic level, as a compact trailing accessory. */
  function renderCallIsland() {
    return (
      <div
        className={`pointer-events-none flex shrink-0 items-center gap-2.5 rounded-full bg-black/85 px-3.5 py-1.5 ring-1 ring-white/[0.08] backdrop-blur-md transition-all duration-300 ${
          micActive ? "island-active" : ""
        }`}
      >
        <Phone size={12} className="text-emerald-400" />
        <span className="text-[12px] font-semibold tabular-nums text-emerald-400">
          {Math.floor(callSeconds / 60)}m
        </span>
        {micActive && (
          <div className="flex h-4 items-center gap-[3px]">
            <span className="wave-bar h-full w-[3px] rounded-full bg-emerald-400" />
            <span className="wave-bar-2 h-full w-[3px] rounded-full bg-emerald-400" />
            <span className="wave-bar-3 h-full w-[3px] rounded-full bg-emerald-400" />
            <span className="wave-bar h-full w-[3px] rounded-full bg-emerald-400" style={{ animationDelay: "0.2s" }} />
            <span className="wave-bar-2 h-full w-[3px] rounded-full bg-emerald-400" style={{ animationDelay: "0.4s" }} />
            <span className="wave-bar-3 h-full w-[3px] rounded-full bg-emerald-400" style={{ animationDelay: "0.1s" }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="relative flex h-dvh overflow-hidden bg-[#070709]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-blue-500/[0.08] blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[24rem] w-[24rem] translate-x-1/4 rounded-full bg-indigo-500/[0.05] blur-[120px]" />
      </div>
      {error && (
        <div className="absolute left-1/2 top-3 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400 shadow-lg shadow-red-500/5">
          <AlertCircle className="mt-0.5 shrink-0" size={13} />
          <span>{error}</span>
        </div>
      )}

      <div
        onClick={() => setShowMembers(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          showMembers ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[82vw] flex-col border-r border-white/[0.06] bg-[#0a0a0d]/95 shadow-2xl shadow-black/60 backdrop-blur-xl transition-transform duration-300 ease-out ${
          showMembers ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-600/10 ring-1 ring-blue-500/20">
            <MySpeakLogo className="h-6 w-6 rounded-lg" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-200">MySpeak</div>
            <div className="text-[10px] text-zinc-600">Voice rooms</div>
          </div>
          <button
            type="button"
            onClick={() => setShowMembers(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300 md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">

          {participants.length > 0 && (
            <>
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">In voice</span>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {participants.length}
                </span>
              </div>
              <div className="space-y-0.5 px-2 pb-2">
                {participants.map((p) => {
                  const isSpeaking = !!speakingMap[String(p.uid)];
                  return (
                    <div
                      key={p.socketId}
                      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 transition ${
                        isSpeaking ? "bg-emerald-500/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-2 ring-emerald-400/25 transition ${
                            p.admin ? "ring-amber-400/30" : ""
                          } ${isSpeaking ? "!ring-emerald-400/70" : ""}`}
                          style={
                            p.admin
                              ? { background: "linear-gradient(145deg, #4a4539, #544e41)" }
                              : { background: identityFor(p.displayName).solid }
                          }
                        >
                          {p.avatar || p.displayName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <span className={`truncate text-[13px] ${p.admin ? "font-medium text-amber-300" : "text-zinc-300"}`}>
                        {p.displayName}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {Number(p.uid) === uid && (
                          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">You</span>
                        )}
                        {p.admin && <Crown size={11} className="text-amber-500/70" />}
                        {isAdmin && !p.admin && Number(p.uid) !== uid && (
                          <button
                            onClick={() => handleKick(p.socketId)}
                            aria-label="Kick user"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          >
                            <UserMinus size={11} />
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b0f] px-3 py-3">
          <div className="mb-2.5 flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-2.5 py-2 ring-1 ring-white/[0.04]">
            <div className="relative shrink-0">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-2 ring-emerald-400/30"
                style={{ background: identityFor(displayName).solid }}
              >
                {avatar || displayName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0b0b0f]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-zinc-100">{displayName}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400/80">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Voice connected
              </div>
            </div>
          </div>
          {renderVoiceControls("sm")}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header — native iOS navigation bar, one line on mobile, identity + island + status on desktop */}
        <header className="shrink-0 border-b border-white/[0.06] px-3 py-2.5 md:px-5 md:py-3">
          <div className="flex items-center gap-2.5 md:gap-3">
            {renderRoomIdentity()}
            {/* Call status cluster: connection state + duration, grouped tightly */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden md:block">{renderStatusPill()}</div>
              {renderCallIsland()}
            </div>
          </div>
        </header>

        {/* Main content: voice grid + chat panel */}
        <div className="flex min-h-0 flex-1">
          {/* Voice grid */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-2 pt-4 md:px-6 md:pb-4 md:pt-6">
              {/* Removed the full-stage ambient waveform per request; now behind avatar only */}
              <div className="relative z-10 flex w-full -translate-y-[6%] flex-col items-center justify-center gap-4 md:gap-5">
              {(() => {
                const self =
                  participants.find((p) => Number(p.uid) === uid) ||
                  ({
                    socketId: "self",
                    uid,
                    displayName,
                    avatar,
                    admin: isAdmin,
                    joinedAt: new Date().toISOString(),
                  } as Participant);
                // Spotlight is always YOU on your own screen
                const active = self;
                // Everyone else in the strip: admins first, then by join time
                const strip = participants
                  .filter((p) => Number(p.uid) !== uid)
                  .sort((a, b) => {
                    if (!!a.admin !== !!b.admin) return a.admin ? -1 : 1;
                    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
                  });
                const activeSpeaking = !!speakingMap[String(active.uid)];
                const activeName = active.displayName;
                const activeMe = identityFor(activeName);
                const activeEmoji = active.avatar || active.displayName.charAt(0).toUpperCase();
                const selfStatus = activeSpeaking ? "Speaking" : micActive ? "Mic on" : "Muted";
                return (
                  <>
                    {/* Spotlight — always YOU on your own screen */}
                    <div
                      key="self-spotlight"
                      className={`relative w-full max-w-[23.5rem] animate-scale-in overflow-hidden rounded-[32px] transition-all duration-500 sm:max-w-[26rem] ${
                        activeSpeaking
                          ? "ring-1 ring-emerald-400/25 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.95)]"
                          : "ring-1 ring-white/[0.06] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.9)]"
                      }`}
                    >
                      {/* Poster background: subtle identity tint + vignette */}
                      <div className="absolute inset-0" style={{ background: activeMe.tint }} />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#101014]/80 to-[#0a0a0e]/95" />
                      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.05),transparent_60%)]" />
                      {/* Speaking halo */}
                      <div
                        className={`absolute inset-0 transition-opacity duration-700 ${
                          activeSpeaking ? "opacity-100" : "opacity-0"
                        }`}
                        style={{
                          background: "radial-gradient(70% 45% at 50% 42%, rgba(52,211,153,0.10), transparent 70%)",
                        }}
                      />

                      <div className="relative flex aspect-[4/5] flex-col items-center justify-center">
                        {/* Emoji medallion — waveform behind, avatar clear */}
                        <div className="relative flex w-full items-center justify-center">
                          {/* Waveform passes through the avatar area, clipped inside the card */}
                          <div
                            className={`pointer-events-none absolute inset-x-0 z-0 flex items-center justify-center overflow-hidden transition-opacity duration-500 ease-out ${
                              activeSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            style={{ height: "30%", top: "50%", transform: "translateY(-50%)" }}
                          >
                            <div className="h-full w-full [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                              <VoiceWaveform
                                active={activeSpeaking}
                                fill
                                color="#34d399"
                                opacity={0.4}
                                squeeze={3}
                                className="h-full w-full"
                              />
                            </div>
                          </div>

                          <div className="relative z-10 flex items-center justify-center">
                            <div
                              className="flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-2 ring-emerald-400/30 sm:h-28 sm:w-28 sm:text-5xl"
                              style={{ background: `linear-gradient(145deg, ${activeMe.from}, ${activeMe.to})` }}
                            >
                              {activeEmoji}
                            </div>
                            {activeSpeaking && (
                              <span className="absolute -inset-2 z-10 rounded-full ring-2 ring-emerald-400/40 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {active.admin && (
                          <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/80 shadow-lg shadow-black/40">
                            <Crown size={12} className="text-white" />
                          </span>
                        )}

                        {/* Name lockup */}
                        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 bg-gradient-to-t from-black/70 to-transparent">
                          <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[17px] font-bold leading-tight tracking-tight text-white">
                                {activeName}
                                <span className="ml-1.5 text-[11px] font-semibold text-white/35">You</span>
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-white/50">
                                <span
                                  className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
                                  style={{
                                    background: activeSpeaking ? "#34d399" : micActive ? "#3f3f46" : "#52525b",
                                  }}
                                />
                                {selfStatus}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Everyone else */}
                    {strip.length > 0 && (
                      <div className="w-full max-w-md px-1 sm:max-w-lg">
                        <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                          In this room · {strip.length}
                        </p>
                        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
                          {strip.map((p) => {
                            const isSpeaking = !!speakingMap[String(p.uid)];
                            const me = identityFor(p.displayName);
                            return (
                              <div
                                key={p.socketId}
                                className="flex w-14 shrink-0 flex-col items-center gap-1.5 animate-scale-in"
                              >
                                <div className="relative">
                                  <div
                                    className="relative flex h-11 w-11 items-center justify-center rounded-full text-base font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ring-2 ring-emerald-400/30 transition-all duration-300"
                                    style={{ background: me.solid }}
                                  >
                                    {p.avatar || p.displayName.charAt(0).toUpperCase()}
                                  </div>
                                  {isSpeaking && (
                                    <span className="absolute -inset-1 rounded-full ring-2 ring-emerald-400/60 animate-pulse" />
                                  )}
                                  {p.admin && (
                                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/80 ring-2 ring-[#0a0a0e]">
                                      <Crown size={8} className="text-white" />
                                    </span>
                                  )}
                                </div>
                                <span className="w-full truncate text-center text-[10px] font-medium text-zinc-400">
                                  {p.displayName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              </div>
            </div>

            {/* Floating control dock — transparent, circles float on their own */}
            <div className="pointer-events-none relative z-20 shrink-0 px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-3 md:pb-8 md:pt-5">
              <div className="pointer-events-auto mx-auto flex w-full max-w-xs items-center justify-center gap-3.5 md:max-w-sm md:gap-4">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!audioTrackRef.current || joining}
                  aria-label={micEnabled ? "Mute" : "Unmute"}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition duration-200 active:scale-95 md:h-14 md:w-14 ${
                    micActive
                      ? "bg-white/[0.09] text-emerald-400 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.07]"
                      : "bg-white/[0.09] text-zinc-200 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.07]"
                  } disabled:opacity-30`}
                >
                  {micEnabled ? <Mic size={19} /> : <MicOff size={19} />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowVolume((v) => !v)}
                  aria-label="Volume"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition duration-200 active:scale-95 md:h-14 md:w-14 ${
                    showVolume
                      ? "bg-white/[0.16] text-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.1]"
                      : "bg-white/[0.09] text-zinc-200 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.07]"
                  }`}
                >
                  <Volume2 size={19} />
                </button>

                {showVolume && (
                  <div className="absolute bottom-full left-1/2 mb-4 flex w-52 -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1C1C1E]/90 px-4 py-3 shadow-xl ring-1 ring-inset ring-white/[0.08] backdrop-blur-xl">
                    <Volume2 size={14} className="shrink-0 text-zinc-400" />
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={micVolume}
                      onChange={handleVolumeChange}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-[#0A84FF]"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-zinc-400">{micVolume}%</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowChat((c) => !c)}
                  aria-label={unreadCount > 0 ? `Chat, ${unreadCount} unread` : "Chat"}
                  className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition duration-200 active:scale-95 md:h-14 md:w-14 ${
                    showChat
                      ? "bg-white/[0.16] text-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.1]"
                      : "bg-white/[0.09] text-zinc-200 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.07]"
                  }`}
                >
                  <MessageSquare size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] animate-scale-in items-center justify-center rounded-full bg-[#0A84FF] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#070709]">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLeave}
                  aria-label="Leave room"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)] transition duration-200 hover:bg-red-500/90 active:scale-95 md:h-14 md:w-14"
                >
                  <PhoneOff size={19} />
                </button>
              </div>
            </div>
          </div>

          {/* Chat panel (slide-in) */}
          <div
            className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-[#070709] shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out md:static md:z-auto md:w-80 md:translate-x-0 md:border-l md:border-white/[0.07] md:shadow-none lg:w-96 ${
              showChat ? "translate-x-0" : "translate-x-full md:hidden"
            }`}
          >
            <div className="relative flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/[0.07]">
                <MessageSquare size={14} className="text-zinc-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-100">Chat</h2>
                <p className="text-[11px] text-zinc-500">{participants.length} in the room</p>
              </div>
              <button
                type="button"
                onClick={() => setShowChat(false)}
                aria-label="Close chat"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-zinc-400 ring-1 ring-inset ring-white/[0.07] transition active:scale-95"
              >
                <X size={13} />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-2 pt-3">
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end">
                {messages.length > 0 ? (
                  <div className="flex flex-col">
                    {messages.map((msg, i) => {
                      if (msg.system) {
                        return (
                          <div key={msg.id} className="my-3 flex justify-center">
                            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-zinc-500 ring-1 ring-inset ring-white/[0.04]">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }
                      const isSelf = msg.displayName === displayName;
                      const sender = participants.find((p) => p.displayName === msg.displayName);
                      const isSenderAdmin = sender?.admin;
                      const senderMe = identityFor(msg.displayName);
                      const prev = messages[i - 1];
                      const next = messages[i + 1];
                      const newGroup = !prev || prev.system || prev.displayName !== msg.displayName;
                      const endGroup = !next || next.system || next.displayName !== msg.displayName;

                      return (
                        <div
                          key={msg.id}
                          className={`msg-in flex items-end gap-2 ${isSelf ? "flex-row-reverse" : ""} ${
                            newGroup ? "mt-4" : "mt-1"
                          }`}
                        >
                          {/* Avatar on the last message of a run */}
                          <div className="w-7 shrink-0 self-end">
                            {!isSelf && endGroup && (
                              <div
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-inset ring-white/10"
                                style={{
                                  background: isSenderAdmin
                                    ? "linear-gradient(145deg, #4a4539, #544e41)"
                                    : senderMe.solid,
                                }}
                              >
                                {sender?.avatar || msg.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div
                            className={`flex min-w-0 max-w-[76%] flex-col ${
                              isSelf ? "items-end" : "items-start"
                            }`}
                          >
                            {!isSelf && newGroup && (
                              <div className="mb-1 flex items-center gap-1.5 pl-1">
                                <span className="text-[12px] font-semibold text-zinc-300">
                                  {msg.displayName}
                                </span>
                                {isSenderAdmin && <Crown size={9} className="text-amber-500/70" />}
                              </div>
                            )}
                            <div
                              className={`rounded-[20px] px-3.5 py-2 text-[15px] leading-[21px] break-words ${
                                isSelf
                                  ? "bg-[#0A84FF] text-white shadow-[0_2px_10px_rgba(10,132,255,0.22)]"
                                  : "bg-white/[0.07] text-zinc-200 ring-1 ring-inset ring-white/[0.06]"
                              } ${newGroup ? (isSelf ? "rounded-br-[9px]" : "rounded-bl-[9px]") : ""} ${
                                !endGroup ? (isSelf ? "rounded-br-[9px]" : "rounded-bl-[9px]") : ""
                              }`}
                            >
                              {renderMessageText(msg.text, isSelf)}
                            </div>
                            {endGroup && (
                              <span className="mt-1 px-1 text-[10px] tabular-nums text-zinc-600">
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/[0.06]">
                      <MessageSquare size={18} className="text-zinc-500" />
                    </div>
                    <p className="mt-4 text-[14px] font-semibold text-zinc-300">No messages yet</p>
                    <p className="mt-1 text-[12px] text-zinc-600">Say something to get things going</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {typingUsers.length > 0 && (
              <div className="relative px-4 pb-1.5 pt-1">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1.5 ring-1 ring-inset ring-white/[0.04]">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                  </div>
                  <p className="truncate text-[11px] text-zinc-500">
                    {typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.join(", ")} are typing`}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={sendMessage} className="relative shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
              <div className="relative mx-auto w-full max-w-3xl">
                {inputFocused && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handlePaste(); }}
                    className="absolute bottom-full left-0 mb-2 flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] font-medium text-zinc-400 ring-1 ring-inset ring-white/[0.07] backdrop-blur transition active:scale-95"
                  >
                    <Clipboard size={11} />
                    Paste
                  </button>
                )}
                <div className="flex items-end gap-2 rounded-[26px] bg-white/[0.07] py-1.5 pl-4 pr-1.5 ring-1 ring-inset ring-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_-14px_rgba(0,0,0,0.9)] transition-colors focus-within:bg-white/[0.09]">
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    rows={1}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                      if (socket && e.target.value) {
                        socket.emit("chat:typing", { typing: true });
                        if (typingTimersRef.current.self) clearTimeout(typingTimersRef.current.self);
                        typingTimersRef.current.self = setTimeout(() => { socket.emit("chat:typing", { typing: false }); }, 2000);
                      } else if (socket) { socket.emit("chat:typing", { typing: false }); }
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                    placeholder="Message"
                    maxLength={500}
                    className="max-h-24 min-w-0 flex-1 resize-none bg-transparent py-1 text-[15px] leading-[22px] text-white outline-none placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    aria-label="Send message"
                    className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                      chatInput.trim() ? "bg-[#0A84FF] text-white" : "bg-white/[0.06] text-zinc-600"
                    }`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
