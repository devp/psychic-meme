import pytest
from tk2.src.board import Board, Square, Piece

def test_board_initialization():
    board = Board()
    assert board.width == 8
    assert board.height == 12
    assert len(board.grid) == 12
    assert len(board.grid[0]) == 8
    # Check that the ball is in the center
    center_x, center_y = 3, 5  # (8-1)//2, (12-1)//2
    assert board.ball_pos == (center_x, center_y)
    assert board.get_square(center_x, center_y).has_ball

def test_get_square():
    board = Board()
    square = board.get_square(0, 0)
    assert isinstance(square, Square)
    assert board.get_square(10, 15) is None

def test_move_piece():
    board = Board()
    piece = Piece(1)
    # Place a piece for player 1 at A1 (0, 0)
    board.get_square(0, 0).pieces[1].append(piece)

    # Valid move
    assert board.move_piece(piece, 0, 0, 1, 1)
    assert len(board.get_square(0, 0).pieces[1]) == 0
    assert len(board.get_square(1, 1).pieces[1]) == 1

    # Invalid move (piece not on from_square)
    assert not board.move_piece(piece, 0, 0, 1, 0)

def test_move_piece_wrong_player():
    board = Board()
    piece1 = Piece(1)
    piece2 = Piece(2)
    board.get_square(0, 0).pieces[1].append(piece1)

    # Trying to move player 1's piece as player 2 should fail
    # because piece2 is not on the from_square
    assert not board.move_piece(piece2, 0, 0, 1, 1)

def test_set_ball_pos():
    board = Board()
    old_ball_x, old_ball_y = board.ball_pos

    board.set_ball_pos(2, 3)

    assert not board.get_square(old_ball_x, old_ball_y).has_ball
    assert board.ball_pos == (2, 3)
    assert board.get_square(2, 3).has_ball
