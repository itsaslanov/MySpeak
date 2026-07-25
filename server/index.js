import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import agoraToken from "agora-token";

dotenv.config();

const { RtcRole, RtcTokenBuilder } = agoraToken;

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 4005);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const corsOrigin = clientOrigin === "*" ? true : clientOrigin;

const envAdminUser = process.env.ADMIN_USER;
const envAdminPassword = process.env.ADMIN_PASSWORD;
const envAdminCredentialsLoaded = Boolean(envAdminUser && envAdminPassword);

let adminUser = envAdminUser || "admin";
let adminPassword = envAdminPassword || "1234";
const adminSecret = process.env.ADMIN_TOKEN_SECRET || "dev-secret-change-me";
const agoraAppId = process.env.AGORA_APP_ID || "";
const agoraAppCertificate = process.env.AGORA_APP_CERTIFICATE || "";
const agoraTokenExpireSeconds = Number(process.env.AGORA_TOKEN_EXPIRE_SECONDS);
const safeAgoraTokenExpireSeconds =
  Number.isFinite(agoraTokenExpireSeconds) && agoraTokenExpireSeconds > 0
    ? agoraTokenExpireSeconds
    : 3600;

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const supabaseTable = process.env.SUPABASE_TABLE || "MySpeak";
const supabaseAdminTable = process.env.SUPABASE_ADMIN_TABLE || "admin_auth";
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

const groups = new Map();
const sockets = new Map();

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "64kb" }));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

function createId(prefix) {
  if (supabase) {
    return `${Date.now().toString().slice(-12)}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
  }

  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeGroupName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 50);
}

function createChannelName(name) {
  const slug = normalizeGroupName(name)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return `myspeak-${slug || "room"}-${Date.now().toString(36)}`.slice(0, 63);
}

function createGroup({ name, maxUsers }) {
  const id = createId("grp");
  const group = {
    id,
    name: normalizeGroupName(name),
    channelName: createChannelName(name),
    maxUsers: Math.min(Math.max(Number(maxUsers) || 30, 2), 200),
    createdAt: new Date().toISOString(),
    participants: new Map()
  };

  groups.set(id, group);
  return group;
}

function serializeGroup(group) {
  const participants = Array.from(group.participants.values()).sort((a, b) =>
    a.joinedAt.localeCompare(b.joinedAt)
  );

  return {
    id: group.id,
    name: group.name,
    channelName: group.channelName,
    maxUsers: group.maxUsers,
    createdAt: group.createdAt,
    count: participants.length,
    isFull: participants.length >= group.maxUsers,
    participants
  };
}

function serializeGroups() {
  return Array.from(groups.values())
    .map(serializeGroup)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function broadcastGroups() {
  io.emit("groups:update", serializeGroups());
}

async function loadGroupsFromStore() {
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase
    .from(supabaseTable)
    .select("*")
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("Supabase load groups error:", error.message || error);
    return;
  }

  groups.clear();
  for (const row of data || []) {
    if (!row?.name || !row?.channelName) {
      continue;
    }

    const groupId = row.id?.toString?.() ?? String(row.id);
    groups.set(groupId, {
      id: groupId,
      name: row.name,
      channelName: row.channelName || row.channelname || "",
      maxUsers: Number(row.maxUsers ?? row.maxusers) || 30,
      createdAt: row.createdAt || row.createdat || new Date().toISOString(),
      participants: new Map()
    });
  }
}

async function persistGroup(group) {
  if (!supabase) {
    return;
  }

  const numericId = Number(group.id);
  const payload = {
    id: Number.isFinite(numericId) ? numericId : group.id,
    name: group.name,
    channelName: group.channelName,
    maxUsers: group.maxUsers,
    createdAt: group.createdAt
  };

  const { error } = await supabase.from(supabaseTable).upsert([payload]);

  if (error) {
    console.error("Supabase persist group error:", error.message || error);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }

  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const keyBuffer = Buffer.from(key, "hex");

  if (derivedBuffer.length !== keyBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, keyBuffer);
}

async function getSupabaseAdminRow(username) {
  if (!supabase || !username) {
    return null;
  }

  const { data, error } = await supabase
    .from(supabaseAdminTable)
    .select("admin_user,admin_password,password_hash")
    .eq("admin_user", username)
    .maybeSingle();

  if (error) {
    if (error.code !== "42703") {
      console.error("Supabase admin lookup error:", error.message || error);
    }
    return null;
  }

  if (!data?.admin_user || (!data.password_hash && !data.admin_password)) {
    return null;
  }

  return {
    user: String(data.admin_user),
    passwordHash: data.password_hash ? String(data.password_hash) : String(data.admin_password)
  };
}

async function saveAdminCredentials(username, password) {
  if (!supabase || !username || !password) {
    return false;
  }

  const payload = {
    admin_user: username,
    password_hash: hashPassword(password)
  };

  const { error } = await supabase
    .from(supabaseAdminTable)
    .upsert([payload], { onConflict: "admin_user" });

  if (error) {
    console.error("Supabase admin save error:", error.message || error);
    return false;
  }

  return true;
}

async function validateAdminLogin(username, password) {
  if (!username || !password) {
    return false;
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password
    });

    if (!error && data?.user) {
      return true;
    }
  }

  if (envAdminCredentialsLoaded && username === envAdminUser && password === envAdminPassword) {
    return true;
  }

  return false;
}

async function deleteGroupRecord(groupId) {
  if (!supabase) {
    return;
  }

  const numericId = Number(groupId);
  const targetId = Number.isFinite(numericId) ? numericId : groupId;
  const { error } = await supabase.from(supabaseTable).delete().eq("id", targetId);

  if (error) {
    console.error("Supabase delete group error:", error.message || error);
  }
}

function signAdminSession(username) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      role: "admin",
      exp: Date.now() + 24 * 60 * 60 * 1000
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSecret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

function verifyAdminSession(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", adminSecret).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.role !== "admin" || Date.now() > session.exp) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const session = verifyAdminSession(token);

  if (!session) {
    return res.status(401).json({ error: "Admin sign in is required." });
  }

  req.admin = session;
  return next();
}

function leaveGroup(socket) {
  const active = sockets.get(socket.id);
  if (!active) {
    return;
  }

  const group = groups.get(active.groupId);
  if (group) {
    group.participants.delete(socket.id);
    socket.leave(group.id);
    io.to(group.id).emit("presence:update", serializeGroup(group));
  }

  sockets.delete(socket.id);
  broadcastGroups();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    agoraAppId,
    tokenEnabled: Boolean(agoraAppCertificate)
  });
});

app.get("/api/groups", (_req, res) => {
  res.json({ groups: serializeGroups() });
});

app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const valid = await validateAdminLogin(username, password);
  if (!valid) {
    return res.status(401).json({ error: "Wrong admin username or password." });
  }

  res.json({
    token: signAdminSession(username),
    admin: { username }
  });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ admin: { username: req.admin.sub } });
});

app.post("/api/admin/credentials", requireAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase is not configured for admin credentials." });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ error: "Admin username and password are required." });
  }

  const saved = await saveAdminCredentials(username, password);
  if (!saved) {
    return res.status(500).json({ error: "Unable to save admin credentials." });
  }

  res.json({ ok: true, admin: { username } });
});

app.post("/api/groups", requireAdmin, async (req, res) => {
  const name = normalizeGroupName(req.body?.name);

  if (name.length < 2) {
    return res.status(400).json({ error: "Group name must be at least 2 characters." });
  }

  const group = createGroup({
    name,
    maxUsers: req.body?.maxUsers
  });

  await persistGroup(group);
  broadcastGroups();
  res.status(201).json({ group: serializeGroup(group) });
});

app.delete("/api/groups/:id", requireAdmin, async (req, res) => {
  const groupId = String(req.params.id);
  const group = groups.get(groupId);

  if (!group) {
    return res.status(404).json({ error: "Group not found." });
  }

  io.to(group.id).emit("group:deleted", { id: group.id });
  for (const socketId of group.participants.keys()) {
    sockets.delete(socketId);
  }
  io.in(group.id).socketsLeave(group.id);

  await deleteGroupRecord(group.id);
  groups.delete(group.id);
  broadcastGroups();
  res.json({ ok: true });
});

app.post("/api/agora/token", (req, res) => {
  const group = req.body?.groupId ? groups.get(String(req.body.groupId)) : null;
  const channelName = group?.channelName || String(req.body?.channelName || "").trim();
  const requestedUid = Number(req.body?.uid);
  const uid =
    Number.isInteger(requestedUid) && requestedUid > 0
      ? requestedUid
      : Math.floor(100000 + Math.random() * 900000000);

  if (!agoraAppId) {
    return res.status(400).json({ error: "AGORA_APP_ID is not configured on the server." });
  }

  if (!channelName) {
    return res.status(400).json({ error: "Agora channel name is required." });
  }

  const token = agoraAppCertificate
    ? RtcTokenBuilder.buildTokenWithUid(
        agoraAppId,
        agoraAppCertificate,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        safeAgoraTokenExpireSeconds,
        safeAgoraTokenExpireSeconds
      )
    : null;

  res.json({
    appId: agoraAppId,
    channelName,
    uid,
    token,
    expiresIn: token ? safeAgoraTokenExpireSeconds : null,
    tokenRequired: Boolean(agoraAppCertificate)
  });
});

io.on("connection", (socket) => {
  socket.emit("groups:update", serializeGroups());

  socket.on("presence:join", (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const group = groups.get(String(payload?.groupId || ""));
    const displayName = String(payload?.displayName || "").trim().slice(0, 32);
    const uid = Number(payload?.uid);

    if (!group) {
      return reply({ ok: false, error: "Group not found." });
    }

    if (!displayName) {
      return reply({ ok: false, error: "Please enter your name first." });
    }

    if (group.participants.size >= group.maxUsers) {
      return reply({ ok: false, error: "This group is full." });
    }

    leaveGroup(socket);
    socket.join(group.id);
    group.participants.set(socket.id, {
      socketId: socket.id,
      uid,
      displayName,
      joinedAt: new Date().toISOString()
    });
    sockets.set(socket.id, { groupId: group.id });

    const serialized = serializeGroup(group);
    io.to(group.id).emit("presence:update", serialized);
    broadcastGroups();
    return reply({ ok: true, group: serialized });
  });

  socket.on("presence:leave", (_payload, respond) => {
    leaveGroup(socket);
    if (typeof respond === "function") {
      respond({ ok: true });
    }
  });

  socket.on("disconnect", () => {
    leaveGroup(socket);
  });
});

const distDir = path.join(process.cwd(), "dist");
const indexPath = path.join(distDir, "index.html");

app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

if (fs.existsSync(indexPath)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(indexPath);
  });
}

console.log(`Supabase table: ${supabaseTable}`);
console.log(`Supabase admin table: ${supabaseAdminTable}`);
console.log(`Agora App ID configured: ${Boolean(agoraAppId)}`);
console.log(`Supabase enabled: ${Boolean(supabase)}`);

(async () => {
  try {
    await loadGroupsFromStore();
  } catch (error) {
    console.error("Failed to initialize Supabase data:", error?.message || error);
  }

  server.listen(port, () => {
    console.log(`MySpeak API listening on http://localhost:${port}`);
  });
})();
