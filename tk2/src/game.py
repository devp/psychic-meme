from tk2.src.board import Board, Piece

class Game:
    """Manages the game logic and state."""
    def __init__(self):
        self.board = Board()
        self.current_player = 1
        self.actions_remaining = 3
        self.winner = None

    def switch_player(self):
        """Switches the turn to the other player."""
        self.current_player = 2 if self.current_player == 1 else 1
        self.actions_remaining = 3

        # Reset has_moved flag for all pieces
        for y in range(self.board.height):
            for x in range(self.board.width):
                square = self.board.get_square(x, y)
                for piece in square.pieces[1] + square.pieces[2]:
                    piece.has_moved = False

    def parse_coords(self, coord_str):
        """Converts algebraic notation (e.g., 'A1') to (x, y) coordinates."""
        if not coord_str or len(coord_str) < 2:
            return None

        try:
            col = ord(coord_str[0].upper()) - ord('A')
            row = int(coord_str[1:]) - 1
            return col, row
        except (ValueError, IndexError):
            return None

    def is_valid_move(self, from_x, from_y, to_x, to_y):
        """Checks if a move is valid (1 square in any direction)."""
        return abs(from_x - to_x) <= 1 and abs(from_y - to_y) <= 1

    def process_move(self, move_str):
        """Processes a player's move string and updates the game state."""
        parts = move_str.strip().split()
        action = parts[0].upper()

        if action not in ('M', 'D', 'K'):
            print("Invalid action. Please use M, D, or K.")
            return False

        from_coords = self.parse_coords(parts[1])
        if not from_coords:
            print("Invalid starting square.")
            return False

        from_square = self.board.get_square(from_coords[0], from_coords[1])
        movable_pieces = [p for p in from_square.pieces[self.current_player] if not p.has_moved]

        if not movable_pieces:
            print("No available pieces to move on this square.")
            return False

        piece_to_move = movable_pieces[0]

        action_cost = 1
        if action in ('D', 'K'):
            if len(from_square.pieces[1]) > 0 and len(from_square.pieces[2]) > 0:
                action_cost = 2

        if self.actions_remaining < action_cost:
            print("Not enough actions remaining to perform this move.")
            return False

        if not self.handle_action(parts, from_coords, piece_to_move):
            return False

        piece_to_move.has_moved = True

        self.actions_remaining -= action_cost
        if self.actions_remaining <= 0:
            self.check_for_win()
            self.switch_player()

        return True

    def handle_action(self, parts, from_coords, piece):
        """Handles the action based on the move type."""
        action = parts[0].upper()

        from_x, from_y = from_coords

        to_coords = self.parse_coords(parts[2])
        if not to_coords:
            print("Invalid ending square.")
            return False

        to_x, to_y = to_coords

        if action == 'K':
            curve_coords = self.parse_coords(parts[3]) if len(parts) > 3 else None
            return self.handle_kick(from_x, from_y, to_x, to_y, curve_coords)

        move_handlers = {
            'M': self.handle_move,
            'D': self.handle_dribble
        }

        handler = move_handlers.get(action)
        return handler(from_x, from_y, to_x, to_y, piece) if handler else False

    def handle_move(self, from_x, from_y, to_x, to_y, piece):
        """Handles a simple move action."""
        if self.is_valid_move(from_x, from_y, to_x, to_y):
            return self.board.move_piece(piece, from_x, from_y, to_x, to_y)
        else:
            print("Invalid move. Pieces can only move 1 square in any direction.")
            return False

    def handle_dribble(self, from_x, from_y, to_x, to_y, piece):
        """Handles a dribble action."""
        if (from_x, from_y) != self.board.ball_pos:
            print("Cannot dribble from a square without the ball.")
            return False

        if self.is_valid_move(from_x, from_y, to_x, to_y):
            if self.board.move_piece(piece, from_x, from_y, to_x, to_y):
                self.board.set_ball_pos(to_x, to_y)
                return True
        else:
            print("Invalid dribble. Can only dribble 1 square in any direction.")
            return False
        return False

    def _get_direction_vector(self, start, end):
        """Returns a normalized direction vector (or None if not a straight line)."""
        dx = end[0] - start[0]
        dy = end[1] - start[1]

        if dx == 0 and dy == 0:
            return None # No movement

        if dx != 0 and dy != 0 and abs(dx) != abs(dy):
            return None # Not a straight line

        return (dx // abs(dx) if dx != 0 else 0, dy // abs(dy) if dy != 0 else 0)

    def _calculate_path(self, start, end):
        """Calculates the path of a straight line from start to end."""
        path = []
        direction = self._get_direction_vector(start, end)
        if not direction:
            return []

        curr_x, curr_y = start
        while (curr_x, curr_y) != end:
            path.append((curr_x, curr_y))
            curr_x += direction[0]
            curr_y += direction[1]
        path.append(end)
        return path

    def handle_kick(self, from_x, from_y, to_x, to_y, curve_coords=None):
        """Handles a kick action, including curves and interceptions."""
        if (from_x, from_y) != self.board.ball_pos:
            print("Cannot kick from a square without the ball.")
            return False

        path = []
        if curve_coords:
            # Validate 45-degree curve
            v1 = self._get_direction_vector((from_x, from_y), (to_x, to_y))
            v2 = self._get_direction_vector((to_x, to_y), curve_coords)

            if not v1 or not v2:
                print("Invalid kick path. Segments must be straight lines.")
                return False

            # To check for a 45-degree turn, the difference between the direction
            # vectors should have components that sum to 1 (e.g., (1,0) or (0,1))
            diff_vector = (abs(v1[0] - v2[0]), abs(v1[1] - v2[1]))
            if sum(diff_vector) != 1:
                print("Invalid curve. Must be a 45-degree turn.")
                return False

            path.extend(self._calculate_path((from_x, from_y), (to_x, to_y))[:-1])
            path.extend(self._calculate_path((to_x, to_y), curve_coords))
        else:
            path = self._calculate_path((from_x, from_y), (to_x, to_y))

        opponent = 2 if self.current_player == 1 else 1
        final_pos = path[-1]

        for pos in path[1:]: # Skip the starting square
            square = self.board.get_square(pos[0], pos[1])
            if not square: # Ball went off the board
                final_pos = path[path.index(pos) - 1]
                break
            if len(square.pieces[opponent]) > 0:
                final_pos = pos
                break

        self.board.set_ball_pos(final_pos[0], final_pos[1])
        return True

    def check_for_win(self):
        """Checks if the ball has crossed a goal line."""
        ball_x, ball_y = self.board.ball_pos
        goal_line_y_p1 = self.board.height - 1
        goal_line_y_p2 = 0

        # Goal lines are the 4 central squares on the back row
        goal_posts = (self.board.width // 2 - 2, self.board.width // 2 + 1)

        if self.current_player == 1 and ball_y == goal_line_y_p1:
            if goal_posts[0] <= ball_x <= goal_posts[1]:
                self.winner = 1
        elif self.current_player == 2 and ball_y == goal_line_y_p2:
            if goal_posts[0] <= ball_x <= goal_posts[1]:
                self.winner = 2

    def is_game_over(self):
        """Returns True if a player has won."""
        return self.winner is not None
