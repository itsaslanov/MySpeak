<p align="center">
  <img src="public/myspeak.svg" alt="MySpeak" width="72" />
</p>

<h1 align="center">MySpeak</h1>

<p align="center">
  Voice rooms in the browser. Pick a name, join a room, start talking.<br />
  <a href="https://myspeak.team"><strong>myspeak.team</strong></a>
</p>

---

MySpeak is a lightweight, TeamSpeak-style voice chat app. There are no accounts and nothing to install. You pick a display name and an avatar, open a room, and you're in a live voice channel with everyone else there. Each room also has a text chat that keeps its history.

## Features

**Voice**
- Real-time voice rooms powered by the [Agora Web SDK](https://www.agora.io/)
- Live speaking indicators, mute state, and per-user connection status ("Connecting…", "Connection failed", "No connection")
- Automatic fallback to Agora Cloud Proxy (TLS 443) on networks that block UDP
- Server-issued Agora tokens that renew automatically, so long calls don't drop
- Mic volume control and join/leave sound chimes

**Rooms and chat**
- Live room list showing who is online right now
- Optional room passcodes and per-room user limits
- Text chat with typing indicators and persistent history (Supabase)
- One session per browser: opening a room in a second tab takes over the first instead of joining twice
- Memoji avatars and rename while in a room

**Admin** (`/admin`)
- Create, rename, reorder, and delete rooms
- Set passcodes and user limits
- Kick users and clear chat history

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Realtime | Socket.IO (presence, chat, mute and connection state) |
| Voice | Agora RTC Web SDK + `agora-token` on the server |
| Backend | Node.js 22, Express |
| Data | Supabase (rooms, chat history, admin accounts) |

## How it works

```
Browser ──Socket.IO──▶ Express server ──▶ Supabase
   │                        │
   │◀── Agora token ────────┘
   │
   └──── voice audio ────▶ Agora global network ◀──── other users
```

The Express server handles presence, chat, and admin actions, and signs Agora tokens. Voice audio never passes through the server. It travels over Agora's global network, so call quality doesn't depend on where the server is hosted.

## Getting started

**Requirements:** Node.js 22+, an [Agora](https://console.agora.io/) project, and optionally a [Supabase](https://supabase.com/) project.

```bash
git clone https://github.com/itsaslanov/MySpeak.git
cd MySpeak
npm install
cp .env.example .env   # then fill in your values
npm run dev
```

- App: http://localhost:5173
- Admin: http://localhost:5173/admin
- API: http://localhost:4005

### Environment variables

See [`.env.example`](.env.example) for the full list. The important ones:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AGORA_APP_ID` | yes | Agora project App ID |
| `AGORA_APP_CERTIFICATE` | recommended | Enables secure, server-signed tokens |
| `ADMIN_TOKEN_SECRET` | yes (production) | Signs admin sessions. Use a long random string |
| `CLIENT_ORIGIN` | yes (production) | Your frontend URL, for CORS |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | optional | Persist rooms, chat, and admin accounts |
| `VITE_API_BASE`, `VITE_SOCKET_URL` | optional | Only when the frontend is hosted separately from the API |

Without Supabase, rooms are kept in memory and are cleared when the server restarts.

### Agora setup notes
- If `AGORA_APP_CERTIFICATE` is empty, the server returns `token: null`. That only works if your Agora project allows testing without tokens.
- To use the UDP-blocked-network fallback, enable **Cloud Proxy** for your project in the Agora Console.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (with `--watch`) and Vite dev server together |
| `npm run build` | Production build of the frontend into `dist/` |
| `npm start` | Start the Express server. It also serves `dist/` if it exists |

## Deployment

Build with `npm run build`, then run `npm start`. The Express server serves the API, Socket.IO, and the built frontend from a single process, so any Node host works (Render, Railway, Fly.io, a VPS, and so on).

You can also host the frontend separately as a static site (a `netlify.toml` is included). In that case, set `VITE_API_BASE` and `VITE_SOCKET_URL` to your API's URL at build time.

## Project structure

```
src/
  server.js            Express + Socket.IO server, Agora token endpoint
  components/          React pages and UI (CallRoom, HomePage, AdminPage, ...)
  hooks/               useVoiceAnnounce (join/leave chimes)
  lib/
    api.ts             HTTP helper and local session storage
    voice.ts           Agora token fetch, join with cloud-proxy fallback, diagnostics
public/                Logo and memoji avatars
```

## Support

If you enjoy MySpeak, you can support it at [myspeak.team/donate](https://myspeak.team/donate).
