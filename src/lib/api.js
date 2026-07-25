export const API_BASE = import.meta.env.VITE_API_BASE || "";
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
