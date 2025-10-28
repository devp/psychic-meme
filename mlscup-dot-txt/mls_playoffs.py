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


def get_match_status_display(match: dict) -> str:
    """Format match status for display"""
    status = match.get('match_status', '')
    
    if status == 'finalWhistle':
        return '✓ FINAL'
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
        print("  ✓ FINAL - Match completed")
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
