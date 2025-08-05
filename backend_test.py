import requests
import sys
from datetime import datetime
import json

class FantasyFootballAPITester:
    def __init__(self, base_url="https://d299295e-a616-4a5a-a918-7496662d3af5.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.league_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {response.json()}"
            self.log_test("API Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("API Health Check", False, f"Error: {str(e)}")
            return False

    def test_create_demo_league(self):
        """Test demo league creation and verify initial MAX BID calculations"""
        try:
            response = requests.post(f"{self.api_url}/demo-league", timeout=10)
            success = response.status_code == 200
            
            if success:
                league_data = response.json()
                self.league_id = league_data['id']
                
                # Verify league structure
                expected_teams = 14
                expected_budget = 300
                expected_roster_size = 16
                
                structure_valid = (
                    league_data['total_teams'] == expected_teams and
                    league_data['budget_per_team'] == expected_budget and
                    league_data['roster_size'] == expected_roster_size and
                    league_data['name'] == "Pipelayer Pro Bowl"
                )
                
                # CRITICAL: Verify initial MAX BID calculation
                # Formula: Remaining Budget - (Remaining Roster Spots - 1)
                # Should be: $300 - (16 - 1) = $285
                expected_max_bid = 285
                max_bid_correct = True
                max_bid_details = []
                
                for team in league_data['teams']:
                    actual_max_bid = team['max_bid']
                    remaining = team['remaining']
                    remaining_spots = team['remaining_spots']
                    
                    max_bid_details.append(f"{team['name']}: MAX_BID=${actual_max_bid}, Remaining=${remaining}, Spots={remaining_spots}")
                    
                    if actual_max_bid != expected_max_bid:
                        max_bid_correct = False
                
                details = f"Teams: {len(league_data['teams'])}, Budget: ${league_data['budget_per_team']}, Roster: {league_data['roster_size']}"
                details += f"\nMAX BID Check: Expected ${expected_max_bid}, " + "; ".join(max_bid_details[:3])
                
                overall_success = success and structure_valid and max_bid_correct
                self.log_test("Create Demo League & Initial MAX BID", overall_success, details)
                return overall_success
            else:
                self.log_test("Create Demo League & Initial MAX BID", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Create Demo League & Initial MAX BID", False, f"Error: {str(e)}")
            return False

    def test_player_search(self):
        """Test player search functionality"""
        try:
            # Test search for Josh Allen
            response = requests.get(f"{self.api_url}/players/search", params={"q": "Josh Allen"}, timeout=10)
            success = response.status_code == 200
            
            if success:
                players = response.json()
                josh_allen_found = any(player['name'] == 'Josh Allen' for player in players)
                details = f"Found {len(players)} players, Josh Allen found: {josh_allen_found}"
                if josh_allen_found:
                    josh_allen = next(player for player in players if player['name'] == 'Josh Allen')
                    details += f", Position: {josh_allen['position']}, Team: {josh_allen['nfl_team']}"
                
                overall_success = success and josh_allen_found
                self.log_test("Player Search (Josh Allen)", overall_success, details)
                return overall_success
            else:
                self.log_test("Player Search (Josh Allen)", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Player Search (Josh Allen)", False, f"Error: {str(e)}")
            return False

    def test_draft_player_and_max_bid_update(self):
        """Test drafting Josh Allen and verify MAX BID updates correctly"""
        if not self.league_id:
            self.log_test("Draft Player & MAX BID Update", False, "No league ID available")
            return False
            
        try:
            # Get initial league state
            league_response = requests.get(f"{self.api_url}/leagues/{self.league_id}", timeout=10)
            if league_response.status_code != 200:
                self.log_test("Draft Player & MAX BID Update", False, "Could not fetch league")
                return False
                
            initial_league = league_response.json()
            team_1 = initial_league['teams'][0]  # Team 1
            initial_max_bid = team_1['max_bid']
            initial_remaining = team_1['remaining']
            initial_spots = team_1['remaining_spots']
            
            # Draft Josh Allen for $50 to Team 1
            draft_data = {
                "player": {
                    "name": "Josh Allen",
                    "position": "QB",
                    "nfl_team": "BUF",
                    "etr_rank": 1,
                    "adp": 12.5,
                    "pos_rank": 1
                },
                "team_id": team_1['id'],
                "amount": 50
            }
            
            response = requests.post(f"{self.api_url}/leagues/{self.league_id}/draft", json=draft_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                updated_team_1 = next(team for team in updated_league['teams'] if team['id'] == team_1['id'])
                
                # Verify calculations
                expected_spent = 50
                expected_remaining = 300 - 50  # $250
                expected_remaining_spots = 15  # 16 - 1
                expected_max_bid = expected_remaining - (expected_remaining_spots - 1)  # $250 - 14 = $236
                
                actual_spent = updated_team_1['spent']
                actual_remaining = updated_team_1['remaining']
                actual_spots = updated_team_1['remaining_spots']
                actual_max_bid = updated_team_1['max_bid']
                actual_roster_size = len(updated_team_1['roster'])
                
                calculations_correct = (
                    actual_spent == expected_spent and
                    actual_remaining == expected_remaining and
                    actual_spots == expected_remaining_spots and
                    actual_max_bid == expected_max_bid and
                    actual_roster_size == 1
                )
                
                details = f"Josh Allen drafted for $50. "
                details += f"Spent: ${actual_spent} (exp: ${expected_spent}), "
                details += f"Remaining: ${actual_remaining} (exp: ${expected_remaining}), "
                details += f"Spots: {actual_spots} (exp: {expected_remaining_spots}), "
                details += f"MAX BID: ${actual_max_bid} (exp: ${expected_max_bid}), "
                details += f"Roster: {actual_roster_size} players"
                
                overall_success = success and calculations_correct
                self.log_test("Draft Player & MAX BID Update", overall_success, details)
                return overall_success
            else:
                self.log_test("Draft Player & MAX BID Update", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Draft Player & MAX BID Update", False, f"Error: {str(e)}")
            return False

    def test_draft_second_player(self):
        """Test drafting Christian McCaffrey to Team 2 and verify different MAX BID values"""
        if not self.league_id:
            self.log_test("Draft Second Player", False, "No league ID available")
            return False
            
        try:
            # Get current league state
            league_response = requests.get(f"{self.api_url}/leagues/{self.league_id}", timeout=10)
            if league_response.status_code != 200:
                self.log_test("Draft Second Player", False, "Could not fetch league")
                return False
                
            current_league = league_response.json()
            team_2 = current_league['teams'][1]  # Team 2
            
            # Draft Christian McCaffrey for $75 to Team 2
            draft_data = {
                "player": {
                    "name": "Christian McCaffrey",
                    "position": "RB",
                    "nfl_team": "SF",
                    "etr_rank": 2,
                    "adp": 3.2,
                    "pos_rank": 1
                },
                "team_id": team_2['id'],
                "amount": 75
            }
            
            response = requests.post(f"{self.api_url}/leagues/{self.league_id}/draft", json=draft_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                updated_team_1 = next(team for team in updated_league['teams'] if team['id'] == current_league['teams'][0]['id'])
                updated_team_2 = next(team for team in updated_league['teams'] if team['id'] == team_2['id'])
                
                # Verify Team 1 still has correct values (Josh Allen for $50)
                team_1_correct = (
                    updated_team_1['spent'] == 50 and
                    updated_team_1['remaining'] == 250 and
                    updated_team_1['max_bid'] == 236  # $250 - 14
                )
                
                # Verify Team 2 has correct values (Christian McCaffrey for $75)
                team_2_correct = (
                    updated_team_2['spent'] == 75 and
                    updated_team_2['remaining'] == 225 and
                    updated_team_2['max_bid'] == 211  # $225 - 14
                )
                
                details = f"Christian McCaffrey drafted for $75. "
                details += f"Team 1: MAX BID ${updated_team_1['max_bid']} (exp: $236), "
                details += f"Team 2: MAX BID ${updated_team_2['max_bid']} (exp: $211)"
                
                overall_success = success and team_1_correct and team_2_correct
                self.log_test("Draft Second Player", overall_success, details)
                return overall_success
            else:
                self.log_test("Draft Second Player", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Draft Second Player", False, f"Error: {str(e)}")
            return False

    def test_undo_functionality(self):
        """Test undo functionality and verify calculations revert correctly"""
        if not self.league_id:
            self.log_test("Undo Functionality", False, "No league ID available")
            return False
            
        try:
            # Get current league state to find a pick to undo
            league_response = requests.get(f"{self.api_url}/leagues/{self.league_id}", timeout=10)
            if league_response.status_code != 200:
                self.log_test("Undo Functionality", False, "Could not fetch league")
                return False
                
            current_league = league_response.json()
            
            # Find the first pick to undo (should be Josh Allen)
            if not current_league['all_picks']:
                self.log_test("Undo Functionality", False, "No picks to undo")
                return False
                
            pick_to_undo = current_league['all_picks'][0]  # Josh Allen pick
            pick_id = pick_to_undo['id']
            team_id = pick_to_undo['team_id']
            pick_amount = pick_to_undo['amount']
            
            # Undo the pick
            response = requests.delete(f"{self.api_url}/leagues/{self.league_id}/picks/{pick_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                # Get updated league state
                updated_league_response = requests.get(f"{self.api_url}/leagues/{self.league_id}", timeout=10)
                updated_league = updated_league_response.json()
                
                # Find the team that had the pick undone
                updated_team = next(team for team in updated_league['teams'] if team['id'] == team_id)
                
                # Verify calculations reverted correctly
                expected_spent = 0  # Should be back to 0
                expected_remaining = 300  # Should be back to full budget
                expected_max_bid = 285  # Should be back to initial MAX BID
                expected_roster_size = 0  # Should have no players
                
                calculations_correct = (
                    updated_team['spent'] == expected_spent and
                    updated_team['remaining'] == expected_remaining and
                    updated_team['max_bid'] == expected_max_bid and
                    len(updated_team['roster']) == expected_roster_size
                )
                
                details = f"Undid {pick_to_undo['player']['name']} ($${pick_amount}). "
                details += f"Team now: Spent ${updated_team['spent']}, Remaining ${updated_team['remaining']}, MAX BID ${updated_team['max_bid']}, Roster {len(updated_team['roster'])}"
                
                overall_success = success and calculations_correct
                self.log_test("Undo Functionality", overall_success, details)
                return overall_success
            else:
                self.log_test("Undo Functionality", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Undo Functionality", False, f"Error: {str(e)}")
            return False

    def test_league_settings_no_kicker(self):
        """Test updating league settings for no-kicker league (K=0)"""
        if not self.league_id:
            self.log_test("League Settings - No Kicker", False, "No league ID available")
            return False
            
        try:
            # Update league settings to remove kickers (K=0)
            settings_data = {
                "name": "Pipelayer Pro Bowl",
                "total_teams": 14,
                "budget_per_team": 300,
                "roster_size": 16,
                "position_requirements": {
                    "QB": 1,
                    "RB": 2,
                    "WR": 2,
                    "TE": 1,
                    "K": 0,  # No kickers
                    "DEF": 1
                }
            }
            
            response = requests.put(f"{self.api_url}/leagues/{self.league_id}/settings", json=settings_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                
                # Verify position requirements updated
                pos_reqs = updated_league['position_requirements']
                no_kicker_correct = (
                    pos_reqs['K'] == 0 and
                    pos_reqs['QB'] == 1 and
                    pos_reqs['RB'] == 2 and
                    pos_reqs['WR'] == 2 and
                    pos_reqs['TE'] == 1 and
                    pos_reqs['DEF'] == 1
                )
                
                # Calculate total starters and bench
                total_starters = sum(pos_reqs.values())
                bench_spots = updated_league['roster_size'] - total_starters
                
                details = f"K=0 league created. Starters: {total_starters}, Bench: {bench_spots}"
                details += f", Position requirements: {pos_reqs}"
                
                overall_success = success and no_kicker_correct and total_starters == 7 and bench_spots == 9
                self.log_test("League Settings - No Kicker", overall_success, details)
                return overall_success
            else:
                self.log_test("League Settings - No Kicker", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("League Settings - No Kicker", False, f"Error: {str(e)}")
            return False

    def test_league_settings_superflex(self):
        """Test updating league settings for superflex league (QB=2)"""
        if not self.league_id:
            self.log_test("League Settings - Superflex", False, "No league ID available")
            return False
            
        try:
            # Update league settings for superflex (QB=2)
            settings_data = {
                "name": "Pipelayer Pro Bowl",
                "total_teams": 14,
                "budget_per_team": 300,
                "roster_size": 16,
                "position_requirements": {
                    "QB": 2,  # Superflex
                    "RB": 2,
                    "WR": 2,
                    "TE": 1,
                    "K": 0,  # Keep no kickers from previous test
                    "DEF": 1
                }
            }
            
            response = requests.put(f"{self.api_url}/leagues/{self.league_id}/settings", json=settings_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                
                # Verify position requirements updated
                pos_reqs = updated_league['position_requirements']
                superflex_correct = (
                    pos_reqs['QB'] == 2 and  # Superflex
                    pos_reqs['RB'] == 2 and
                    pos_reqs['WR'] == 2 and
                    pos_reqs['TE'] == 1 and
                    pos_reqs['K'] == 0 and
                    pos_reqs['DEF'] == 1
                )
                
                # Calculate total starters and bench
                total_starters = sum(pos_reqs.values())
                bench_spots = updated_league['roster_size'] - total_starters
                
                details = f"Superflex league (QB=2, K=0). Starters: {total_starters}, Bench: {bench_spots}"
                details += f", Position requirements: {pos_reqs}"
                
                overall_success = success and superflex_correct and total_starters == 8 and bench_spots == 8
                self.log_test("League Settings - Superflex", overall_success, details)
                return overall_success
            else:
                self.log_test("League Settings - Superflex", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("League Settings - Superflex", False, f"Error: {str(e)}")
            return False

    def test_flex_position_default(self):
        """Test that FLEX position is included in default league creation"""
        if not self.league_id:
            self.log_test("FLEX Position - Default", False, "No league ID available")
            return False
            
        try:
            # Get current league state
            league_response = requests.get(f"{self.api_url}/leagues/{self.league_id}", timeout=10)
            success = league_response.status_code == 200
            
            if success:
                league_data = league_response.json()
                pos_reqs = league_data['position_requirements']
                
                # Verify FLEX is present and set to 1 by default
                flex_present = 'FLEX' in pos_reqs
                flex_default_value = pos_reqs.get('FLEX', 0) == 1
                
                # Verify total calculation includes FLEX
                expected_total = 1 + 2 + 2 + 1 + 1 + 1 + 1  # QB + RB + WR + TE + FLEX + K + DEF = 9
                actual_total = sum(pos_reqs.values())
                total_correct = actual_total == expected_total
                
                details = f"FLEX present: {flex_present}, FLEX value: {pos_reqs.get('FLEX', 'missing')}"
                details += f", Total starters: {actual_total} (expected: {expected_total})"
                details += f", Position requirements: {pos_reqs}"
                
                overall_success = success and flex_present and flex_default_value and total_correct
                self.log_test("FLEX Position - Default", overall_success, details)
                return overall_success
            else:
                self.log_test("FLEX Position - Default", False, f"Status: {league_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("FLEX Position - Default", False, f"Error: {str(e)}")
            return False

    def test_flex_position_double_flex(self):
        """Test updating league settings for double FLEX league (FLEX=2)"""
        if not self.league_id:
            self.log_test("FLEX Position - Double FLEX", False, "No league ID available")
            return False
            
        try:
            # Update league settings for double FLEX
            settings_data = {
                "name": "Pipelayer Pro Bowl",
                "total_teams": 14,
                "budget_per_team": 300,
                "roster_size": 16,
                "position_requirements": {
                    "QB": 1,
                    "RB": 2,
                    "WR": 2,
                    "TE": 1,
                    "FLEX": 2,  # Double FLEX
                    "K": 1,
                    "DEF": 1
                }
            }
            
            response = requests.put(f"{self.api_url}/leagues/{self.league_id}/settings", json=settings_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                pos_reqs = updated_league['position_requirements']
                
                # Verify FLEX is set to 2
                flex_correct = pos_reqs.get('FLEX', 0) == 2
                
                # Calculate total starters and bench (should be 10 starters, 6 bench)
                total_starters = sum(pos_reqs.values())
                bench_spots = updated_league['roster_size'] - total_starters
                expected_starters = 10  # QB:1 + RB:2 + WR:2 + TE:1 + FLEX:2 + K:1 + DEF:1
                expected_bench = 6
                
                totals_correct = total_starters == expected_starters and bench_spots == expected_bench
                
                details = f"Double FLEX league (FLEX=2). Starters: {total_starters} (exp: {expected_starters}), Bench: {bench_spots} (exp: {expected_bench})"
                details += f", FLEX value: {pos_reqs.get('FLEX', 'missing')}"
                
                overall_success = success and flex_correct and totals_correct
                self.log_test("FLEX Position - Double FLEX", overall_success, details)
                return overall_success
            else:
                self.log_test("FLEX Position - Double FLEX", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("FLEX Position - Double FLEX", False, f"Error: {str(e)}")
            return False

    def test_flex_position_no_flex(self):
        """Test updating league settings for no FLEX league (FLEX=0)"""
        if not self.league_id:
            self.log_test("FLEX Position - No FLEX", False, "No league ID available")
            return False
            
        try:
            # Update league settings for no FLEX
            settings_data = {
                "name": "Pipelayer Pro Bowl",
                "total_teams": 14,
                "budget_per_team": 300,
                "roster_size": 16,
                "position_requirements": {
                    "QB": 1,
                    "RB": 2,
                    "WR": 2,
                    "TE": 1,
                    "FLEX": 0,  # No FLEX
                    "K": 1,
                    "DEF": 1
                }
            }
            
            response = requests.put(f"{self.api_url}/leagues/{self.league_id}/settings", json=settings_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                pos_reqs = updated_league['position_requirements']
                
                # Verify FLEX is set to 0
                flex_correct = pos_reqs.get('FLEX', -1) == 0
                
                # Calculate total starters and bench (should be 8 starters, 8 bench)
                total_starters = sum(pos_reqs.values())
                bench_spots = updated_league['roster_size'] - total_starters
                expected_starters = 8  # QB:1 + RB:2 + WR:2 + TE:1 + FLEX:0 + K:1 + DEF:1
                expected_bench = 8
                
                totals_correct = total_starters == expected_starters and bench_spots == expected_bench
                
                details = f"No FLEX league (FLEX=0). Starters: {total_starters} (exp: {expected_starters}), Bench: {bench_spots} (exp: {expected_bench})"
                details += f", FLEX value: {pos_reqs.get('FLEX', 'missing')}"
                
                overall_success = success and flex_correct and totals_correct
                self.log_test("FLEX Position - No FLEX", overall_success, details)
                return overall_success
            else:
                self.log_test("FLEX Position - No FLEX", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("FLEX Position - No FLEX", False, f"Error: {str(e)}")
            return False

    def test_league_settings_edge_cases(self):
        """Test edge cases for league settings"""
        if not self.league_id:
            self.log_test("League Settings - Edge Cases", False, "No league ID available")
            return False
            
        try:
            # Test extreme case: All positions set to 0 except one
            settings_data = {
                "name": "Pipelayer Pro Bowl",
                "total_teams": 14,
                "budget_per_team": 300,
                "roster_size": 16,
                "position_requirements": {
                    "QB": 0,
                    "RB": 0,
                    "WR": 1,  # Only WR required
                    "TE": 0,
                    "FLEX": 0,  # Include FLEX in edge case test
                    "K": 0,
                    "DEF": 0
                }
            }
            
            response = requests.put(f"{self.api_url}/leagues/{self.league_id}/settings", json=settings_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                updated_league = response.json()
                
                # Verify position requirements updated
                pos_reqs = updated_league['position_requirements']
                edge_case_correct = (
                    pos_reqs['QB'] == 0 and
                    pos_reqs['RB'] == 0 and
                    pos_reqs['WR'] == 1 and
                    pos_reqs['TE'] == 0 and
                    pos_reqs['FLEX'] == 0 and
                    pos_reqs['K'] == 0 and
                    pos_reqs['DEF'] == 0
                )
                
                # Calculate total starters and bench
                total_starters = sum(pos_reqs.values())
                bench_spots = updated_league['roster_size'] - total_starters
                
                details = f"Edge case: Only WR=1. Starters: {total_starters}, Bench: {bench_spots}"
                details += f", Position requirements: {pos_reqs}"
                
                overall_success = success and edge_case_correct and total_starters == 1 and bench_spots == 15
                self.log_test("League Settings - Edge Cases", overall_success, details)
                return overall_success
            else:
                self.log_test("League Settings - Edge Cases", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("League Settings - Edge Cases", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏈 Starting Fantasy Football Auction Draft Tracker API Tests")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_api_health,
            self.test_create_demo_league,
            self.test_player_search,
            self.test_draft_player_and_max_bid_update,
            self.test_draft_second_player,
            self.test_undo_functionality,
            self.test_league_settings_no_kicker,
            self.test_league_settings_superflex,
            self.test_league_settings_edge_cases
        ]
        
        for test in tests:
            test()
            print()  # Add spacing between tests
        
        # Print summary
        print("=" * 60)
        print(f"📊 BACKEND API TEST SUMMARY")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend API tests PASSED!")
            return True
        else:
            print("⚠️  Some backend API tests FAILED!")
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['name']}: {result['details']}")
            return False

def main():
    tester = FantasyFootballAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())