import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { AlertCircle, Mic, MicOff, PhoneOff, Radio, Users, Wifi } from "lucide-react";
import { request } from "../lib/api.js";

function createUid() {
  return Math.floor(100000 + Math.random() * 900000000);
}

export default function CallRoom({ group, displayName, socket, config, onLeave }) {
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

  const micState = (() => {
    if (error || /error|denied|unavailable|failed/i.test(micStatus)) {
      return {
        label: "Mic issue",
        classes: "bg-fuchsia-900/70 text-fuchsia-100"
      };
    }

    if (micEnabled) {
      return {
        label: "Mic active",
        classes: "bg-emerald-900/70 text-emerald-100"
      };
    }

    return {
      label: "Mic muted",
      classes: "bg-indigo-900/70 text-indigo-100"
    };
  })();

  async function cleanupAgora() {
    const client = clientRef.current;
    const tracks = [audioTrackRef.current].filter(Boolean);

    if (client) {
      if (tracks.length) {
        try {
          await client.unpublish(tracks);
        } catch {
          // It is fine if the client is already unpublished.
        }
      }
      try {
        await client.leave();
      } catch {
        // It is fine if the client is already gone.
      }
      client.removeAllListeners?.();
    }

    tracks.forEach((track) => {
      try {
        track.stop();
        track.close();
      } catch {
        // Cleanup should never block leaving the room.
      }
    });

    clientRef.current = null;
    audioTrackRef.current = null;
    setJoined(false);
  }

  useEffect(() => {
    let disposed = false;

    function updatePresence(nextGroup) {
      if (nextGroup?.id === group.id) {
        setParticipants(nextGroup.participants || []);
      }
    }

    function handleDeleted(payload) {
      if (payload?.id === group.id) {
        setError("This group was closed by the admin.");
        cleanupAgora();
      }
    }

    function joinPresence() {
      if (!socket) {
        return Promise.resolve({ ok: false, error: "Presence server is not ready." });
      }

      return new Promise((resolve) => {
        const timer = window.setTimeout(
          () => resolve({ ok: false, error: "Could not reach the presence server." }),
          5000
        );

        socket.emit(
          "presence:join",
          {
            groupId: group.id,
            displayName,
            uid
          },
          (reply) => {
            window.clearTimeout(timer);
            resolve(reply);
          }
        );
      });
    }

    async function startCall() {
      if (!socket) {
        setStatus("Waiting for presence server");
        setJoining(true);
        return;
      }

      try {
        setJoining(true);
        setError("");
        setStatus("Connecting");

        const presence = await joinPresence();
        if (!presence.ok) {
          throw new Error(presence.error || "Could not join this group.");
        }
        setParticipants(presence.group?.participants || []);

        if (!config.agoraAppId) {
          setStatus("Waiting for Agora credentials");
          return;
        }

        setStatus("Starting voice");
        const tokenResponse = await request("/api/agora/token", {
          method: "POST",
          body: { groupId: group.id, uid }
        });

        if (disposed) {
          return;
        }

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        client.on("user-published", async (user, mediaType) => {
          if (mediaType !== "audio") {
            return;
          }

          await client.subscribe(user, mediaType);
          user.audioTrack?.play();
        });

        let audioTrack = null;
        try {
          setMicStatus("Requesting microphone permission");
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "speech_standard"
          });
          setMicStatus("");
        } catch (err) {
          setMicEnabled(false);
          setMicStatus(
            err?.message
              ? `Microphone error: ${err.message}`
              : "Microphone unavailable or permission denied"
          );
        }

        if (disposed) {
          audioTrack?.close();
          return;
        }

        await client.join(
          tokenResponse.appId,
          tokenResponse.channelName,
          tokenResponse.token || null,
          tokenResponse.uid
        );

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
        if (!disposed) {
          setJoining(false);
        }
      }
    }

    socket?.on("presence:update", updatePresence);
    socket?.on("group:deleted", handleDeleted);
    startCall();

    return () => {
      disposed = true;
      socket?.off("presence:update", updatePresence);
      socket?.off("group:deleted", handleDeleted);
      socket?.emit("presence:leave", { groupId: group.id });
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
    if (!track) {
      return;
    }

    const next = !micEnabled;
    try {
      await track.setEnabled(next);
      setMicEnabled(next);
      setMicStatus("");
    } catch (err) {
      setError(err.message || "Could not change microphone state.");
      setMicStatus("Microphone control failed");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
              <Radio size={18} aria-hidden="true" />
              MySpeak
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 text-sm font-medium text-slate-100">
              <Wifi size={16} aria-hidden="true" />
              {status}
            </span>
            <button
              type="button"
              onClick={handleLeave}
              title="Leave group"
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              <PhoneOff size={17} aria-hidden="true" />
              Leave
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-3xl border border-fuchsia-600 bg-fuchsia-900/70 px-4 py-3 text-sm text-fuchsia-100">
            <AlertCircle className="mt-0.5 shrink-0 text-fuchsia-100" size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Voice room</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {joined ? "Audio is connected." : "Joining voice..."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${micState.classes}`}
                    >
                      {micState.label}
                    </span>
                    {micStatus ? (
                      <span className="text-sm text-slate-400">{micStatus}</span>
                    ) : null}
                  </div>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-100">
                  {micEnabled ? <Mic size={21} aria-hidden="true" /> : <MicOff size={21} aria-hidden="true" />}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {participants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="flex h-16 items-center justify-between gap-3 rounded-3xl bg-slate-800 px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {participant.displayName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {Number(participant.uid) === uid ? "You" : "Connected"}
                      </p>
                    </div>
                    <Mic size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">People</h2>
              <span className="inline-flex h-7 items-center gap-1 rounded-2xl bg-slate-800 px-2 text-xs font-semibold text-slate-300">
                <Users size={14} aria-hidden="true" />
                {participants.length}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.socketId}
                  className="flex h-10 items-center justify-between gap-3 rounded-2xl bg-slate-800 px-3"
                >
                  <span className="truncate text-sm font-medium text-slate-100">
                    {participant.displayName}
                  </span>
                  {Number(participant.uid) === uid && (
                    <span className="text-xs font-semibold text-sky-300">You</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={toggleMic}
                disabled={!audioTrackRef.current || joining}
                title={micEnabled ? "Mute mic" : "Unmute mic"}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {micEnabled ? <Mic size={19} aria-hidden="true" /> : <MicOff size={19} aria-hidden="true" />}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}