import React, { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { AlertCircle, ArrowLeft, Crown, LogOut, MessageSquare, Mic, MicOff, PhoneOff, Send, UserMinus, Users, Volume2, X, Clipboard } from "lucide-react";
import { request, getAdminToken } from "../lib/api";
import type { Group, Participant, ChatMessage, Config, AgoraTokenResponse } from "../types";
import type { Socket } from "socket.io-client";

AgoraRTC.setLogLevel(4);

function createUid() {
  return Math.floor(100000 + Math.random() * 900000000);
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
              ? "bg-accent/15 text-accent ring-1 ring-accent/25"
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

type SidebarTab = "room" | "members";

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
  const [showChat, setShowChat] = useState(true);
  const showChatRef = useRef(showChat);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimersRef = useRef<{ self?: ReturnType<typeof setTimeout> }>({});
  const isAdmin = !!getAdminToken();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("room");
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  const micActive = !error && !/error|denied|unavailable|failed/i.test(micStatus) && micEnabled;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (sidebarTab === "members") setSidebarTab("room");
        else if (showChat) setShowChat(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat, sidebarTab]);

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
          setMessages(reply.messages);
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

  function renderMessageText(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-accent hover:text-accent/80 transition-colors">
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

  return (
    <main className="h-dvh bg-[#060608]">
      <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-2 py-2 sm:px-4 sm:py-3 lg:flex-row lg:items-stretch lg:gap-3 lg:py-3">
        {error && (
          <div className="mb-2 flex w-full items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-400 lg:absolute lg:top-3 lg:left-1/2 lg:max-w-md lg:-translate-x-1/2">
            <AlertCircle className="mt-0.5 shrink-0" size={13} />
            <span>{error}</span>
          </div>
        )}

        <div className={`flex flex-1 flex-col min-h-0 ${showChat ? "hidden lg:flex" : "flex"} lg:w-72 xl:w-80 lg:shrink-0`}>
          <div className="flex flex-1 flex-col overflow-hidden bg-[#0c0c10] min-h-0 rounded-2xl ring-1 ring-white/[0.04]">
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]">
                  <Users size={16} className="text-zinc-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm font-bold text-zinc-100 tracking-tight truncate">{group.name}</h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${joined ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="text-[10px] text-zinc-600">
                      {joined ? `${participants.length} online` : status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLeave}
                  title="Leave room"
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-red-500/10 text-red-400 px-3 text-[11px] font-medium transition hover:bg-red-500/15"
                >
                  <LogOut size={13} />
                  Leave
                </button>
              </div>
            </div>

            <div className="flex items-center border-b border-white/[0.04]">
              <button
                type="button"
                onClick={() => setSidebarTab("room")}
                className={`flex-1 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider transition ${
                  sidebarTab === "room" ? "text-zinc-300 border-b border-zinc-400" : "text-zinc-600 hover:text-zinc-500"
                }`}
              >
                Room
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("members")}
                className={`flex-1 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider transition ${
                  sidebarTab === "members" ? "text-zinc-300 border-b border-zinc-400" : "text-zinc-600 hover:text-zinc-500"
                }`}
              >
                Members ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="relative flex h-8 items-center justify-center rounded-xl px-3 text-zinc-600 transition hover:text-zinc-400 lg:hidden"
              >
                <MessageSquare size={14} />
                {unreadCount > 0 && (
                  <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-5">
              {sidebarTab === "room" ? (
                <>
                  {participants.length > 0 ? (
                    <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
                      {participants.map((p) => (
                        <ParticipantBubble
                          key={p.socketId}
                          participant={p}
                          isSelf={Number(p.uid) === uid}
                          speaking={!!speakingMap[String(p.uid)]}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.04]">
                        <Users size={20} className="text-zinc-700" />
                      </div>
                      <p className="mt-3 text-[11px] text-zinc-600">Waiting for others...</p>
                    </div>
                  )}
                  {micStatus && (
                    <p className="mt-5 text-center text-[11px] text-zinc-700">{micStatus}</p>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  {participants.map((p) => (
                    <div key={p.socketId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.02]">
                      <div className="relative">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition duration-300 ${
                          speakingMap[String(p.uid)] ? "speaking-glow" : ""
                        } ${
                          p.admin ? "bg-amber-500/10 ring-1 ring-amber-500/20" : "bg-white/[0.04] ring-1 ring-white/[0.04]"
                        }`}>
                          {p.avatar || p.displayName.charAt(0).toUpperCase()}
                        </div>
                        {p.admin && (
                          <div className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500">
                            <Crown size={8} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`truncate text-xs font-medium ${p.admin ? "text-amber-400" : "text-zinc-400"}`}>
                            {p.displayName}
                          </span>
                          {Number(p.uid) === uid && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">You</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && !p.admin && Number(p.uid) !== uid && (
                        <button
                          type="button"
                          onClick={() => handleKick(p.socketId)}
                          title="Kick"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          <UserMinus size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showVolume && (
            <div className="mt-2.5 flex w-full items-center gap-3 rounded-xl bg-[#0c0c10] px-4 py-3 ring-1 ring-white/[0.04]">
              <Volume2 size={14} className="shrink-0 text-zinc-600" />
              <input
                type="range"
                min="0"
                max="200"
                value={micVolume}
                onChange={handleVolumeChange}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-accent"
              />
              <span className="w-9 shrink-0 text-right text-[11px] text-zinc-600">{micVolume}%</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-3.5 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={() => setShowVolume((v) => !v)}
              title="Mic volume"
              className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition ${
                showVolume
                  ? "bg-white/15 text-white ring-1 ring-white/20 shadow-lg shadow-white/5"
                  : "bg-white/[0.06] text-zinc-400 ring-1 ring-white/[0.08] hover:bg-white/[0.1] hover:text-zinc-300"
              }`}
            >
              <Volume2 size={18} />
            </button>
            <button
              type="button"
              onClick={toggleMic}
              disabled={!audioTrackRef.current || joining}
              title={micEnabled ? "Mute" : "Unmute"}
              className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition ${
                micActive
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/30 shadow-lg shadow-emerald-500/20 hover:bg-emerald-500/25"
                  : "bg-white/15 text-white ring-1 ring-white/20 shadow-lg shadow-white/5 hover:bg-white/20"
              } disabled:opacity-30`}
            >
              {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <button
              type="button"
              onClick={handleLeave}
              title="Leave room"
              className="flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md bg-red-500/20 text-red-400 ring-1 ring-red-400/30 shadow-lg shadow-red-500/20 transition hover:bg-red-500/25"
            >
              <PhoneOff size={22} />
            </button>
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md bg-white/[0.06] text-zinc-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-zinc-300 lg:hidden"
            >
              <MessageSquare size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/30">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0c10] rounded-2xl ring-1 ring-white/[0.04] lg:w-96 xl:w-[28rem] lg:flex-1 ${showChat ? "flex" : "hidden lg:flex"}`}>
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MessageSquare size={14} className="text-zinc-600" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Chat</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="flex h-7 items-center gap-1.5 rounded-xl px-2.5 text-[10px] text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-zinc-600 hover:text-zinc-400 lg:hidden"
              >
                <ArrowLeft size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {messages.length > 0 ? (
              <div className="space-y-2">
                {messages.map((msg, i) => {
                  if (msg.system) {
                    return (
                      <div key={msg.id} className="flex justify-center py-1.5 animate-fade-in">
                        <span className="text-[10px] text-zinc-700">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  const isSelf = msg.displayName === displayName;
                  const sender = participants.find((p) => p.displayName === msg.displayName);
                  const isSenderAdmin = sender?.admin;
                  const senderAvatar = sender?.avatar;
                  const showHeader = i === 0
                    || messages[i - 1]?.system
                    || messages[i - 1]?.displayName !== msg.displayName;

                  return (
                    <div key={msg.id} className={`animate-fade-in ${isSelf ? "flex justify-end" : "flex justify-start"} ${showHeader ? "mt-3" : "mt-1"}`}>
                      <div className={`max-w-[85%] min-w-0 ${isSelf ? "items-end" : "items-start"} flex flex-col`}>
                        {showHeader && (
                          <div className={`inline-flex items-center gap-1.5 mb-1 ${isSelf ? "flex-row-reverse ml-auto" : ""}`}>
                            {senderAvatar && (
                              <span className="text-xs leading-none">{senderAvatar}</span>
                            )}
                            {isSenderAdmin && (
                              <Crown size={8} className="text-amber-500/60" />
                            )}
                            <span className={`text-[10px] font-medium ${isSenderAdmin ? "text-amber-500/70" : "text-zinc-500"}`}>
                              {isSelf ? "You" : msg.displayName}
                            </span>
                            <span className="text-[9px] text-zinc-700">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        <div className={`break-words break-all rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                          isSenderAdmin && !isSelf
                            ? "bg-amber-500/5 text-zinc-300 rounded-bl-md ring-1 ring-amber-500/10"
                            : isSelf
                              ? "bg-accent/10 text-zinc-300 rounded-br-md"
                              : "bg-white/[0.03] text-zinc-400 rounded-bl-md ring-1 ring-white/[0.04]"
                        }`}>
                          {renderMessageText(msg.text)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.04]">
                  <MessageSquare size={18} className="text-zinc-700" />
                </div>
                <p className="mt-3 text-xs font-medium text-zinc-600">No messages yet</p>
                <p className="mt-1 text-[10px] text-zinc-700">Say something to start</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2.5 px-4 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-[10px] text-zinc-600">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing`
                  : `${typingUsers.join(" and ")} are typing`}
              </p>
            </div>
          )}

          <form onSubmit={sendMessage} className="relative flex items-center gap-2.5 border-t border-white/[0.04] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
              {inputFocused && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handlePaste(); }}
                  className="absolute -top-11 left-4 flex items-center gap-2 rounded-xl bg-[#0c0c10] px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/[0.06] transition hover:text-zinc-400 animate-fade-in"
                >
                  <Clipboard size={12} />
                  Paste
                </button>
              )}
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
                    typingTimersRef.current.self = setTimeout(() => {
                      socket.emit("chat:typing", { typing: false });
                    }, 2000);
                  } else if (socket) {
                    socket.emit("chat:typing", { typing: false });
                  }
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder="Type a message..."
                maxLength={500}
                className="max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 ring-1 ring-white/[0.04] focus:ring-accent/20"
              />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="flex h-10 w-10 items-center justify-center shrink-0 rounded-2xl bg-accent/15 text-accent transition hover:bg-accent/20 disabled:opacity-20"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
