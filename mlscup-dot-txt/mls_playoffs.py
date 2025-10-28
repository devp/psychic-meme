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


def display_compressed_bracket(schedule: List[dict]):
    """Display tournament in compressed bracket format"""
    sections = group_by_section(schedule)
    
    print("\n" + "=" * 100)
    print("                                MLS CUP PLAYOFFS 2025 - BRACKET VIEW")
    print("=" * 100)
    
    # Wild Card Results
    if 'Wild Card matches' in sections:
        print("\n🎯 WILD CARD:")
        wc_matches = sections['Wild Card matches']
        for match in wc_matches:
            home = get_team_short_name(match['home_team_name'], match.get('home_team_three_letter_code', ''))
            away = get_team_short_name(match['away_team_name'], match.get('away_team_three_letter_code', ''))
            
            if match.get('match_status') == 'finalWhistle':
                result = match.get('result', '0:0')
                home_goals = match.get('home_team_goals', 0)
                away_goals = match.get('away_team_goals', 0)
                
                if home_goals > away_goals:
                    winner = f"✅{home}"
                    loser = f"✗{away}"
                else:
                    winner = f"✅{away}"
                    loser = f"✗{home}"
                    
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home}: {result} ({date}) → {winner} advances, {loser} eliminated")
            else:
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home} - {date}")
    
    # Round One Best-of-3 Series
    if 'Round One Best-of-3 Series' in sections:
        print("\n🏆 ROUND ONE (Best of 3):")
        r1_matches = sections['Round One Best-of-3 Series']
        
        # Group by series
        series_dict = defaultdict(list)
        for match in r1_matches:
            series_name = match.get('series_name', 'Unknown')
            series_dict[series_name].append(match)
        
        for series_name, series_matches in series_dict.items():
            series_matches.sort(key=lambda m: m.get('match_type', ''))
            
            # Get team info from first match
            first_match = series_matches[0]
            home_team = get_team_short_name(first_match['home_team_name'], first_match.get('home_team_three_letter_code', ''))
            away_team = get_team_short_name(first_match['away_team_name'], first_match.get('away_team_three_letter_code', ''))
            home_seed = first_match.get('home_team_seed', '')
            away_seed = first_match.get('away_team_seed', '')
            
            home_display = f"({home_seed}){home_team}" if home_seed else home_team
            away_display = f"({away_seed}){away_team}" if away_seed else away_team
            
            # Calculate series record
            home_record = get_series_record(series_matches, first_match.get('home_team_id'))
            away_record = get_series_record(series_matches, first_match.get('away_team_id'))
            
            print(f"\n  {away_display} vs {home_display} [{away_record[0]}-{away_record[1]}] vs [{home_record[0]}-{home_record[1]}]")
            
            # Show match results
            for i, match in enumerate(series_matches, 1):
                if match.get('match_status') == 'finalWhistle':
                    result = match.get('result', '0:0')
                    pk_info = ""
                    if match.get('home_team_penalty_goals', 0) > 0 or match.get('away_team_penalty_goals', 0) > 0:
                        pk_info = f" (PK: {match.get('away_team_penalty_goals', 0)}-{match.get('home_team_penalty_goals', 0)})"
                    date = format_time_compact(match.get('planned_kickoff_time', ''))
                    status = "✅"
                elif match.get('match_status') == 'scheduled':
                    result = "TBD"
                    pk_info = ""
                    date = format_time_compact(match.get('planned_kickoff_time', ''))
                    status = "⏰"
                else:
                    result = "TBD"
                    pk_info = ""
                    date = "TBD"
                    status = "?"
                    
                print(f"    G{i}: {result}{pk_info} ({date}) {status}")
            
            # Determine series winner if applicable
            if max(home_record[0], away_record[0]) >= 2:
                if home_record[0] > away_record[0]:
                    print(f"    → {home_display} ADVANCES")
                else:
                    print(f"    → {away_display} ADVANCES")
            elif home_record[0] + away_record[0] + home_record[1] + away_record[1] >= 3:
                print(f"    → Series continues...")
    
    # Conference Semifinals
    if 'Conference Semifinals' in sections:
        print("\n🔥 CONFERENCE SEMIFINALS:")
        cf_matches = sections['Conference Semifinals']
        for match in cf_matches:
            home = get_team_short_name(match['home_team_name'], match.get('home_team_three_letter_code', ''))
            away = get_team_short_name(match['away_team_name'], match.get('away_team_three_letter_code', ''))
            
            if match.get('match_status') == 'finalWhistle':
                result = match.get('result', '0:0')
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home}: {result} ({date}) ✅")
            else:
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home} - {date} ⏰")
    
    # Conference Finals
    if 'Conference Finals' in sections:
        print("\n🏅 CONFERENCE FINALS:")
        cf_matches = sections['Conference Finals']
        for match in cf_matches:
            home = get_team_short_name(match['home_team_name'], match.get('home_team_three_letter_code', ''))
            away = get_team_short_name(match['away_team_name'], match.get('away_team_three_letter_code', ''))
            
            if match.get('match_status') == 'finalWhistle':
                result = match.get('result', '0:0')
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home}: {result} ({date}) ✅")
            else:
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home} - {date} ⏰")
    
    # MLS Cup Final
    if 'MLS Cup presented by Audi' in sections:
        print("\n🏆 MLS CUP FINAL:")
        final_matches = sections['MLS Cup presented by Audi']
        for match in final_matches:
            home = get_team_short_name(match['home_team_name'], match.get('home_team_three_letter_code', ''))
            away = get_team_short_name(match['away_team_name'], match.get('away_team_three_letter_code', ''))
            
            if match.get('match_status') == 'finalWhistle':
                result = match.get('result', '0:0')
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home}: {result} ({date}) ✅ CHAMPION!")
            else:
                date = format_time_compact(match.get('planned_kickoff_time', ''))
                print(f"  {away} @ {home} - {date} ⏰")
    
    print("\n" + "=" * 100)
    print("Legend: ✅=Final ⏰=Scheduled ✗=Eliminated (seed)=Team Seed [W-L]=Series Record")
    print("=" * 100)


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
            display_compressed_bracket(schedule)
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
