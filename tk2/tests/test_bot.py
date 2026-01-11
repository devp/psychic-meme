import pytest
from tk2.src.game import Game
from tk2.src.bot import TrivialBot, OkayBot
from tk2.src.board import Piece

def test_trivial_bot_select_move():
    game = Game()
    bot = TrivialBot(1)

    # Place a piece for the bot to move
    game.board.get_square(0, 0).pieces[1].append(Piece(1))

    move_str = bot.select_move(game)
    assert move_str is not None

    # Check that the move is valid
    parts = move_str.split()
    assert len(parts) == 3
    assert parts[0] == "M"
    assert game.parse_coords(parts[1]) == (0, 0)
    assert game.is_valid_move(0, 0, game.parse_coords(parts[2])[0], game.parse_coords(parts[2])[1])

def test_okay_bot_select_move_no_possession():
    game = Game()
    bot = OkayBot(1)

    # Place a piece for the bot to move
    game.board.get_square(0, 0).pieces[1].append(Piece(1))

    move_str = bot.select_move(game)
    assert move_str is not None

    # Check that the bot moves towards the ball
    parts = move_str.split()
    assert parts[0] == "M"
    assert game.parse_coords(parts[1]) == (0, 0)
    to_coords = game.parse_coords(parts[2])
    assert to_coords[0] > 0 or to_coords[1] > 0 # Should move towards the center

def test_okay_bot_select_move_with_possession():
    game = Game()
    bot = OkayBot(1)

    # Give the bot possession of the ball
    game.board.set_ball_pos(2, 2)
    game.board.get_square(2, 2).pieces[1].append(Piece(1))

    move_str = bot.select_move(game)
    assert move_str is not None

    # Check that the bot kicks towards the opponent's goal
    parts = move_str.split()
    assert parts[0] == "K"
    assert game.parse_coords(parts[1]) == (2, 2)
    to_coords = game.parse_coords(parts[2])
    assert to_coords[1] == game.board.height - 1

def test_okay_bot_does_not_select_moved_piece():
    game = Game()
    bot = OkayBot(1)

    # Place two pieces for the bot to move
    piece1 = Piece(1)
    piece2 = Piece(1)
    piece1.has_moved = True
    game.board.get_square(0, 0).pieces[1].append(piece1)
    game.board.get_square(1, 1).pieces[1].append(piece2)

    # The bot should select the unmoved piece (piece2)
    move_str = bot.select_move(game)
    assert move_str is not None
    parts = move_str.split()
    assert game.parse_coords(parts[1]) == (1, 1)
