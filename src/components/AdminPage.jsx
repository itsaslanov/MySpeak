import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Globe, Lock, LogOut, Plus, Radio, Shield, Trash2, Users } from "lucide-react";
import { getAdminToken, request, setAdminToken, SOCKET_URL } from "../lib/api.js";

export default function AdminPage() {
  const [token, setToken] = useState(getAdminToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [maxUsers, setMaxUsers] = useState(30);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadGroups() {
    const response = await request("/api/groups");
    setGroups(response.groups || []);
  }

  useEffect(() => {
    if (!token) return undefined;
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
    if (!groupName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/groups", {
        method: "POST",
        token,
        body: { name: groupName, maxUsers, passcode }
      });
      setGroupName("");
      setPasscode("");
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
      await request(`/api/groups/${groupId}`, { method: "DELETE", token });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center p-3 sm:p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm animate-scale-in">
          <div className="glass-card p-6 sm:p-8">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3 sm:mb-6 sm:h-11 sm:w-11">
              <Shield size={18} className="text-zinc-400 sm:text-zinc-400" />
            </div>
            <h1 className="text-base font-semibold text-zinc-100 sm:text-lg">Admin sign in</h1>
            <p className="mt-1 text-xs text-zinc-500 sm:mt-1.5 sm:text-sm">Manage voice rooms.</p>

            {error && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400 sm:mt-4">
                {error}
              </div>
            )}

            <div className="mt-4 space-y-3 sm:mt-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="glass-input h-9 w-full px-3 text-sm sm:h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input h-9 w-full px-3 text-sm sm:h-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="btn-primary mt-4 flex h-9 w-full items-center justify-center gap-1.5 text-xs sm:mt-5 sm:h-10"
            >
              <Lock size={13} />
              Sign in
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-3 sm:pb-5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 sm:h-8 sm:w-8">
              <Radio size={13} className="text-zinc-400" />
            </div>
            <h1 className="text-sm font-semibold text-zinc-100 sm:text-base">Admin</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Link to="/" className="btn-secondary flex h-8 items-center gap-1.5 px-2.5 text-xs">
              <Globe size={12} />
              <span className="hidden sm:inline">Site</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary flex h-8 items-center gap-1.5 px-2.5 text-xs"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <section className="grid gap-4 py-2 lg:grid-cols-[320px_1fr] lg:gap-5">
          <form onSubmit={handleCreateGroup} className="glass-card h-fit p-3 sm:p-4">
            <h2 className="text-xs font-semibold text-zinc-300">Create room</h2>
            <div className="mt-3 space-y-3 sm:mt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="group-name">Name</label>
                <input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={50}
                  placeholder="General voice"
                  className="glass-input h-9 w-full px-3 text-sm sm:h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="max-users">Max users</label>
                <input
                  id="max-users"
                  type="number"
                  min="2"
                  max="200"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="glass-input h-9 w-full px-3 text-sm sm:h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="passcode">Passcode (optional)</label>
                <input
                  id="passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  maxLength={20}
                  placeholder="Leave empty for open room"
                  className="glass-input h-9 w-full px-3 text-sm sm:h-10"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !groupName.trim()}
              className="btn-primary mt-3 flex h-9 w-full items-center justify-center gap-1.5 text-xs sm:mt-4 sm:h-10"
            >
              <Plus size={13} />
              Create
            </button>
          </form>

          <div>
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h2 className="text-xs font-semibold text-zinc-300">Live rooms</h2>
              <span className="text-[11px] text-zinc-600">{groups.length} total</span>
            </div>

            {groups.length ? (
              <div className="grid gap-1.5 sm:gap-2">
                {groups.map((group, i) => (
                  <div
                    key={group.id}
                    className={`glass-card p-3.5 opacity-0 animate-slide-up stagger-${Math.min(i + 1, 6)} sm:p-4`}
                    style={{ animationFillMode: "forwards" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-100 sm:text-sm">{group.name}</h3>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <Users size={10} />
                          {group.count}/{group.maxUsers}
                          {group.count > 0 && <span className="text-emerald-500">active</span>}
                          {group.hasPasscode && <Lock size={9} className="text-zinc-600" />}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={busy}
                        title="Delete"
                        className="btn-danger flex h-7 w-7 items-center justify-center !rounded-md p-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {group.participants.length ? (
                        group.participants.map((p) => (
                          <span
                            key={p.socketId}
                            className="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-zinc-500"
                          >
                            <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            {p.displayName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-600">Empty</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-6 text-center animate-fade-in sm:p-10">
                <Users className="mx-auto text-zinc-600" size={24} />
                <h3 className="mt-3 text-sm font-semibold text-zinc-200">No rooms yet</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Create a room and users will see it instantly.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
