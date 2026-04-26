/**
 * Player Game Client
 * Handles accelerometer input, WebSocket communication, and UI updates
 */

let socket;
let sparkler;
let playerId = null;
let sessionId = 'default';
let playerName = null;
let currentSession = null;
let movementScore = 0;
let scoreThreshold = 200;
let gameActive = false;

// Accelerometer data
let accelData = { x: 0, y: 0, z: 0 };
let frameCount = 0;
let lastSendTime = 0;

/**
 * Initialize player client
 */
function initPlayer() {
    // Create WebSocket connection
    socket = io();
    
    // Set up socket events
    socket.on('connected', onConnected);
    socket.on('join_success', onJoinSuccess);
    socket.on('join_failed', onJoinFailed);
    socket.on('session_update', onSessionUpdate);
    socket.on('game_started', onGameStarted);
    socket.on('player_eliminated', onPlayerEliminated);
    socket.on('game_ended', onGameEnded);
    socket.on('error', onError);
    
    // Initialize sparkler animator
    sparkler = new SparklerAnimator('sparklerCanvas');
    sparkler.start();
    
    // Request accelerometer permission (iOS 13+)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        showPermissionRequest();
    } else if (typeof DeviceMotionEvent !== 'undefined') {
        // Android or older iOS
        startAccelerometerTracking();
    } else {
        updateStatusMessage('このデバイスは加速度センサーに対応していません');
    }
}

/**
 * Show permission request button (iOS 13+)
 */
function showPermissionRequest() {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.innerHTML = `
        <p>加速度センサーへのアクセスを許可してください</p>
        <button onclick="requestAccelerometerPermission()" style="padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            許可する
        </button>
    `;
}

/**
 * Request accelerometer permission (iOS 13+)
 */
function requestAccelerometerPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    startAccelerometerTracking();
                } else {
                    updateStatusMessage('加速度センサーの許可が拒否されました');
                }
            })
            .catch(error => {
                console.error('Permission request error:', error);
                updateStatusMessage('エラーが発生しました: ' + error.message);
            });
    } else {
        startAccelerometerTracking();
    }
}

/**
 * Start tracking accelerometer data
 */
function startAccelerometerTracking() {
    window.addEventListener('devicemotion', handleDeviceMotion, true);
    updateStatusMessage('静かにして...');
}

/**
 * Handle device motion event (accelerometer data)
 */
function handleDeviceMotion(event) {
    // Get acceleration
    const accel = event.acceleration;
    if (!accel) return;
    
    accelData.x = accel.x || 0;
    accelData.y = accel.y || 0;
    accelData.z = accel.z || 0;
    
    // Update debug display
    updateDebugInfo();
    
    // Send accelerometer data to server periodically (every 100ms ~10Hz)
    const now = Date.now();
    if (now - lastSendTime > 100 && playerId && gameActive) {
        sendAccelerometerData();
        lastSendTime = now;
    }
}

/**
 * Send accelerometer data to server
 */
function sendAccelerometerData() {
    if (!socket || !playerId || !gameActive) return;
    
    socket.emit('accelerometer_data', {
        player_id: playerId,
        accel_x: accelData.x,
        accel_y: accelData.y,
        accel_z: accelData.z,
        timestamp: Date.now()
    });
}

/**
 * Update score display and sparkler brightness
 */
function updateScoreDisplay() {
    const scoreRatio = Math.min(movementScore / scoreThreshold, 1.0);
    
    // Update score bar
    const scoreBar = document.getElementById('scoreBar');
    scoreBar.style.width = (scoreRatio * 100) + '%';
    
    // Color change: green -> yellow -> red
    if (scoreRatio < 0.5) {
        scoreBar.style.backgroundColor = '#4CAF50'; // Green
    } else if (scoreRatio < 0.8) {
        scoreBar.style.backgroundColor = '#FFC107'; // Yellow
    } else {
        scoreBar.style.backgroundColor = '#F44336'; // Red
    }
    
    // Update score text
    document.getElementById('scoreValue').textContent = Math.floor(movementScore);
    document.getElementById('scoreMax').textContent = Math.floor(scoreThreshold);
    
    // Update sparkler brightness
    sparkler.setBrightness(scoreRatio);
}

/**
 * Update debug information
 */
function updateDebugInfo() {
    frameCount++;
    document.getElementById('frameCount').textContent = frameCount;
    document.getElementById('accelDisplay').textContent = 
        `${accelData.x.toFixed(2)}, ${accelData.y.toFixed(2)}, ${accelData.z.toFixed(2)}`;
}

/**
 * Update status message
 */
function updateStatusMessage(message) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
}

/**
 * WebSocket: Connected
 */
function onConnected(data) {
    console.log('Connected to server:', data);
    
    // Join game with default session
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('sid') || 'default';
    playerName = `Player_${Math.random().toString(36).substr(2, 9)}`;
    
    socket.emit('join_game', {
        session_id: sessionId,
        player_name: playerName
    });
}

/**
 * WebSocket: Join successful
 */
function onJoinSuccess(data) {
    playerId = data.player_id;
    playerName = data.player_name;
    sessionId = data.session_id;
    
    console.log('Joined game:', data);
    
    // Update UI
    document.getElementById('playerNameDisplay').textContent = playerName;
    document.getElementById('gameStatusText').textContent = 'ホストがゲームを開始するまで待機中...';
}

/**
 * WebSocket: Join failed
 */
function onJoinFailed(data) {
    console.error('Join failed:', data);
    updateStatusMessage('ゲームに参加できません: ' + data.error);
}

/**
 * WebSocket: Session update
 */
function onSessionUpdate(data) {
    currentSession = data.session;
    
    if (currentSession.status === 'active') {
        gameActive = true;
        
        // Find self in players
        for (let p of currentSession.players) {
            if (p.player_id === playerId) {
                movementScore = p.movement_score;
                updateScoreDisplay();
                break;
            }
        }
    }
}

/**
 * WebSocket: Game started
 */
function onGameStarted(data) {
    currentSession = data.session;
    gameActive = true;
    document.getElementById('gameStatusText').textContent = 'ゲーム中...';
    updateStatusMessage('静かにして！\n線香花火を揺らさないようにしてください');
}

/**
 * WebSocket: Player eliminated
 */
function onPlayerEliminated(data) {
    const eliminatedId = data.player_id;
    
    if (eliminatedId === playerId) {
        // Player was eliminated
        gameActive = false;
        sparkler.stop();
        updateStatusMessage('💥 消えてしまった！');
        document.getElementById('gameStatusText').textContent = '消えてしまった';
    } else {
        // Another player was eliminated
        updateStatusMessage('他の参加者が消えました...');
    }
}

/**
 * WebSocket: Game ended
 */
function onGameEnded(data) {
    const winnerId = data.winner_id;
    
    gameActive = false;
    sparkler.stop();
    
    if (winnerId === playerId) {
        // Player won
        updateStatusMessage('🎉 優勝！\n最後まで線香花火を保ちました！');
        document.getElementById('gameStatusText').textContent = '優勝！';
    } else if (!winnerId) {
        updateStatusMessage('ゲーム終了\n全員脱落で引き分けです');
        document.getElementById('gameStatusText').textContent = '引き分け';
    } else {
        // Another player won
        const winnerName = data.winner_name || 'プレイヤー';
        updateStatusMessage(`${winnerName} が優勝しました！`);
        document.getElementById('gameStatusText').textContent = '終了';
    }
}

/**
 * WebSocket: Error
 */
function onError(data) {
    console.error('Socket error:', data);
    updateStatusMessage('エラー: ' + data.message);
}

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', initPlayer);
