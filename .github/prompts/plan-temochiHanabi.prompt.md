# Plan: Multiplayer Sparkler Game (線香花火)

**TL;DR**  
Build a web-based multiplayer game where participants keep their smartphones still using the accelerometer sensor. Backend (Python) tracks cumulative movement; players are eliminated when they exceed a threshold. Host dashboard displays all sparklers in real-time. Architecture: Python WebSocket server + vanilla HTML/CSS/JS frontend, local deployment, supports 2-10 players per session.

---

## Steps

### Phase 1: Core Infrastructure Setup (*foundational*)
1. **Backend structure** — Create Python WebSocket server (Flask + Flask-SocketIO or FastAPI + websockets)
   - Define game state model (players, scores, game status)
   - Implement player join/leave handlers
   - Set up real-time broadcast system for updates
   
2. **Frontend structure** — Create vanilla JS single-page app with routes:
   - Host dashboard (`/host`)
   - Player participant page (`/play`)
   - QR code generation page (`/qr`)

3. **WebSocket communication protocol** — Define message types:
   - `player_join`, `accelerometer_data`, `player_eliminated`, `game_end`, `game_status_update`
   - Server broadcasts elimination and status changes to all connected clients

### Phase 2: Accelerometer & Movement Detection (*depends on Phase 1*)
4. **Accelerometer API integration** — Implement on player client:
   - Request `DeviceMotionEvent` permission (iOS 13+)
   - Poll accelerometer at 50-100ms intervals
   - Calculate acceleration magnitude: $\sqrt{x^2 + y^2 + z^2}$

5. **Movement score calculation** — Server-side logic:
   - Accumulate squared acceleration values over time (cumulative score)
   - Define elimination threshold (e.g., 200 arbitrary units; tuned empirically)
   - Track per-player score in real-time

### Phase 3: Game State & Elimination (*depends on Phase 2*)
6. **Game lifecycle** — Server manages:
   - Waiting state: accept player joins, show QR code
   - Active state: track accelerometer data, check for eliminations, broadcast status
   - End state: declare winner, prevent new joins
   - No respawning—one shot per game

7. **Elimination logic** — When player exceeds threshold:
   - Mark player as eliminated
   - Remove from active player list
   - Broadcast elimination event to all clients
   - If only 1 player remains → end game

### Phase 4: Host Dashboard UI (*parallel with Phase 3*)
8. **Host visualization** — Responsive grid layout:
   - Display each participant's sparkler side-by-side
   - Show real-time sparkler animation (particle effects, brightness)
   - Indicate eliminated/active status (greyed out or faded)
   - Optional: movement score bar per player, countdown timer

9. **Sparkler animation** — Canvas-based or CSS animation:
   - Particle system with gravity falloff
   - Brightness linked to movement score (dimmer = closer to death)
   - Realistic embers, sparks, trail effects
   - Frame-rate optimized (~30-60 FPS)

### Phase 5: Participant Client UI (*parallel with Phase 4*)
10. **Player screen** — Simple, mobile-optimized layout:
    - Large, centered sparkler animation
    - Movement score indicator (gauge/bar)
    - Status text ("Keep Still!", "Eliminated", "You Won!")
    - Accelerometer debugging info (optional, for testing)

### Phase 6: QR Code & Deployment (*depends on Phase 1*)
11. **QR code generation** — Server generates QR linking to `/play?sid=<session_id>`
    - Display on host screen for participants to scan
    - Session ID identifies the game room
    - No auth needed (single room assumption)

12. **Local deployment setup**:
    - Package backend as Python application (requirements.txt)
    - Serve frontend files via same server (static folder)
    - Document startup: `python app.py`, then open `http://localhost:5000/host`
    - Network access for local LAN (participants join from same WiFi)

### Phase 7: Testing & Tuning (*final*)
13. **Calibration**:
    - Empirically tune accelerometer sensitivity and elimination threshold
    - Test with 2-10 participants simultaneously
    - Verify WebSocket reliability under network conditions

---

## Relevant Files (to be created)

### Backend (Python)
- `server.py` — Flask/FastAPI app with SocketIO, game state management, elimination logic
- `game_state.py` — Player, GameSession models; score calculation functions
- `requirements.txt` — Dependencies (flask, flask-socketio, python-socketio, etc.)

### Frontend (HTML/CSS/JS)
- `index.html` — Static HTML entry point with routing logic
- `host.html` / `play.html` — Host dashboard and player screens (embedded or separate templates)
- `host.js` — Logic for host dashboard, rendering sparklers, WebSocket client
- `player.js` — Logic for player screen, accelerometer polling, WebSocket client
- `sparkler.js` — Particle animation engine for realistic sparkler visuals
- `styles.css` — Responsive mobile-first styling

---

## Verification

1. **Unit tests** — Test score calculation logic (edge cases: zero movement, extreme acceleration values)
2. **Integration tests** — Simulate 5 players joining, accelerometer events, elimination triggers
3. **Manual testing checklist**:
   - ✓ Host screen displays QR code
   - ✓ 3 phones scan QR and join (WebSocket connects)
   - ✓ Host sees all 3 sparklers animating in real-time
   - ✓ One participant shakes phone → sparkler dims, score increases
   - ✓ Score exceeds threshold → player eliminated, host dashboard updates
   - ✓ Winner declared when 1 player remains
   - ✓ Mobile responsive (landscape/portrait)
   - ✓ Low-latency (<200ms) updates across 5+ devices on local WiFi

---

## Decisions & Assumptions

- **Single room only**: No room codes, room management, or multi-session support—simplifies backend
- **Cumulative score, no recovery**: Encourages tension throughout the game
- **Local WiFi deployment**: No public internet hosting required; participants must be on same network
- **Python backend**: Simpler WebSocket setup with Flask-SocketIO; faster development
- **Vanilla JS frontend**: No build step, lightweight, runs everywhere (modern browsers with Accelerometer API support)
- **No database**: Game state lives in server memory; resets on server restart (acceptable for event/classroom use)
- **iOS 13+ requirement**: Accelerometer requires permission; older iOS versions not supported

---

## Further Considerations

1. **Accelerometer sensitivity by device** — Different phones may report different acceleration ranges. Should we include a calibration phase at game start where players hold still to establish a baseline noise level?

2. **Network latency / clock sync** — If players experience high latency, movement scores may feel unfair. Should server assign timestamps to accelerometer events, or is client-side tracking sufficient for a casual game?

3. **Realistic sparkler animation quality** — Canvas-based particle system vs. CSS animations vs. WebGL? What frame rate/quality target? (Consider battery usage on player phones.)
