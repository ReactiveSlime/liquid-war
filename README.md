**Liquid Wars — Web Client (v7 - network)**

- **Overview:** Browser-based remake of Liquid Wars. This site contains the UI, game loop, and multiplayer client that connects to the Node/Socket.IO server. The client is written as ES modules and imports the Socket.IO client from a CDN.
- **Main behaviour:** Local single-player mode or multiplayer via the multiplayer server. Multiplayer uses a host-authoritative model: the host creates the room and broadcasts game state; other clients receive updates and send inputs (player positions, ready state).

**Quick Start (recommended)**
- Serve the site files over HTTP (recommended):
  - From `web/v7 - network` run a static server, for example:

    # Python 3
    python -m http.server 8080

    # Or using npm (if installed globally)
    npx http-server -p 8080

  - Then open: http://localhost:8080 (or open the `index.html` file directly in the browser—module imports may be blocked by some browsers when using file://)

- **Server URL:** Default server URL is `http://localhost:3000` (see `js/app.js`). To point the client at a different server, set `window.LIQUID_WARS_SERVER_URL` before loading the page or edit `js/app.js`.

**How the web client and server communicate**
- The web client uses Socket.IO (client ESM from CDN) to connect to the multiplayer server. The client calls events such as `create-room`, `join-room`, `start-game`, `player-position`, and listens for `game-state-update`, `player-position`, `game-started`, etc. The server relays, coordinates rooms, and broadcasts messages to room members.

**Entry points & important files**
- **index.html:** Main HTML shell and UI containers. See [web/v7 - network/index.html](web/v7%20-%20network/index.html#L1-L200)
- **js/app.js:** Bootstraps the application, constructs `MultiplayerClient`, initializes UI and game loop. See [web/v7 - network/js/app.js](web/v7%20-%20network/js/app.js#L1-L200)
- **js/multiplayer.js:** Socket.IO client wrapper; exposes high-level methods: `createRoom`, `joinRoom`, `updateSettings`, `startGame`, `sendGameState`, `sendPlayerPosition`, etc. See [web/v7 - network/js/multiplayer.js](web/v7%20-%20network/js/multiplayer.js#L1-L400)
- **js/multiplayer-ui.js:** Connects `MultiplayerClient` events to DOM controls (create/join room dialogs, lobby, ready/start flow). See [web/v7 - network/js/multiplayer-ui.js](web/v7%20-%20network/js/multiplayer-ui.js#L1-L400)
- **js/game.js:** Core game logic and host/client message handling (applyRemoteGameState, applyHostPlayerPosition, etc.). See [web/v7 - network/js/game.js](web/v7%20-%20network/js/game.js#L1-L200)
- **js/state.js:** Holds client state (single vs multiplayer, running flags, mp host flag).
- **js/render.js / js/input.js / js/layout.js:** Rendering, input capture and responsive layout helpers.
- **js/map-normal.js / js/map-custom.js:** Built-in map handling and custom map file handling.
- **js/config.js:** Key constants (team count, default sizes, MAP_COUNT). See [web/v7 - network/js/config.js](web/v7%20-%20network/js/config.js#L1-L80)

**File responsibilities (short)**
- `app.js` — bootstrap, wire multiplayer client to game, start main loop.
- `multiplayer.js` — network client API: connection, room lifecycle, event wiring.
- `multiplayer-ui.js` — UI for lobby, create/join flows, map sync, ready/start.
- `ui-controller.js` / `ui.js` — DOM overlays, HUD, in-game controls.
- `game.js` / `state.js` / `render.js` — game engine logic and drawing.
- `map-custom.js` — reads user-supplied collision/display images and converts to data URLs to send to host/players.

**Start sequence (typical)**
1. Start the server (see server/README.md). Default server: `http://localhost:3000`.
2. Serve the web folder (see Quick Start above) and open the page in the browser.
3. Use the UI to: select Multiplayer → Create Room (host) or Join Room (client).
4. Host updates settings and starts the match. Host then broadcasts game snapshots to clients.

**Notes & common pitfalls**
- `index.html` loads JS modules; serving over HTTP is recommended to avoid CORS/ESM restrictions in some browsers.
- The server helper scripts (`start-server.bat` and `start-server.ps1`) reference older paths in their output text in places (for example they mention `web/v5 - multiplayer/index.html`). Open `web/v7 - network/index.html` instead in this workspace.
- Custom maps are transmitted as data URLs (base64) via `sync-custom-map` events — large files may be slow to transfer.

If you want I can also add a small `serve` npm script or an example `docker-compose` to launch both the web static server and the Node server together.
