const API_BASE = import.meta.env.VITE_API_BASE || "";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

export async function request(path, options = {}) {
  const headers = {
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

  return data;
}

export function getAdminToken() {
  return localStorage.getItem("myspeak:admin-token") || "";
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem("myspeak:admin-token", token);
  } else {
    localStorage.removeItem("myspeak:admin-token");
  }
}

const ROOM_ACCESS_TTL = 5 * 60 * 1000;

export function grantRoomAccess(groupId, passcode = "") {
  const record = { groupId, passcode, grantedAt: Date.now() };
  localStorage.setItem(`myspeak:room-access:${groupId}`, JSON.stringify(record));
}

export function hasRoomAccess(groupId) {
  try {
    const raw = localStorage.getItem(`myspeak:room-access:${groupId}`);
    if (!raw) return false;
    const record = JSON.parse(raw);
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

export function getRoomPasscode(groupId) {
  try {
    const raw = localStorage.getItem(`myspeak:room-access:${groupId}`);
    if (!raw) return "";
    const record = JSON.parse(raw);
    return record.passcode || "";
  } catch {
    return "";
  }
}

export function revokeRoomAccess(groupId) {
  localStorage.removeItem(`myspeak:room-access:${groupId}`);
}
