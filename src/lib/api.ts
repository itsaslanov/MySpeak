import type { RequestOptions, RoomAccessRecord } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "";
export const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL || undefined;

export async function request<T = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export function getAdminToken(): string {
  return localStorage.getItem("myspeak:admin-token") || "";
}

export function setAdminToken(token: string): void {
  if (token) {
    localStorage.setItem("myspeak:admin-token", token);
  } else {
    localStorage.removeItem("myspeak:admin-token");
  }
}

/**
 * Stable per-browser identity, shared by every tab/window of the same
 * browser via localStorage. The server uses it to keep a single active
 * presence per person in a room, so opening the same room link in a second
 * tab takes over the session instead of registering a second user.
 */
const CLIENT_ID_KEY = "myspeak:client-id";

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

const ROOM_ACCESS_TTL = 5 * 60 * 1000;

export function grantRoomAccess(groupId: string, passcode = ""): void {
  const record: RoomAccessRecord = { groupId, passcode, grantedAt: Date.now() };
  localStorage.setItem(`myspeak:room-access:${groupId}`, JSON.stringify(record));
}

export function hasRoomAccess(groupId: string): boolean {
  try {
    const raw = localStorage.getItem(`myspeak:room-access:${groupId}`);
    if (!raw) return false;
    const record: RoomAccessRecord = JSON.parse(raw);
    if (record.groupId !== groupId) return false;
    if (Date.now() - record.grantedAt > ROOM_ACCESS_TTL) {
      revokeRoomAccess(groupId);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getRoomPasscode(groupId: string): string {
  try {
    const raw = localStorage.getItem(`myspeak:room-access:${groupId}`);
    if (!raw) return "";
    const record: RoomAccessRecord = JSON.parse(raw);
    return record.passcode || "";
  } catch {
    return "";
  }
}

export function revokeRoomAccess(groupId: string): void {
  localStorage.removeItem(`myspeak:room-access:${groupId}`);
}
