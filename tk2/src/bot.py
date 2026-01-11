import abc
import random

class BaseBot(abc.ABC):
    """Abstract base class for all bots."""
    def __init__(self, player_num):
        self.player_num = player_num

    @abc.abstractmethod
    def select_move(self, game):
        """Selects a move to make based on the current game state."""
        pass

    def _coords_to_str(self, x, y):
        """Converts (x, y) coordinates to algebraic notation."""
        return f"{chr(ord('A') + x)}{y + 1}"

class TrivialBot(BaseBot):
    """A bot that makes a simple valid move."""
    def select_move(self, game):
        board = game.board
        ball_x, ball_y = board.ball_pos
        ball_square = board.get_square(ball_x, ball_y)

        has_possession = (len(ball_square.pieces[self.player_num]) > 0 and
                          len(ball_square.pieces[3 - self.player_num]) == 0)

        if has_possession:
            # Simple kick forward
            goal_y = ball_y + 1 if self.player_num == 1 else ball_y - 1
            from_sq = self._coords_to_str(ball_x, ball_y)
            to_sq = self._coords_to_str(ball_x, goal_y)
            return f"K {from_sq} {to_sq}"
        else:
            # Find the first available piece and move it one square forward
            for y in range(board.height):
                for x in range(board.width):
                    if any(not p.has_moved for p in board.get_square(x, y).pieces[self.player_num]):
                        to_y = y + 1 if self.player_num == 1 else y - 1
                        if 0 <= to_y < board.height:
                            from_sq = self._coords_to_str(x, y)
                            to_sq = self._coords_to_str(x, to_y)
                            return f"M {from_sq} {to_sq}"
        return None # Should not happen in a normal game

class OkayBot(BaseBot):
    """A bot that uses simple heuristics to make a reasonable move."""
    def select_move(self, game):
        board = game.board
        ball_x, ball_y = board.ball_pos

        # Check if we have possession
        ball_square = board.get_square(ball_x, ball_y)
        has_possession = (len(ball_square.pieces[self.player_num]) > 0 and
                          len(ball_square.pieces[3 - self.player_num]) == 0)

        if has_possession:
            # Kick towards the opponent's goal
            goal_y = board.height - 1 if self.player_num == 1 else 0
            from_sq = self._coords_to_str(ball_x, ball_y)
            to_sq = self._coords_to_str(ball_x, goal_y)
            return f"K {from_sq} {to_sq}"
        else:
            # Move a piece closer to the ball
            my_pieces = []
            for y in range(board.height):
                for x in range(board.width):
                    if any(not p.has_moved for p in board.get_square(x, y).pieces[self.player_num]):
                        my_pieces.append((x, y))

            if not my_pieces:
                return None # No pieces to move

            # Find a random piece to move
            from_x, from_y = random.choice(my_pieces)

            # Move towards the ball
            to_x, to_y = from_x, from_y
            if ball_x > from_x: to_x += 1
            elif ball_x < from_x: to_x -= 1
            if ball_y > from_y: to_y += 1
            elif ball_y < from_y: to_y -= 1

            from_sq = self._coords_to_str(from_x, from_y)
            to_sq = self._coords_to_str(to_x, to_y)
            return f"M {from_sq} {to_sq}"
