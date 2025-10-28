#!/usr/bin/env python3
"""
MLS Playoffs Viewer
Fetches and displays MLS playoff bracket data from the official MLS API
"""

import json
import sys
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

try:
    import requests
except ImportError:
    print("Error: requests library not installed. Install with: pip install requests --break-system-packages")
    sys.exit(1)


DEFAULT_URL = "https://stats-api.mlssoccer.com/matches/seasons/MLS-SEA-0001K9?match_date[gte]=2025-01-01&match_date[lte]=2025-12-31&competition_id=MLS-COM-000002&per_page=100"


def load_data(source: str) -> dict:
    """Load playoff data from URL or file path"""
    if source.startswith('http://') or source.startswith('https://'):
        print("Fetching data from URL...\n")
        response = requests.get(source)
        response.raise_for_status()
        return response.json()
    else:
        print(f"Loading data from file: {source}\n")
        with open(source, 'r') as f:
            return json.load(f)


def format_time(iso_time: str) -> str:
    """Format ISO timestamp to readable format"""
    if not iso_time:
        return "TBD"
    try:
        dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
        return dt.strftime('%b %d, %I:%M %p')
    except Exception:
        return iso_time


def format_time_compact(iso_time: str) -> str:
    """Format ISO timestamp to compact format"""
    if not iso_time:
        return "TBD"
    try:
        dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
        return dt.strftime('%m/%d %H:%M')
    except Exception:
        return iso_time[:10]


def get_match_status_display(match: dict) -> str:
    """Format match status for display"""
    status = match.get('match_status', '')
    
    if status == 'finalWhistle':
        return '✅✅ FINAL'
    elif status == 'scheduled':
        return '⏰ Scheduled'
    else:
        return status.upper()


def display_match(match: dict, index: Optional[int] = None):
    """Display a single match with formatting"""
    home = match['home_team_name']
    away = match['away_team_name']
    result = match.get('result', '0:0')
    status = get_match_status_display(match)
    kickoff = format_time(match.get('planned_kickoff_time', ''))
    # match_type = match.get('match_type', 'Match')
    venue = match.get('stadium_name', 'TBD')
    city = match.get('stadium_city', '')
    
    # Add seed numbers if available
    home_seed = match.get('home_team_seed', '')
    away_seed = match.get('away_team_seed', '')
    
    home_display = f"({home_seed}) {home}" if home_seed else home
    away_display = f"({away_seed}) {away}" if away_seed else away
    
    print(f"  Match {index if index else ''}:")
    print(f"    {away_display} @ {home_display}")
    print(f"    Score: {result} - {status}")
    print(f"    Time: {kickoff}")
    print(f"    Venue: {venue}" + (f", {city}" if city and city != 'unknown' else ""))
    print()


def group_by_section(schedule: List[dict]) -> Dict[str, List[dict]]:
    """Group matches by playoff section"""
    sections = defaultdict(list)
    
    for match in schedule:
        section = match.get('section_name', 'Other')
        sections[section].append(match)
    
    return sections


def display_series(series_matches: List[dict]):
    """Display a best-of-3 series"""
    series_name = series_matches[0].get('series_name', 'Series')
    print(f"\n  📊 {series_name}")
    print("  " + "=" * 60)
    
    # Sort by match type to get them in order
    series_matches.sort(key=lambda m: m.get('match_type', ''))
    
    for i, match in enumerate(series_matches, 1):
        display_match(match, i)


def get_series_record(series_matches: List[dict], team_id: str) -> tuple:
    """Get wins/losses for a team in a series"""
    wins = 0
    losses = 0
    
    for match in series_matches:
        if match.get('match_status') != 'finalWhistle':
            continue
            
        home_goals = match.get('home_team_goals', 0)
        away_goals = match.get('away_team_goals', 0)
        home_pk = match.get('home_team_penalty_goals', 0)
        away_pk = match.get('away_team_penalty_goals', 0)
        
        # Determine winner
        if home_goals + home_pk > away_goals + away_pk:
            winner_id = match.get('home_team_id')
        elif away_goals + away_pk > home_goals + home_pk:
            winner_id = match.get('away_team_id')
        else:
            continue  # Draw, no winner
            
        if winner_id == team_id:
            wins += 1
        else:
            losses += 1
            
    return (wins, losses)


def get_team_emoji(team_name: str) -> str:
    """Get emoji for team"""
    team_emojis = {
        # TODO: ⚜️🫖🐂🦅
        'Los Angeles Football Club': '🏴',  # Lightning for LAFC's energy
        'Inter Miami CF': '🌴',            # Palm tree for Miami
        'New York City Football Club': '🏙️',  # City skyline
        'Portland Timbers': '🌲',          # Tree for Timbers
        'San Diego FC': '🏄',              # surfs up i guess
        'Vancouver Whitecaps FC': '🏔️',    # literal mountain
        'Seattle Sounders FC': '🐬',       # not an orca
        'Minnesota United FC': '❄️',       # Snow for Minnesota
        'FC Cincinnati': '🔶',            # Orange diamond for FC Cincy colors
        'Columbus Crew': '🚧',            # CREW
        'Philadelphia Union': '🐍',       # no steppy
        'Chicago Fire FC': '🔥',          # Fire for Chicago Fire
        'Charlotte FC': '👑',             # Crown for Queen City
        'Nashville SC': '🎸',             # Guitar for Music City
        'FC Dallas': '🤠',                # Cowboy for Texas
        'Austin FC': '🌳',                # they like trees
        'Orlando City': '🏰',             # Castle for Orlando
        'Real Salt Lake': '🧂',           # lol
        'TBC Home': '❓',                 # Question mark for TBC
        'TBC Away': '❓'                  # Question mark for TBC
    }
    
    return team_emojis.get(team_name, '⚽')  # Default soccer ball


def get_team_short_name(team_name: str, team_code: str) -> str:
    """Get abbreviated team name"""
    if team_code and team_code != 'TBC':
        return team_code
    
    # Custom abbreviations for common teams
    abbrevs = {
        'Los Angeles Football Club': 'LAFC',
        'Inter Miami CF': 'MIA',
        'New York City Football Club': 'NYC',
        'Portland Timbers': 'POR',
        'San Diego FC': 'SD',
        'Vancouver Whitecaps FC': 'VAN',
        'Seattle Sounders FC': 'SEA',
        'Minnesota United FC': 'MIN',
        'FC Cincinnati': 'CIN',
        'Columbus Crew': 'CLB',
        'Philadelphia Union': 'PHI',
        'Chicago Fire FC': 'CHI',
        'Charlotte FC': 'CLT',
        'Nashville SC': 'NSH',
        'FC Dallas': 'DAL',
        'Austin FC': 'ATX',
        'Orlando City': 'ORL',
        'Real Salt Lake': 'RSL'
    }
    
    return abbrevs.get(team_name, team_name[:3].upper())


def get_bracket_team_info(match: dict, is_home: bool) -> dict:
    """Extract team info for bracket display"""
    if is_home:
        team_name = match.get('home_team_name', 'TBC')
        team_code = match.get('home_team_three_letter_code', '')
        team_seed = match.get('home_team_seed', '')
        team_id = match.get('home_team_id', '')
    else:
        team_name = match.get('away_team_name', 'TBC')
        team_code = match.get('away_team_three_letter_code', '')
        team_seed = match.get('away_team_seed', '')
        team_id = match.get('away_team_id', '')
    
    short_name = get_team_short_name(team_name, team_code)
    emoji = get_team_emoji(team_name)
    if team_seed:
        display_name = f"{emoji}({team_seed}){short_name}"
    else:
        display_name = f"{emoji}{short_name}"
    
    return {
        'name': team_name,
        'short': short_name,
        'display': display_name,
        'seed': team_seed,
        'id': team_id
    }


def get_series_winner(series_matches: List[dict]) -> Optional[str]:
    """Get the winner of a series, returns team display name or None"""
    if not series_matches:
        return None
    
    first_match = series_matches[0]
    home_id = first_match.get('home_team_id')
    away_id = first_match.get('away_team_id')
    
    home_record = get_series_record(series_matches, home_id)
    away_record = get_series_record(series_matches, away_id)
    
    if home_record[0] >= 2:
        return get_bracket_team_info(first_match, True)['display']
    elif away_record[0] >= 2:
        return get_bracket_team_info(first_match, False)['display']
    
    return None


def get_match_winner(match: dict) -> Optional[str]:
    """Get winner of a single match"""
    if match.get('match_status') != 'finalWhistle':
        return None
    
    home_goals = match.get('home_team_goals', 0) + match.get('home_team_penalty_goals', 0)
    away_goals = match.get('away_team_goals', 0) + match.get('away_team_penalty_goals', 0)
    
    if home_goals > away_goals:
        return get_bracket_team_info(match, True)['display']
    elif away_goals > home_goals:
        return get_bracket_team_info(match, False)['display']
    
    return None


def display_ascii_bracket(schedule: List[dict]):
    """Display tournament as ASCII bracket"""
    sections = group_by_section(schedule)
    
    print("\n" + "=" * 120)
    print("                                    MLS CUP PLAYOFFS 2025 - BRACKET")
    print("=" * 120)
    
    # Collect data for bracket
    wildcard_winners = []
    r1_series = []
    semifinal_winners = []
    final_winners = []
    cup_winner = None
    
    # Wild Card results
    if 'Wild Card matches' in sections:
        for match in sections['Wild Card matches']:
            winner = get_match_winner(match)
            if winner:
                wildcard_winners.append(winner)
            else:
                home = get_bracket_team_info(match, True)['display']
                away = get_bracket_team_info(match, False)['display']
                wildcard_winners.append(f"{away}v{home}")
    
    # Round One series
    if 'Round One Best-of-3 Series' in sections:
        series_dict = defaultdict(list)
        for match in sections['Round One Best-of-3 Series']:
            series_name = match.get('series_name', 'Unknown')
            series_dict[series_name].append(match)
        
        for series_name, series_matches in series_dict.items():
            series_matches.sort(key=lambda m: m.get('match_type', ''))
            first_match = series_matches[0]
            
            home_info = get_bracket_team_info(first_match, True)
            away_info = get_bracket_team_info(first_match, False)
            
            home_record = get_series_record(series_matches, first_match.get('home_team_id'))
            away_record = get_series_record(series_matches, first_match.get('away_team_id'))
            
            winner = get_series_winner(series_matches)
            
            r1_series.append({
                'home': home_info,
                'away': away_info,
                'home_record': home_record,
                'away_record': away_record,
                'winner': winner,
                'matches': series_matches
            })
    
    # Conference Semifinals
    if 'Conference Semifinals' in sections:
        for match in sections['Conference Semifinals']:
            winner = get_match_winner(match)
            if winner:
                semifinal_winners.append(winner)
    
    # Conference Finals  
    if 'Conference Finals' in sections:
        for match in sections['Conference Finals']:
            winner = get_match_winner(match)
            if winner:
                final_winners.append(winner)
    
    # MLS Cup
    if 'MLS Cup presented by Audi' in sections:
        for match in sections['MLS Cup presented by Audi']:
            winner = get_match_winner(match)
            if winner:
                cup_winner = winner
    
    # Print bracket
    print("\nWILD CARD         ROUND ONE              CONF SEMIS       CONF FINALS       MLS CUP")
    print("─" * 120)
    
    # Sort series by bracket position for consistent display
    r1_series.sort(key=lambda s: s['home']['seed'] or 99)
    
    # Print bracket rows
    max_rows = max(len(wildcard_winners), len(r1_series), 4)
    for i in range(max_rows):
        line = ""
        
        # Wild Card column (18 chars)
        if i < len(wildcard_winners):
            wc = wildcard_winners[i]
            if "v" in wc and not wc.startswith("✅"):
                line += f"{wc:<18}"
            else:
                line += f"✅{wc:<16}"
        else:
            line += " " * 18
        
        # Connector
        if i < len(wildcard_winners) or i < len(r1_series):
            line += "─"
        else:
            line += " "
        
        # Round One column (23 chars to account for emojis)
        if i < len(r1_series):
            series = r1_series[i]
            if series['winner']:
                line += f"✅{series['winner']:<21}"
            else:
                away_display = series['away']['display']
                home_display = series['home']['display']
                line += f"{away_display}v{home_display}"[:23].ljust(23)
        else:
            line += " " * 23
        
        # Connector  
        if i < 4:
            line += "─"
        else:
            line += " "
        
        # Conference Semifinals column (18 chars)
        if i < 4:  # 4 conference semifinal spots
            if i < len(semifinal_winners):
                line += f"✅{semifinal_winners[i]:<16}"
            else:
                line += "❓TBC".ljust(18)
        else:
            line += " " * 18
        
        # Connector
        if i < 2:
            line += "─"
        else:
            line += " "
        
        # Conference Finals column (18 chars)
        if i < 2:  # 2 conference final spots
            if i < len(final_winners):
                line += f"✅{final_winners[i]:<16}"
            else:
                line += "❓TBC".ljust(18)
        else:
            line += " " * 18
        
        # Connector
        if i == 0:
            line += "─"
        else:
            line += " "
        
        # MLS Cup column
        if i == 0:  # Only one MLS Cup winner
            if cup_winner:
                line += f"🏆{cup_winner}"
            else:
                line += "❓TBC"
        
        print(line)
    
    print("\n" + "─" * 120)
    
    # Show detailed series info below bracket
    print("\nSERIES DETAILS:")
    print("─" * 50)
    
    for series in r1_series:
        home = series['home']['display']
        away = series['away']['display']
        h_rec = series['home_record']
        a_rec = series['away_record']
        
        print(f"{away} vs {home} [{a_rec[0]}-{a_rec[1]}] vs [{h_rec[0]}-{h_rec[1]}]")
        
        for i, match in enumerate(series['matches'], 1):
            if match.get('match_status') == 'finalWhistle':
                result = match.get('result', '0:0')
                pk_info = ""
                if match.get('home_team_penalty_goals', 0) > 0 or match.get('away_team_penalty_goals', 0) > 0:
                    pk_info = f" PK:{match.get('away_team_penalty_goals', 0)}-{match.get('home_team_penalty_goals', 0)}"
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  G{i}: {result}{pk_info} ({date}) ✅")
            elif match.get('match_status') == 'scheduled':
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  G{i}: TBD ({date}) ⏰")
    
    print("\n" + "=" * 120)
    print("Legend: ✅=Complete ⏰=Scheduled 🏆=Champion (seed)=Team Seed [W-L]=Series Record")
    print("=" * 120)


def main():
    """Main function to fetch and display playoff data"""
    # Determine source
    if len(sys.argv) > 1:
        source = sys.argv[1]
    else:
        print (f"Fetching url: ${DEFAULT_URL}")
        source = DEFAULT_URL
    
    try:
        # Load data
        data = load_data(source)
        schedule = data.get('schedule', [])
        
        if not schedule:
            print("No matches found in the data.")
            return
        
        # Check if user wants compressed view (default now)
        compressed = True
        if len(sys.argv) > 2 and sys.argv[2] == '--detailed':
            compressed = False
        
        if compressed:
            display_ascii_bracket(schedule)
        else:
            # Original detailed view
            print("=" * 70)
            print("           MLS CUP PLAYOFFS 2025")
            print("=" * 70)
            print(f"\nTotal matches: {len(schedule)}\n")
            
            # Group matches by section
            sections = group_by_section(schedule)
            
            # Define section order
            section_order = [
                'Wild Card matches',
                'Round One Best-of-3 Series',
                'Conference Semifinals',
                'Conference Finals',
                'MLS Cup presented by Audi'
            ]
            
            # Display sections in order
            for section_name in section_order:
                if section_name not in sections:
                    continue
                
                matches = sections[section_name]
                print(f"\n{'=' * 70}")
                print(f"  {section_name.upper()}")
                print(f"{'=' * 70}")
                
                if section_name == 'Round One Best-of-3 Series':
                    # Group by series
                    series_dict = defaultdict(list)
                    for match in matches:
                        series_name = match.get('series_name', 'Unknown')
                        series_dict[series_name].append(match)
                    
                    for series_name, series_matches in series_dict.items():
                        display_series(series_matches)
                else:
                    # Display individual matches
                    for i, match in enumerate(matches, 1):
                        display_match(match, i)
            
            print("=" * 70)
            print("\nLegend:")
            print("  ✅ FINAL - Match completed")
            print("  ⏰ Scheduled - Match scheduled")
            print("  (N) - Team seed number")
            print("=" * 70)
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"Error: File not found: {sys.argv[1]}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
