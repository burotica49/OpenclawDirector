# OpenClaw Director

**OpenClaw Director** is a web interface (Vite + React) to drive OpenClaw: **chat**, **task management (kanban)**, and an agents **workspace**.

- OpenClaw project (reference): [`openclaw/openclaw`](https://github.com/openclaw/openclaw)

## Prerequisites

- Node.js + npm
- An accessible OpenClaw gateway (for realtime features / sessions)

## Installation

```bash
npm install
```

## Start

```bash
npm run dev
```

By default, Vite picks an available port (often `5173`, otherwise `5174`, etc.).

## Configuration (env)

- **`VITE_APP_TOKEN`** (optional): enables the token authentication screen.
- **OpenClaw gateway connection**: depending on your setup, configure the WebSocket URL on the app side (see `src/services/websocket.ts`).

## Cloudflare Tunnel (sans exposer la gateway)

Objectif: **ne jamais exposer** `ws://127.0.0.1:18789` au public, tout en rendant l’UI accessible via `cloudflared`.

- **Principe**: un petit “backoffice” local sert `dist/` (UI) et expose `wss://<ton-domaine>/ws`, puis **proxy** en interne vers la gateway locale.

### 1) Build + lancer le backoffice

```bash
npm install
npm run build
HOST=127.0.0.1 PORT=3000 WS_PATH=/ws GATEWAY_WS_URL=ws://127.0.0.1:18789 npm run start
```

### 2) Configurer le front pour utiliser le proxy

Dans `.env` (ou `.env.production` / `.env.preview` selon ton usage) :

```env
VITE_WS_PATH=/ws
```

### 3) Tunnel Cloudflare

Fais pointer ton tunnel vers `http://127.0.0.1:3000` (HTTP + WebSocket).

## Pages / screens (with screenshots)

### 1) Authentication

![Authentication screen](docs/screenshots/01-auth.png)

### 2) Chat

![Chat screen](docs/screenshots/02-chat.png)

### 3) Kanban (tasks)

![Kanban screen](docs/screenshots/03-kanban.png)

### 4) Workspace

![Workspace screen](docs/screenshots/04-workspace.png)
