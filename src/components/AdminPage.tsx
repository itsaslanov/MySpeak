import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Globe, GripVertical, Lock, LogOut, Pencil, Plus, Shield, Trash2, Users, X, Check } from "lucide-react";
import { getAdminToken, request, setAdminToken, SOCKET_URL } from "../lib/api";
import MySpeakLogo from "./MySpeakLogo";
import type { Group } from "../types";
import Footer from "./Footer";
import Toast, { type Toast as ToastType } from "./Toast";

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
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const toastId = useRef(0);

  const addToast = useCallback((type: ToastType["type"], message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
      addToast("success", "Signed in successfully");
    } catch (err) {
      setError((err as Error).message);
      addToast("error", (err as Error).message);
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
      addToast("success", "Room created");
    } catch (err) {
      setError((err as Error).message);
      addToast("error", (err as Error).message);
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
      addToast("success", "Room deleted");
    } catch (err) {
      setError((err as Error).message);
      addToast("error", (err as Error).message);
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
      addToast("success", "Room updated");
    } catch (err) {
      setError((err as Error).message);
      addToast("error", (err as Error).message);
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
      addToast("success", "Order saved");
    } catch (err) {
      setError((err as Error).message);
      addToast("error", (err as Error).message);
      loadGroups();
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm animate-scale-in">
          <div className="glass-card p-7 sm:p-9">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] sm:mb-7">
              <Shield size={20} className="text-zinc-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Admin sign in</h1>
            <p className="mt-2 text-sm text-zinc-500">Manage voice rooms.</p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-4 sm:mt-7">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="btn-primary mt-6 flex h-12 sm:h-11 w-full items-center justify-center gap-2 text-sm sm:text-xs sm:mt-7"
            >
              <Lock size={14} />
              Sign in
            </button>
          </div>
        </form>
        <Toast toasts={toasts} remove={removeToast} />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeEdit} />
          <form onSubmit={handleSaveEdit} className="relative w-full sm:max-w-sm animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card relative p-6 sm:p-7 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] sm:h-12 sm:w-12">
                  <Pencil size={18} className="text-zinc-400" />
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-500 transition hover:bg-white/[0.1] hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100">Edit room</h2>
              <p className="mt-1.5 text-sm text-zinc-500">Update {editingGroup.name}</p>

              <div className="mt-5 space-y-4 sm:space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">Max users</label>
                  <input
                    type="number"
                    min="2"
                    max="200"
                    value={editMaxUsers}
                    onChange={(e) => setEditMaxUsers(e.target.value)}
                    className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">Passcode</label>
                  <input
                    value={editPasscode}
                    onChange={(e) => setEditPasscode(e.target.value)}
                    maxLength={20}
                    placeholder={editingGroup.hasPasscode ? "Leave empty to keep current" : "Leave empty for open room"}
                    className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-7 flex gap-3 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="btn-secondary h-12 sm:h-11 flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !editName.trim()}
                  className="btn-primary flex h-12 sm:h-11 flex-1 items-center justify-center gap-2 text-sm"
                >
                  <Check size={14} />
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setDeletingGroup(null)} />
          <div className="relative w-full sm:max-w-sm animate-[slideUp_0.2s_ease] sm:animate-scale-in">
            <div className="glass-card p-7 rounded-t-2xl sm:rounded-2xl">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100">Delete room?</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Are you sure you want to delete <span className="font-medium text-zinc-300">{deletingGroup.name}</span>?
                {deletingGroup.count > 0 && (
                  <span className="mt-2 block text-amber-400">
                    {deletingGroup.count} user{deletingGroup.count > 1 ? "s" : ""} currently connected.
                  </span>
                )}
              </p>
              <div className="mt-6 flex gap-3 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="btn-secondary h-12 sm:h-11 flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={busy}
                  className="btn-danger h-12 sm:h-11 flex-1 text-sm"
                >
                  {busy ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between pb-5 sm:pb-6">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <MySpeakLogo className="h-10 w-10 rounded-xl" />
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/" className="btn-secondary flex h-10 sm:h-9 items-center gap-2 px-3 text-sm">
              <Globe size={14} />
              <span className="hidden sm:inline">Site</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary flex h-10 sm:h-9 items-center gap-2 px-3 text-sm"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <section className="grid gap-4 pb-6 pt-2 lg:grid-cols-[320px_1fr] lg:gap-5">
          <form onSubmit={handleCreateGroup} className="glass-card h-fit p-5 sm:p-6">
            <h2 className="text-sm sm:text-base font-semibold text-zinc-300">Create room</h2>
            <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400" htmlFor="group-name">Name</label>
                <input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={50}
                  placeholder="General voice"
                  className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400" htmlFor="max-users">Max users</label>
                <input
                  id="max-users"
                  type="number"
                  min="2"
                  max="200"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400" htmlFor="passcode">Passcode (optional)</label>
                <input
                  id="passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  maxLength={20}
                  placeholder="Leave empty for open room"
                  className="glass-input h-12 sm:h-11 w-full px-4 text-base sm:text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !groupName.trim()}
              className="btn-primary mt-5 flex h-12 sm:h-11 w-full items-center justify-center gap-2 text-sm sm:text-xs sm:mt-6"
            >
              <Plus size={14} />
              Create
            </button>
          </form>

          <div>
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <h2 className="text-sm sm:text-base font-semibold text-zinc-300">Live rooms</h2>
              <span className="text-xs text-zinc-600">{groups.length} total</span>
            </div>

            {groups.length ? (
              <div className="grid gap-3 sm:gap-3">
                {groups.map((group, i) => (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`glass-card p-4 sm:p-5 opacity-0 animate-slide-up stagger-${Math.min(i + 1, 6)} cursor-grab active:cursor-grabbing`}
                    style={{ animationFillMode: "forwards" }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-zinc-600">
                          <GripVertical size={15} />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-semibold text-zinc-100">{group.name}</h3>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                            <Users size={12} />
                            {group.count}/{group.maxUsers}
                            {group.count > 0 && <span className="text-emerald-500">active</span>}
                            {group.hasPasscode && <Lock size={10} className="text-zinc-600" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(group)}
                          disabled={busy}
                          title="Edit"
                          className="btn-secondary flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center !rounded-xl p-0"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteGroup(group)}
                          disabled={busy}
                          title="Delete"
                          className="btn-danger flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center !rounded-xl p-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {group.participants.length ? (
                        group.participants.map((p) => (
                          <span
                            key={p.socketId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-zinc-500"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {p.displayName}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-600">Empty</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center animate-fade-in sm:p-12">
                <Users className="mx-auto text-zinc-600" size={28} />
                <h3 className="mt-4 text-base sm:text-lg font-semibold text-zinc-200">No rooms yet</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Create a room and users will see it instantly.
                </p>
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>
      <Toast toasts={toasts} remove={removeToast} />
    </main>
  );
}
