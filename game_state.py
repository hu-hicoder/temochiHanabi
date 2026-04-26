import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import math


class GameStatus(Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    ENDED = "ended"


@dataclass
class Player:
    """Represents a player in the game."""
    player_id: str
    session_id: str
    name: str = "Player"
    movement_score: float = 0.0
    is_eliminated: bool = False
    joined_at: float = field(default_factory=time.time)
    last_update: float = field(default_factory=time.time)
    
    def eliminate(self):
        """Mark player as eliminated."""
        self.is_eliminated = True
        self.last_update = time.time()
    
    def add_movement(self, accel_x: float, accel_y: float, accel_z: float) -> float:
        """
        Add acceleration data to movement score.
        Uses squared magnitude of acceleration vector.
        Returns new movement score.
        """
        magnitude_squared = accel_x**2 + accel_y**2 + accel_z**2
        self.movement_score += magnitude_squared
        self.last_update = time.time()
        return self.movement_score
    
    def to_dict(self):
        """Serialize player to dictionary."""
        return {
            "player_id": self.player_id,
            "name": self.name,
            "movement_score": round(self.movement_score, 2),
            "is_eliminated": self.is_eliminated,
            "joined_at": self.joined_at,
        }


@dataclass
class GameSession:
    """Represents a single game session."""
    session_id: str
    status: GameStatus = GameStatus.WAITING
    players: Dict[str, Player] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    elimination_threshold: float = 200.0  # Tunable threshold for elimination
    winner_id: Optional[str] = None
    
    def add_player(self, player: Player) -> None:
        """Add a player to the session."""
        self.players[player.player_id] = player
    
    def remove_player(self, player_id: str) -> None:
        """Remove a player from the session."""
        if player_id in self.players:
            del self.players[player_id]
    
    def get_active_players(self) -> List[Player]:
        """Return list of non-eliminated players."""
        return [p for p in self.players.values() if not p.is_eliminated]
    
    def check_eliminations(self) -> List[Player]:
        """
        Check for players exceeding elimination threshold.
        Returns list of newly eliminated players.
        """
        eliminated = []
        for player in self.get_active_players():
            if player.movement_score >= self.elimination_threshold:
                player.eliminate()
                eliminated.append(player)
        return eliminated
    
    def start_game(self) -> None:
        """Start the game session."""
        self.status = GameStatus.ACTIVE
        self.started_at = time.time()
    
    def end_game(self, winner_id: Optional[str] = None) -> None:
        """End the game session."""
        self.status = GameStatus.ENDED
        self.ended_at = time.time()
        self.winner_id = winner_id
    
    def get_winner(self) -> Optional[Player]:
        """
        Determine winner (last non-eliminated player).
        Returns winner or None if no winner yet.
        """
        active = self.get_active_players()
        if len(active) == 1:
            return active[0]
        return None
    
    def to_dict(self):
        """Serialize game session to dictionary."""
        return {
            "session_id": self.session_id,
            "status": self.status.value,
            "players": [p.to_dict() for p in self.players.values()],
            "active_count": len(self.get_active_players()),
            "created_at": self.created_at,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "winner_id": self.winner_id,
        }


class GameStateManager:
    """Manages all active game sessions."""
    
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
    
    def create_session(self, session_id: str, elimination_threshold: float = 200.0) -> GameSession:
        """Create a new game session."""
        session = GameSession(
            session_id=session_id,
            elimination_threshold=elimination_threshold
        )
        self.sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[GameSession]:
        """Get a game session by ID."""
        return self.sessions.get(session_id)
    
    def delete_session(self, session_id: str) -> None:
        """Delete a game session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def cleanup_old_sessions(self, max_age_seconds: int = 3600) -> None:
        """Remove sessions older than max_age_seconds."""
        current_time = time.time()
        expired_ids = [
            sid for sid, session in self.sessions.items()
            if current_time - session.created_at > max_age_seconds
        ]
        for sid in expired_ids:
            self.delete_session(sid)
