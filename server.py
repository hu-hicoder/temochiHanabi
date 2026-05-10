from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import uuid
import qrcode
import io
import base64
from game_state import GameStateManager, GameSession, Player

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = 'your-secret-key-change-me'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global game state manager
game_manager = GameStateManager()

# Track connected clients: socket_id -> session_id
client_sessions = {}


@app.route('/')
def index():
    """Redirect to host page."""
    return '''
    <html>
        <head>
            <title>線香花火ゲーム</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>線香花火ゲームへようこそ</h1>
            <p>
                <a href="/host" style="font-size: 18px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                    🎮 ホスト画面を開く
                </a>
            </p>
            <p style="color: #666;">
                参加者はQRコードでゲーム画面に参加してください。
            </p>
        </body>
    </html>
    '''


@app.route('/host')
def host():
    """Host dashboard page."""
    return render_template('host.html')


@app.route('/play')
def play():
    """Player game page."""
    return render_template('play.html')


@app.route('/qr')
def get_qr():
    """Generate QR code image linking to player join page."""
    try:
        # Get the server IP/host from request
        host_url = request.host_url.rstrip('/')
        play_url = f"{host_url}/play"
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(play_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return jsonify({
            "success": True,
            "qr_image": f"data:image/png;base64,{img_base64}",
            "play_url": play_url
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    print(f"Client connected: {request.sid}")
    emit('connected', {'data': 'Connected to server'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    sid = request.sid
    print(f"Client disconnected: {sid}")
    
    # If player was in a session, remove them
    if sid in client_sessions:
        session_id = client_sessions[sid]
        session = game_manager.get_session(session_id)
        if session:
            # Find and remove the player
            for player_id, player in list(session.players.items()):
                if hasattr(player, '_socket_id') and player._socket_id == sid:
                    session.remove_player(player_id)
                    # Broadcast player left
                    socketio.emit('player_left', {
                        'player_id': player_id,
                        'session': session.to_dict()
                    }, room=session_id)
                    break
        del client_sessions[sid]


@socketio.on('join_game')
def handle_join_game(data):
    """Handle player joining the game."""
    session_id = data.get('session_id', 'default')
    
    print(f"Player joining request to session {session_id}")
    
    # Get or create session
    session = game_manager.get_session(session_id)
    if not session:
        session = game_manager.create_session(session_id)
    
    # Check if game has already started
    if session.status.value != 'waiting':
        emit('join_failed', {'error': 'Game has already started'})
        return

    assigned_name = session.assign_player_name()
    if not assigned_name:
        emit('join_failed', {'error': 'This game is full'})
        return
    
    # Create player
    player_id = str(uuid.uuid4())
    player = Player(
        player_id=player_id,
        session_id=session_id,
        name=assigned_name
    )
    player._socket_id = request.sid  # Store socket ID for later
    
    # Add player to session
    session.add_player(player)
    client_sessions[request.sid] = session_id
    
    # Join socket room
    join_room(session_id)
    
    # Emit join success to player
    emit('join_success', {
        'player_id': player_id,
        'session_id': session_id,
        'player_name': assigned_name
    })
    
    # Broadcast updated session state to all in room
    socketio.emit('session_update', {
        'session': session.to_dict()
    }, room=session_id)


@socketio.on('start_game')
def handle_start_game(data):
    """Handle host starting the game."""
    session_id = data.get('session_id', 'default')
    
    session = game_manager.get_session(session_id)
    if not session:
        emit('error', {'message': 'Session not found'})
        return
    
    if len(session.get_active_players()) < 2:
        emit('error', {'message': 'Need at least 2 players to start'})
        return
    
    session.start_game()
    
    # Broadcast game started
    socketio.emit('game_started', {
        'session': session.to_dict()
    }, room=session_id)
    
    print(f"Game started in session {session_id}")


@socketio.on('accelerometer_data')
def handle_accelerometer_data(data):
    """Handle accelerometer data from player."""
    sid = request.sid
    
    if sid not in client_sessions:
        return
    
    session_id = client_sessions[sid]
    session = game_manager.get_session(session_id)
    
    if not session or session.status.value != 'active':
        return
    
    player_id = data.get('player_id')
    accel_x = float(data.get('accel_x', 0))
    accel_y = float(data.get('accel_y', 0))
    accel_z = float(data.get('accel_z', 0))
    
    if player_id not in session.players:
        return
    
    player = session.players[player_id]
    if player.is_eliminated:
        return

    tilt_x = data.get('tilt_x')
    tilt_y = data.get('tilt_y')
    if tilt_x is not None and tilt_y is not None:
        try:
            player.set_tilt(float(tilt_x), float(tilt_y))
        except (TypeError, ValueError):
            pass
    
    # Update movement score (movement + elapsed-time pressure)
    player.add_movement(accel_x, accel_y, accel_z, started_at=session.started_at)
    
    # Check for eliminations
    eliminated = session.check_eliminations()
    
    if eliminated:
        for eliminated_player in eliminated:
            socketio.emit('player_eliminated', {
                'player_id': eliminated_player.player_id,
                'player_name': eliminated_player.name,
                'session': session.to_dict()
            }, room=session_id)
            print(f"Player {eliminated_player.name} eliminated in session {session_id}")
    
    # Check if game should end
    active_players = session.get_active_players()
    if len(active_players) == 1:
        winner = active_players[0]
        session.end_game(winner_id=winner.player_id)
        socketio.emit('game_ended', {
            'winner_id': winner.player_id,
            'winner_name': winner.name,
            'session': session.to_dict()
        }, room=session_id)
        print(f"Game ended in session {session_id}, winner: {winner.name}")
    elif len(active_players) == 0:
        session.end_game(winner_id=None)
        socketio.emit('game_ended', {
            'winner_id': None,
            'winner_name': None,
            'session': session.to_dict()
        }, room=session_id)
        print(f"Game ended in session {session_id}, no winner")
    else:
        # Broadcast session update to all players
        socketio.emit('session_update', {
            'session': session.to_dict()
        }, room=session_id)


@socketio.on('request_session_update')
def handle_request_session_update(data):
    """Handle request for current session state."""
    session_id = data.get('session_id', 'default')
    
    session = game_manager.get_session(session_id)
    if session:
        emit('session_update', {
            'session': session.to_dict()
        })
    else:
        # Create default session if doesn't exist
        session = game_manager.create_session(session_id)
        emit('session_update', {
            'session': session.to_dict()
        })


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
