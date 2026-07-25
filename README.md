# MySpeak

A simple TeamSpeak-style voice group app built with React, Tailwind, Node.js, Socket.IO, and Agora.

## Features

- Public website asks only for a display name.
- Users see available groups live and join with one button.
- `/admin` lets an admin sign in, create groups, and close groups.
- Socket.IO tracks live room presence.
- Agora Web SDK powers voice-only audio calls.
- Optional server-side Agora RTC tokens through `agora-token`.

## Setup

1. Install Node.js 18 or newer.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` from `.env.example` and fill in your values:

```bash
cp .env.example .env
```

Required for real calls:

```bash
AGORA_APP_ID=your_agora_app_id
```

Recommended for production:

```bash
AGORA_APP_CERTIFICATE=your_agora_app_certificate
ADMIN_PASSWORD=change-this-password
ADMIN_TOKEN_SECRET=change-this-long-random-secret
```

4. Start the app:

```bash
npm run dev
```

Open:

- Website: `http://localhost:5173`
- Admin: `http://localhost:5173/admin`

## Notes

- If `AGORA_APP_CERTIFICATE` is empty, the server returns `token: null`. That works only when your Agora project allows tokenless testing.
- The backend stores groups in memory for speed and simplicity. Restarting the server clears groups.
- For deployment, run `npm run build` and then `npm start`. The Express server will serve the built frontend from `dist`.
