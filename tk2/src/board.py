import itertools

class Piece:
    """Represents a single piece on the board."""
    id_counter = itertools.count()

    def __init__(self, player_num):
        self.id = next(Piece.id_counter)
        self.player_num = player_num
        self.has_moved = False

class Square:
    """Represents a single square on the board."""
    def __init__(self):
        self.pieces = {1: [], 2: []}  # Lists of Piece objects for each player
        self.has_ball = False

    def __str__(self):
        """String representation of the square for CLI display."""
        if self.has_ball:
            return '@'

        player1_pieces = len(self.pieces[1])
        player2_pieces = len(self.pieces[2])

        if player1_pieces > 0 and player2_pieces > 0:
            return 'B' # Both players
        elif player1_pieces > 0:
            return 'X'
        elif player2_pieces > 0:
            return 'O'
        else:
            return '.'

class Board:
    """Represents the game board."""
    def __init__(self, width=8, height=12):
        self.width = width
        self.height = height
        self.grid = [[Square() for _ in range(width)] for _ in range(height)]

        center_x, center_y = (width -1) // 2, (height -1) // 2
        self.grid[center_y][center_x].has_ball = True
        self.ball_pos = (center_x, center_y)

    def display(self):
        """Prints the current state of the board to the console."""
        header = '   ' + ''.join([f' {chr(ord("A") + i)} ' for i in range(self.width)])
        print(header)

        for y in range(self.height):
            row_num = str(y + 1).rjust(2)
            row_str = f'{row_num} '
            for x in range(self.width):
                square_str = str(self.grid[y][x])
                row_str += f'[{square_str}]'
            print(row_str)

    def get_square(self, x, y):
        """Returns the Square object at the given coordinates."""
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.grid[y][x]
        return None

    def move_piece(self, piece, from_x, from_y, to_x, to_y):
        """Moves a piece from one square to another."""
        from_square = self.get_square(from_x, from_y)
        to_square = self.get_square(to_x, to_y)

        if from_square and to_square and piece in from_square.pieces[piece.player_num]:
            from_square.pieces[piece.player_num].remove(piece)
            to_square.pieces[piece.player_num].append(piece)
            return True
        return False

    def set_ball_pos(self, x, y):
        """Sets the ball position."""
        if self.ball_pos:
            old_x, old_y = self.ball_pos
            self.get_square(old_x, old_y).has_ball = False

        self.ball_pos = (x, y)
        self.get_square(x, y).has_ball = True
