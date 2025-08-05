import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Search, DollarSign, Users, Trophy, Undo2, Plus, Settings, Edit, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { toast } from 'sonner';
import { Label } from './components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuctionTracker = () => {
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [showAddPick, setShowAddPick] = useState(false);
  const [activeView, setActiveView] = useState('control');
  const [showLeagueSettings, setShowLeagueSettings] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [tempTeamName, setTempTeamName] = useState('');
  const [leagueSettings, setLeagueSettings] = useState({
    name: '',
    total_teams: 12,
    budget_per_team: 300,
    roster_size: 16,
    position_requirements: {
      QB: 1,
      RB: 2, 
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1
    }
  });

  // NEW USER SYSTEM STATE
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'commissioner' or 'team'
  const [showUserSelection, setShowUserSelection] = useState(true);
  const [activePosition, setActivePosition] = useState('ALL');
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [userTargets, setUserTargets] = useState([]);
  const [userValues, setUserValues] = useState({});
  const [commissionerPassword, setCommissionerPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  // Simple authentication - in production this would be more secure
  const COMMISSIONER_PASSWORD = 'draft2024';

  // Load demo league and player database on component mount
  useEffect(() => {
    loadDemoLeague();
    loadPlayerDatabase();
  }, []);

  const loadPlayerDatabase = async () => {
    try {
      // Load ALL players from CSV (increase limit significantly)
      const response = await axios.get(`${API}/players/search`, {
        params: { limit: 500, q: '' } // Empty query to get all players
      });
      console.log('Loaded players:', response.data?.length || 0);
      setPlayerDatabase(response.data || []);
    } catch (error) {
      console.error('Error loading player database:', error);
      // Set empty array as fallback
      setPlayerDatabase([]);
    }
  };

  const selectUser = (role, teamId = null) => {
    if (role === 'commissioner') {
      setShowPasswordPrompt(true);
      return;
    }
    
    // For team members, directly set user
    setUserRole(role);
    setCurrentUser(teamId);
    setShowUserSelection(false);
    
    // If team member, set their team as selected
    if (role === 'team' && teamId) {
      setSelectedTeam(teamId);
    }
  };

  const authenticateCommissioner = () => {
    if (commissionerPassword === COMMISSIONER_PASSWORD) {
      setUserRole('commissioner');
      setCurrentUser('Commissioner');
      setShowUserSelection(false);
      setShowPasswordPrompt(false);
      setCommissionerPassword('');
      toast.success('Commissioner access granted');
    } else {
      toast.error('Invalid commissioner password');
      setCommissionerPassword('');
    }
  };

  // Get current user's team data
  const getCurrentUserTeam = () => {
    if (!league || userRole !== 'team') return null;
    return league.teams.find(team => team.id === currentUser);
  };

  const loadDemoLeague = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/demo-league`);
      setLeague(response.data);
      setLeagueSettings({
        name: response.data.name,
        total_teams: response.data.total_teams,
        budget_per_team: response.data.budget_per_team,
        roster_size: response.data.roster_size,
        position_requirements: response.data.position_requirements || {
          QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1
        }
      });
      console.log('Demo league loaded:', response.data);
    } catch (error) {
      console.error('Error loading demo league:', error);
      toast.error('Failed to load demo league');
    } finally {
      setLoading(false);
    }
  };

  const updateLeagueSettings = async () => {
    try {
      // Update league settings first
      const response = await axios.put(`${API}/leagues/${league.id}/settings`, leagueSettings);
      
      // Update all team names that have changed
      const updatedLeague = response.data;
      for (let i = 0; i < league.teams.length; i++) {
        const currentName = league.teams[i].name;
        const originalName = updatedLeague.teams[i]?.name;
        
        if (currentName !== originalName && currentName !== `Team ${i + 1}`) {
          await axios.put(`${API}/leagues/${league.id}/teams/${league.teams[i].id}`, {
            name: currentName
          });
        }
      }
      
      // Force reload league data to ensure sync
      const finalResponse = await axios.get(`${API}/leagues/${league.id}`);
      const freshLeague = finalResponse.data;
      
      // Update both league state and league settings
      setLeague(freshLeague);
      setLeagueSettings({
        name: freshLeague.name,
        total_teams: freshLeague.total_teams,
        budget_per_team: freshLeague.budget_per_team,
        roster_size: freshLeague.roster_size,
        position_requirements: freshLeague.position_requirements || {
          QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1
        }
      });
      
      setShowLeagueSettings(false);
      toast.success('League settings updated successfully!');
    } catch (error) {
      console.error('Error updating league settings:', error);
      toast.error('Failed to update league settings');
    }
  };

  const updateTeamName = async (teamId, newName) => {
    try {
      const response = await axios.put(`${API}/leagues/${league.id}/teams/${teamId}`, {
        name: newName
      });
      setLeague(response.data);
      setEditingTeam(null);
      setTempTeamName('');
      toast.success('Team name updated!');
    } catch (error) {
      console.error('Error updating team name:', error);
      toast.error('Failed to update team name');
    }
  };

  const startEditingTeam = (team) => {
    setEditingTeam(team.id);
    setTempTeamName(team.name);
  };

  const updatePositionRequirement = (position, value) => {
    setLeagueSettings({
      ...leagueSettings,
      position_requirements: {
        ...leagueSettings.position_requirements,
        [position]: parseInt(value)
      }
    });
  };

  const cancelEditingTeam = () => {
    setEditingTeam(null);
    setTempTeamName('');
  };

  // Debounced search function to prevent excessive API calls
  const debouncedSearchPlayers = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      
      try {
        const response = await axios.get(`${API}/players/search`, {
          params: { q: query, limit: 10 }
        });
        setSearchResults(response.data || []);
      } catch (error) {
        console.error('Error searching players:', error);
        setSearchResults([]);
      }
    }, 300),
    []
  );

  // Debounce utility function
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  const searchPlayers = async (query = '') => {
    debouncedSearchPlayers(query);
  };

  // Get available players for draft (excluding drafted players)
  const getAvailablePlayersForDraft = useCallback(() => {
    if (!playerDatabase || !league) return [];
    
    return playerDatabase.filter(player => {
      // Check if player is already drafted
      const isDrafted = league.all_picks?.some(pick => 
        pick.player.name === player.name && 
        pick.player.position === player.position &&
        pick.player.nfl_team === player.nfl_team
      );
      return !isDrafted;
    });
  }, [playerDatabase, league]);

  // Filter players for draft based on search query
  const getFilteredDraftPlayers = useCallback((query) => {
    const availablePlayers = getAvailablePlayersForDraft();
    
    if (!query.trim()) return [];
    
    const searchQuery = query.toLowerCase();
    let filtered = availablePlayers.filter(player => 
      player.name.toLowerCase().includes(searchQuery) ||
      player.nfl_team.toLowerCase().includes(searchQuery)
    );
    
    // For single letter searches, prioritize popular players
    if (query.length === 1) {
      const priority = [];
      const regular = [];
      
      filtered.forEach(player => {
        if (player.name.toLowerCase().startsWith(searchQuery) && 
            ["Josh Allen", "Justin Jefferson", "Ja'Marr Chase"].includes(player.name)) {
          priority.push(player);
        } else {
          regular.push(player);
        }
      });
      
      filtered = [...priority, ...regular];
    }
    
    // Sort by ETR rank
    filtered.sort((a, b) => (a.etr_rank || 999) - (b.etr_rank || 999));
    
    return filtered.slice(0, 10);
  }, [getAvailablePlayersForDraft]);

  const addDraftPick = async (player) => {
    if (!selectedTeam || !bidAmount) {
      toast.error('Please select a team and enter bid amount');
      return;
    }

    try {
      const response = await axios.post(`${API}/leagues/${league.id}/draft`, {
        player: {
          name: player.name,
          position: player.position,
          nfl_team: player.nfl_team,
          etr_rank: player.etr_rank,
          adp: player.adp,
          pos_rank: player.pos_rank
        },
        team_id: selectedTeam,
        amount: parseInt(bidAmount)
      });
      
      // CRITICAL: Update league state completely
      const updatedLeague = response.data;
      setLeague(updatedLeague);
      
      // Clear form
      setSearchQuery('');
      setSearchResults([]);
      setBidAmount('');
      
      // Reload player database to update availability
      await loadPlayerDatabase();
      
      toast.success(`${player.name} drafted for $${bidAmount}!`);
      
      console.log('Draft completed, league updated:', updatedLeague);
    } catch (error) {
      console.error('Error adding draft pick:', error);
      toast.error(error.response?.data?.detail || 'Failed to add draft pick');
    }
  };

  // Helper function to get max bid color class
  const getMaxBidColorClass = (maxBid) => {
    if (maxBid > 50) return 'text-emerald-400 font-bold';
    if (maxBid >= 10) return 'text-yellow-400 font-bold';
    return 'text-red-400 font-bold';
  };

  // Helper function to get budget utilization color
  const getBudgetUtilizationColor = (utilization) => {
    if (utilization < 50) return 'text-emerald-400';
    if (utilization < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get position-specific color classes for badges
  const getPositionColorClass = (position) => {
    switch (position) {
      case 'QB': return 'border-yellow-400 text-yellow-300 bg-yellow-500/10';
      case 'RB': return 'border-sky-400 text-sky-300 bg-sky-500/10';
      case 'WR': return 'border-green-400 text-green-300 bg-green-500/10';
      case 'TE': return 'border-pink-400 text-pink-300 bg-pink-500/10';
      case 'FLEX': return 'border-indigo-400 text-indigo-300 bg-indigo-500/10';
      case 'DST': return 'border-orange-400 text-orange-300 bg-orange-500/10';
      case 'K': return 'border-purple-400 text-purple-300 bg-purple-500/10';
      case 'BENCH': return 'border-slate-400 text-slate-300 bg-slate-500/10';
      default: return 'border-gray-400 text-gray-300 bg-gray-500/10';
    }
  };
  // Calculate which positions a team still needs
  const calculatePositionsNeeded = (team, positionRequirements) => {
    const positionsNeeded = [];
    const positionsFilled = {};
    
    // Count filled positions
    team.roster.forEach(pick => {
      const pos = pick.player.position;
      positionsFilled[pos] = (positionsFilled[pos] || 0) + 1;
    });
    
    // Check starting positions needed
    Object.entries(positionRequirements).forEach(([position, required]) => {
      if (position !== 'BENCH') {
        const filled = positionsFilled[position] || 0;
        const needed = required - filled;
        
        for (let i = 0; i < needed; i++) {
          positionsNeeded.push({
            position: position,
            type: 'starter'
          });
        }
      }
    });
    
    // Calculate remaining bench spots needed
    const totalStartingSpots = Object.entries(positionRequirements)
      .filter(([pos]) => pos !== 'BENCH')
      .reduce((sum, [, required]) => sum + required, 0);
    
    const benchSpots = league.roster_size - totalStartingSpots;
    const currentRosterSize = team.roster.length;
    const benchSpotsNeeded = Math.max(0, benchSpots - Math.max(0, currentRosterSize - totalStartingSpots));
    
    for (let i = 0; i < benchSpotsNeeded; i++) {
      positionsNeeded.push({
        position: 'BENCH',
        type: 'bench'
      });
    }
    
    return positionsNeeded.slice(0, 8); // Limit display to 8 positions
  };

  const UserSelectionScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="bg-white/10 backdrop-blur-md border-white/20 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white text-2xl text-center mb-2">
            {league ? league.name : 'Fantasy Football Auction'}
          </CardTitle>
          <div className="text-slate-300 text-center">Select your role to continue</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Commissioner Option */}
          <Button
            onClick={() => selectUser('commissioner')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
          >
            <Settings className="h-5 w-5 mr-2" />
            Commissioner
            <div className="text-sm text-emerald-200 ml-2">(Requires Password)</div>
          </Button>

          {/* Team Selection */}
          {league && (
            <div className="space-y-2">
              <div className="text-slate-300 text-sm font-medium text-center">
                Or select your team:
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {league.teams.map(team => (
                  <Button
                    key={team.id}
                    onClick={() => selectUser('team', team.id)}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white p-3"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {team.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commissioner Password Dialog */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-white text-xl text-center">Commissioner Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Enter commissioner password"
                value={commissionerPassword}
                onChange={(e) => setCommissionerPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') authenticateCommissioner();
                  if (e.key === 'Escape') setShowPasswordPrompt(false);
                }}
                autoFocus
              />
              <div className="flex space-x-2">
                <Button
                  onClick={authenticateCommissioner}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Login
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setCommissionerPassword('');
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
              <div className="text-xs text-slate-400 text-center">
                Demo password: draft2024
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  const LeagueSettingsDialog = () => (
    <Dialog open={showLeagueSettings} onOpenChange={setShowLeagueSettings}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">League Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="league-name" className="text-slate-300">League Name</Label>
            <Input
              id="league-name"
              value={leagueSettings.name}
              onChange={(e) => setLeagueSettings({...leagueSettings, name: e.target.value})}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="total-teams" className="text-slate-300">Number of Teams</Label>
            <Select 
              value={leagueSettings.total_teams.toString()} 
              onValueChange={(value) => setLeagueSettings({...leagueSettings, total_teams: parseInt(value)})}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {[8, 10, 12, 14, 16, 18, 20].map(num => (
                  <SelectItem key={num} value={num.toString()} className="text-white">
                    {num} Teams
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="budget" className="text-slate-300">Budget Per Team</Label>
            <Select 
              value={leagueSettings.budget_per_team.toString()} 
              onValueChange={(value) => setLeagueSettings({...leagueSettings, budget_per_team: parseInt(value)})}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {[100, 150, 200, 250, 300, 400, 500].map(amount => (
                  <SelectItem key={amount} value={amount.toString()} className="text-white">
                    ${amount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="roster-size" className="text-slate-300">Roster Spots</Label>
            <Select 
              value={leagueSettings.roster_size.toString()} 
              onValueChange={(value) => setLeagueSettings({...leagueSettings, roster_size: parseInt(value)})}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {[10, 12, 14, 15, 16, 18, 20, 22, 25].map(num => (
                  <SelectItem key={num} value={num.toString()} className="text-white">
                    {num} Spots
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 text-base font-medium">Starting Lineup Requirements</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">QB:</span>
                <Select 
                  value={leagueSettings.position_requirements.QB.toString()} 
                  onValueChange={(value) => updatePositionRequirement('QB', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2, 3].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">RB:</span>
                <Select 
                  value={leagueSettings.position_requirements.RB.toString()} 
                  onValueChange={(value) => updatePositionRequirement('RB', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2, 3, 4].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">WR:</span>
                <Select 
                  value={leagueSettings.position_requirements.WR.toString()} 
                  onValueChange={(value) => updatePositionRequirement('WR', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2, 3, 4, 5, 6].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">TE:</span>
                <Select 
                  value={leagueSettings.position_requirements.TE.toString()} 
                  onValueChange={(value) => updatePositionRequirement('TE', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2, 3].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">FLEX:</span>
                <Select 
                  value={leagueSettings.position_requirements.FLEX.toString()} 
                  onValueChange={(value) => updatePositionRequirement('FLEX', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2, 3].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">K:</span>
                <Select 
                  value={leagueSettings.position_requirements.K.toString()} 
                  onValueChange={(value) => updatePositionRequirement('K', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                <span className="text-slate-300">DEF:</span>
                <Select 
                  value={leagueSettings.position_requirements.DEF.toString()} 
                  onValueChange={(value) => updatePositionRequirement('DEF', value)}
                >
                  <SelectTrigger className="w-16 h-8 bg-slate-600 border-slate-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {[0, 1, 2].map(num => (
                      <SelectItem key={num} value={num.toString()} className="text-white">
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-2 text-slate-400 text-sm">
              FLEX can be RB/WR/TE • Total: {
                Object.values(leagueSettings.position_requirements).reduce((sum, val) => sum + val, 0)
              } starters, {leagueSettings.roster_size - Object.values(leagueSettings.position_requirements).reduce((sum, val) => sum + val, 0)} bench
            </div>
          </div>

          {/* TEAM NAME MANAGEMENT */}
          <div>
            <Label className="text-slate-300 text-base font-medium">Team Names</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {league && league.teams.map((team, index) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <span className="text-slate-400 text-sm w-16">Team {index + 1}:</span>
                  <Input
                    value={team.name}
                    onChange={(e) => {
                      e.preventDefault();
                      const updatedTeams = [...league.teams];
                      updatedTeams[index] = { ...team, name: e.target.value };
                      setLeague({ ...league, teams: updatedTeams });
                    }}
                    onInput={(e) => {
                      const updatedTeams = [...league.teams];
                      updatedTeams[index] = { ...team, name: e.target.value };
                      setLeague({ ...league, teams: updatedTeams });
                    }}
                    className="bg-slate-700 border-slate-600 text-white flex-1"
                    placeholder={`Team ${index + 1} name`}
                    data-testid={`team-name-input-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button 
              onClick={updateLeagueSettings}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowLeagueSettings(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const undoPick = async (pickId) => {
    try {
      await axios.delete(`${API}/leagues/${league.id}/picks/${pickId}`);
      // Reload league data
      const response = await axios.get(`${API}/leagues/${league.id}`);
      setLeague(response.data);
      toast.success('Pick undone successfully');
    } catch (error) {
      console.error('Error undoing pick:', error);
      toast.error('Failed to undo pick');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl font-light">Loading Pipelayer Pro Bowl...</div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Failed to load league</div>
      </div>
    );
  }

  // Player status helper
  const getPlayerStatus = (player) => {
    const drafted = league?.all_picks?.find(pick => 
      pick.player.name === player.name && 
      pick.player.position === player.position &&
      pick.player.nfl_team === player.nfl_team
    );
    
    if (drafted) {
      const draftingTeam = league.teams.find(team => team.id === drafted.team_id);
      return {
        status: 'drafted',
        team: draftingTeam?.name || 'Unknown',
        amount: drafted.amount
      };
    }
    return { status: 'available' };
  };

  // Filter players by position
  const getFilteredPlayers = () => {
    let filtered = playerDatabase;
    
    if (activePosition !== 'ALL') {
      filtered = filtered.filter(player => player.position === activePosition);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.nfl_team.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort by ETR rank (lower rank = better player)
    filtered.sort((a, b) => (a.etr_rank || 999) - (b.etr_rank || 999));
    
    return filtered.slice(0, 200); // Show more players for better selection
  };

  // Calculate suggested value for a player
  const getSuggestedValue = (player) => {
    const position = player.position;
    const rank = player.etr_rank || 999;
    
    // Basic value formulas by position
    switch (position) {
      case 'QB':
        if (rank <= 3) return 35 + (4 - rank) * 5; // $40-50
        if (rank <= 8) return 20 + (9 - rank) * 2; // $22-28
        if (rank <= 15) return 10 + (16 - rank) * 1; // $11-17
        return Math.max(1, 8 - Math.floor((rank - 15) / 5));
      
      case 'RB':
      case 'WR':
        if (rank <= 12) return 45 + (13 - rank) * 3; // $48-78
        if (rank <= 24) return 25 + (25 - rank) * 1.5; // $26.5-43
        if (rank <= 36) return 15 + (37 - rank) * 0.8; // $15.8-24.2
        return Math.max(1, 12 - Math.floor((rank - 36) / 8));
      
      case 'TE':
        if (rank <= 6) return 20 + (7 - rank) * 2; // $22-32
        if (rank <= 15) return 8 + (16 - rank) * 1.2; // $9.2-19
        return Math.max(1, 6 - Math.floor((rank - 15) / 10));
      
      case 'K':
      case 'DST':
        return Math.max(1, 3 - Math.floor(rank / 10));
      
      default:
        return 1;
    }
  };

  const PlayerRankingsDashboard = () => (
    <div className="space-y-4">
      {/* Position Tabs */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'].map(position => (
          <Button
            key={position}
            onClick={() => setActivePosition(position)}
            variant={activePosition === position ? "default" : "outline"}
            className={`${
              activePosition === position 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'border-slate-600 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {position}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-700 border-slate-600 text-white pr-10"
        />
        <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
      </div>

      {/* Player List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {getFilteredPlayers().map((player, index) => {
          const playerStatus = getPlayerStatus(player);
          const suggestedValue = getSuggestedValue(player);
          const userValue = userValues[`${player.name}-${player.position}`] || suggestedValue;
          const isTarget = userTargets.includes(`${player.name}-${player.position}`);
          
          return (
            <div
              key={`${player.name}-${player.position}-${index}`}
              className={`p-3 rounded-lg border ${
                playerStatus.status === 'drafted' 
                  ? 'bg-red-900/20 border-red-500/30 text-red-300'
                  : 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">
                      {index + 1}. {player.name}
                    </span>
                    <Badge className={getPositionColorClass(player.position)}>
                      {player.position}
                    </Badge>
                    <span className="text-slate-400">({player.nfl_team})</span>
                    {isTarget && <span className="text-yellow-400">⭐</span>}
                  </div>
                  
                  <div className="text-sm text-slate-400 mt-1">
                    ETR #{player.etr_rank} • {player.pos_rank}
                    {playerStatus.status === 'drafted' && (
                      <span className="text-red-400 ml-2">
                        → {playerStatus.team} (${playerStatus.amount})
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-emerald-400 font-medium">
                    Suggested: ${suggestedValue}
                  </div>
                  {userValue !== suggestedValue && (
                    <div className="text-blue-400 text-sm">
                      My Value: ${userValue}
                    </div>
                  )}
                  <div className={`text-sm font-medium ${
                    playerStatus.status === 'drafted' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {playerStatus.status === 'drafted' ? 'UNAVAILABLE' : 'AVAILABLE'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ControlInterface = () => (
    <div className="grid grid-cols-5 gap-6 h-screen p-4">
      {/* Left Side: Player Rankings Dashboard (60%) */}
      <div className="col-span-3 bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Player Rankings</h2>
          <div className="text-slate-400 text-sm">
            {userRole === 'team' ? `${getCurrentUserTeam()?.name || 'My Team'} Dashboard` : 'Commissioner View'}
          </div>
        </div>
        <PlayerRankingsDashboard />
      </div>

      {/* Right Side: Role-Based Controls (40%) */}
      <div className="col-span-2">
        {userRole === 'commissioner' ? <CommissionerControls /> : <TeamMemberControls />}
      </div>
    </div>
  );

  const CommissionerControls = () => (
    <div className="space-y-4">
      {/* League Header */}
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg">{league.name}</CardTitle>
              <div className="text-slate-300 text-sm">
                {league.total_teams} Teams • ${league.budget_per_team} Budget
              </div>
            </div>
            <Button 
              onClick={() => setShowLeagueSettings(true)}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Draft Entry Form */}
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white text-lg">Draft Player</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                const filteredResults = getFilteredDraftPlayers(value);
                setSearchResults(filteredResults);
              }}
              className="bg-slate-700 border-slate-600 text-white pr-10"
            />
            <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
          </div>
          
          {searchResults.length > 0 && searchQuery && (
            <div className="max-h-32 overflow-y-auto space-y-2">
              {searchResults.slice(0, 5).map((player, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setSearchQuery(player.name);
                    setSearchResults([player]); // Set exactly one player for draft button
                  }}
                  className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600 transition-colors"
                >
                  <div className="text-white text-sm font-medium">
                    {player.name} ({player.position}, {player.nfl_team})
                  </div>
                  <div className="text-slate-400 text-xs">
                    ETR #{player.etr_rank} • {player.pos_rank}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent className="bg-slate-700 border-slate-600">
              {league.teams.map(team => (
                <SelectItem key={team.id} value={team.id} className="text-white">
                  <div className="flex justify-between w-full">
                    <span>{team.name}</span>
                    <span className="ml-4 text-slate-400">
                      Max: <span className={getMaxBidColorClass(team.max_bid).replace('font-bold', '')}>${team.max_bid}</span>
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Winning bid amount"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white"
            min="1"
            step="1"
            inputMode="numeric"
            autoComplete="off"
          />

          {searchResults.length === 1 && selectedTeam && bidAmount && parseInt(bidAmount) > 0 && (
            <Button
              onClick={() => addDraftPick(searchResults[0])}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Draft {searchResults[0].name} for ${bidAmount}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent Picks */}
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white text-lg">Recent Picks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {league.all_picks.slice(-10).reverse().map(pick => {
              const team = league.teams.find(t => t.id === pick.team_id);
              return (
                <div key={pick.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                  <div>
                    <div className="text-white text-sm font-medium">{pick.player.name}</div>
                    <div className="text-xs text-slate-400">
                      {team?.name} • {pick.player.position}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 font-medium">${pick.amount}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => undoPick(pick.id)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                    >
                      <Undo2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {league.all_picks.length === 0 && (
              <div className="text-slate-500 text-sm italic">No picks yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const TeamMemberControls = () => {
    const currentTeam = getCurrentUserTeam();
    
    if (!currentTeam) {
      return (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="text-red-400">Error: Team not found</div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Team Summary Card */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-xl">{currentTeam.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Budget Info */}
            <div className="bg-slate-800/50 rounded-lg p-4 border-l-4 border-emerald-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 font-medium">MAX BID:</span>
                <span className={`text-2xl ${getMaxBidColorClass(currentTeam.max_bid)}`}>
                  ${currentTeam.max_bid}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Budget Left:</span>
                  <span className="text-emerald-400 font-medium">${currentTeam.remaining}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Spots Left:</span>
                  <span className="text-white font-medium">{currentTeam.remaining_spots || 0}</span>
                </div>
              </div>
            </div>

            {/* Roster */}
            <div>
              <h3 className="text-white font-medium mb-2">My Roster ({currentTeam.roster.length}/{league.roster_size})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {currentTeam.roster.map(pick => (
                  <div key={pick.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                    <div>
                      <div className="text-white text-sm font-medium">{pick.player.name}</div>
                      <div className="text-xs text-slate-400">
                        {pick.player.position} • {pick.player.nfl_team}
                      </div>
                    </div>
                    <span className="text-emerald-400 font-medium">${pick.amount}</span>
                  </div>
                ))}
                {currentTeam.roster.length === 0 && (
                  <div className="text-slate-500 text-sm italic">No players drafted yet</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const TVDisplayInterface = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">{league.name}</h1>
        <div className="text-2xl text-slate-300">Live Auction Draft</div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
        {league.teams.map(team => {
          // Calculate additional metrics for TV display
          const avgPerRemaining = team.remaining_spots > 0 ? (team.remaining / team.remaining_spots).toFixed(2) : '0.00';
          const teamRating = team.roster.length > 0 ? 
            (team.roster.reduce((sum, pick) => sum + (pick.player.etr_rank || 999), 0) / team.roster.length).toFixed(1) : 
            'N/A';
          
          // Calculate positions needed
          const positionsNeeded = calculatePositionsNeeded(team, league.position_requirements);
          
          return (
            <Card key={team.id} className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-3xl mb-4">{team.name}</CardTitle>
                
                {/* CRITICAL VALUES - Side by Side */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-900/70 rounded-lg p-4 border-2 border-emerald-500/50">
                    <div className="text-center">
                      <div className="text-slate-300 text-sm uppercase tracking-wide">MAX BID</div>
                      <div className={`text-4xl font-bold ${getMaxBidColorClass(team.max_bid)}`}>
                        ${team.max_bid}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/70 rounded-lg p-4 border-2 border-blue-500/50">
                    <div className="text-center">
                      <div className="text-slate-300 text-sm uppercase tracking-wide">BUDGET</div>
                      <div className="text-4xl font-bold text-blue-400">
                        ${team.remaining}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* SECONDARY INFORMATION */}
                <div className="space-y-2 text-lg">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Roster:</span>
                    <span className="text-white font-medium">{team.roster.length}/{league.roster_size}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg/Remaining:</span>
                    <span className="text-white font-medium">${avgPerRemaining}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Team Rating:</span>
                    <span className="text-white font-medium">{teamRating}</span>
                  </div>
                </div>
                
                {/* POSITIONS NEEDED */}
                <div className="mt-4">
                  <div className="text-slate-400 text-lg mb-2">Positions Needed:</div>
                  <div className="flex flex-wrap gap-2">
                    {positionsNeeded.map((pos, index) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className={`text-sm font-medium ${getPositionColorClass(pos.position)}`}
                      >
                        {pos.position}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* RECENT PICKS */}
                {team.roster.length > 0 && (
                  <div>
                    <div className="text-slate-400 text-lg mb-2">Recent Picks:</div>
                    <div className="space-y-2">
                      {team.roster.slice(-3).map(pick => (
                        <div key={pick.id} className="flex justify-between bg-slate-800/50 rounded p-2">
                          <span className="text-white text-lg">{pick.player.name}</span>
                          <span className="text-emerald-400 font-bold text-lg">${pick.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // Show user selection screen if no user is selected
  if (showUserSelection) {
    return <UserSelectionScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* League Settings Dialog */}
      <LeagueSettingsDialog />
      
      {/* View Toggle */}
      <div className="mb-6">
        <Tabs value={activeView} onValueChange={setActiveView} className="w-fit">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="control" className="text-white">Control Interface</TabsTrigger>
            <TabsTrigger value="display" className="text-white">TV Display</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeView} className="w-full">
        <TabsContent value="control">
          <ControlInterface />
        </TabsContent>
        <TabsContent value="display">
          <TVDisplayInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuctionTracker;