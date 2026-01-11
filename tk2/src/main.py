from tk2.src.game import Game
from tk2.src.bot import TrivialBot, OkayBot
from tk2.src.board import Piece
import time

def get_player_setup(game, player_num):
    """Gets the initial piece placements from a player."""
    print(f"Player {player_num}, please place your 7 pieces.")
    placements = []
    while len(placements) < 7:
        try:
            coord_str = input(f"Enter coordinate for piece {len(placements) + 1} (e.g., A1): ")
            coords = game.parse_coords(coord_str)
            if coords and 0 <= coords[0] < game.board.width and 0 <= coords[1] < game.board.height:
                placements.append(coords)
            else:
                print("Invalid coordinate. Please enter a valid coordinate (e.g., A1, H12).")
        except (EOFError, KeyboardInterrupt):
            print("\nSetup interrupted. Exiting.")
            exit()
    return placements

def get_bot_setup(player_num):
    """Provides a default setup for bots."""
    if player_num == 1:
        return [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1)]
    else: # Player 2
        return [(0, 10), (1, 10), (2, 10), (3, 10), (4, 10), (5, 10), (6, 10)]

def main():
    """Main function to run the Taka-Taka Soccer CLI."""
    print("Welcome to Taka-Taka Soccer!")
    print("Select a game mode:")
    print("1. Human vs. Human")
    print("2. Human vs. Bot")
    print("3. Bot vs. Bot")

    game_mode = ""
    while game_mode not in ["1", "2", "3"]:
        try:
            game_mode = input("Enter your choice (1-3): ")
        except (EOFError, KeyboardInterrupt):
            print("\nSelection interrupted. Exiting.")
            exit()

    game = Game()
    player1 = None
    player2 = None

    if game_mode == "1": # Human vs. Human
        player1_setup = get_player_setup(game, 1)
        player2_setup = get_player_setup(game, 2)
    elif game_mode == "2": # Human vs. Bot
        player1_setup = get_player_setup(game, 1)
        player2_setup = get_bot_setup(2)
        player2 = OkayBot(2)
        print("Player 2 is OkayBot.")
    elif game_mode == "3": # Bot vs. Bot
        player1_setup = get_bot_setup(1)
        player2_setup = get_bot_setup(2)
        player1 = TrivialBot(1)
        player2 = OkayBot(2)
        print("Player 1 is TrivialBot, Player 2 is OkayBot.")

    # Place pieces on the board
    for x, y in player1_setup:
        game.board.get_square(x, y).pieces[1].append(Piece(1))
    for x, y in player2_setup:
        game.board.get_square(x, y).pieces[2].append(Piece(2))

    # Game loop
    while not game.is_game_over():
        game.board.display()
        print(f"\nPlayer {game.current_player}'s turn. {game.actions_remaining} actions remaining.")

        current_player_is_bot = (game.current_player == 1 and player1) or \
                                (game.current_player == 2 and player2)

        if current_player_is_bot:
            bot = player1 if game.current_player == 1 else player2
            move_str = bot.select_move(game)
            print(f"Bot (Player {game.current_player}) chose move: {move_str}")
            time.sleep(1) # Pause to make bot moves readable
        else:
            try:
                move_str = input("Enter your move (e.g., M A1 B2): ")
            except (EOFError, KeyboardInterrupt):
                print("\nGame interrupted. Exiting.")
                break

        if not move_str:
            continue

        if game.process_move(move_str):
            print("Move successful.")
        else:
            print("Invalid move. Please try again.")

    if game.winner:
        print(f"\nPlayer {game.winner} wins!")

if __name__ == "__main__":
    main()
