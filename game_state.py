import time
import random
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
    tilt_x: float = 0.0
    tilt_y: float = 0.0
    movement_sensitivity: float = 1.8
    time_score_base_rate: float = 0.12
    time_score_accel_rate: float = 0.015
    prev_accel_x: Optional[float] = None
    prev_accel_y: Optional[float] = None
    prev_accel_z: Optional[float] = None
    last_score_time: Optional[float] = None
    joined_at: float = field(default_factory=time.time)
    last_update: float = field(default_factory=time.time)
    
    def eliminate(self):
        """Mark player as eliminated."""
        self.is_eliminated = True
        self.last_update = time.time()
    
    def add_movement(
        self,
        accel_x: float,
        accel_y: float,
        accel_z: float,
        started_at: Optional[float] = None,
    ) -> float:
        """
        Add acceleration and time-progressive score to movement_score.
        Movement term uses squared magnitude of delta from previous sample.
        Time term increases as elapsed game time grows.
        Returns new movement score.
        """
        now = time.time()

        if self.prev_accel_x is None:
            self.prev_accel_x = accel_x
            self.prev_accel_y = accel_y
            self.prev_accel_z = accel_z
            self.last_score_time = now
            self.last_update = now
            return self.movement_score

        delta_x = accel_x - self.prev_accel_x
        delta_y = accel_y - self.prev_accel_y
        delta_z = accel_z - self.prev_accel_z
        delta_magnitude_squared = delta_x**2 + delta_y**2 + delta_z**2
        movement_score_delta = delta_magnitude_squared * self.movement_sensitivity

        dt = 0.0
        if self.last_score_time is not None:
            dt = max(0.0, now - self.last_score_time)

        elapsed = 0.0
        if started_at is not None:
            elapsed = max(0.0, now - started_at)

        # Time pressure grows over time so late-game score rises faster.
        time_rate = self.time_score_base_rate + (self.time_score_accel_rate * elapsed)
        time_score_delta = dt * time_rate

        self.movement_score += movement_score_delta + time_score_delta

        self.prev_accel_x = accel_x
        self.prev_accel_y = accel_y
        self.prev_accel_z = accel_z
        self.last_score_time = now
        self.last_update = now
        return self.movement_score

    def set_tilt(self, tilt_x: float, tilt_y: float) -> None:
        """Store the latest normalized tilt values for visual animation."""
        self.tilt_x = tilt_x
        self.tilt_y = tilt_y
        self.last_update = time.time()
    
    def to_dict(self):
        """Serialize player to dictionary."""
        return {
            "player_id": self.player_id,
            "name": self.name,
            "movement_score": round(self.movement_score, 2),
            "is_eliminated": self.is_eliminated,
            "tilt_x": round(self.tilt_x, 3),
            "tilt_y": round(self.tilt_y, 3),
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
    elimination_threshold: float = 100.0  # Tunable threshold for elimination
    winner_id: Optional[str] = None
    available_display_names: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Prepare per-game shuffled name pool."""
        if self.available_display_names:
            return

        self.available_display_names = [
            "スイカ",
            "短冊",
            "風鈴",
            "金魚",
            "浴衣",
            "うちわ",
            "屋台",
            "ちょうちん",
            "かき氷",
        ]
        random.shuffle(self.available_display_names)

    def assign_player_name(self) -> Optional[str]:
        """Assign a unique display name from the per-session pool."""
        used_names = {p.name for p in self.players.values()}
        for candidate in self.available_display_names:
            if candidate not in used_names:
                return candidate
        return None
    
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
    
    def create_session(self, session_id: str, elimination_threshold: float = 100.0) -> GameSession:
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
