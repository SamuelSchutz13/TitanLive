<p align="center">
  <img src=".github/assets/logo.svg" alt="" width="72" />
</p>

<h1 align="center">TitanLive</h1>

<p align="center">
  <b>English</b> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  Watch together and talk live: share your screen and talk by voice with up to 10 people, right from the browser. No sign-up, no install, just send the link.
</p>

<p align="center">
  <img alt="NestJS 11" src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white" />
  <img alt="Socket.IO 4" src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white" />
  <img alt="WebRTC" src="https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc&logoColor=white" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/tests-Playwright%20%2B%20Jest-2ead33?logo=playwright&logoColor=white" />
</p>

<p align="center">
  <img src=".github/assets/room.png" alt="A TitanLive room: the shared screen on the left, people with status capsules and the chat with a voice note on the right" />
</p>

> [!NOTE]
> **Nothing is stored.** Rooms live only in the server's memory. Chat messages and files are relayed to whoever is in the room and disappear when you leave. Audio and video go peer to peer over WebRTC.

## Features

- **Rooms in one click**: a random link is the key. Only people with the link get in, up to 10 per room.
- **Screen sharing**: one person shares, everyone watches on the big stage.
- **Voice**: mic on/off with one button, and a gold ring shows who is speaking. Joined without a mic? Turn it on later.
- **Chat with media**: text, images, videos and audio files (up to 8 MB each), plus voice notes recorded right in the chat.
- **One dock for the call**: mic, screen sharing and leave sit together over the stage, and copy link sits next to the room name.
- **Who is here**: avatars of everyone in the room next to the counter, and status capsules for *you*, *muted* and *sharing*.
- **Reconnects by itself** when the connection drops.
- **English, Português and Español**, dark and light themes.
- **TURN ready**: a `docker-compose.yml` with coturn for people behind strict NAT.

## Screenshots

**Home**: create a room or paste a link.

<p align="center"><img src=".github/assets/home.png" alt="Home in Portuguese, dark theme" /></p>

**Light theme** and **Español**:

<p align="center">
  <img src=".github/assets/home-light-en.png" alt="Home in English, light theme" width="49%" />
  <img src=".github/assets/home-es.png" alt="Home in Spanish, dark theme" width="49%" />
</p>

## Getting started

You need [Node.js](https://nodejs.org) **20.19 or newer**.

```sh
git clone https://github.com/SamuelSchutz13/TitanLive.git
cd TitanLive

cd server && npm install && npm run start:dev   # http://localhost:3000
cd ../web && npm install && npm run dev         # http://localhost:5173
```

Open http://localhost:5173, pick a nickname and create a room.

### Configuration

`server/.env` (copy from `server/.env.example`):

| Variable                      | Description                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| `PORT`                        | Server port (default `3000`)                                        |
| `WEB_ORIGIN`                  | Allowed origin for the website (default: any)                       |
| `TURN_URLS`, `TURN_SECRET`    | TURN relay (coturn `use-auth-secret`). Empty means STUN only        |
| `OTEL_*`                      | OpenTelemetry export for `npm run start:prod` (SigNoz or any OTLP)  |

`web/.env`: `VITE_SERVER_URL` (default `http://localhost:3000`).

TURN for strict networks:

```sh
TURN_SECRET=change-me docker compose up -d   # set TURN_EXTERNAL_IP to the public IP in production
```

### Scripts

| Where     | Command              | What it does                                   |
| --------- | -------------------- | ---------------------------------------------- |
| `server/` | `npm run start:dev`  | Server with reload on port 3000                |
| `server/` | `npm run test:e2e`   | Jest: rooms, signaling, chat and files         |
| `server/` | `npm run start:prod` | Built server with OpenTelemetry                |
| `web/`    | `npm run dev`        | Vite with hot reload                           |
| `web/`    | `npm run build`      | Type-checks and builds into `web/dist`         |
| `web/`    | `npm run test:e2e`   | Playwright: real browsers joining real rooms   |

## Privacy and security

- **No accounts and no history.** Rooms exist in memory only while someone is in them.
- **Private by link.** Room codes are 96 random bits, generated in the browser.
- **Media is peer to peer.** The server only relays WebRTC signaling between people in the same room.
- **Files are checked and never saved.** Only `image/*`, `video/*` and `audio/*` up to 8 MB. They are relayed, not stored.
- **Limits at the server**: nickname up to 32 characters, messages up to 500, 5 messages every 5 seconds per person, 10 people per room.
- **TURN never relays into private networks**: coturn denies private and loopback ranges.

## How it works

```
browser (Vite + TypeScript)  ⇄  Socket.IO  ⇄  NestJS (signaling, chat)
        ⇅ WebRTC (screen + voice, peer to peer, TURN when needed)
browser  ⇄  browser
```

The Socket.IO events and errors are in [server/README.md](server/README.md), and Swagger runs at `http://localhost:3000/docs`.
