import React, { useState, useEffect } from 'react';
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
    roster_size: 16
  });

  // Load demo league on component mount
  useEffect(() => {
    loadDemoLeague();
  }, []);

  const loadDemoLeague = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/demo-league`);
      setLeague(response.data);
      setLeagueSettings({
        name: response.data.name,
        total_teams: response.data.total_teams,
        budget_per_team: response.data.budget_per_team,
        roster_size: response.data.roster_size
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
      const response = await axios.put(`${API}/leagues/${league.id}/settings`, leagueSettings);
      setLeague(response.data);
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

  const cancelEditingTeam = () => {
    setEditingTeam(null);
    setTempTeamName('');
  };

  const searchPlayers = async (query = '') => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/players/search`, {
        params: { q: query, limit: 10 }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  };

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
      
      setLeague(response.data);
      setSearchQuery('');
      setSearchResults([]);
      setBidAmount('');
      setShowAddPick(false);
      toast.success(`${player.name} drafted for $${bidAmount}!`);
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

  const ControlInterface = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{league.name}</h1>
            <div className="flex items-center space-x-6 text-slate-300">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{league.total_teams} Teams</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>${league.budget_per_team} Budget</span>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
                <span>{league.roster_size} Roster Spots</span>
              </div>
            </div>
          </div>
          <Dialog open={showAddPick} onOpenChange={setShowAddPick}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Draft Player
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Draft Player</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPlayers(e.target.value);
                    }}
                    className="bg-slate-700 border-slate-600 text-white pr-10"
                  />
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
                
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {searchResults.map((player, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setSearchQuery(player.name);
                          setSearchResults([player]);
                        }}
                        className="p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">{player.name}</div>
                            <div className="text-slate-400 text-sm">{player.nfl_team} • Rank #{player.etr_rank}</div>
                          </div>
                          <Badge variant="secondary" className="bg-slate-600">
                            {player.position}
                          </Badge>
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
                            ${team.remaining} left • Max: <span className={getMaxBidColorClass(team.max_bid).replace('font-bold', '')}>${team.max_bid}</span>
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  placeholder="Bid amount"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />

                {searchResults.length === 1 && (
                  <Button
                    onClick={() => addDraftPick(searchResults[0])}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Draft {searchResults[0].name} for ${bidAmount}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {league.teams.map(team => (
          <Card key={team.id} className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">{team.name}</CardTitle>
              <div className="space-y-2">
                {/* Budget Summary */}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Spent: ${team.spent}</span>
                  <span className="text-emerald-400 font-medium">Left: ${team.remaining}</span>
                </div>
                
                {/* MAX BID - Most Important */}
                <div className="bg-slate-800/50 rounded-lg p-2 border-l-4 border-emerald-500">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm font-medium">MAX BID:</span>
                    <span className={`text-lg ${getMaxBidColorClass(team.max_bid)}`}>
                      ${team.max_bid}
                    </span>
                  </div>
                </div>
                
                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-400">
                    Spots Left: <span className="text-white font-medium">{team.remaining_spots || 0}</span>
                  </div>
                  <div className="text-slate-400">
                    Avg/Spot: <span className="text-white font-medium">${team.avg_per_spot || 0}</span>
                  </div>
                  <div className="text-slate-400 col-span-2">
                    Budget Used: <span className={getBudgetUtilizationColor(team.budget_utilization)}>{team.budget_utilization || 0}%</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {team.roster.map(pick => (
                  <div key={pick.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                    <div>
                      <div className="text-white text-sm font-medium">{pick.player.name}</div>
                      <div className="text-xs text-slate-400">
                        {pick.player.position} • {pick.player.nfl_team}
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
                ))}
                {team.roster.length === 0 && (
                  <div className="text-slate-500 text-sm italic">No players drafted</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const TVDisplayInterface = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">{league.name}</h1>
        <div className="text-2xl text-slate-300">Live Auction Draft</div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {league.teams.map(team => (
          <Card key={team.id} className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-2xl">{team.name}</CardTitle>
              <div className="space-y-3">
                {/* Budget Summary */}
                <div className="flex justify-between text-lg">
                  <span className="text-slate-300">Spent: ${team.spent}</span>
                  <span className="text-emerald-400 font-bold">Left: ${team.remaining}</span>
                </div>
                
                {/* CRITICAL: MAX BID - Large and Prominent for TV */}
                <div className="bg-slate-900/70 rounded-lg p-4 border-2 border-emerald-500/50">
                  <div className="text-center">
                    <div className="text-slate-300 text-sm uppercase tracking-wide">MAX BID</div>
                    <div className={`text-3xl font-bold ${getMaxBidColorClass(team.max_bid)}`}>
                      ${team.max_bid}
                    </div>
                  </div>
                </div>
                
                {/* Roster and Key Metrics */}
                <div className="flex justify-between text-base">
                  <span className="text-slate-400">
                    Roster: <span className="text-white font-medium">{team.roster.length}/{league.roster_size}</span>
                  </span>
                  <span className="text-slate-400">
                    Left: <span className="text-white font-medium">{team.remaining_spots || 0} spots</span>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg text-slate-400 mb-2">
                Roster: {team.roster.length}/{league.roster_size}
              </div>
              <div className="space-y-2">
                {team.roster.slice(-3).map(pick => (
                  <div key={pick.id} className="flex justify-between bg-slate-800/50 rounded p-2">
                    <span className="text-white">{pick.player.name}</span>
                    <span className="text-emerald-400">${pick.amount}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
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