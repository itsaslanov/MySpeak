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

const adminUser = envAdminUser || "admin";
const adminPassword = envAdminPassword || "1234";
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
const supabaseChatTable = process.env.SUPABASE_CHAT_TABLE || "MySpeakChat";
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

const groups = new Map();
const sockets = new Map();
const chatMessages = new Map();

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

function normalizePasscode(passcode) {
  const raw = String(passcode || "").trim();
  if (!raw) return "";
  return raw.slice(0, 20);
}

function createGroup({ name, maxUsers, passcode }) {
  const id = createId("grp");
  const group = {
    id,
    name: normalizeGroupName(name),
    channelName: createChannelName(name),
    maxUsers: Math.min(Math.max(Number(maxUsers) || 30, 2), 200),
    passcode: normalizePasscode(passcode),
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
    hasPasscode: Boolean(group.passcode),
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
      passcode: row.passcode || "",
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
    passcode: group.passcode || "",
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

async function loadChatFromStore() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from(supabaseChatTable)
    .select("*")
    .order("timestamp", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Supabase load chat error:", error.message || error);
    return;
  }

  chatMessages.clear();
  for (const row of data || []) {
    const groupId = String(row.group_id || "");
    if (!groupId) continue;
    if (!chatMessages.has(groupId)) chatMessages.set(groupId, []);
    chatMessages.get(groupId).push({
      id: String(row.id || ""),
      displayName: row.display_name || "",
      text: row.text || "",
      timestamp: row.timestamp || new Date().toISOString()
    });
  }
}

async function persistChatMessage(groupId, msg) {
  if (!supabase) return;

  const { error } = await supabase.from(supabaseChatTable).insert([{
    id: msg.id,
    group_id: groupId,
    display_name: msg.displayName,
    text: msg.text,
    timestamp: msg.timestamp
  }]);

  if (error) {
    console.error("Supabase persist chat error:", error.message || error);
  }
}

async function deleteChatForGroup(groupId) {
  if (!supabase) return;

  const { error } = await supabase.from(supabaseChatTable).delete().eq("group_id", groupId);
  if (error) {
    console.error("Supabase delete chat error:", error.message || error);
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
    const participant = group.participants.get(socket.id);
    const displayName = participant?.displayName;
    group.participants.delete(socket.id);
    socket.leave(group.id);
    io.to(group.id).emit("presence:update", serializeGroup(group));

    if (displayName) {
      const sysMsg = {
        id: `${Date.now()}-sys`,
        displayName: "",
        text: `${displayName} left the group`,
        timestamp: new Date().toISOString(),
        system: true,
        type: "leave"
      };
      if (!chatMessages.has(group.id)) chatMessages.set(group.id, []);
      const roomMessages = chatMessages.get(group.id);
      roomMessages.push(sysMsg);
      if (roomMessages.length > 100) roomMessages.splice(0, roomMessages.length - 100);
      persistChatMessage(group.id, sysMsg);
      io.to(group.id).emit("chat:message", sysMsg);
    }
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
    maxUsers: req.body?.maxUsers,
    passcode: req.body?.passcode
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
  await deleteChatForGroup(group.id);
  groups.delete(group.id);
  chatMessages.delete(group.id);
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

  socket.on("group:verify-passcode", (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const group = groups.get(String(payload?.groupId || ""));
    const passcode = String(payload?.passcode || "");

    if (!group) {
      return reply({ ok: false, error: "Group not found." });
    }

    if (group.passcode && passcode !== group.passcode) {
      return reply({ ok: false, error: "Wrong passcode." });
    }

    return reply({ ok: true });
  });

  socket.on("presence:join", (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const group = groups.get(String(payload?.groupId || ""));
    const displayName = String(payload?.displayName || "").trim().slice(0, 32);
    const uid = Number(payload?.uid);
    const passcode = String(payload?.passcode || "");
    const adminToken = String(payload?.adminToken || "");
    const avatar = String(payload?.avatar || "").slice(0, 8);
    const isAdmin = !!verifyAdminSession(adminToken);

    if (!group) {
      return reply({ ok: false, error: "Group not found." });
    }

    if (!displayName) {
      return reply({ ok: false, error: "Please enter your name first." });
    }

    if (group.passcode && passcode !== group.passcode) {
      return reply({ ok: false, error: "Wrong passcode." });
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
      avatar,
      admin: isAdmin,
      joinedAt: new Date().toISOString()
    });
    sockets.set(socket.id, { groupId: group.id });

    const serialized = serializeGroup(group);
    io.to(group.id).emit("presence:update", serialized);
    broadcastGroups();

    const joinMsg = {
      id: `${Date.now()}-sys`,
      displayName: "",
      text: `${displayName} joined the group`,
      timestamp: new Date().toISOString(),
      system: true,
      type: "join"
    };
    if (!chatMessages.has(group.id)) chatMessages.set(group.id, []);
    const roomMessages = chatMessages.get(group.id);
    roomMessages.push(joinMsg);
    if (roomMessages.length > 100) roomMessages.splice(0, roomMessages.length - 100);
    persistChatMessage(group.id, joinMsg);
    io.to(group.id).emit("chat:message", joinMsg);

    return reply({ ok: true, group: serialized });
  });

  socket.on("presence:leave", (_payload, respond) => {
    leaveGroup(socket);
    if (typeof respond === "function") {
      respond({ ok: true });
    }
  });

  socket.on("chat:history", async (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const groupId = String(payload?.groupId || "");

    if (supabase) {
      const { data, error } = await supabase
        .from(supabaseChatTable)
        .select("*")
        .eq("group_id", groupId)
        .order("timestamp", { ascending: true })
        .limit(100);

      if (!error && data) {
        const messages = data.map((row) => ({
          id: String(row.id || ""),
          displayName: row.display_name || "",
          text: row.text || "",
          timestamp: row.timestamp || ""
        }));
        return reply({ ok: true, messages });
      }
    }

    const messages = chatMessages.get(groupId) || [];
    return reply({ ok: true, messages });
  });

  socket.on("chat:send", (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const active = sockets.get(socket.id);
    if (!active) return reply({ ok: false, error: "Join a room first." });

    const text = String(payload?.text || "").trim().slice(0, 500);
    if (!text) return reply({ ok: false, error: "Empty message." });

    const group = groups.get(active.groupId);
    if (!group) return reply({ ok: false, error: "Room not found." });

    const participant = group.participants.get(socket.id);
    if (!participant) return reply({ ok: false, error: "Not in this room." });

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      displayName: participant.displayName,
      admin: !!participant.admin,
      text,
      timestamp: new Date().toISOString()
    };

    if (!chatMessages.has(group.id)) chatMessages.set(group.id, []);
    const roomMessages = chatMessages.get(group.id);
    roomMessages.push(msg);
    if (roomMessages.length > 100) roomMessages.splice(0, roomMessages.length - 100);

    persistChatMessage(group.id, msg);
    io.to(group.id).emit("chat:message", msg);
    return reply({ ok: true });
  });

  socket.on("chat:typing", (payload) => {
    const active = sockets.get(socket.id);
    if (!active) return;
    const group = groups.get(active.groupId);
    if (!group) return;
    const participant = group.participants.get(socket.id);
    if (!participant) return;
    socket.to(group.id).emit("chat:typing", {
      displayName: participant.displayName,
      typing: !!payload?.typing
    });
  });

  socket.on("chat:clear", async (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const token = String(payload?.token || "");
    const session = verifyAdminSession(token);
    if (!session) return reply({ ok: false, error: "Admin access required." });

    const active = sockets.get(socket.id);
    if (!active) return reply({ ok: false, error: "Join a room first." });

    const group = groups.get(active.groupId);
    if (!group) return reply({ ok: false, error: "Room not found." });

    chatMessages.delete(group.id);

    if (supabase) {
      const { error } = await supabase
        .from(supabaseChatTable)
        .delete()
        .eq("group_id", group.id);
      if (error) console.error("Chat clear from Supabase failed:", error.message || error);
    }

    io.to(group.id).emit("chat:cleared");
    return reply({ ok: true });
  });

  socket.on("presence:rename", (payload, respond) => {
    const reply = typeof respond === "function" ? respond : () => {};
    const active = sockets.get(socket.id);
    if (!active) return reply({ ok: false, error: "Join a room first." });

    const group = groups.get(active.groupId);
    if (!group) return reply({ ok: false, error: "Room not found." });

    const participant = group.participants.get(socket.id);
    if (!participant) return reply({ ok: false, error: "Not in this room." });

    const newName = String(payload?.displayName || "").trim().slice(0, 32);
    if (!newName) return reply({ ok: false, error: "Name cannot be empty." });

    participant.displayName = newName;
    if (typeof payload?.avatar === "string") participant.avatar = payload.avatar.slice(0, 8);

    const serialized = serializeGroup(group);
    io.to(group.id).emit("presence:update", serialized);
    broadcastGroups();
    return reply({ ok: true });
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

(async () => {
  try {
    await loadGroupsFromStore();
    await loadChatFromStore();
  } catch (error) {
    console.error("Failed to initialize Supabase data:", error?.message || error);
  }

  server.listen(port, () => {
    console.log(`MySpeak running on http://localhost:${port}`);
  });
})();
