# OpenClaw Director

**OpenClaw Director** est une interface web (Vite + React) pour piloter OpenClaw : **chat**, **gestion de tâches (kanban)** et **workspace** des agents.

- Projet OpenClaw (référence) : [`openclaw/openclaw`](https://github.com/openclaw/openclaw)

## Prérequis

- Node.js + npm
- Une gateway OpenClaw accessible (pour les fonctionnalités temps-réel / sessions)

## Installation

```bash
npm install
```

## Démarrage

```bash
npm run dev
```

Par défaut Vite choisit un port disponible (souvent `5173`, sinon `5174`, etc.).

## Configuration (env)

- **`VITE_APP_TOKEN`** (optionnel) : active l’écran d’authentification par token.
- **Connexion gateway OpenClaw** : selon votre setup, configurez l’URL WebSocket côté app (voir `src/services/websocket.ts`).

## Pages / écrans (avec captures)

### 1) Authentification

![Écran Authentification](docs/screenshots/01-auth.png)

### 2) Chat

![Écran Chat](docs/screenshots/02-chat.png)

### 3) Kanban (tâches)

![Écran Kanban](docs/screenshots/03-kanban.png)

### 4) Workspace

![Écran Workspace](docs/screenshots/04-workspace.png)

## Générer / mettre à jour les captures d’écran

1) Démarrer l’app avec l’auth activée :

```bash
VITE_APP_TOKEN=OPENCLAW_DIRECTOR_DEMO npm run dev
```

2) Dans un autre terminal, lancer la capture (en adaptant le port si besoin) :

```bash
BASE_URL=http://127.0.0.1:5174 APP_TOKEN=OPENCLAW_DIRECTOR_DEMO npm run screenshots
```

Les images sont écrites dans `docs/screenshots/`.

