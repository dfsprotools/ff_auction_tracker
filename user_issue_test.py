import requests
import sys

class UserIssueAPITester:
    def __init__(self, base_url="https://f62c9dd1-ed84-4e7d-b3b1-56d81ffbd9ae.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.league_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")

    def test_search_single_letter_j(self):
        """Test: Type single letter 'J' in search field - Does Josh Allen appear immediately?"""
        try:
            response = requests.get(f"{self.api_url}/players/search", params={"q": "J", "limit": 10}, timeout=10)
            success = response.status_code == 200
            
            if success:
                players = response.json()
                josh_allen_found = any(player['name'] == 'Josh Allen' for player in players)
                
                # Get all J names for debugging
                j_names = [player['name'] for player in players if player['name'].startswith('J')]
                
                details = f"Found {len(players)} players with 'J'. Josh Allen found: {josh_allen_found}"
                details += f". J-names: {j_names[:5]}"  # Show first 5 J names
                
                self.log_test("Search Single Letter 'J'", josh_allen_found, details)
                return josh_allen_found
            else:
                self.log_test("Search Single Letter 'J'", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Search Single Letter 'J'", False, f"Error: {str(e)}")
            return False

    def test_search_progressive_josh(self):
        """Test: Try typing 'Jo' and 'Jos' to see what's required"""
        results = {}
        
        for query in ['Jo', 'Jos', 'Josh']:
            try:
                response = requests.get(f"{self.api_url}/players/search", params={"q": query, "limit": 10}, timeout=10)
                if response.status_code == 200:
                    players = response.json()
                    josh_allen_found = any(player['name'] == 'Josh Allen' for player in players)
                    results[query] = {
                        'found': josh_allen_found,
                        'total_players': len(players),
                        'names': [p['name'] for p in players[:3]]  # First 3 names
                    }
                else:
                    results[query] = {'error': f"Status: {response.status_code}"}
            except Exception as e:
                results[query] = {'error': str(e)}
        
        # Determine success - Josh Allen should be found with any of these queries
        success = any(results.get(q, {}).get('found', False) for q in ['Jo', 'Jos', 'Josh'])
        
        details = f"Results: {results}"
        self.log_test("Progressive Search (Jo/Jos/Josh)", success, details)
        return success

    def test_jamarr_chase_draft_function(self):
        """Test: Select Ja'Marr Chase + Team 2 + $60, click draft button"""
        try:
            # First create a demo league
            league_response = requests.post(f"{self.api_url}/demo-league", timeout=10)
            if league_response.status_code != 200:
                self.log_test("Ja'Marr Chase Draft Test", False, "Could not create demo league")
                return False
            
            league = league_response.json()
            self.league_id = league['id']
            team_2_id = league['teams'][1]['id']  # Team 2
            
            # Search for Ja'Marr Chase first
            search_response = requests.get(f"{self.api_url}/players/search", params={"q": "Ja'Marr Chase"}, timeout=10)
            if search_response.status_code != 200:
                self.log_test("Ja'Marr Chase Draft Test", False, "Could not search for Ja'Marr Chase")
                return False
            
            players = search_response.json()
            jamarr_chase = None
            for player in players:
                if player['name'] == "Ja'Marr Chase":
                    jamarr_chase = player
                    break
            
            if not jamarr_chase:
                self.log_test("Ja'Marr Chase Draft Test", False, "Ja'Marr Chase not found in search")
                return False
            
            # Draft Ja'Marr Chase for $60 to Team 2
            draft_data = {
                "player": {
                    "name": jamarr_chase['name'],
                    "position": jamarr_chase['position'],
                    "nfl_team": jamarr_chase['nfl_team'],
                    "etr_rank": jamarr_chase.get('etr_rank', 1),
                    "adp": jamarr_chase.get('adp', 1.0),
                    "pos_rank": jamarr_chase.get('pos_rank', 'WR01')
                },
                "team_id": team_2_id,
                "amount": 60
            }
            
            draft_response = requests.post(f"{self.api_url}/leagues/{self.league_id}/draft", json=draft_data, timeout=10)
            success = draft_response.status_code == 200
            
            if success:
                updated_league = draft_response.json()
                
                # Check if pick appears in recent picks
                recent_picks = updated_league.get('all_picks', [])
                jamarr_pick = None
                for pick in recent_picks:
                    if pick['player']['name'] == "Ja'Marr Chase":
                        jamarr_pick = pick
                        break
                
                # Check Team 2 budget changes
                team_2 = next(team for team in updated_league['teams'] if team['id'] == team_2_id)
                budget_changed = team_2['spent'] == 60 and team_2['remaining'] == 240
                
                details = f"Draft successful. Pick in recent picks: {jamarr_pick is not None}"
                details += f", Team 2 budget: Spent ${team_2['spent']}, Remaining ${team_2['remaining']}"
                details += f", Team 2 roster size: {len(team_2['roster'])}"
                
                overall_success = success and jamarr_pick is not None and budget_changed
                self.log_test("Ja'Marr Chase Draft Test", overall_success, details)
                return overall_success
            else:
                error_text = draft_response.text if draft_response.text else "No error message"
                self.log_test("Ja'Marr Chase Draft Test", False, f"Status: {draft_response.status_code}, Error: {error_text}")
                return False
                
        except Exception as e:
            self.log_test("Ja'Marr Chase Draft Test", False, f"Error: {str(e)}")
            return False

    def test_player_database_counts(self):
        """Test: Check QB/RB tabs - count players, look for specific players"""
        try:
            results = {}
            
            # Test QB count
            qb_response = requests.get(f"{self.api_url}/players/search", params={"position": "QB", "limit": 500}, timeout=10)
            if qb_response.status_code == 200:
                qb_players = qb_response.json()
                results['QB'] = {
                    'count': len(qb_players),
                    'names': [p['name'] for p in qb_players[:5]]  # First 5 QBs
                }
            else:
                results['QB'] = {'error': f"Status: {qb_response.status_code}"}
            
            # Test RB count and look for specific players
            rb_response = requests.get(f"{self.api_url}/players/search", params={"position": "RB", "limit": 500}, timeout=10)
            if rb_response.status_code == 200:
                rb_players = rb_response.json()
                
                # Look for Bijan Robinson and Saquon Barkley
                bijan_found = any(p['name'] == 'Bijan Robinson' for p in rb_players)
                saquon_found = any(p['name'] == 'Saquon Barkley' for p in rb_players)
                
                results['RB'] = {
                    'count': len(rb_players),
                    'bijan_robinson': bijan_found,
                    'saquon_barkley': saquon_found,
                    'names': [p['name'] for p in rb_players[:5]]  # First 5 RBs
                }
            else:
                results['RB'] = {'error': f"Status: {rb_response.status_code}"}
            
            # Test total player count
            all_response = requests.get(f"{self.api_url}/players/search", params={"limit": 500}, timeout=10)
            if all_response.status_code == 200:
                all_players = all_response.json()
                results['TOTAL'] = {
                    'count': len(all_players),
                    'positions': {}
                }
                
                # Count by position
                for player in all_players:
                    pos = player['position']
                    results['TOTAL']['positions'][pos] = results['TOTAL']['positions'].get(pos, 0) + 1
            else:
                results['TOTAL'] = {'error': f"Status: {all_response.status_code}"}
            
            # Determine success
            qb_success = results.get('QB', {}).get('count', 0) > 0
            rb_success = results.get('RB', {}).get('count', 0) > 0
            bijan_success = results.get('RB', {}).get('bijan_robinson', False)
            saquon_success = results.get('RB', {}).get('saquon_barkley', False)
            total_success = results.get('TOTAL', {}).get('count', 0) > 0
            
            overall_success = qb_success and rb_success and bijan_success and saquon_success and total_success
            
            details = f"QB count: {results.get('QB', {}).get('count', 'error')}"
            details += f", RB count: {results.get('RB', {}).get('count', 'error')}"
            details += f", Bijan Robinson: {bijan_success}, Saquon Barkley: {saquon_success}"
            details += f", Total players: {results.get('TOTAL', {}).get('count', 'error')}"
            details += f", Position breakdown: {results.get('TOTAL', {}).get('positions', {})}"
            
            self.log_test("Player Database Counts", overall_success, details)
            return overall_success
            
        except Exception as e:
            self.log_test("Player Database Counts", False, f"Error: {str(e)}")
            return False

    def run_user_issue_tests(self):
        """Run tests for specific user issues"""
        print("🔍 Testing EXACT User Issues")
        print("=" * 50)
        
        # Test sequence for user issues
        tests = [
            self.test_search_single_letter_j,
            self.test_search_progressive_josh,
            self.test_jamarr_chase_draft_function,
            self.test_player_database_counts
        ]
        
        for test in tests:
            test()
            print()
        
        # Print summary
        print("=" * 50)
        print(f"📊 USER ISSUE TEST SUMMARY")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = UserIssueAPITester()
    success = tester.run_user_issue_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())