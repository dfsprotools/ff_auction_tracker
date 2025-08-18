#!/usr/bin/env python3

import requests
import sys

def test_player_database():
    """Test the player database to see what's happening"""
    base_url = "https://draft-sync-hub.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🔍 Testing Player Database...")
    
    try:
        # Test 1: Get all players
        print("\n1. Testing all players (limit=500)...")
        response = requests.get(f"{api_url}/players/search", params={"limit": 500}, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            players = response.json()
            print(f"Total players returned: {len(players)}")
            
            if len(players) > 0:
                print(f"First 3 players:")
                for i, player in enumerate(players[:3]):
                    print(f"  {i+1}. {player.get('name', 'N/A')} ({player.get('position', 'N/A')}, {player.get('nfl_team', 'N/A')})")
            else:
                print("❌ No players returned!")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
            
        # Test 2: Search for Josh Allen specifically
        print("\n2. Testing Josh Allen search...")
        response = requests.get(f"{api_url}/players/search", params={"q": "Josh Allen", "limit": 10}, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            players = response.json()
            print(f"Josh Allen search returned: {len(players)} players")
            
            for player in players:
                print(f"  - {player.get('name', 'N/A')} ({player.get('position', 'N/A')}, {player.get('nfl_team', 'N/A')})")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
            
        # Test 3: Search by position
        print("\n3. Testing QB position search...")
        response = requests.get(f"{api_url}/players/search", params={"position": "QB", "limit": 10}, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            players = response.json()
            print(f"QB search returned: {len(players)} players")
            
            for player in players:
                print(f"  - {player.get('name', 'N/A')} ({player.get('position', 'N/A')}, {player.get('nfl_team', 'N/A')})")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        return False
        
    return True

if __name__ == "__main__":
    test_player_database()