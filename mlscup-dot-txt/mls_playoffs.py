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
    if team_seed:
        display_name = f"({team_seed}){short_name}"
    else:
        display_name = short_name
    
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


def get_next_match_info(series_matches: List[dict]) -> dict:
    """Get info about the next match in a series"""
    for match in series_matches:
        if match.get('match_status') == 'scheduled':
            return {
                'date': format_time_compact(match.get('planned_kickoff_time', '')),
                'match_type': match.get('match_type', ''),
                'venue': match.get('stadium_name', 'TBC')
            }
    return None


def get_series_state_emoji(series_matches: List[dict], home_id: str, away_id: str) -> str:
    """Get emoji representing series state"""
    home_record = get_series_record(series_matches, home_id)
    away_record = get_series_record(series_matches, away_id)
    
    if home_record[0] >= 2 or away_record[0] >= 2:
        return "✅"  # Series complete
    elif home_record[0] + away_record[0] + home_record[1] + away_record[1] > 0:
        return "⚽"  # Series in progress
    else:
        return "⏰"  # Series not started


def display_ascii_bracket(schedule: List[dict]):
    """Display tournament as ASCII bracket with integrated details"""
    sections = group_by_section(schedule)
    
    print("\n" + "=" * 140)
    print("                                    MLS CUP PLAYOFFS 2025 - BRACKET")
    print("=" * 140)
    
    # Collect Wild Card data
    wildcard_data = []
    if 'Wild Card matches' in sections:
        for match in sections['Wild Card matches']:
            home = get_bracket_team_info(match, True)['display']
            away = get_bracket_team_info(match, False)['display']
            winner = get_match_winner(match)
            
            if winner:
                wildcard_data.append({
                    'display': f"✅ {winner}",
                    'detail': f"Advanced from WC"
                })
            else:
                wildcard_data.append({
                    'display': f"⏰ {away} v {home}",
                    'detail': format_time_compact(match.get('planned_kickoff_time', ''))
                })
    
    # Collect Round One series data
    r1_data = []
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
            
            state_emoji = get_series_state_emoji(series_matches, first_match.get('home_team_id'), first_match.get('away_team_id'))
            winner = get_series_winner(series_matches)
            
            if winner:
                r1_data.append({
                    'display': f"✅ {winner}",
                    'detail': f"Won series",
                    'seed': home_info['seed'] or away_info['seed']
                })
            else:
                next_match = get_next_match_info(series_matches)
                detail = ""
                if next_match:
                    detail = f"Next: {next_match['date']}"
                else:
                    detail = f"[{away_record[0]}-{away_record[1]}] v [{home_record[0]}-{home_record[1]}]"
                
                r1_data.append({
                    'display': f"{state_emoji} {away_info['display']} v {home_info['display']}",
                    'detail': detail,
                    'seed': home_info['seed'] or 99
                })
    
    # Sort by seed for consistent display
    r1_data.sort(key=lambda x: int(x.get('seed', 99)))
    
    # Collect Conference Semifinals data
    semifinal_data = []
    if 'Conference Semifinals' in sections:
        for match in sections['Conference Semifinals']:
            home = get_bracket_team_info(match, True)['display']
            away = get_bracket_team_info(match, False)['display']
            winner = get_match_winner(match)
            
            if winner:
                semifinal_data.append({
                    'display': f"✅ {winner}",
                    'detail': "Advanced"
                })
            else:
                semifinal_data.append({
                    'display': f"⏰ {away} v {home}",
                    'detail': format_time_compact(match.get('planned_kickoff_time', ''))
                })
    
    # Collect Conference Finals data
    final_data = []
    if 'Conference Finals' in sections:
        for match in sections['Conference Finals']:
            home = get_bracket_team_info(match, True)['display']
            away = get_bracket_team_info(match, False)['display']
            winner = get_match_winner(match)
            
            if winner:
                final_data.append({
                    'display': f"✅ {winner}",
                    'detail': "To MLS Cup"
                })
            else:
                final_data.append({
                    'display': f"⏰ {away} v {home}",
                    'detail': format_time_compact(match.get('planned_kickoff_time', ''))
                })
    
    # Collect MLS Cup data
    cup_data = None
    if 'MLS Cup presented by Audi' in sections:
        for match in sections['MLS Cup presented by Audi']:
            home = get_bracket_team_info(match, True)['display']
            away = get_bracket_team_info(match, False)['display']
            winner = get_match_winner(match)
            
            if winner:
                cup_data = {
                    'display': f"🏆 {winner}",
                    'detail': "CHAMPION!"
                }
            else:
                cup_data = {
                    'display': f"⏰ {away} v {home}",
                    'detail': format_time_compact(match.get('planned_kickoff_time', ''))
                }
    
    # Print bracket with details
    print("\nWILD CARD          ROUND ONE (Best of 3)      CONF SEMIS        CONF FINALS       MLS CUP")
    print("─" * 140)
    
    max_rows = max(len(wildcard_data), len(r1_data), len(semifinal_data), len(final_data), 1) * 2  # *2 for detail lines
    
    for i in range(0, max_rows, 2):  # Step by 2 to handle main + detail lines
        row_idx = i // 2
        
        # Main line
        line = ""
        
        # Wild Card (22 chars)
        if row_idx < len(wildcard_data):
            line += f"{wildcard_data[row_idx]['display']:<22}"
        else:
            line += " " * 22
        line += "─"
        
        # Round One (28 chars)
        if row_idx < len(r1_data):
            line += f"{r1_data[row_idx]['display']:<28}"
        else:
            line += " " * 28
        line += "─"
        
        # Conference Semifinals (20 chars)
        if row_idx < len(semifinal_data):
            line += f"{semifinal_data[row_idx]['display']:<20}"
        else:
            line += " " * 20
        line += "─"
        
        # Conference Finals (20 chars)
        if row_idx < len(final_data):
            line += f"{final_data[row_idx]['display']:<20}"
        else:
            line += " " * 20
        line += "─"
        
        # MLS Cup
        if row_idx == 0 and cup_data:
            line += cup_data['display']
        
        print(line)
        
        # Detail line
        detail_line = ""
        
        # Wild Card detail
        if row_idx < len(wildcard_data):
            detail_line += f"  {wildcard_data[row_idx]['detail']:<20}"
        else:
            detail_line += " " * 22
        detail_line += " "
        
        # Round One detail
        if row_idx < len(r1_data):
            detail_line += f"  {r1_data[row_idx]['detail']:<26}"
        else:
            detail_line += " " * 28
        detail_line += " "
        
        # Conference Semifinals detail
        if row_idx < len(semifinal_data):
            detail_line += f"  {semifinal_data[row_idx]['detail']:<18}"
        else:
            detail_line += " " * 20
        detail_line += " "
        
        # Conference Finals detail
        if row_idx < len(final_data):
            detail_line += f"  {final_data[row_idx]['detail']:<18}"
        else:
            detail_line += " " * 20
        detail_line += " "
        
        # MLS Cup detail
        if row_idx == 0 and cup_data:
            detail_line += f"  {cup_data['detail']}"
        
        print(detail_line)
        
        if i + 2 < max_rows:  # Add spacing between matchups
            print()
    
    print("\n" + "=" * 140)
    print("Legend: ✅=Complete ⚽=In Progress ⏰=Scheduled 🏆=Champion (seed)=Team Seed")
    print("=" * 140)


def main():
    """Main function to fetch and display playoff data"""
    # Determine source
    source = DEFAULT_URL
    compressed = True
    if len(sys.argv) > 1:
        if sys.argv[1] == '--detailed':
            compressed = False
        else
            source = sys.argv[1]
            if len(sys.argv) > 2 and sys.argv[2] == '--detailed':
                compressed = False
    
    try:
        # Load data
        data = load_data(source)
        schedule = data.get('schedule', [])
        
        if not schedule:
            print("No matches found in the data.")
            return
        
        # Check if user wants compressed view (default now)
        compressed = True
        if len(sys.argv) == 1 and sys.argv[1] == '--detailed':
            compressed = False
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
