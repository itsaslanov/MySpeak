# MySpeak

Simple voice chat app shell using React, Tailwind, and Node.

## Setup

1. Open terminal in `MySpeak`.
2. Install dependencies:
   - `npm install` in root if using npm workspaces
   - or `cd client && npm install` and `cd ../server && npm install`
3. Update `client/src/AgoraVoice.js` with your Agora App ID.
4. Replace the dummy token logic in `server/index.js` with Agora token generation.

## Run

- Start backend: `cd server && npm start`
- Start frontend: `cd client && npm start`

## What it includes

- Signup/login with user code
- Add friend by code
- Create voice groups
- Agora voice join/leave UI

> This is a minimal prototype. Add secure password storage, real Agora tokens, and persistent DB for production.
