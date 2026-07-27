import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Globe, GripVertical, Lock, LogOut, Pencil, Plus, Radio, Shield, Trash2, Users, X, Check } from "lucide-react";
import { getAdminToken, request, setAdminToken, SOCKET_URL } from "../lib/api";
import type { Group } from "../types";
import Footer from "./Footer";

export default function AdminPage() {
  const [token, setToken] = useState(getAdminToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [maxUsers, setMaxUsers] = useState<number | string>(30);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState<number | string>("");
  const [editPasscode, setEditPasscode] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  async function loadGroups() {
    const response = await request<{ groups: Group[] }>("/api/groups");
    setGroups(response.groups || []);
  }

  useEffect(() => {
    if (!token) return undefined;
    loadGroups().catch((err) => setError(err.message));
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.on("groups:update", (nextGroups: Group[]) => setGroups(nextGroups || []));
    return () => { socket.disconnect(); };
  }, [token]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await request<{ token: string }>("/api/admin/login", {
        method: "POST",
        body: { username: email, password }
      });
      setAdminToken(response.token);
      setToken(response.token);
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setAdminToken("");
    setToken("");
  }

  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!groupName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/groups", {
        method: "POST",
        token,
        body: { name: groupName, maxUsers: Number(maxUsers), passcode }
      });
      setGroupName("");
      setPasscode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteGroup(group: Group) {
    setDeletingGroup(group);
  }

  async function handleDeleteGroup() {
    if (!deletingGroup) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/groups/${deletingGroup.id}`, { method: "DELETE", token });
      setDeletingGroup(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openEdit(group: Group) {
    setEditingGroup(group);
    setEditName(group.name);
    setEditMaxUsers(group.maxUsers);
    setEditPasscode("");
  }

  function closeEdit() {
    setEditingGroup(null);
    setEditName("");
    setEditMaxUsers("");
    setEditPasscode("");
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingGroup || !editName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        maxUsers: Number(editMaxUsers)
      };
      if (editPasscode) body.passcode = editPasscode;
      await request(`/api/groups/${editingGroup.id}`, {
        method: "PATCH",
        token,
        body
      });
      closeEdit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const reordered = [...groups];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, moved);
    setGroups(reordered);

    dragItem.current = null;
    dragOverItem.current = null;

    try {
      await request("/api/groups/reorder", {
        method: "PUT",
        token,
        body: { order: reordered.map((g) => g.id) }
      });
    } catch (err) {
      setError((err as Error).message);
      loadGroups();
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm animate-scale-in">
          <div className="glass-card p-6 sm:p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3 sm:mb-6 sm:h-11 sm:w-11">
              <Shield size={18} className="text-zinc-400" />
            </div>
            <h1 className="text-[17px] sm:text-lg font-semibold text-zinc-100">Admin sign in</h1>
            <p className="mt-1 text-[13px] sm:text-sm text-zinc-500">Manage voice rooms.</p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[13px] sm:text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="mt-5 space-y-4 sm:mt-6">
              <div>
                <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="btn-primary mt-5 flex h-11 sm:h-10 w-full items-center justify-center gap-1.5 text-[13px] sm:text-xs sm:mt-5"
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
    <main className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEdit} />
          <form onSubmit={handleSaveEdit} className="relative w-full sm:max-w-sm animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card relative p-5 sm:p-6 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 sm:h-11 sm:w-11">
                  <Pencil size={16} className="text-zinc-400" />
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>
              <h2 className="text-[15px] sm:text-sm font-semibold text-zinc-100">Edit room</h2>
              <p className="mt-1 text-[13px] sm:text-xs text-zinc-500">Update {editingGroup.name}</p>

              <div className="mt-4 space-y-3.5 sm:space-y-3">
                <div>
                  <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400">Max users</label>
                  <input
                    type="number"
                    min="2"
                    max="200"
                    value={editMaxUsers}
                    onChange={(e) => setEditMaxUsers(e.target.value)}
                    className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400">Passcode</label>
                  <input
                    value={editPasscode}
                    onChange={(e) => setEditPasscode(e.target.value)}
                    maxLength={20}
                    placeholder={editingGroup.hasPasscode ? "Leave empty to keep current" : "Leave empty for open room"}
                    className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-2.5 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="btn-secondary h-11 sm:h-10 flex-1 text-[13px] sm:text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !editName.trim()}
                  className="btn-primary flex h-11 sm:h-10 flex-1 items-center justify-center gap-1.5 text-[13px] sm:text-xs"
                >
                  <Check size={13} />
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingGroup(null)} />
          <div className="relative w-full sm:max-w-xs animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card p-6 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h2 className="text-[15px] sm:text-sm font-semibold text-zinc-100">Delete room?</h2>
              <p className="mt-1.5 text-[13px] sm:text-xs leading-relaxed text-zinc-500">
                Are you sure you want to delete <span className="font-medium text-zinc-300">{deletingGroup.name}</span>?
                {deletingGroup.count > 0 && (
                  <span className="mt-1.5 block text-amber-400">
                    {deletingGroup.count} user{deletingGroup.count > 1 ? "s" : ""} currently connected.
                  </span>
                )}
              </p>
              <div className="mt-5 flex gap-2.5 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="btn-secondary h-12 sm:h-10 flex-1 text-[13px] sm:text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={busy}
                  className="btn-danger h-12 sm:h-10 flex-1 text-[13px] sm:text-xs"
                >
                  {busy ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-4 sm:pb-5">
          <div className="flex items-center gap-2.5 sm:gap-2.5">
            <img src="/myspeak.png" alt="MySpeak" className="h-8 w-8 rounded-lg object-cover sm:h-8 sm:w-8" />
            <h1 className="text-[15px] sm:text-base font-semibold text-zinc-100">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs">
              <Globe size={12} />
              <span className="hidden sm:inline">Site</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary flex h-9 sm:h-8 items-center gap-1.5 px-2.5 text-[13px] sm:text-xs"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <section className="grid gap-4 py-2 lg:grid-cols-[320px_1fr] lg:gap-5">
          <form onSubmit={handleCreateGroup} className="glass-card h-fit p-4 sm:p-4">
            <h2 className="text-[13px] sm:text-xs font-semibold text-zinc-300">Create room</h2>
            <div className="mt-3 space-y-3.5 sm:mt-4 sm:space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400" htmlFor="group-name">Name</label>
                <input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={50}
                  placeholder="General voice"
                  className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400" htmlFor="max-users">Max users</label>
                <input
                  id="max-users"
                  type="number"
                  min="2"
                  max="200"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] sm:text-xs font-medium text-zinc-400" htmlFor="passcode">Passcode (optional)</label>
                <input
                  id="passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  maxLength={20}
                  placeholder="Leave empty for open room"
                  className="glass-input h-11 sm:h-10 w-full px-4 text-[15px] sm:text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !groupName.trim()}
              className="btn-primary mt-4 flex h-11 sm:h-10 w-full items-center justify-center gap-1.5 text-[13px] sm:text-xs sm:mt-4"
            >
              <Plus size={13} />
              Create
            </button>
          </form>

          <div>
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h2 className="text-[13px] sm:text-xs font-semibold text-zinc-300">Live rooms</h2>
              <span className="text-[11px] text-zinc-600">{groups.length} total</span>
            </div>

            {groups.length ? (
              <div className="grid gap-2 sm:gap-2">
                {groups.map((group, i) => (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`glass-card p-3.5 sm:p-4 opacity-0 animate-slide-up stagger-${Math.min(i + 1, 6)} cursor-grab active:cursor-grabbing`}
                    style={{ animationFillMode: "forwards" }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 text-zinc-600">
                          <GripVertical size={14} />
                        </div>
                        <div>
                          <h3 className="text-[13px] sm:text-sm font-semibold text-zinc-100">{group.name}</h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                            <Users size={10} />
                            {group.count}/{group.maxUsers}
                            {group.count > 0 && <span className="text-emerald-500">active</span>}
                            {group.hasPasscode && <Lock size={9} className="text-zinc-600" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(group)}
                          disabled={busy}
                          title="Edit"
                          className="btn-secondary flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center !rounded-md p-0"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteGroup(group)}
                          disabled={busy}
                          title="Delete"
                          className="btn-danger flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center !rounded-md p-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {group.participants.length ? (
                        group.participants.map((p) => (
                          <span
                            key={p.socketId}
                            className="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] sm:text-[10px] text-zinc-500"
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
                <h3 className="mt-3 text-[15px] sm:text-sm font-semibold text-zinc-200">No rooms yet</h3>
                <p className="mt-1 text-[13px] sm:text-xs text-zinc-500">
                  Create a room and users will see it instantly.
                </p>
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
