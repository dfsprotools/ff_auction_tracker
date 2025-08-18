import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Search, Plus, Settings, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { toast } from 'sonner';
import { Label } from './components/ui/label';
import { Toaster } from './components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuctionTracker = () => {
  // Core application state
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [showLeagueSettings, setShowLeagueSettings] = useState(false);
  const [activePosition, setActivePosition] = useState('ALL');
  const [playerDatabase, setPlayerDatabase] = useState([]);
  
  // League settings
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

  // Refs for maintaining focus
  const searchInputRef = useRef(null);
  const bidInputRef = useRef(null);
  const teamNameRefs = useRef({});

  // Load demo league and player database on component mount
  useEffect(() => {
    loadDemoLeague();
    loadPlayerDatabase();
  }, []);

  const loadPlayerDatabase = async () => {
    try {
      const response = await axios.get(`${API}/players/search`, {
        params: { limit: 500, q: '' }
      });
      console.log('Loaded players:', response.data?.length || 0);
      
      // Filter out Kickers completely
      const playersWithoutKickers = (response.data || []).filter(player => 
        player.position !== 'K'
      );
      
      console.log('Players after removing Kickers:', playersWithoutKickers.length);
      setPlayerDatabase(playersWithoutKickers);
    } catch (error) {
      console.error('Error loading player database:', error);
      setPlayerDatabase([]);
    }
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

  // Memoized team name update
  const updateTeamName = useCallback((teamId, newName) => {
    setLeague(prevLeague => ({
      ...prevLeague,
      teams: prevLeague.teams.map(team => 
        team.id === teamId ? { ...team, name: newName } : team
      )
    }));
    
    // Maintain focus on input
    setTimeout(() => {
      const inputRef = teamNameRefs.current[teamId];
      if (inputRef && document.activeElement !== inputRef) {
        inputRef.focus();
      }
    }, 0);
  }, []);

  // Memoized bid amount handler
  const handleBidAmountChange = useCallback((value) => {
    setBidAmount(value);
    console.log('Bid amount set:', value); // Debug
    
    setTimeout(() => {
      if (bidInputRef.current && document.activeElement !== bidInputRef.current) {
        bidInputRef.current.focus();
      }
    }, 0);
  }, []);

  // Get available players for draft (excluding drafted players)
  const getAvailablePlayersForDraft = useCallback(() => {
    if (!playerDatabase || !league) return [];
    
    return playerDatabase.filter(player => {
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
    
    if (query.length === 1) {
      const results = [];
      
      availablePlayers.forEach(player => {
        const firstName = player.name.split(' ')[0].toLowerCase();
        if (firstName.startsWith(searchQuery)) {
          results.push(player);
        }
      });

      results.sort((a, b) => (a.etr_rank || 999) - (b.etr_rank || 999));
      return results.slice(0, 10);
    }
    
    const results = availablePlayers.filter(player => {
      const firstName = player.name.split(' ')[0].toLowerCase();
      return firstName.startsWith(searchQuery);
    });
    
    results.sort((a, b) => (a.etr_rank || 999) - (b.etr_rank || 999));
    return results.slice(0, 10);
  }, [getAvailablePlayersForDraft]);

  // Memoized search query handler  
  const handleSearchQueryChange = useCallback((value) => {
    setSearchQuery(value);
    
    setTimeout(() => {
      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);

    if (value.trim()) {
      const filteredResults = getFilteredDraftPlayers(value);
      setSearchResults(filteredResults);
      console.log('Search results:', filteredResults); // Debug log
    } else {
      setSearchResults([]);
    }
  }, [getFilteredDraftPlayers]);

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
      
      const updatedLeague = response.data;
      setLeague(updatedLeague);
      
      setSearchQuery('');
      setSearchResults([]);
      setBidAmount('');
      
      await loadPlayerDatabase();
      
      toast.success(`${player.name} drafted for $${bidAmount}!`);
      
      console.log('Draft completed, league updated:', updatedLeague);
    } catch (error) {
      console.error('Error adding draft pick:', error);
      toast.error(error.response?.data?.detail || 'Failed to add draft pick');
    }
  };

  const undoPick = async (pickId) => {
    try {
      await axios.delete(`${API}/leagues/${league.id}/picks/${pickId}`);
      
      const response = await axios.get(`${API}/leagues/${league.id}`);
      setLeague(response.data);
      
      await loadPlayerDatabase();
      
      toast.success('Pick undone successfully!');
    } catch (error) {
      console.error('Error undoing pick:', error);
      toast.error('Failed to undo pick');
    }
  };

  // Helper function to get max bid color class
  const getMaxBidColorClass = (maxBid) => {
    if (maxBid > 50) return 'text-emerald-400 font-bold';
    if (maxBid >= 10) return 'text-yellow-400 font-bold';
    return 'text-red-400 font-bold';
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
    
    team.roster.forEach(pick => {
      const pos = pick.player.position;
      positionsFilled[pos] = (positionsFilled[pos] || 0) + 1;
    });
    
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
    
    return positionsNeeded.slice(0, 8);
  };

  // Dynamic Auction Value Calculation System
  const calculateAuctionValues = useCallback((players, leagueConfig) => {
    if (!players || !leagueConfig) return {};

    const totalBudget = leagueConfig.total_teams * leagueConfig.budget_per_team;
    
    // Position budget allocation (corrected values - NO KICKERS)
    const positionBudgets = {
      'RB': Math.floor(totalBudget * 0.32), // 32%
      'WR': Math.floor(totalBudget * 0.38), // 38% 
      'QB': Math.floor(totalBudget * 0.08), // 8%
      'TE': Math.floor(totalBudget * 0.05), // 5%
      'DST': Math.floor(totalBudget * 0.008), // 0.8%
    };

    // Expected drafted players by position (realistic distribution - NO KICKERS)
    const expectedDrafted = {
      'QB': Math.floor(leagueConfig.total_teams * 1.5), // ~21 for 14 teams
      'RB': Math.floor(leagueConfig.total_teams * 2.8), // ~39 for 14 teams  
      'WR': Math.floor(leagueConfig.total_teams * 3.2), // ~45 for 14 teams
      'TE': Math.floor(leagueConfig.total_teams * 1.4), // ~20 for 14 teams
      'DST': leagueConfig.total_teams + 1, // ~15 for 14 teams
    };

    const auctionValues = {};

    // Calculate values for each position
    Object.keys(positionBudgets).forEach(position => {
      const positionPlayers = players.filter(p => p.position === position);
      const budget = positionBudgets[position];
      const expectedCount = expectedDrafted[position];
      
      if (positionPlayers.length === 0 || expectedCount === 0) return;

      // Base value per player
      const baseValue = budget / expectedCount;

      // Sort players by rank for tier assignment
      const sortedPlayers = [...positionPlayers].sort((a, b) => 
        (a.etr_rank || 999) - (b.etr_rank || 999)
      );

      sortedPlayers.forEach((player, index) => {
        let multiplier = 1.0;
        const percentile = index / Math.max(1, expectedCount - 1);

        // Balanced multiplier system (not inflated)
        if (percentile <= 0.1) { // Top 10%
          multiplier = 2.2 + (0.3 * (1 - percentile * 10)); // 2.2x to 2.5x
        } else if (percentile <= 0.3) { // Elite tier
          multiplier = 1.4 + (0.8 * (1 - (percentile - 0.1) / 0.2)); // 1.4x to 2.2x
        } else if (percentile <= 0.7) { // Solid tier  
          multiplier = 0.8 + (0.6 * (1 - (percentile - 0.3) / 0.4)); // 0.8x to 1.4x
        } else { // Bench tier
          multiplier = 0.2 + (0.6 * (1 - (percentile - 0.7) / 0.3)); // 0.2x to 0.8x
        }

        // Scarcity adjustments (moderate, not excessive)
        if (position === 'TE') {
          multiplier *= 1.05; // +5% for TE scarcity
        } else if (position === 'RB') {
          multiplier *= 1.03; // +3% for RB scarcity  
        }

        // Calculate final value
        let value = Math.round(baseValue * multiplier);
        
        // Minimum values
        if (position === 'K' || position === 'DST') {
          value = Math.max(1, value);
        } else {
          value = Math.max(1, value);
        }

        auctionValues[`${player.name}-${player.position}-${player.nfl_team}`] = value;
      });
    });

    return auctionValues;
  }, []);

  // Calculate auction values when league or players change
  const auctionValues = useMemo(() => {
    if (!league || !playerDatabase) return {};
    return calculateAuctionValues(playerDatabase, league);
  }, [league, playerDatabase, calculateAuctionValues]);

  // Helper function to get auction value for a player
  const getAuctionValue = useCallback((player) => {
    const key = `${player.name}-${player.position}-${player.nfl_team}`;
    return auctionValues[key] || 1;
  }, [auctionValues]);

  // Filter players by position
  const getFilteredPlayers = () => {
    if (!playerDatabase) return [];
    
    if (activePosition === 'ALL') {
      return playerDatabase.slice(0, 50);
    }
    
    return playerDatabase.filter(player => player.position === activePosition).slice(0, 30);
  };

  // League Settings Dialog
  const LeagueSettingsDialog = React.memo(() => {
    const [localLeagueSettings, setLocalLeagueSettings] = useState(leagueSettings);
    const [localTeams, setLocalTeams] = useState(league?.teams || []);
    const localTeamNameRefs = useRef({});
    
    React.useEffect(() => {
      if (showLeagueSettings && league) {
        setLocalLeagueSettings(leagueSettings);
        setLocalTeams([...league.teams]);
      }
    }, [showLeagueSettings, league, leagueSettings]);

    const handleLocalTeamNameChange = useCallback((teamId, newName) => {
      setLocalTeams(prevTeams => 
        prevTeams.map(team => 
          team.id === teamId ? { ...team, name: newName } : team
        )
      );
      
      setTimeout(() => {
        const inputRef = localTeamNameRefs.current[teamId];
        if (inputRef && document.activeElement !== inputRef) {
          inputRef.focus();
        }
      }, 0);
    }, []);

    const handleLocalPositionRequirementChange = useCallback((position, value) => {
      setLocalLeagueSettings(prev => ({
        ...prev,
        position_requirements: {
          ...prev.position_requirements,
          [position]: parseInt(value)
        }
      }));
    }, []);

    const handleSaveSettings = async () => {
      try {
        setLeagueSettings(localLeagueSettings);
        
        setLeague(prevLeague => ({
          ...prevLeague,
          teams: localTeams
        }));

        const response = await axios.put(`${API}/leagues/${league.id}/settings`, localLeagueSettings);
        
        for (let i = 0; i < localTeams.length; i++) {
          const team = localTeams[i];
          if (team.name !== `Team ${i + 1}`) {
            await axios.put(`${API}/leagues/${league.id}/teams/${team.id}`, {
              name: team.name
            });
          }
        }
        
        const finalResponse = await axios.get(`${API}/leagues/${league.id}`);
        const freshLeague = finalResponse.data;
        setLeague(freshLeague);
        
        setShowLeagueSettings(false);
        toast.success('League settings updated successfully!');
      } catch (error) {
        console.error('Error updating league settings:', error);
        toast.error('Failed to update league settings');
      }
    };

    const LocalTeamNameInput = React.memo(({ team, index }) => (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 text-sm w-16">Team {index + 1}:</span>
          <Input
            ref={(el) => {
              if (el) localTeamNameRefs.current[team.id] = el;
            }}
            value={team.name}
            onChange={(e) => handleLocalTeamNameChange(team.id, e.target.value)}
            className="bg-slate-700 border-slate-600 text-white flex-1"
            placeholder={`Team ${index + 1} name`}
          />
        </div>
      </div>
    ));

    return (
      <Dialog open={showLeagueSettings} onOpenChange={setShowLeagueSettings}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md" aria-describedby="league-settings-description">
          <DialogHeader>
            <DialogTitle className="text-white">League Settings</DialogTitle>
            <div id="league-settings-description" className="sr-only">
              Configure your fantasy football league settings
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="league-name" className="text-slate-300">League Name</Label>
              <Input
                id="league-name"
                value={localLeagueSettings.name}
                onChange={(e) => setLocalLeagueSettings({...localLeagueSettings, name: e.target.value})}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            <div>
              <Label htmlFor="total-teams" className="text-slate-300">Number of Teams</Label>
              <Select 
                value={localLeagueSettings.total_teams.toString()} 
                onValueChange={(value) => setLocalLeagueSettings({...localLeagueSettings, total_teams: parseInt(value)})}
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
                value={localLeagueSettings.budget_per_team.toString()} 
                onValueChange={(value) => setLocalLeagueSettings({...localLeagueSettings, budget_per_team: parseInt(value)})}
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
                value={localLeagueSettings.roster_size.toString()} 
                onValueChange={(value) => setLocalLeagueSettings({...localLeagueSettings, roster_size: parseInt(value)})}
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
                {Object.entries(localLeagueSettings.position_requirements).map(([position, value]) => (
                  <div key={position} className="flex items-center justify-between bg-slate-700 rounded p-2">
                    <span className="text-slate-300">{position}:</span>
                    <Select 
                      value={value.toString()} 
                      onValueChange={(val) => handleLocalPositionRequirementChange(position, val)}
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
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-base font-medium">Team Names</Label>
              <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
                {localTeams.map((team, index) => (
                  <LocalTeamNameInput
                    key={team.id}
                    team={team}
                    index={index}
                  />
                ))}
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleSaveSettings}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
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
  });

  // Player Rankings Dashboard Component
  const PlayerRankingsDashboard = () => {
    const filteredPlayers = getFilteredPlayers();
    
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'QB', 'RB', 'WR', 'TE', 'DST'].map(position => (
            <button
              key={position}
              onClick={() => setActivePosition(position)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activePosition === position
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {position}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredPlayers.map((player, index) => {
            const isDrafted = league?.all_picks?.some(pick => 
              pick.player.name === player.name && 
              pick.player.position === player.position &&
              pick.player.nfl_team === player.nfl_team
            );

            const draftedInfo = isDrafted ? league.all_picks.find(pick => 
              pick.player.name === player.name && 
              pick.player.position === player.position &&
              pick.player.nfl_team === player.nfl_team
            ) : null;

            const teamName = draftedInfo ? league.teams.find(t => t.id === draftedInfo.team_id)?.name : '';

            return (
              <div
                key={`${player.name}-${player.position}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isDrafted 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-slate-800/50 border-slate-700/50'
                } hover:bg-slate-700/50 transition-colors`}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-white">
                      {index + 1}. {player.name}
                    </span>
                    <Badge className={getPositionColorClass(player.position)}>
                      {player.position}
                    </Badge>
                    <span className="text-slate-400">({player.nfl_team})</span>
                  </div>
                  
                  <div className="text-sm text-slate-400 mt-1">
                    ETR #{player.etr_rank} • {player.pos_rank}
                    {isDrafted && draftedInfo && (
                      <span className="text-red-400 ml-2">
                        → {teamName} (${draftedInfo.amount})
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-emerald-400 font-medium">
                    Auction Value: ${getAuctionValue(player)}
                  </div>
                  <div className={`text-sm font-medium ${
                    isDrafted ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {isDrafted ? 'DRAFTED' : 'AVAILABLE'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Control Interface (Commissioner View)
  const ControlInterface = () => (
    <div className="grid grid-cols-5 gap-6 h-screen p-4">
      <div className="col-span-3 bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Player Rankings</h2>
          <div className="text-slate-400 text-sm">Commissioner Control Panel</div>
        </div>
        <PlayerRankingsDashboard />
      </div>

      <div className="col-span-2 space-y-4">
        
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg">{league?.name || 'Loading...'}</CardTitle>
                <div className="text-slate-300 text-sm">
                  {league?.total_teams} Teams • ${league?.budget_per_team} Budget
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

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">Draft Player</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                ref={searchInputRef}
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
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
                      setSearchResults([player]); // Keep exactly one player for draft button
                      console.log('Player selected:', player.name, 'Search results now:', 1); // Debug
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

            <Select value={selectedTeam} onValueChange={(value) => {
              setSelectedTeam(value);
              console.log('Team selected:', value); // Debug
            }}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {league?.teams?.map(team => (
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
              ref={bidInputRef}
              type="number"
              placeholder="Winning bid amount"
              value={bidAmount}
              onChange={(e) => handleBidAmountChange(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              min="1"
            />

            <Button 
              onClick={() => {
                console.log('Draft button clicked', { 
                  searchResults: searchResults.length, 
                  selectedTeam, 
                  bidAmount 
                });
                if (searchResults.length > 0) {
                  addDraftPick(searchResults[0]);
                }
              }}
              disabled={!searchResults.length || !selectedTeam || !bidAmount}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Draft Player
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">Recent Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {league?.all_picks?.slice(-5).reverse().map((pick, index) => {
                const team = league.teams.find(t => t.id === pick.team_id);
                return (
                  <div key={pick.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                    <div>
                      <div className="text-white text-sm font-medium">{pick.player.name}</div>
                      <div className="text-xs text-slate-400">
                        {pick.player.position} • {team?.name}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-medium">${pick.amount}</span>
                      <Button
                        onClick={() => undoPick(pick.id)}
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-400 hover:bg-slate-700"
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(!league?.all_picks || league.all_picks.length === 0) && (
                <div className="text-slate-500 text-sm italic">No picks yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Display Interface (TV View) - Read-only
  const DisplayInterface = () => {
    console.log('DisplayInterface rendering...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{league?.name || 'Fantasy Football Auction'}</h1>
          <div className="text-xl text-slate-300">
            {league?.total_teams} Teams • ${league?.budget_per_team} Budget • {league?.roster_size} Roster Spots
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {league?.teams?.map((team, index) => (
            <Card key={team.id} className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">{team.name}</CardTitle>
                <div className="text-sm text-slate-300">
                  Budget: ${team.remaining} • Spots: {team.remaining_spots}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-3 p-2 bg-slate-800/50 rounded border-l-4 border-emerald-500">
                  <div className="text-slate-300 text-xs">MAX BID</div>
                  <div className={`text-xl ${getMaxBidColorClass(team.max_bid)}`}>
                    ${team.max_bid}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-400 text-xs font-medium">
                    Roster ({team.roster.length}/{league.roster_size})
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {team.roster.slice(-3).map((pick, idx) => (
                      <div key={pick.id} className="flex justify-between text-xs">
                        <span className="text-white">{pick.player.name}</span>
                        <span className="text-emerald-400">${pick.amount}</span>
                      </div>
                    ))}
                    {team.roster.length === 0 && (
                      <div className="text-slate-500 text-xs italic">No players</div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-slate-400 text-xs font-medium mb-1">Positions Needed</div>
                  <div className="flex flex-wrap gap-1">
                    {calculatePositionsNeeded(team, league.position_requirements).slice(0, 4).map((pos, idx) => (
                      <Badge
                        key={idx}
                        className={`text-xs ${getPositionColorClass(pos.position)}`}
                      >
                        {pos.position}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {league?.all_picks && league.all_picks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Recent Picks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {league.all_picks.slice(-9).reverse().map((pick, index) => {
                const team = league.teams.find(t => t.id === pick.team_id);
                return (
                  <div key={pick.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white font-medium">{pick.player.name}</div>
                        <div className="text-slate-400 text-sm">
                          {pick.player.position} • {team?.name}
                        </div>
                      </div>
                      <div className="text-emerald-400 font-bold text-lg">
                        ${pick.amount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Fantasy Football Auction Tracker...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Routes>
          <Route path="/control" element={<ControlInterface />} />
          <Route path="/display" element={<DisplayInterface />} />
          <Route path="*" element={<Navigate to="/control" replace />} />
        </Routes>
        
        <LeagueSettingsDialog />
        <Toaster />
      </div>
    </BrowserRouter>
  );
};

export default AuctionTracker;