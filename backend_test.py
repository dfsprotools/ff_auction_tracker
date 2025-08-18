#!/usr/bin/env python3
"""
Fantasy Football Auction Tracker - Backend API Testing
Tests all API endpoints for the simplified single-user commissioner mode
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class FantasyFootballAPITester:
    def __init__(self, base_url="https://draft-sync-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.league_id = None
        self.team_ids = []
        self.player_picks = []
        self.tests_run = 0
        self.tests_passed = 0
        
    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            if response.status_code in [200, 201]:
                try:
                    return True, response.json()
                except:
                    return True, {"message": "Success - no JSON response"}
            else:
                return False, {
                    "status_code": response.status_code,
                    "error": response.text[:200]
                }
                
        except requests.exceptions.RequestException as e:
            return False, {"error": f"Request failed: {str(e)}"}
        except Exception as e:
            return False, {"error": f"Unexpected error: {str(e)}"}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.make_request('GET', '/')
        return self.log_test(
            "API Root Endpoint", 
            success and "Fantasy Football Auction Draft Tracker API" in str(response),
            f"Response: {response.get('message', 'No message')}"
        )

    def test_create_demo_league(self):
        """Test creating the demo league 'Pipelayer Pro Bowl'"""
        success, response = self.make_request('POST', '/demo-league')
        
        if success:
            self.league_id = response.get('id')
            self.team_ids = [team['id'] for team in response.get('teams', [])]
            
            # Validate league structure
            expected_fields = ['name', 'total_teams', 'budget_per_team', 'roster_size', 'teams']
            missing_fields = [field for field in expected_fields if field not in response]
            
            if missing_fields:
                return self.log_test(
                    "Create Demo League", 
                    False, 
                    f"Missing fields: {missing_fields}"
                )
            
            # Validate league details
            league_valid = (
                response.get('name') == 'Pipelayer Pro Bowl' and
                response.get('total_teams') == 14 and
                response.get('budget_per_team') == 300 and
                len(response.get('teams', [])) == 14
            )
            
            return self.log_test(
                "Create Demo League", 
                league_valid,
                f"League: {response.get('name')}, Teams: {len(response.get('teams', []))}, Budget: ${response.get('budget_per_team')}"
            )
        
        return self.log_test("Create Demo League", False, f"Error: {response}")

    def test_get_league(self):
        """Test retrieving league by ID"""
        if not self.league_id:
            return self.log_test("Get League", False, "No league ID available")
        
        success, response = self.make_request('GET', f'/leagues/{self.league_id}')
        
        if success:
            league_valid = (
                response.get('id') == self.league_id and
                response.get('name') == 'Pipelayer Pro Bowl'
            )
            return self.log_test(
                "Get League", 
                league_valid,
                f"Retrieved league: {response.get('name')}"
            )
        
        return self.log_test("Get League", False, f"Error: {response}")

    def test_get_all_leagues(self):
        """Test retrieving all leagues"""
        success, response = self.make_request('GET', '/leagues')
        
        if success and isinstance(response, list):
            demo_league_found = any(
                league.get('name') == 'Pipelayer Pro Bowl' 
                for league in response
            )
            return self.log_test(
                "Get All Leagues", 
                demo_league_found,
                f"Found {len(response)} leagues, demo league present: {demo_league_found}"
            )
        
        return self.log_test("Get All Leagues", False, f"Error: {response}")

    def test_player_search(self):
        """Test player search functionality"""
        # Test basic search
        success, response = self.make_request('GET', '/players/search', params={'q': 'Josh', 'limit': 10})
        
        if success and isinstance(response, list):
            josh_players = [p for p in response if 'josh' in p.get('name', '').lower()]
            
            # Should find Josh Allen, Josh Jacobs, etc.
            josh_allen_found = any(
                'josh allen' in p.get('name', '').lower() and p.get('position') == 'QB'
                for p in josh_players
            )
            
            return self.log_test(
                "Player Search - Josh", 
                len(josh_players) > 0 and josh_allen_found,
                f"Found {len(josh_players)} Josh players, Josh Allen found: {josh_allen_found}"
            )
        
        return self.log_test("Player Search - Josh", False, f"Error: {response}")

    def test_player_search_by_position(self):
        """Test player search by position"""
        success, response = self.make_request('GET', '/players/search', params={'position': 'QB', 'limit': 10})
        
        if success and isinstance(response, list):
            all_qbs = all(p.get('position') == 'QB' for p in response)
            return self.log_test(
                "Player Search - QB Position", 
                len(response) > 0 and all_qbs,
                f"Found {len(response)} QBs, all are QBs: {all_qbs}"
            )
        
        return self.log_test("Player Search - QB Position", False, f"Error: {response}")

    def test_te_position_search(self):
        """Test TE position search - Critical for user issue"""
        success, response = self.make_request('GET', '/players/search', params={'position': 'TE', 'limit': 10})
        
        if success and isinstance(response, list):
            all_tes = all(p.get('position') == 'TE' for p in response)
            te_players_found = len(response) > 0
            
            # Look for known TE players
            known_tes = ['travis kelce', 'mark andrews', 'george kittle', 'tj hockenson']
            known_te_found = any(
                any(known_te in p.get('name', '').lower() for known_te in known_tes)
                for p in response
            )
            
            return self.log_test(
                "Player Search - TE Position", 
                te_players_found and all_tes,
                f"Found {len(response)} TEs, all are TEs: {all_tes}, known TE found: {known_te_found}"
            )
        
        return self.log_test("Player Search - TE Position", False, f"Error: {response}")

    def test_def_position_search(self):
        """Test DEF position search - Critical for user issue"""
        success, response = self.make_request('GET', '/players/search', params={'position': 'DEF', 'limit': 10})
        
        if success and isinstance(response, list):
            all_defs = all(p.get('position') == 'DEF' for p in response)
            def_players_found = len(response) > 0
            
            return self.log_test(
                "Player Search - DEF Position", 
                def_players_found and all_defs,
                f"Found {len(response)} DEF players, all are DEF: {all_defs}"
            )
        
        return self.log_test("Player Search - DEF Position", False, f"Error: {response}")

    def test_draft_player(self):
        """Test drafting a player"""
        if not self.league_id or not self.team_ids:
            return self.log_test("Draft Player", False, "No league or team IDs available")
        
        # First, get a player to draft
        success, players = self.make_request('GET', '/players/search', params={'q': 'Josh Allen', 'limit': 1})
        
        if not success or not players:
            return self.log_test("Draft Player", False, "Could not find Josh Allen to draft")
        
        player = players[0]
        team_id = self.team_ids[0]  # Use first team
        bid_amount = 50
        
        draft_data = {
            "player": {
                "name": player['name'],
                "position": player['position'],
                "nfl_team": player['nfl_team'],
                "etr_rank": player.get('etr_rank'),
                "adp": player.get('adp'),
                "pos_rank": player.get('pos_rank')
            },
            "team_id": team_id,
            "amount": bid_amount
        }
        
        success, response = self.make_request('POST', f'/leagues/{self.league_id}/draft', draft_data)
        
        if success:
            # Verify the draft was successful
            drafted_team = None
            for team in response.get('teams', []):
                if team['id'] == team_id:
                    drafted_team = team
                    break
            
            if drafted_team:
                draft_successful = (
                    len(drafted_team.get('roster', [])) > 0 and
                    drafted_team.get('spent') == bid_amount and
                    drafted_team.get('remaining') == 300 - bid_amount
                )
                
                if draft_successful:
                    # Store pick for undo test
                    if response.get('all_picks'):
                        self.player_picks = response['all_picks']
                
                return self.log_test(
                    "Draft Player", 
                    draft_successful,
                    f"Drafted {player['name']} for ${bid_amount}, team spent: ${drafted_team.get('spent')}"
                )
        
        return self.log_test("Draft Player", False, f"Error: {response}")

    def test_max_bid_calculation(self):
        """Test MAX BID calculation after draft"""
        if not self.league_id:
            return self.log_test("MAX BID Calculation", False, "No league ID available")
        
        success, response = self.make_request('GET', f'/leagues/{self.league_id}')
        
        if success:
            # Check that MAX BID is calculated correctly for teams
            team_with_pick = None
            for team in response.get('teams', []):
                if len(team.get('roster', [])) > 0:
                    team_with_pick = team
                    break
            
            if team_with_pick:
                # MAX BID = Remaining Budget - (Remaining Roster Spots - 1)
                remaining_spots = 16 - len(team_with_pick['roster'])  # 16 is roster size
                expected_max_bid = max(0, team_with_pick['remaining'] - max(0, remaining_spots - 1))
                actual_max_bid = team_with_pick.get('max_bid', 0)
                
                max_bid_correct = actual_max_bid == expected_max_bid
                
                return self.log_test(
                    "MAX BID Calculation", 
                    max_bid_correct,
                    f"Expected: ${expected_max_bid}, Actual: ${actual_max_bid}, Remaining: ${team_with_pick['remaining']}, Spots: {remaining_spots}"
                )
        
        return self.log_test("MAX BID Calculation", False, f"Error: {response}")

    def test_undo_pick(self):
        """Test undoing a draft pick"""
        if not self.league_id or not self.player_picks:
            return self.log_test("Undo Pick", False, "No league ID or picks available")
        
        # Get the last pick to undo
        last_pick = self.player_picks[-1]
        pick_id = last_pick['id']
        
        success, response = self.make_request('DELETE', f'/leagues/{self.league_id}/picks/{pick_id}')
        
        if success:
            # Verify the pick was undone by checking league state
            success2, league_response = self.make_request('GET', f'/leagues/{self.league_id}')
            
            if success2:
                # Check that the pick is no longer in all_picks
                pick_removed = not any(
                    pick['id'] == pick_id 
                    for pick in league_response.get('all_picks', [])
                )
                
                return self.log_test(
                    "Undo Pick", 
                    pick_removed,
                    f"Pick {pick_id} removed: {pick_removed}"
                )
        
        return self.log_test("Undo Pick", False, f"Error: {response}")

    def test_league_settings_update(self):
        """Test updating league settings"""
        if not self.league_id:
            return self.log_test("Update League Settings", False, "No league ID available")
        
        updated_settings = {
            "name": "Updated Pipelayer Pro Bowl",
            "total_teams": 14,
            "budget_per_team": 350,  # Changed from 300
            "roster_size": 16,
            "position_requirements": {
                "QB": 1,
                "RB": 2,
                "WR": 2,
                "TE": 1,
                "FLEX": 1,
                "K": 1,
                "DEF": 1
            }
        }
        
        success, response = self.make_request('PUT', f'/leagues/{self.league_id}/settings', updated_settings)
        
        if success:
            settings_updated = (
                response.get('name') == updated_settings['name'] and
                response.get('budget_per_team') == updated_settings['budget_per_team']
            )
            
            return self.log_test(
                "Update League Settings", 
                settings_updated,
                f"Name: {response.get('name')}, Budget: ${response.get('budget_per_team')}"
            )
        
        return self.log_test("Update League Settings", False, f"Error: {response}")

    def test_team_update(self):
        """Test updating team details"""
        if not self.league_id or not self.team_ids:
            return self.log_test("Update Team", False, "No league or team IDs available")
        
        team_id = self.team_ids[0]
        team_data = {"name": "Updated Team Name"}
        
        success, response = self.make_request('PUT', f'/leagues/{self.league_id}/teams/{team_id}', team_data)
        
        if success:
            # Verify team name was updated
            updated_team = None
            for team in response.get('teams', []):
                if team['id'] == team_id:
                    updated_team = team
                    break
            
            name_updated = updated_team and updated_team.get('name') == team_data['name']
            
            return self.log_test(
                "Update Team", 
                name_updated,
                f"Team name updated to: {updated_team.get('name') if updated_team else 'Not found'}"
            )
        
        return self.log_test("Update Team", False, f"Error: {response}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Fantasy Football Auction Tracker Backend Tests")
        print(f"🌐 Testing API at: {self.api_url}")
        print("=" * 60)
        
        # Core API tests
        self.test_api_root()
        self.test_create_demo_league()
        self.test_get_league()
        self.test_get_all_leagues()
        
        # Critical tests for TE and DEF positions (user issue)
        print("\n🎯 CRITICAL TESTS - TE and DEF Position Support")
        self.test_get_demo_league_endpoint()
        self.test_demo_league_position_requirements()
        self.test_te_position_search()
        self.test_def_position_search()
        
        # Player search tests
        self.test_player_search()
        self.test_player_search_by_position()
        
        # Draft functionality tests
        self.test_draft_player()
        self.test_max_bid_calculation()
        self.test_undo_pick()
        
        # League management tests
        self.test_league_settings_update()
        self.test_team_update()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests PASSED! API is working correctly.")
            return 0
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} test(s) FAILED. Backend needs attention.")
            return 1

def main():
    """Main test execution"""
    tester = FantasyFootballAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())