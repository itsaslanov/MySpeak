import React, { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { AlertCircle, ArrowLeft, Crown, LogOut, MessageSquare, Mic, MicOff, PhoneOff, UserMinus, Users, Volume2, X, Clipboard } from "lucide-react";
import { request, getAdminToken } from "../lib/api";
import { useVoiceAnnounce } from "../hooks/useVoiceAnnounce";
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
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
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
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowChat(false);
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

  const [allGroups, setAllGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handler = (groups: Group[]) => setAllGroups(groups);
    socket.on("groups:update", handler);
    return () => { socket.off("groups:update", handler); };
  }, [socket]);

  const [showMembers, setShowMembers] = useState(false);

  return (
    <main className="h-dvh bg-[#060608] flex">
      {error && (
        <div className="absolute top-3 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400 shadow-lg shadow-red-500/5">
          <AlertCircle className="mt-0.5 shrink-0" size={13} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex w-64 shrink-0 flex-col bg-[#0a0a0c]">
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-white/[0.04]">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-zinc-400">MySpeak</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Voice Rooms</div>
          <div className="px-2 space-y-0.5">
            {allGroups.map((g) => (
              <div
                key={g.id}
                className={`relative flex items-center px-3 py-2 rounded-lg transition cursor-default overflow-hidden ${
                  g.id === group.id ? "bg-accent/10" : "hover:bg-white/[0.03]"
                }`}
              >
                {g.id === group.id && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-accent" />}
                <span className={`truncate text-[13px] ${g.id === group.id ? "text-zinc-200 font-medium" : "text-zinc-500"}`}>
                  {g.name}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {g.id === group.id && <span className={`h-2 w-2 rounded-full ${joined ? "bg-emerald-500" : "bg-amber-500"}`} />}
                  <span className="text-[10px] text-zinc-700">{g.count}/{g.maxUsers}</span>
                </div>
              </div>
            ))}
            {allGroups.length === 0 && <div className="px-3 py-8 text-center text-[11px] text-zinc-700">No rooms</div>}
          </div>

          {participants.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Online — {participants.length}</div>
              <div className="px-2 space-y-0.5">
                {participants.map((p) => (
                  <div key={p.socketId} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      p.admin ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.04] text-zinc-500"
                    }`}>
                      {p.avatar || p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className={`truncate text-[13px] ${p.admin ? "text-amber-400 font-medium" : "text-zinc-400"}`}>
                      {p.displayName}
                    </span>
                    {Number(p.uid) === uid && <span className="text-[9px] text-zinc-700">You</span>}
                    {p.admin && <Crown size={10} className="text-amber-500/60" />}
                    {isAdmin && !p.admin && Number(p.uid) !== uid && (
                      <button onClick={() => handleKick(p.socketId)} className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-zinc-700 opacity-0 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400">
                        <UserMinus size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-[#0d0d10] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0d0d10]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-zinc-200">{displayName}</div>
              <div className="text-[10px] text-zinc-600">Voice connected</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!audioTrackRef.current || joining}
              className={`flex flex-1 items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-medium transition ${
                micActive ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15" : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.07]"
              } disabled:opacity-30`}
            >
              {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              {micEnabled ? "Mute" : "Unmute"}
            </button>
            <button
              type="button"
              onClick={() => setShowVolume((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                showVolume ? "bg-white/[0.08] text-zinc-300" : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.07] hover:text-zinc-400"
              }`}
            >
              <Volume2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleLeave}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <PhoneOff size={14} />
            </button>
          </div>
          {showVolume && (
            <div className="flex items-center gap-2 px-1 mt-2">
              <input type="range" min="0" max="200" value={micVolume} onChange={handleVolumeChange} className="h-[3px] w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-accent" />
              <span className="w-7 shrink-0 text-right text-[9px] text-zinc-600">{micVolume}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-6 h-14 border-b border-white/[0.04] shrink-0">
          <h1 className="text-[15px] font-bold text-zinc-100 tracking-tight">{group.name}</h1>
          <span className="text-[11px] text-zinc-600">— {status}</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/8">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-400">{participants.length} online</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {messages.length > 0 ? (
                <div className="space-y-0.5">
                  {messages.map((msg, i) => {
                    if (msg.system) {
                      return (
                        <div key={msg.id} className="flex justify-center py-2">
                          <span className="text-[10px] text-zinc-700">{msg.text}</span>
                        </div>
                      );
                    }
                    const isSelf = msg.displayName === displayName;
                    const sender = participants.find((p) => p.displayName === msg.displayName);
                    const isSenderAdmin = sender?.admin;
                    const senderAvatar = sender?.avatar;
                    const showHeader = i === 0 || messages[i - 1]?.system || messages[i - 1]?.displayName !== msg.displayName;
                    return (
                      <div key={msg.id} className={`flex gap-3 px-2 py-1 rounded-lg transition hover:bg-white/[0.01] ${showHeader ? "mt-4" : ""}`}>
                        {showHeader && (
                          <div className="shrink-0 mt-0.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                              isSenderAdmin ? "bg-amber-500/10 text-amber-400" : "bg-accent/10 text-accent"
                            }`}>
                              {senderAvatar || msg.displayName.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                        <div className={`min-w-0 flex-1 ${showHeader ? "" : "ml-12"}`}>
                          {showHeader && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[14px] font-semibold ${isSenderAdmin ? "text-amber-400" : "text-zinc-200"}`}>
                                {msg.displayName}
                              </span>
                              {isSenderAdmin && <Crown size={10} className="text-amber-500/60" />}
                              <span className="text-[10px] text-zinc-700">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          )}
                          <div className="text-[14px] leading-relaxed text-zinc-400 break-words">{renderMessageText(msg.text)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03]">
                    <MessageSquare size={18} className="text-zinc-700" />
                  </div>
                  <p className="mt-3 text-xs font-medium text-zinc-600">No messages yet</p>
                  <p className="mt-1 text-[10px] text-zinc-700">Be the first to say something</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-6 py-2">
                <div className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-[11px] text-zinc-600">{typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.join(" and ")} are typing`}</p>
              </div>
            )}

            <form onSubmit={sendMessage} className="px-6 pb-4 pt-2 shrink-0">
              {inputFocused && (
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handlePaste(); }} className="absolute bottom-full mb-2 flex items-center gap-2 rounded-lg bg-[#0c0c10] px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/[0.06] transition hover:text-zinc-400">
                  <Clipboard size={11} />
                  Paste
                </button>
              )}
              <div className="flex items-end gap-2 rounded-xl bg-[#0e0e12] px-4 ring-1 ring-white/[0.05] focus-within:ring-accent/20 transition">
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
                  className="max-h-28 min-w-0 flex-1 resize-none bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-700 leading-relaxed py-3"
                />
                <button type="submit" disabled={!chatInput.trim()} className="mb-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 disabled:opacity-20 disabled:bg-zinc-800 disabled:text-zinc-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
