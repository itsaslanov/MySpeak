import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { LogOut, Radio, RefreshCw, Users } from "lucide-react";
import { request, SOCKET_URL } from "../lib/api.js";
import CallRoom from "./CallRoom.jsx";
import NameModal from "./NameModal.jsx";

export default function HomePage() {
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("myspeak:display-name") || ""
  );
  const [groups, setGroups] = useState([]);
  const [config, setConfig] = useState({ agoraAppId: "", tokenEnabled: false });
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  const visibleGroups = useMemo(() => groups.filter((group) => !group.isFull), [groups]);

  async function loadInitialData() {
    try {
      setError("");
      const [configResponse, groupResponse] = await Promise.all([
        request("/api/config"),
        request("/api/groups")
      ]);
      setConfig(configResponse);
      setGroups(groupResponse.groups || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("groups:update", (nextGroups) => {
      setGroups(nextGroups || []);
      setActiveGroup((current) =>
        current ? (nextGroups || []).find((group) => group.id === current.id) || current : current
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function saveDisplayName(name) {
    localStorage.setItem("myspeak:display-name", name);
    setDisplayName(name);
  }

  function resetDisplayName() {
    localStorage.removeItem("myspeak:display-name");
    setDisplayName("");
  }

  if (activeGroup) {
    return (
      <CallRoom
        config={config}
        displayName={displayName}
        group={activeGroup}
        socket={socketRef.current}
        onLeave={() => setActiveGroup(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {!displayName && <NameModal onSave={saveDisplayName} />}
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
              <Radio size={18} aria-hidden="true" />
              MySpeak
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-100">
              Available voice groups
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {displayName && (
              <button
                type="button"
                onClick={resetDisplayName}
                title="Change name"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm font-medium text-slate-100 transition hover:border-slate-700"
              >
                <LogOut size={16} aria-hidden="true" />
                {displayName}
              </button>
            )}
            <a
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Admin
            </a>
          </div>
        </header>

        <section className="flex flex-1 flex-col py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-fuchsia-700 bg-fuchsia-900/50 px-4 py-3 text-sm text-fuchsia-100">
              {error}
            </div>
          )}

          {!config.agoraAppId && (
            <div className="mb-4 rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-3 text-sm text-sky-100">
              Add AGORA_APP_ID in `.env` to enable real calls. The group UI and presence still work.
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {visibleGroups.length} open group{visibleGroups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={loadInitialData}
              title="Refresh groups"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-100 transition hover:border-slate-700"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900"
                />
              ))}
            </div>
          ) : visibleGroups.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleGroups.map((group) => (
                <article
                  key={group.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm transition hover:border-sky-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-100">
                        {group.name}
                      </h2>
                    </div>
                    <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-2 text-xs font-semibold text-slate-300">
                      <Users size={14} aria-hidden="true" />
                      {group.count}/{group.maxUsers}
                    </span>
                  </div>

                  <div className="mt-4 flex h-8 items-center gap-2 overflow-hidden">
                    {group.participants.length ? (
                      group.participants.slice(0, 4).map((participant) => (
                        <span
                          key={participant.socketId}
                          className="max-w-[7rem] truncate rounded-2xl bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300"
                        >
                          {participant.displayName}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">No one inside yet</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveGroup(group)}
                    disabled={!displayName || group.isFull}
                    className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-800"
                  >
                    Join
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
              <div>
                <Users className="mx-auto text-slate-400" size={34} aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-slate-100">No groups available</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Ask an admin to create a group from `/admin`, then it will appear here live.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
