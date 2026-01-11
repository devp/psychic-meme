import pytest
from tk2.src.game import Game
from tk2.src.board import Piece

def test_game_initialization():
    game = Game()
    assert game.current_player == 1
    assert game.actions_remaining == 3
    assert game.winner is None

def test_switch_player():
    game = Game()
    piece = Piece(1)
    piece.has_moved = True
    game.board.get_square(0, 0).pieces[1].append(piece)
    game.switch_player()
    assert game.current_player == 2
    assert game.actions_remaining == 3
    assert not piece.has_moved

def test_parse_coords():
    game = Game()
    assert game.parse_coords("A1") == (0, 0)
    assert game.parse_coords("H12") == (7, 11)
    assert game.parse_coords("invalid") is None

def test_is_valid_move():
    game = Game()
    # Valid moves
    assert game.is_valid_move(0, 0, 1, 1)
    assert game.is_valid_move(3, 3, 2, 4)
    # Invalid moves
    assert not game.is_valid_move(0, 0, 2, 2)
    assert not game.is_valid_move(0, 0, 0, 2)

def test_one_action_per_piece():
    game = Game()
    game.board.get_square(0, 0).pieces[1].append(Piece(1))

    # First move with the piece is allowed
    assert game.process_move("M A1 B2")
    assert game.actions_remaining == 2

    # A second move with the same piece from its new location is not allowed
    assert not game.process_move("M B2 C3")
    assert game.actions_remaining == 2 # Should not have changed

def test_multiple_pieces_on_square():
    game = Game()
    game.board.get_square(0, 0).pieces[1].append(Piece(1))
    game.board.get_square(0, 0).pieces[1].append(Piece(1))

    # First move with one piece is allowed
    assert game.process_move("M A1 B2")
    assert game.actions_remaining == 2

    # Second move with the other piece is allowed
    assert game.process_move("M A1 A2")
    assert game.actions_remaining == 1

def test_contested_ball_action_cost():
    game = Game()
    # Set up a contested square with the ball
    game.board.set_ball_pos(2, 2)
    game.board.get_square(2, 2).pieces[1].append(Piece(1))
    game.board.get_square(2, 2).pieces[2].append(Piece(2))

    # A dribble from the contested square should cost 2 actions
    assert game.process_move("D C3 D4")
    assert game.actions_remaining == 1 # 3 - 2 = 1

    # A kick from a non-contested square should cost 1 action
    game.switch_player() # Switch to player 2
    game.board.set_ball_pos(4, 4)
    game.board.get_square(4, 4).pieces[2].append(Piece(2))
    assert game.process_move("K E5 F6")
    assert game.actions_remaining == 2 # 3 - 1 = 2

def test_straight_kick():
    game = Game()
    game.board.set_ball_pos(3, 5)
    game.board.get_square(3, 5).pieces[1].append(Piece(1))
    game.process_move("K D6 D10")
    assert game.board.ball_pos == (3, 9)

def test_curved_kick():
    game = Game()
    game.board.set_ball_pos(3, 5)
    game.board.get_square(3, 5).pieces[1].append(Piece(1))
    # This is a valid 45-degree kick (diagonal then horizontal)
    game.process_move("K D6 G9 H9")
    assert game.board.ball_pos == (7, 8)

def test_invalid_curved_kick():
    game = Game()
    game.board.set_ball_pos(3, 5)
    game.board.get_square(3, 5).pieces[1].append(Piece(1))
    # This is a 90-degree turn, which is invalid
    assert not game.process_move("K D6 D10 G10")
    assert game.board.ball_pos == (3, 5) # Ball should not have moved

    # This is a 135-degree turn, which is invalid
    assert not game.process_move("K D6 A3 B2")
    assert game.board.ball_pos == (3, 5) # Ball should not have moved

def test_kick_interception():
    game = Game()
    game.board.set_ball_pos(3, 5)
    game.board.get_square(3, 5).pieces[1].append(Piece(1))
    game.board.get_square(3, 7).pieces[2].append(Piece(2))
    game.process_move("K D6 D10")
    assert game.board.ball_pos == (3, 7)

def test_check_for_win():
    game = Game()
    # Player 1 scores
    game.board.set_ball_pos(3, 11)
    game.check_for_win()
    assert game.winner == 1

    # Player 2 scores
    game = Game()
    game.current_player = 2
    game.board.set_ball_pos(3, 0)
    game.check_for_win()
    assert game.winner == 2
