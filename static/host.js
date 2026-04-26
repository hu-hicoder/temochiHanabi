/**
 * Host Dashboard Client
 * Displays game state, QR code, and all player sparklers
 */

let socket;
let sessionId = 'default';
let currentSession = null;
let gameStarted = false;

// Keep track of individual sparkler animators per player
const playerSparklers = {}; // { player_id: SparklerAnimator }

/**
 * Initialize host client
 */
function initHost() {
    // Create WebSocket connection
    socket = io();
    
    // Set up socket events
    socket.on('connected', onConnected);
    socket.on('session_update', onSessionUpdate);
    socket.on('game_started', onGameStarted);
    socket.on('player_eliminated', onPlayerEliminated);
    socket.on('game_ended', onGameEnded);
    socket.on('error', onError);
    
    // Generate QR code
    generateQRCode();
    
    // Request initial session state
    socket.emit('request_session_update', {
        session_id: sessionId
    });
}

/**
 * Generate QR code
 */
function generateQRCode() {
    fetch('/qr')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const qrImage = document.getElementById('qrImage');
                const qrLoading = document.getElementById('qrLoading');
                
                qrImage.src = data.qr_image;
                qrImage.style.display = 'block';
                qrLoading.style.display = 'none';
                
                document.getElementById('playUrl').textContent = data.play_url;
            } else {
                console.error('QR generation failed:', data.error);
            }
        })
        .catch(error => {
            console.error('QR fetch error:', error);
        });
}

/**
 * Render sparklers grid
 */
function renderSparklers() {
    const grid = document.getElementById('sparklersGrid');
    
    if (!currentSession || !currentSession.players || currentSession.players.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">参加者がいません</p>';
        return;
    }
    
    // Create grid items
    let html = '';
    for (const player of currentSession.players) {
        const isEliminated = player.is_eliminated;
        const scoreRatio = Math.min(player.movement_score / 200, 1.0);
        
        html += `
            <div class="sparkler-item ${isEliminated ? 'eliminated' : ''}">
                <div class="sparkler-canvas-container">
                    <canvas class="player-canvas" id="canvas-${player.player_id}" width="200" height="250"></canvas>
                </div>
                <div class="sparkler-info">
                    <div class="player-name">${player.name}</div>
                    <div class="score-bar-small">
                        <div class="score-bar-fill" style="width: ${scoreRatio * 100}%;"></div>
                    </div>
                    <div class="score-text">${Math.floor(player.movement_score)}</div>
                </div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // Initialize or update sparkler animators
    for (const player of currentSession.players) {
        const canvasId = `canvas-${player.player_id}`;
        const canvas = document.getElementById(canvasId);
        
        if (canvas && !playerSparklers[player.player_id]) {
            // Create new sparkler
            const sparkler = new SparklerAnimator(canvasId);
            sparkler.start();
            playerSparklers[player.player_id] = sparkler;
        }
        
        // Update sparkler state: time-based progression + shake stress
        if (playerSparklers[player.player_id]) {
            const scoreRatio = Math.min(player.movement_score / 200, 1.0);
            playerSparklers[player.player_id].setStress(scoreRatio);
            playerSparklers[player.player_id].setBurnStartTime(currentSession.started_at);
            
            // Stop animation if eliminated
            if (player.is_eliminated && playerSparklers[player.player_id].isAnimating) {
                playerSparklers[player.player_id].stop();
            }
        }
    }
    
    // Clean up eliminated sparklers (keep in DOM but stop animation)
    for (const playerId in playerSparklers) {
        const player = currentSession.players.find(p => p.player_id === playerId);
        if (!player) {
            // Player left session, clean up
            playerSparklers[playerId].stop();
            delete playerSparklers[playerId];
        }
    }
}

/**
 * Update header status
 */
function updateHeaderStatus() {
    if (!currentSession) return;
    
    const statusBadge = document.getElementById('gameStatus');
    const playerCount = document.getElementById('playerCount');
    
    // Update status
    statusBadge.textContent = getStatusText(currentSession.status);
    statusBadge.className = `status-badge ${currentSession.status}`;
    
    // Update player count
    playerCount.textContent = `参加者: ${currentSession.active_count || 0}人`;
}

/**
 * Get status text
 */
function getStatusText(status) {
    switch(status) {
        case 'waiting': return '待機中';
        case 'active': return 'ゲーム中';
        case 'ended': return '終了';
        default: return status;
    }
}

/**
 * Start game button handler
 */
function startGame() {
    if (!socket || !sessionId) return;
    
    socket.emit('start_game', {
        session_id: sessionId
    });
}

/**
 * Reset game button handler
 */
function resetGame() {
    // Reload page to restart
    window.location.reload();
}

/**
 * WebSocket: Connected
 */
function onConnected(data) {
    console.log('Host connected to server:', data);
}

/**
 * WebSocket: Session update
 */
function onSessionUpdate(data) {
    currentSession = data.session;
    console.log('Session update:', currentSession);
    
    updateHeaderStatus();
    renderSparklers();
}

/**
 * WebSocket: Game started
 */
function onGameStarted(data) {
    currentSession = data.session;
    gameStarted = true;
    
    console.log('Game started!');
    updateHeaderStatus();
    
    // Hide start button, show reset button
    document.getElementById('startGameBtn').style.display = 'none';
    document.getElementById('resetGameBtn').style.display = 'inline-block';
}

/**
 * WebSocket: Player eliminated
 */
function onPlayerEliminated(data) {
    currentSession = data.session;
    console.log(`Player ${data.player_name} eliminated!`);
    
    updateHeaderStatus();
    renderSparklers();
}

/**
 * WebSocket: Game ended
 */
function onGameEnded(data) {
    currentSession = data.session;
    const winnerName = data.winner_name;
    
    if (winnerName) {
        console.log(`Game ended! Winner: ${winnerName}`);
        alert(`🎉 ゲーム終了！\n優勝者: ${winnerName}`);
    } else {
        console.log('Game ended! Draw (no winner)');
        alert('ゲーム終了！\n全員脱落で引き分けです');
    }
    
    updateHeaderStatus();
    renderSparklers();
}

/**
 * WebSocket: Error
 */
function onError(data) {
    console.error('Socket error:', data);
    alert('エラー: ' + data.message);
}

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', initHost);

/**
 * Periodic session status request (fallback)
 */
setInterval(() => {
    if (socket) {
        socket.emit('request_session_update', {
            session_id: sessionId
        });
    }
}, 500);
