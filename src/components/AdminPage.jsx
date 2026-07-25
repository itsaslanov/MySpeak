import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Lock, LogOut, Plus, Radio, Trash2, Users } from "lucide-react";
import { getAdminToken, request, setAdminToken, SOCKET_URL } from "../lib/api.js";

export default function AdminPage() {
  const [token, setToken] = useState(getAdminToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [maxUsers, setMaxUsers] = useState(30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadGroups() {
    const response = await request("/api/groups");
    setGroups(response.groups || []);
  }

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    loadGroups().catch((err) => setError(err.message));
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.on("groups:update", (nextGroups) => setGroups(nextGroups || []));

    return () => socket.disconnect();
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await request("/api/admin/login", {
        method: "POST",
        body: { username: email, password }
      });
      setAdminToken(response.token);
      setToken(response.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setAdminToken("");
    setToken("");
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    if (!groupName.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await request("/api/groups", {
        method: "POST",
        token,
        body: {
          name: groupName,
          maxUsers
        }
      });
      setGroupName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGroup(groupId) {
    setBusy(true);
    setError("");

    try {
      await request(`/api/groups/${groupId}`, {
        method: "DELETE",
        token
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-[28px] border border-slate-800 bg-slate-900 p-6 shadow-sm"
        >
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-white">
            <Lock size={21} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100">Admin sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Create and close voice groups.</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-fuchsia-700 bg-fuchsia-900/50 px-3 py-2 text-sm text-fuchsia-100">
              {error}
            </div>
          )}

          <label className="mt-5 block text-sm font-medium text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />

          <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-800"
          >
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
              <Radio size={18} aria-hidden="true" />
              MySpeak Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">Group control</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:border-slate-700"
            >
              Website
            </a>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <section className="grid gap-5 py-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleCreateGroup}
            className="h-fit rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-100">Create group</h2>
            <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="group-name">
              Name
            </label>
            <input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              maxLength={50}
              placeholder="General voice"
              className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />

            <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="max-users">
              Max users
            </label>
            <input
              id="max-users"
              type="number"
              min="2"
              max="200"
              value={maxUsers}
              onChange={(event) => setMaxUsers(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />

            <button
              type="submit"
              disabled={busy || !groupName.trim()}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-800"
            >
              <Plus size={17} aria-hidden="true" />
              Create
            </button>
          </form>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-100">Live groups</h2>
              <span className="text-sm text-slate-400">{groups.length} total</span>
            </div>

            {groups.length ? (
              <div className="grid gap-3">
                {groups.map((group) => (
                  <article
                    key={group.id}
                    className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-100">
                          {group.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 items-center gap-1 rounded-2xl bg-slate-800 px-2 text-xs font-semibold text-slate-300">
                          <Users size={14} aria-hidden="true" />
                          {group.count}/{group.maxUsers}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          disabled={busy}
                          title="Delete group"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.participants.length ? (
                        group.participants.map((participant) => (
                          <span
                            key={participant.socketId}
                            className="max-w-[10rem] truncate rounded-2xl bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300"
                          >
                            {participant.displayName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">Empty</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
                <Users className="mx-auto text-slate-400" size={34} aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-slate-100">No groups yet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Create the first group and users will see it on the website instantly.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
