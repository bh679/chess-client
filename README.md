# Chess

A chess game built to practice working with Claude. Runs in the browser with a companion server for persistent game storage.

## Documentation

- [Wiki](https://github.com/bh679/Chess/wiki) — full project documentation
- [Roadmap & Project Board](https://github.com/users/bh679/projects/1) — live feature tracking
- [Agents](https://github.com/bh679/Chess/wiki/Agents) — AI agents that manage and build the project

## Features

### [Core Gameplay](https://github.com/bh679/Chess/wiki/Features)
- [**Full chess rules**](https://github.com/bh679/Chess/wiki/Feature:-Game-Rules-Engine) — powered by chess.js, supporting castling, en passant, pawn promotion, check, checkmate, stalemate, insufficient material, threefold repetition, and 50-move rule
- [**Chess960 (Fischer Random Chess)**](https://github.com/bh679/Chess/wiki/Feature:-Chess960) — randomized starting positions with bishops on opposite colors and king between rooks, enabled by default
- [**Click and drag-to-move**](https://github.com/bh679/Chess/wiki/Feature:-Chess-Board) — select a piece by clicking or drag it to a target square (mouse and touch supported)
- [**Legal move highlighting**](https://github.com/bh679/Chess/wiki/Feature:-Chess-Board) — selected pieces show available moves and captures
- [**Pawn promotion modal**](https://github.com/bh679/Chess/wiki/Feature:-Piece-Promotion) — choose between queen, rook, bishop, or knight
- [**Last move highlighting**](https://github.com/bh679/Chess/wiki/Feature:-Move-Animations) — the most recent move is highlighted on the board
- [**Premoves**](https://github.com/bh679/Chess/wiki/Feature:-Premoves) — queue a move during the opponent's turn that executes instantly when your turn begins (settings toggle, default off)

### [AI Opponents](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents)
- [**Stockfish WASM engine**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — full Stockfish chess engine running as a Web Worker
- [**Independent AI per side**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — enable AI for white, black, or both independently
- [**ELO-based difficulty**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — adjustable from 100 to 3200 ELO per side using Skill Level (low ELO) and UCI_LimitStrength (high ELO)
- [**AI vs AI mode**](https://github.com/bh679/Chess/wiki/Feature:-AI-vs-AI) — watch two engines play against each other at different strengths
- [**Deferred start**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — when AI plays white, a Start button appears so you can configure settings first
- [**Board orientation for AI games**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — board automatically flips when playing as Black against AI, matching multiplayer behaviour
- [**Correct player names on game start**](https://github.com/bh679/Chess/wiki/Feature:-AI-Opponents) — engine name and Human label appear immediately when starting an AI game, even after leaving a multiplayer session

### [Interactive Player Bars](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration)
- [**Player info display**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — shows player name, ELO (for AI), type icon, and timer for each side
- [**Click icon to toggle AI**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click the player icon (pre-game) to switch between Human and AI
- [**Click ELO to adjust**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click the ELO label (pre-game) to open an inline slider popup
- [**Click timer to change time**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click either timer (pre-game) for a time control dropdown
- [**Editable player names**](https://github.com/bh679/Chess/wiki/Feature:-Player-Configuration) — click any player name to rename it (works anytime, persists to database)
- [**Persistent player name**](https://github.com/bh679/Chess/wiki/Feature:-Player-Name-Cache) — name is cached in localStorage and pre-filled automatically in future sessions

### [Timers](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls)
- [**Preset time controls**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — Bullet 1+0, Blitz 3+2, Rapid 5+0, Rapid 10+0, Classical 30+0
- [**Custom time control**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — set minutes per side and increment, with optional different time per player (time odds)
- [**Timeout detection**](https://github.com/bh679/Chess/wiki/Feature:-Time-Controls) — automatic win on time with visual indicator
- [**Custom time controls for friend games**](https://github.com/bh679/chess-client/wiki/Feature:-Custom-Time-Controls-for-Friend-Games) — set any minutes+increment when creating a friend game; supports time odds (different time per player) with "Your time / Opponent's time" labels that follow you after random color assignment

### [Art Styles](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles)
- [**Classic**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — traditional SVG chess pieces
- [**Pixel**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — pixel art style
- [**Neo**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — bold modern style
- [**Fish**](https://github.com/bh679/Chess/wiki/Feature:-Art-Styles) — fish/sea creature themed pieces

### [Sound Effects](https://github.com/bh679/chess-client/wiki/Feature:-Sound-Effects)
- [**Piano sound effects**](https://github.com/bh679/chess-client/wiki/Feature:-Sound-Effects) — distinct sounds for piece moves, captures, check, checkmate/draw, and game start (MIT-licensed Lichess piano audio)
- [**Sound Effects toggle**](https://github.com/bh679/chess-client/wiki/Feature:-Sound-Effects) — enable/disable in the Display settings section (default on, persists across reloads)

### [Animations](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations)
- [**Move animations**](https://github.com/bh679/Chess/wiki/Feature:-Move-Animations) — smooth piece movement with easing
- [**Combat animations**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — unique per-piece capture animations (pawn thrust, knight leap, bishop slash, rook crush, queen spin, king sword swing)
- [**Enhanced combat effects**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — screen shake, impact flashes, and particle systems
- [**Animation toggle**](https://github.com/bh679/Chess/wiki/Feature:-Combat-Animations) — turn all animations on/off

### [Game Database & History](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage)
- [**Local-first persistence**](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage) — all game data (moves, results, metadata) is written to localStorage immediately and never blocks gameplay; a background sync timer pushes data to the server every 10 seconds
- [**Offline resilience**](https://github.com/bh679/Chess/wiki/Feature:-Local-Storage) — if the server is down, games are fully preserved locally and sync automatically when connectivity returns
- [**Idempotent sync**](https://github.com/bh679/Chess/wiki/Feature:-Server-Sync) — duplicate moves are safely deduplicated via server-side UNIQUE constraints; partial syncs resume from where they left off
- [**Server-side storage**](https://github.com/bh679/Chess/wiki/Feature:-Server-Sync) — synced games are stored via REST API in a SQLite database (see [chess-api](https://github.com/bh679/chess-api))
- [**Game history browser**](https://github.com/bh679/Chess/wiki/Feature:-Game-Browser) — browse past games with player info, results, and move counts
- [**Replay viewer**](https://github.com/bh679/Chess/wiki/Feature:-Replay-Viewer) — step through any saved game move by move with:
  - Reconstructed board positions
  - Horizontal move strip with scroll navigation (consolidated into live-move-bar below board — no duplicate controls)
  - Reconstructed clock display from move timestamps
  - Playback controls (play/pause, step forward/back, jump to start/end)
  - Keyboard navigation (arrow keys, space for play/pause)
- [**URL routing**](https://github.com/bh679/Chess/wiki/Feature:-URL-Routing) — shareable hash-based URLs for game views (`/#/replay?gameid=42`, `/#/games`, `/#/history`, `/#/live`); URL updates live as you navigate with no page refresh; path-based URLs redirect to hash equivalents

### [Analysis](https://github.com/bh679/Chess/wiki/Feature:-Board-Analysis)
- [**Post-game summary**](https://github.com/bh679/Chess/wiki/Feature:-Post-Game-Summary) — chess.com-style summary screen with win-probability-based per-player accuracy, per-player average move time, and 10 move classification types (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder); auto-triggers after every game, also available via "Game Summary" button in replay mode; multiplayer game summary uses coordinate-based move replay for reliable reconstruction across all game modes; avg move time shows immediately during analysis and for multiplayer games; tapping the move time stat cycles through avg/median/longest/shortest on both desktop and mobile
- [**Board analysis**](https://github.com/bh679/Chess/wiki/Feature:-Board-Analysis) — Stockfish-powered position evaluation with move classification arrows and accuracy percentages

### [Automation](https://github.com/bh679/Chess/wiki/Blogging-Agent)
- [**Weekly blog**](https://github.com/bh679/Chess/wiki/Blogging-Agent) — automated weekly development blog posts generated via GitHub Actions and the Anthropic API; publishes to `blog/` directory every Monday

### [User Accounts](https://github.com/bh679/Chess/wiki/Feature:-User-Accounts)
- **Local auth** — register and sign in with username/password (bcrypt hashing, JWT tokens)
- **User profile** — view Glicko-2 ratings (Bullet/Blitz/Rapid/Classical), game history with full filters (result, player type, game type, time control, elo range)
- **Clickable game rows** — click any game in your profile to replay it
- **Friends system** — add friends, accept/reject requests, view friend list
- **Settings sync** — user settings persist across sessions via the server
- **Game claiming** — games are linked to your account at creation; pre-login games are batch claimed on sign-in

### [Deployment](https://github.com/bh679/Chess/wiki/Feature:-Deployment-Status-Page)
- [**Deployment status page**](https://github.com/bh679/Chess/wiki/Feature:-Deployment-Status-Page) — standalone page showing real-time deployment progress with step-by-step status, elapsed timer, deployment history, and auto-redirect on completion; index.html redirects visitors to the deployment page during active deploys
- [**Reliable deploy script**](https://github.com/bh679/chess-client/wiki/Feature:-Deploy-Script-Git-Reset) — deploy script uses `git fetch + reset --hard` instead of `git pull` to prevent deployment failures when the production server has local modifications (e.g. package.json modified after npm install)

### UI
- [**Captured pieces display**](https://github.com/bh679/Chess/wiki/Feature:-Captured-Pieces) — shows captured pieces with material advantage indicators
- [**Responsive layout**](https://github.com/bh679/Chess/wiki/Feature:-Responsive-Design) — works on desktop and mobile
- [**Settings panel**](https://github.com/bh679/Chess/wiki/Feature:-Settings-Panel) — collapsible panel with all game configuration options
- [**Archive menu**](https://github.com/bh679/Chess/wiki/Feature:-Archive-Browser) — dynamic archive discovery with navigation between versions; opens in new tab from main app, same tab within archives
- [**Video board squares**](https://github.com/bh679/Chess/wiki/Feature:-Video-Board-Squares) — during video calls, camera feeds display as a mosaic across the board (white player on light squares, black player on dark squares) using CSS checkerboard masks
- [**Video feed color tint**](https://github.com/bh679/Chess/wiki/Feature:-Video-Feed-Color-Tint) — board-colored tint overlay on video feeds indicating whose turn it is (10% on active side, 30% on waiting side)
- [**Face tracking video centering**](https://github.com/bh679/Chess/wiki/Feature:-Face-Tracking-Video-Centering) — real-time face detection (MediaPipe) centers and normalizes faces on the board; white player offset left, black player offset right for a facing-each-other effect
- [**Hidden video popup on board**](https://github.com/bh679/Chess/wiki/Feature:-Hide-Video-Popup-on-Board) — when video board mode is active, the floating video popup is hidden to avoid redundancy
- [**WebRTC reliability fix**](https://github.com/bh679/Chess/wiki/Feature:-WebRTC-ICE-Fix) — ICE candidate queuing prevents race-condition drops; dynamic TURN server config via `/api/chess/ice-servers` for NAT traversal
- [**Cropped video stream**](https://github.com/bh679/chess-client/wiki/Feature:-Cropped-Video-Stream) — face-tracked 480×480 canvas stream transmitted over WebRTC instead of raw camera; face tracking runs only on the local feed; both players see identical output regardless of board size
- [**Video chat reliability**](https://github.com/bh679/chess-client/wiki/Feature:-Video-Chat) — Chrome-compatible face tracking (off-screen video instead of display:none), race condition fix for remote stream on joiners, face tracking fallback to raw camera, explicit play() for iOS Safari
- [**Video reconnection**](https://github.com/bh679/chess-client/wiki/Feature:-Video-Reconnection) — automatic ICE restart when WebRTC connection drops (network hiccup, iOS backgrounding); up to 5 attempts with exponential backoff; "Reconnecting video..." toast shown during recovery; remote track mute/unmute detection for iOS camera interruptions
- [**Inline lobby panel**](https://github.com/bh679/chess-client/wiki/Feature:-Lobby-Redesign) — pre-game lobby shown inline below the board (not a modal); room code in header; pieces faded at 30% opacity; camera feed on board squares during lobby preview; ready button with dynamic labels
- [**Simplified friend modal**](https://github.com/bh679/chess-client/wiki/Feature:-Simplify-Friend-Modal) — Play with Friend step reduced to Create Room + Join; camera mode (Board Face / King Cam / No Cam) moved to lobby panel alongside TC, Variant, and Colors
- **Lobby flash on board touch** — tapping or clicking the board during the pre-game lobby flashes the lobby panel with a glowing border ring to draw attention to the Ready button
- [**Waiting room settings**](https://github.com/bh679/chess-client/wiki/Feature:-Waiting-Lobby-Settings) — when a host creates a Friend game, the inline lobby panel opens immediately below the board; TC and Variant (Chess960) are configurable while waiting for the opponent; settings persist when the opponent joins
- [**Submit issue flag in lobby**](https://github.com/bh679/chess-client/wiki/Feature:-Lobby-Issue-Flag) — the ⚑ issue report button now appears in the waiting room (while waiting for opponent) and in the lobby panel (once both players connect), not just during active games
- [**Resign on New Game**](https://github.com/bh679/chess-client/wiki/Feature:-Resign-on-New-Game) — clicking New Game during an active multiplayer game shows a "Resign Game?" confirmation; confirming resigns the current game, disconnects, and opens the new game menu
- [**Exit Current Game**](https://github.com/bh679/chess-client/wiki/Feature:-Exit-Current-Game) — after confirming resignation/abandonment, the new game menu shows a red "Exit Current Game" button at the bottom; clicking it resets the board to a fresh start state without starting a new game
- [**Hard Reset**](https://github.com/bh679/chess-client/wiki/Feature:-Hard-Reset) — consolidated cleanup function that fully resets game state, network connections, video feeds, and UI when exiting a multiplayer game or lobby
- [**Exit Game button**](https://github.com/bh679/chess-client/wiki/Feature:-Exit-Game-Button) — the New Game button contextually becomes a red "Exit Game" button when in an online game, lobby, waiting room, post-game summary, or shared replay; clicking it shows a confirmation and exits cleanly to a fresh local game
- [**Public lobbies**](https://github.com/bh679/chess-client/wiki/Feature:-Public-Lobbies) — hosts can toggle a globe button in the waiting room to make their lobby discoverable; other players see public rooms listed in the Play with Friend menu and can join with one click
- [**Game title/status in waiting room & lobby**](https://github.com/bh679/Chess/wiki/Feature:-Game-Title-Lobby-Status) — the header status bar updates to show "Hosting · 5+0" in the waiting room and "vs Name · 5+0" in the lobby; updates live as settings change; browser tab title mirrors the state
- [**Public lobby list below board**](https://github.com/bh679/chess-client/wiki/Feature:-Public-Lobby-List) — open public games appear in an "Open Games" panel directly below the board, auto-refreshing every 5 seconds; each listing shows the host name, time control, variant, and camera mode (e.g. `Alice — 5+0 · King·Cam`); players can join with one click without opening the New Game wizard
- [**Per-player connection status**](https://github.com/bh679/chess-client/wiki/Feature:-Per-Player-Connection-Status) — two separate inline connection dots, one next to each player's name in the player bars; visible during waiting room (host only), lobby, and in-game; shows colored text + dot for non-connected states (e.g. `Disconnected ●` in red)
- [**Split Cam mode**](https://github.com/bh679/chess-client/wiki/Feature:-Split-Cam) — new camera mode where the left half of the board shows white player's camera and the right half shows black player's camera; board color tints indicate whose turn it is
- [**Connection & video diagnostics**](https://github.com/bh679/chess-client/wiki/Feature:-Connection-and-Video-Logging) — 12 new diagnostic events covering WebSocket reconnect attempts, heartbeat timeouts, room-lost errors, camera acquisition/denial, video call start/fail, and ICE reconnect lifecycle; critical failure events flush immediately for maximum delivery reliability
- [**Analysis Controller extraction**](https://github.com/bh679/chess-client/wiki/Feature:-Analysis-Controller) — refactored 12 analysis display functions and 3 state variables from `app.js` into a dedicated `AnalysisController` ES6 module; shared constants eliminate duplication between app.js and replay.js
- **Audio/video issue checkbox** — the "Audio / video issue" category is now shown in the issue reporter for all games, not only King-Cam video games
- [**Rematch button fix**](https://github.com/bh679/chess-client/wiki/Feature:-Rematch-Fix) — rematch button text now resets to "Rematch" on every game-over; previously it could get stuck showing "Accept" from a prior game, causing the server to unilaterally start a new game when clicked
- [**Diagnostics Dashboard**](https://github.com/bh679/chess-client/wiki/Feature:-Diagnostics-Dashboard) — client-side diagnostics dashboard at `dashboard.html` with dark theme UI; displays session events, WebRTC summaries, game navigation, category filters, and issue reports; fetches data from JSON API endpoints; shows client and API version numbers in the header
- [**Video lobby fix**](https://github.com/bh679/chess-client/wiki/Feature:-Video-Lobby-Fix) — guards against duplicate WebRTC signaling that caused video/audio to fail in the lobby; server prevents duplicate `video_start` broadcasts, client prevents redundant `startCall()` and rejects stale SDP answers
- [**Lobby performance**](https://github.com/bh679/chess-client/wiki/Feature:-Lobby-Performance) — diff-based lobby list rendering, event-driven dev mode check, idle-aware database sync, and reduced polling overhead for smoother lobby experience
- [**Connection status in lobby**](https://github.com/bh679/chess-client/wiki/Feature:-Connection-Status-in-Lobby) — the connection status label ("Connected", "Reconnecting...", "Opponent disconnected", etc.) now appears inside the lobby panel as well as during active games
- **Split-cam color fix** — camera feeds in Side by Side / Top-Bottom modes no longer vanish when the board is re-oriented due to a color preference change in the lobby

## Roadmap

See the [project roadmap](https://github.com/bh679/Chess/wiki/Roadmap) for planned features, priorities, and status tracking.

## Dependencies

### Server (required for game history)

The game database runs on a separate Node.js server: **[chess-api](https://github.com/bh679/chess-api)**

The client uses a local-first architecture: all game data is written to localStorage immediately and synced to the server in the background. If the server is unreachable, games are fully preserved locally and sync when connectivity returns. The game history browser and replay viewer require server connectivity to fetch past games.

| Dependency | Version | Purpose |
|------------|---------|---------|
| chess-api server | >= 1.10.0000 | Game storage REST API (SQLite) |
| Apache mod_proxy | any | Proxies `/api/*` to the Node.js server |

### Client-side (bundled, no install needed)

| Library | Purpose |
|---------|---------|
| chess.js | Chess rules engine |
| Stockfish WASM | AI opponent (Web Worker) |

## Getting Started

No build step or install needed. Open `index.html` in a browser or serve the directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

For full functionality (game saving and history), set up the [chess-api](https://github.com/bh679/chess-api) server and configure Apache to proxy `/api` requests.

## Project Structure

```
index.html              Main HTML page
deploying.html          Deployment status page (standalone)
css/style.css           Board and UI styles
css/deploy.css          Deployment status page styles
css/combat-enhanced.css Combat animation effects (shake, flash, particles)
js/app.js               App entry point, game flow, player bar controls
js/game.js              Game state wrapper around chess.js
js/board.js             Board rendering, click/drag interaction, promotion UI
js/combat.js            Combat animation system for captures
js/timer.js             Chess timer with increment support
js/ai.js                Stockfish WASM integration via Web Worker (UCI protocol)
js/database.js          Local-first game persistence with background server sync
js/browser.js           Game history browser UI
js/analysis.js          Post-game position analysis, 10-type move classification
js/post-game-summary.js Post-game summary modal (accuracy, classification grid)
js/auth.js              Auth service (register, login, logout, JWT, batch claim)
js/auth-ui.js           Sign-in/register modals, user badge with dropdown
js/profile.js           Profile modal with ratings and filtered game list
js/friends.js           Friends modal (add, accept, reject, remove)
js/replay.js            Replay viewer with board, move strip, and clock reconstruction
js/replay-controller.js Replay mode controller (navigation, playback, clock reconstruction)
js/live-move-bar.js     Live move bar and live review mode (persistent strip during active games)
js/face-tracker.js      Face detection (MediaPipe) for video board centering
js/video-board.js       Video board mode (camera feeds as board mosaic)
js/split-cam.js         Split Cam mode (left half = white player, right half = black player)
js/split-cam-h.js       Top/Bottom Cam mode (local player always bottom, remote always top)
js/cropped-stream.js    Face-tracked canvas stream for WebRTC transmission
js/chess.js             chess.js engine (full rule enforcement)
js/lib/stockfish.js     Stockfish WASM engine (Web Worker)
blog/                   Weekly development blog (auto-generated)
img/pieces/             Classic SVG chess pieces
img/pieces-pixel/       Pixel art chess pieces
img/pieces-neo/         Neo bold chess pieces
img/pieces-fish/        Fish/sea creature chess pieces
```
