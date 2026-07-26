import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { AlertCircle, ArrowLeft, Crown, MessageSquare, Mic, MicOff, PhoneOff, Send, Users, Volume2, Pencil, X, Check } from "lucide-react";
import { request, getAdminToken } from "../lib/api.js";

function createUid() {
  return Math.floor(100000 + Math.random() * 900000000);
}

const ParticipantBubble = React.memo(function ParticipantBubble({ participant, isSelf, speaking }) {
  const isParticipantAdmin = participant.admin;
  return (
    <div className="flex flex-col items-center gap-1 animate-scale-in">
      <div className="relative">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold transition duration-300 ${
            speaking ? "speaking-glow" : ""
          } ${
            isSelf
              ? "bg-accent text-white shadow-md shadow-accent/20"
              : isParticipantAdmin
                ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                : "bg-surface-3 text-zinc-300"
          }`}
        >
          {participant.avatar || participant.displayName.charAt(0).toUpperCase()}
        </div>
        {isParticipantAdmin && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-sm">
            <Crown size={9} className="text-white" />
          </div>
        )}
      </div>
      <span className={`max-w-[3.5rem] truncate text-[10px] ${isParticipantAdmin ? "text-amber-400" : "text-zinc-400"}`}>
        {participant.displayName}
      </span>
      {isSelf && (
        <span className="text-[8px] font-semibold uppercase tracking-wider text-accent">You</span>
      )}
    </div>
  );
});

export default function CallRoom({ group, displayName, avatar, socket, config, passcode, onLeave }) {
  const uid = useMemo(createUid, []);
  const clientRef = useRef(null);
  const audioTrackRef = useRef(null);
  const [participants, setParticipants] = useState(group.participants || []);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [micStatus, setMicStatus] = useState("Checking microphone");
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState("");
  const [micVolume, setMicVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(true);
  const showChatRef = useRef(showChat);
  const chatEndRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimersRef = useRef({});
  const isAdmin = !!getAdminToken();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserList, setShowUserList] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(displayName);
  const [speakingMap, setSpeakingMap] = useState({});

  const micActive = !error && !/error|denied|unavailable|failed/i.test(micStatus) && micEnabled;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (showUserList) setShowUserList(false);
        else if (showChat) setShowChat(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat, showUserList]);

  async function cleanupAgora() {
    const client = clientRef.current;
    const tracks = [audioTrackRef.current].filter(Boolean);
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

  function handleChatMessage(msg) {
    if (msg?.system || msg?.displayName) {
      setMessages((prev) => [...prev, msg]);
      if (!showChatRef.current) setUnreadCount((c) => c + 1);
    }
  }

  function handleTyping({ displayName: name, typing }) {
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
    socket.emit("presence:rename", { displayName: trimmed }, (reply) => {
      if (reply?.ok) {
        localStorage.setItem("myspeak:display-name", trimmed);
        setEditingName(false);
      }
    });
  }

  useEffect(() => {
    let disposed = false;
    let deleteTimer = null;

    function updatePresence(nextGroup) {
      if (nextGroup?.id === group.id) {
        setParticipants(nextGroup.participants || []);
      }
    }

    function handleDeleted(payload) {
      if (payload?.id === group.id) {
        setError("This room was closed by the admin.");
        cleanupAgora();
        deleteTimer = setTimeout(() => onLeave(), 1500);
      }
    }

    function joinPresence() {
      if (!socket) {
        return Promise.resolve({ ok: false, error: "Presence server is not ready." });
      }
      return new Promise((resolve) => {
        const timer = window.setTimeout(
          () => resolve({ ok: false, error: "Could not reach the presence server." }), 5000
        );
        socket.emit("presence:join", { groupId: group.id, displayName, uid, passcode, adminToken: getAdminToken(), avatar }, (reply) => {
          window.clearTimeout(timer);
          resolve(reply);
        });
      });
    }

    async function loadChatHistory() {
      if (!socket) return;
      socket.emit("chat:history", { groupId: group.id }, (reply) => {
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
        const tokenResponse = await request("/api/agora/token", {
          method: "POST",
          body: { groupId: group.id, uid }
        });
        if (disposed) return;
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        client.enableAudioVolumeIndicator();
        clientRef.current = client;
        client.on("user-published", async (user, mediaType) => {
          if (mediaType !== "audio") return;
          await client.subscribe(user, mediaType);
          user.audioTrack?.play();
        });
        client.on("volume-indicator", (volumes) => {
          if (disposed) return;
          const next = {};
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
        let audioTrack = null;
        try {
          setMicStatus("Requesting mic permission");
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
          setMicStatus("");
        } catch (err) {
          setMicEnabled(false);
          setMicStatus(err?.message ? `Mic error: ${err.message}` : "Microphone unavailable");
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
        setError(err.message);
        setStatus("Disconnected");
      } finally {
        if (!disposed) setJoining(false);
      }
    }

    socket?.on("presence:update", updatePresence);
    socket?.on("group:deleted", handleDeleted);
    socket?.on("chat:message", handleChatMessage);
    socket?.on("chat:typing", handleTyping);
    socket?.on("chat:cleared", handleCleared);
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
      setError(err.message || "Could not change mic state.");
      setMicStatus("Mic control failed");
    }
  }

  async function handleVolumeChange(e) {
    const level = Number(e.target.value);
    setMicVolume(level);
    const track = audioTrackRef.current;
    if (track) {
      try { await track.setVolume(level); } catch {}
    }
  }

  function sendMessage(e) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket) return;
    socket.emit("chat:send", { text }, (reply) => {
      if (!reply?.ok) setError(reply?.error || "Failed to send.");
    });
    socket.emit("chat:typing", { typing: false });
    if (typingTimersRef.current.self) clearTimeout(typingTimersRef.current.self);
    setChatInput("");
  }

  return (
    <main className="h-dvh">
      <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-stretch lg:gap-5 lg:py-5">
        {error && (
          <div className="mb-3 flex w-full items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400 lg:absolute lg:top-4 lg:left-1/2 lg:max-w-md lg:-translate-x-1/2">
            <AlertCircle className="mt-0.5 shrink-0" size={13} />
            <span>{error}</span>
          </div>
        )}

        <div className={`flex flex-1 flex-col ${showChat ? "hidden lg:flex" : "flex"} lg:w-72 xl:w-80 lg:shrink-0`}>
          <div className="w-full overflow-hidden rounded-2xl border border-zinc-800/50 bg-surface-2">
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleLeave}
                  title="Go back"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-zinc-400 transition hover:text-zinc-300"
                >
                  <ArrowLeft size={13} />
                </button>
                <div>
                  <h1 className="text-xs font-semibold text-zinc-100">{group.name}</h1>
                  <div className="flex items-center gap-1">
                    {editingName ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          maxLength={32}
                          className="h-4 w-24 rounded bg-surface-3 px-1.5 text-[10px] text-zinc-200 outline-none focus:ring-1 focus:ring-accent/30"
                        />
                        <button type="submit" className="text-emerald-400 hover:text-emerald-300"><Check size={10} /></button>
                        <button type="button" onClick={() => { setEditingName(false); setNewName(displayName); }} className="text-zinc-500 hover:text-zinc-300"><X size={10} /></button>
                      </form>
                    ) : (
                      <>
                        <span className="text-[10px] text-zinc-500">{displayName}</span>
                        <button type="button" onClick={() => setEditingName(true)} className="text-zinc-600 transition hover:text-zinc-400">
                          <Pencil size={8} />
                        </button>
                      </>
                    )}
                    <span className={`h-1 w-1 rounded-full ${joined ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="text-[10px] text-zinc-500">
                      {joined ? `${participants.length} speaking` : status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowChat(true)}
                  className={`hidden lg:flex h-6 w-6 items-center justify-center rounded-md transition ${
                    showChat ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-400"
                  }`}
                >
                  <MessageSquare size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUserList((v) => !v); if (!showUserList) setShowChat(false); }}
                  className={`flex h-6 items-center gap-1 rounded-md bg-surface-3 px-1.5 text-[10px] text-zinc-500 transition hover:text-zinc-400 ${
                    showUserList ? "text-accent" : ""
                  }`}
                >
                  <Users size={9} />
                  {participants.length}
                </button>
              </div>
            </div>

            <div className="px-3 py-4 sm:px-4 sm:py-5 lg:py-3">
              {participants.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-4">
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
                <div className="flex flex-col items-center py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3">
                    <Users size={16} className="text-zinc-600" />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">Waiting for others...</p>
                </div>
              )}
              {micStatus && (
                <p className="mt-3 text-center text-[10px] text-zinc-600">{micStatus}</p>
              )}
            </div>
          </div>

          {showVolume && (
            <div className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-zinc-800/50 bg-surface-2 px-3 py-2.5">
              <Volume2 size={13} className="shrink-0 text-zinc-500" />
              <input
                type="range"
                min="0"
                max="200"
                value={micVolume}
                onChange={handleVolumeChange}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-accent"
              />
              <span className="w-8 shrink-0 text-right text-[10px] text-zinc-500">{micVolume}%</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowVolume((v) => !v)}
              title="Mic volume"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                showVolume
                  ? "border border-accent/30 bg-accent/10 text-accent"
                  : "border border-zinc-800/50 bg-surface-2 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              <Volume2 size={16} />
            </button>
            <button
              type="button"
              onClick={toggleMic}
              disabled={!audioTrackRef.current || joining}
              title={micEnabled ? "Mute" : "Unmute"}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                micActive
                  ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-surface-2 text-zinc-500 hover:bg-zinc-800"
              } border border-zinc-800/50 disabled:opacity-30`}
            >
              {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button
              type="button"
              onClick={handleLeave}
              title="Leave room"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20"
            >
              <PhoneOff size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800/50 bg-surface-2 text-zinc-500 transition hover:bg-zinc-800 lg:hidden"
            >
              <MessageSquare size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800/50 bg-surface-2 lg:w-96 xl:w-[28rem] lg:flex-1 ${showChat ? "flex" : "hidden lg:flex"}`}>
          <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <MessageSquare size={12} className="text-zinc-500" />
              <h2 className="text-[11px] font-semibold text-zinc-400">Chat</h2>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 lg:hidden"
              >
                <ArrowLeft size={12} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {messages.length > 0 ? (
              <div className="space-y-1.5">
                {messages.map((msg, i) => {
                  if (msg.system) {
                    return (
                      <div key={msg.id} className="flex justify-center py-1.5 animate-fade-in">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                          msg.type === "join"
                            ? "bg-emerald-500/10 text-emerald-400/80"
                            : "bg-red-500/10 text-red-400/80"
                        }`}>
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
                    <div key={msg.id} className={`animate-fade-in ${isSelf ? "flex justify-end" : "flex justify-start"} ${showHeader ? "mt-2.5" : "mt-0.5"}`}>
                      <div className={`max-w-[85%] ${isSelf ? "items-end" : "items-start"} flex flex-col`}>
                        {showHeader && (
                          <div className={`flex items-center gap-1.5 mb-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
                            {!isSelf && senderAvatar && (
                              <span className="text-sm leading-none">{senderAvatar}</span>
                            )}
                            {isSenderAdmin && (
                              <Crown size={10} className="text-amber-400" />
                            )}
                            <span className={`text-[11px] font-semibold ${isSenderAdmin ? "text-amber-400" : "text-zinc-300"}`}>
                              {isSelf ? "You" : msg.displayName}
                            </span>
                            <span className="text-[9px] text-zinc-600">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                          isSenderAdmin && !isSelf
                            ? "bg-amber-500/10 text-zinc-200 rounded-bl-md ring-1 ring-amber-500/20"
                            : isSelf
                              ? "bg-accent/15 text-zinc-200 rounded-br-md"
                              : "bg-zinc-800/60 text-zinc-300 rounded-bl-md"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/50">
                  <MessageSquare size={18} className="text-zinc-600" />
                </div>
                <p className="mt-3 text-xs text-zinc-500">No messages yet</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">Say something to start the conversation</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-[11px] text-zinc-500">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing`
                  : `${typingUsers.join(" and ")} are typing`}
              </p>
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-zinc-800/50 px-3 py-3 sm:px-4">
              <input
                type="text"
                value={chatInput}
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
                }}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 rounded-xl bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-accent/30"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent/90 disabled:opacity-30"
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {showUserList && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800/50 bg-surface-2 lg:w-64 lg:flex-none">
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Users size={12} className="text-zinc-500" />
                <h2 className="text-[11px] font-semibold text-zinc-400">Members ({participants.length})</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowUserList(false)}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 lg:hidden"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
              <div className="space-y-1">
                {participants.map((p) => (
                  <div key={p.socketId} className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-zinc-800/40">
                    <div className="relative">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition duration-300 ${
                        speakingMap[String(p.uid)] ? "speaking-glow" : ""
                      } ${
                        p.admin ? "bg-amber-500/15 ring-1 ring-amber-500/30" : "bg-surface-3"
                      }`}>
                        {p.avatar || p.displayName.charAt(0).toUpperCase()}
                      </div>
                      {p.admin && (
                        <div className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500">
                          <Crown size={7} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={`truncate text-[11px] font-medium ${p.admin ? "text-amber-400" : "text-zinc-300"}`}>
                          {p.displayName}
                        </span>
                        {Number(p.uid) === uid && (
                          <span className="text-[8px] font-bold text-accent">YOU</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
