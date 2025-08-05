#!/usr/bin/env python3
"""
URGENT FINAL TEST - Josh Allen Search Test
Only test if Josh Allen search works when typing "J"
"""

import requests
import sys

def test_josh_allen_search():
    """Test if Josh Allen appears when typing single letter 'J'"""
    
    base_url = "https://d299295e-a616-4a5a-a918-7496662d3af5.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🏈 URGENT FINAL TEST: Josh Allen Single Letter Search")
    print("=" * 50)
    
    try:
        # Test search for single letter "J"
        print("Testing search for single letter 'J'...")
        response = requests.get(f"{api_url}/players/search", params={"q": "J", "limit": 10}, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ API Error: Status {response.status_code}")
            return False
            
        players = response.json()
        print(f"✅ API Response: {len(players)} players returned")
        
        # Check if Josh Allen is in results
        josh_allen_found = False
        josh_allen_position = -1
        
        for i, player in enumerate(players):
            if player['name'] == 'Josh Allen':
                josh_allen_found = True
                josh_allen_position = i + 1
                print(f"✅ Josh Allen FOUND at position #{josh_allen_position}")
                print(f"   Details: {player['position']}, {player['nfl_team']}, Rank: {player.get('etr_rank', 'N/A')}")
                break
        
        if not josh_allen_found:
            print("❌ Josh Allen NOT FOUND in results")
            print("First 10 results:")
            for i, player in enumerate(players[:10]):
                print(f"   {i+1}. {player['name']} ({player['position']}, {player['nfl_team']})")
        
        print("=" * 50)
        print(f"RESULT: Josh Allen appears when typing 'J': {'YES' if josh_allen_found else 'NO'}")
        print("=" * 50)
        
        return josh_allen_found
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print("=" * 50)
        print("RESULT: Josh Allen appears when typing 'J': NO (ERROR)")
        print("=" * 50)
        return False

if __name__ == "__main__":
    success = test_josh_allen_search()
    sys.exit(0 if success else 1)