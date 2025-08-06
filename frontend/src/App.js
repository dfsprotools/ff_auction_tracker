import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  
  // NEW TEAM CLAIMING SYSTEM + SMS INVITATION SYSTEM
  const [claimedTeams, setClaimedTeams] = useState(new Set()); // Track claimed teams
  const [commissionerTeamsNamed, setCommissionerTeamsNamed] = useState(false); // Track if commissioner has named teams
  const [teamPhoneNumbers, setTeamPhoneNumbers] = useState({}); // Track phone numbers for each team
  const [teamInviteUrls, setTeamInviteUrls] = useState({}); // Track unique URLs for each team
  const [showInviteMessages, setShowInviteMessages] = useState(null); // Show generated invite messages

  // Add these refs to your existing state declarations
  const searchInputRef = useRef(null);
  const bidInputRef = useRef(null);
  const teamNameRefs = useRef({});
  const teamPhoneRefs = useRef({}); // Add phone number refs

  // Simple authentication - in production this would be more secure
  const COMMISSIONER_PASSWORD = 'draft2024';

  // Load demo league and player database on component mount
  useEffect(() => {
    loadDemoLeague();
    loadPlayerDatabase();
  }, []);

  // Generate unique URLs for team invitations
  const generateTeamInviteUrls = useCallback(() => {
    const newUrls = {};
    league.teams.forEach(team => {
      // Generate a unique 12-character code for each team
      const uniqueCode = Math.random().toString(36).substring(2, 14);
      newUrls[team.id] = `/team/${uniqueCode}`;
    });
    setTeamInviteUrls(newUrls);
    return newUrls;
  }, [league]);

  // Generate invite messages for manual SMS sending
  const generateInviteMessages = useCallback(() => {
    const urls = Object.keys(teamInviteUrls).length > 0 ? teamInviteUrls : generateTeamInviteUrls();
    const messages = [];
    
    league.teams.forEach(team => {
      const teamName = team.name || `Team ${league.teams.indexOf(team) + 1}`;
      const phoneNumber = teamPhoneNumbers[team.id] || 'No phone number';
      const uniqueUrl = `${window.location.origin}${urls[team.id]}`;
      
      messages.push({
        teamId: team.id,
        teamName,
        phoneNumber,
        message: `Join ${league.name} as ${teamName}: ${uniqueUrl}`
      });
    });
    
    return messages;
  }, [league, teamPhoneNumbers, teamInviteUrls, generateTeamInviteUrls]);

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
    
    // For team members - check if teams have been named by commissioner
    if (!commissionerTeamsNamed) {
      toast.error('Commissioner must login first and name teams before team users can join');
      return;
    }
    
    // Check if team is already claimed
    if (claimedTeams.has(teamId)) {
      toast.error('This team has already been claimed by another user');
      return;
    }
    
    // Claim the team
    setClaimedTeams(prev => new Set([...prev, teamId]));
    setUserRole(role);
    setCurrentUser(teamId);
    setShowUserSelection(false);
    setSelectedTeam(teamId); // Auto-select their team
    
    toast.success(`Successfully claimed ${league.teams.find(t => t.id === teamId)?.name || 'team'}!`);
  };

  const authenticateCommissioner = () => {
    if (commissionerPassword === COMMISSIONER_PASSWORD) {
      setUserRole('commissioner');
      
      // Assign commissioner to Team 1 by default
      const team1 = league?.teams?.[0];
      if (team1) {
        setCurrentUser(team1.id);
        setSelectedTeam(team1.id);
        setClaimedTeams(prev => new Set([...prev, team1.id])); // Claim Team 1 for commissioner
      } else {
        setCurrentUser('Commissioner');
      }
      
      setShowUserSelection(false);
      setShowPasswordPrompt(false);
      setCommissionerPassword('');
      toast.success('Commissioner access granted - You are assigned to Team 1');
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
      
      // Mark that commissioner has named teams - enable team user login
      setCommissionerTeamsNamed(true);
      
      setShowLeagueSettings(false);
      toast.success('League settings updated! Team users can now join the league.');
    } catch (error) {
      console.error('Error updating league settings:', error);
      toast.error('Failed to update league settings');
    }
  };

  // Memoized team name update - FIXED WITH SAME PATTERN AS SEARCH INPUTS
  const updateTeamName = useCallback((teamId, newName) => {
    setLeague(prevLeague => ({
      ...prevLeague,
      teams: prevLeague.teams.map(team => 
        team.id === teamId ? { ...team, name: newName } : team
      )
    }));
    
    // Apply the SAME cursor fix that works for search inputs
    setTimeout(() => {
      const inputRef = teamNameRefs.current[teamId];
      if (inputRef && document.activeElement !== inputRef) {
        inputRef.focus();
      }
    }, 0);
  }, []);

  // Phone number update handler with same cursor fix pattern
  const updateTeamPhoneNumber = useCallback((teamId, phoneNumber) => {
    setTeamPhoneNumbers(prev => ({
      ...prev,
      [teamId]: phoneNumber
    }));
    
    // Apply the SAME cursor fix pattern
    setTimeout(() => {
      const inputRef = teamPhoneRefs.current[teamId];
      if (inputRef && document.activeElement !== inputRef) {
        inputRef.focus();
      }
    }, 0);
  }, []);

  // Memoized bid amount handler
  const handleBidAmountChange = useCallback((value) => {
    setBidAmount(value);
    
    // Maintain focus on bid input
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
      // Check if player is already drafted
      const isDrafted = league.all_picks?.some(pick => 
        pick.player.name === player.name && 
        pick.player.position === player.position &&
        pick.player.nfl_team === player.nfl_team
      );
      return !isDrafted;
    });
  }, [playerDatabase, league]);

  // Filter players for draft based on search query - WORKING VERSION
  const getFilteredDraftPlayers = useCallback((query) => {
    const availablePlayers = getAvailablePlayersForDraft();

    if (!query.trim()) return [];

    const searchQuery = query.toLowerCase();
    
    // For single letter searches - ONLY show players whose FIRST NAME starts with that letter
    if (query.length === 1) {
      const results = [];
      
      availablePlayers.forEach(player => {
        const firstName = player.name.split(' ')[0].toLowerCase();
        
        // ONLY add if first name starts with the search letter
        if (firstName.startsWith(searchQuery)) {
          results.push(player);
        }
      });

      // Sort by ETR rank
      results.sort((a, b) => (a.etr_rank || 999) - (b.etr_rank || 999));
      
      return results.slice(0, 10);
    }
    
    // For multi-character searches
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
    
    // Maintain focus on the input - this prevents cursor loss
    setTimeout(() => {
      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);

    if (value.trim()) {
      const filteredResults = getFilteredDraftPlayers(value);
      setSearchResults(filteredResults);
    } else {
      setSearchResults([]);
    }
  }, [getFilteredDraftPlayers]);

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
            <div className="text-sm text-emerald-200 ml-2">(Team 1 + Admin Access)</div>
          </Button>

          {/* Team Selection */}
          {league && (
            <div className="space-y-2">
              <div className="text-slate-300 text-sm font-medium text-center">
                {commissionerTeamsNamed ? 'Select your team:' : 'Waiting for Commissioner to name teams...'}
              </div>
              
              {!commissionerTeamsNamed && (
                <div className="text-yellow-400 text-xs text-center bg-yellow-500/10 rounded p-2 border border-yellow-500/20">
                  ⚠️ Commissioner must login first and set team names before team users can join
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {league.teams.map((team, index) => {
                  const isClaimed = claimedTeams.has(team.id);
                  const isCommissionerTeam = index === 0; // Team 1 is commissioner's team
                  
                  return (
                    <Button
                      key={team.id}
                      onClick={() => selectUser('team', team.id)}
                      variant="outline"
                      disabled={!commissionerTeamsNamed || isClaimed}
                      className={`border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white p-3 ${
                        isClaimed 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-slate-700'
                      } ${
                        isCommissionerTeam 
                          ? 'border-emerald-500/50 bg-emerald-500/10' 
                          : ''
                      }`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      <div className="text-left">
                        <div>{team.name}</div>
                        {isCommissionerTeam && (
                          <div className="text-xs text-emerald-400">Commissioner's Team</div>
                        )}
                        {isClaimed && !isCommissionerTeam && (
                          <div className="text-xs text-red-400">Claimed</div>
                        )}
                      </div>
                    </Button>
                  );
                })}
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
              <div className="text-slate-400 text-sm text-center">You will be assigned to Team 1</div>
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

  // Enhanced TeamNameInput component with phone number field
  const TeamNameInput = React.memo(({ team, index, updateTeamName, updateTeamPhoneNumber, teamNameRefs, teamPhoneRefs, teamPhoneNumbers }) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <span className="text-slate-400 text-sm w-16">Team {index + 1}:</span>
        <Input
          ref={(el) => {
            if (el) teamNameRefs.current[team.id] = el;
          }}
          value={team.name}
          onChange={(e) => updateTeamName(team.id, e.target.value)}
          className="bg-slate-700 border-slate-600 text-white flex-1"
          placeholder={`Team ${index + 1} name`}
        />
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-slate-400 text-sm w-16">Phone:</span>
        <Input
          ref={(el) => {
            if (el) teamPhoneRefs.current[team.id] = el;
          }}
          value={teamPhoneNumbers[team.id] || ''}
          onChange={(e) => updateTeamPhoneNumber(team.id, e.target.value)}
          className="bg-slate-700 border-slate-600 text-white flex-1"
          placeholder="(555) 123-4567"
          type="tel"
        />
      </div>
    </div>
  ));

  // SMS Messages Display Dialog
  const SMSMessagesDialog = () => (
    <Dialog open={!!showInviteMessages} onOpenChange={() => setShowInviteMessages(null)}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg" aria-describedby="sms-messages-description">
        <DialogHeader>
          <DialogTitle className="text-white">SMS Invite Messages</DialogTitle>
          <div id="sms-messages-description" className="sr-only">
            Copy these messages to send via SMS to your team managers
          </div>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {showInviteMessages && showInviteMessages.map(invite => (
            <div key={invite.teamId} className="bg-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-emerald-400 font-medium">{invite.teamName}</span>
                <span className="text-slate-400 text-sm">{invite.phoneNumber}</span>
              </div>
              <div className="bg-slate-800 rounded p-2">
                <code className="text-white text-sm">{invite.message}</code>
              </div>
              <Button 
                onClick={() => navigator.clipboard.writeText(invite.message)}
                size="sm"
                className="mt-2 bg-blue-600 hover:bg-blue-700"
              >
                Copy Message
              </Button>
            </div>
          ))}
        </div>
        <div className="flex space-x-2 pt-4">
          <Button 
            onClick={() => {
              const allMessages = showInviteMessages.map(invite => `${invite.teamName} (${invite.phoneNumber}): ${invite.message}`).join('\n\n');
              navigator.clipboard.writeText(allMessages);
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Copy All Messages
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowInviteMessages(null)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Isolated League Settings Dialog with internal state management
  const LeagueSettingsDialog = React.memo(() => {
    // Internal state for the dialog - prevents re-rendering
    const [localLeagueSettings, setLocalLeagueSettings] = useState(leagueSettings);
    const [localTeams, setLocalTeams] = useState(league?.teams || []);
    const [localPhoneNumbers, setLocalPhoneNumbers] = useState(teamPhoneNumbers);
    const localTeamNameRefs = useRef({});
    const localTeamPhoneRefs = useRef({});
    
    // Update local state when dialog opens
    React.useEffect(() => {
      if (showLeagueSettings && league) {
        setLocalLeagueSettings(leagueSettings);
        setLocalTeams([...league.teams]);
        setLocalPhoneNumbers({...teamPhoneNumbers});
      }
    }, [showLeagueSettings, league, leagueSettings, teamPhoneNumbers]);

    // Local handlers that don't trigger parent re-renders
    const handleLocalTeamNameChange = useCallback((teamId, newName) => {
      setLocalTeams(prevTeams => 
        prevTeams.map(team => 
          team.id === teamId ? { ...team, name: newName } : team
        )
      );
      
      // Maintain focus
      setTimeout(() => {
        const inputRef = localTeamNameRefs.current[teamId];
        if (inputRef && document.activeElement !== inputRef) {
          inputRef.focus();
        }
      }, 0);
    }, []);

    const handleLocalPhoneNumberChange = useCallback((teamId, phoneNumber) => {
      setLocalPhoneNumbers(prev => ({
        ...prev,
        [teamId]: phoneNumber
      }));
      
      // Maintain focus
      setTimeout(() => {
        const inputRef = localTeamPhoneRefs.current[teamId];
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

    // Save all changes to parent state
    const handleSaveSettings = async () => {
      try {
        // Update parent states
        setLeagueSettings(localLeagueSettings);
        setTeamPhoneNumbers(localPhoneNumbers);
        
        // Update league teams
        setLeague(prevLeague => ({
          ...prevLeague,
          teams: localTeams
        }));

        // Call the original update function
        const response = await axios.put(`${API}/leagues/${league.id}/settings`, localLeagueSettings);
        
        // Update team names on server
        for (let i = 0; i < localTeams.length; i++) {
          const team = localTeams[i];
          if (team.name !== `Team ${i + 1}`) {
            await axios.put(`${API}/leagues/${league.id}/teams/${team.id}`, {
              name: team.name
            });
          }
        }
        
        // Force reload league data
        const finalResponse = await axios.get(`${API}/leagues/${league.id}`);
        const freshLeague = finalResponse.data;
        setLeague(freshLeague);
        
        // Mark that commissioner has named teams
        setCommissionerTeamsNamed(true);
        
        setShowLeagueSettings(false);
        toast.success('League settings updated! Team users can now join the league.');
      } catch (error) {
        console.error('Error updating league settings:', error);
        toast.error('Failed to update league settings');
      }
    };

    // Local TeamNameInput component to prevent external dependencies
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
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 text-sm w-16">Phone:</span>
          <Input
            ref={(el) => {
              if (el) localTeamPhoneRefs.current[team.id] = el;
            }}
            value={localPhoneNumbers[team.id] || ''}
            onChange={(e) => handleLocalPhoneNumberChange(team.id, e.target.value)}
            className="bg-slate-700 border-slate-600 text-white flex-1"
            placeholder="(555) 123-4567"
            type="tel"
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
              Configure your fantasy football league settings including team count, budget, roster size, and position requirements
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
                <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                  <span className="text-slate-300">QB:</span>
                  <Select 
                    value={localLeagueSettings.position_requirements.QB.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('QB', value)}
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
                    value={localLeagueSettings.position_requirements.RB.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('RB', value)}
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
                    value={localLeagueSettings.position_requirements.WR.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('WR', value)}
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
                    value={localLeagueSettings.position_requirements.TE.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('TE', value)}
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
                    value={localLeagueSettings.position_requirements.FLEX.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('FLEX', value)}
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
                    value={localLeagueSettings.position_requirements.K.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('K', value)}
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
                    value={localLeagueSettings.position_requirements.DEF.toString()} 
                    onValueChange={(value) => handleLocalPositionRequirementChange('DEF', value)}
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
                  Object.values(localLeagueSettings.position_requirements).reduce((sum, val) => sum + val, 0)
                } starters, {localLeagueSettings.roster_size - Object.values(localLeagueSettings.position_requirements).reduce((sum, val) => sum + val, 0)} bench
              </div>
            </div>

            {/* TEAM NAME MANAGEMENT - ISOLATED */}
            <div>
              <Label className="text-slate-300 text-base font-medium">Team Names & Phone Numbers</Label>
              <div className="mt-2 space-y-3 max-h-48 overflow-y-auto">
                {localTeams.map((team, index) => (
                  <LocalTeamNameInput 
                    key={team.id}
                    team={team}
                    index={index}
                  />
                ))}
              </div>
            </div>

            {/* GENERATE INVITES SECTION */}
            <div>
              <Label className="text-slate-300 text-base font-medium">SMS Invitations</Label>
              <div className="mt-2">
                <Button 
                  onClick={() => {
                    // Use local state to generate messages
                    const messages = localTeams.map(team => {
                      const teamName = team.name || `Team ${localTeams.indexOf(team) + 1}`;
                      const phoneNumber = localPhoneNumbers[team.id] || 'No phone number';
                      const uniqueCode = Math.random().toString(36).substring(2, 14);
                      const uniqueUrl = `${window.location.origin}/team/${uniqueCode}`;
                      
                      return {
                        teamId: team.id,
                        teamName,
                        phoneNumber,
                        message: `Join ${localLeagueSettings.name} as ${teamName}: ${uniqueUrl}`
                      };
                    });
                    
                    setShowInviteMessages(messages);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={localTeams.some(team => !team.name.trim() || team.name.startsWith('Team '))}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate SMS Invites
                </Button>
                <div className="text-xs text-slate-400 mt-1">
                  All teams must be named before generating invites
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleSaveSettings}
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
  });

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
    
    return filtered.slice(0, 500); // Show all available players
  };

  // DYNAMIC AUCTION VALUE SYSTEM - Based on Actual 2023 Data
  const POSITION_BUDGETS = {
    RB: 0.38, // 38% - $1,615 of $4,200 actual spend
    WR: 0.45, // 45% - $1,890 of $4,200 actual spend  
    QB: 0.10, // 10% - $420 of $4,200 actual spend
    TE: 0.06, // 6% - $252 of $4,200 actual spend
    K: 0.005, // 0.5% - $21 of $4,200 actual spend
    DST: 0.005 // 0.5% - $21 of $4,200 actual spend
  };

  // Calculate position budgets dynamically based on league settings
  const calculatePositionBudgets = useCallback(() => {
    if (!league) return {};
    
    const totalBudget = league.total_teams * league.budget_per_team;
    return Object.entries(POSITION_BUDGETS).reduce((budgets, [pos, pct]) => {
      budgets[pos] = totalBudget * pct;
      return budgets;
    }, {});
  }, [league]);

  // Get total players at each position from database
  const getPositionCounts = useCallback(() => {
    const counts = {};
    if (playerDatabase && playerDatabase.length > 0) {
      playerDatabase.forEach(player => {
        counts[player.position] = (counts[player.position] || 0) + 1;
      });
    }
    return counts;
  }, [playerDatabase]);

  // Calculate dynamic player value based on position budget and rank percentile
  const calculatePlayerValue = useCallback((player, positionBudget, totalAtPosition) => {
    // Extract position rank number from strings like "QB01", "RB02", etc.
    const posRankMatch = player.pos_rank?.match(/\d+/);
    const rank = posRankMatch ? parseInt(posRankMatch[0]) : 999;
    
    // Calculate percentile (lower is better)
    const percentile = rank / totalAtPosition;
    
    let budgetShare;
    if (percentile <= 0.10) {        // Top 10% (Josh Allen, CMC tier)
      budgetShare = 0.40 + (0.10 - percentile) * 2; // 40-60% of position budget
    } else if (percentile <= 0.25) { // Elite tier (Top 25%)
      budgetShare = 0.15 + (0.25 - percentile) * 1.67; // 15-40%
    } else if (percentile <= 0.65) { // Solid starters
      budgetShare = 0.02 + (0.65 - percentile) * 0.325; // 2-15%
    } else {                         // Bench/depth
      budgetShare = Math.max(0.001, (1 - percentile) * 0.057); // $1-5
    }
    
    // Calculate base value - adjusted denominator for proper scaling
    const startingPositionSlots = Math.min(totalAtPosition, league?.total_teams || 14);
    let baseValue = Math.max(1, Math.round(positionBudget * budgetShare / Math.max(1, startingPositionSlots * 0.6)));
    
    // Apply market adjustments
    
    // 1. Scarcity premium for scarce positions
    if (player.position === 'TE') {
      baseValue = Math.round(baseValue * 1.15); // +15% TE scarcity premium
    } else if (player.position === 'RB') {
      baseValue = Math.round(baseValue * 1.10); // +10% RB scarcity premium
    }
    
    // 2. Additional boost for top-tier players
    if (percentile <= 0.05) { // Top 5% get extra boost
      baseValue = Math.round(baseValue * 1.25);
    }
    
    return Math.max(1, baseValue);
  }, [league]);

  // Enhanced suggested value function with dynamic calculation
  const getSuggestedValue = useCallback((player) => {
    if (!league || !playerDatabase || playerDatabase.length === 0) return 1;
    
    const positionBudgets = calculatePositionBudgets();
    const positionCounts = getPositionCounts();
    
    const playerPosition = player.position;
    const positionBudget = positionBudgets[playerPosition];
    const totalAtPosition = positionCounts[playerPosition];
    
    if (!positionBudget || !totalAtPosition) {
      return 1;
    }
    
    return calculatePlayerValue(player, positionBudget, totalAtPosition);
  }, [league, playerDatabase, calculatePositionBudgets, getPositionCounts, calculatePlayerValue]);

  // Validation function to ensure total values balance
  const validateAuctionValues = useCallback(() => {
    if (!league || !playerDatabase || playerDatabase.length === 0) return { isValid: false, details: {} };
    
    const expectedTotal = league.total_teams * league.budget_per_team;
    const undraftedPlayerValue = (playerDatabase.length - (league.total_teams * league.roster_size)) * 1;
    const expectedDraftedTotal = expectedTotal - undraftedPlayerValue;
    
    let actualTotal = 0;
    const positionTotals = {};
    
    playerDatabase.forEach(player => {
      const value = getSuggestedValue(player);
      actualTotal += value;
      positionTotals[player.position] = (positionTotals[player.position] || 0) + value;
    });
    
    return {
      isValid: Math.abs(actualTotal - expectedTotal) < (expectedTotal * 0.05), // 5% tolerance
      expectedTotal,
      actualTotal,
      difference: actualTotal - expectedTotal,
      positionTotals,
      undraftedPlayerValue
    };
  }, [league, playerDatabase, getSuggestedValue]);

  // Debug component to show value validation (can be removed later)
  const ValueValidationDebug = () => {
    const validation = validateAuctionValues();
    
    if (!validation.isValid && league && playerDatabase.length > 0) {
      console.log('AUCTION VALUE VALIDATION:', validation);
    }
    
    return null; // Hidden component for debugging
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
          ref={userRole === 'team' ? searchInputRef : undefined}
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            // Apply same cursor fix for team users
            if (userRole === 'team') {
              setTimeout(() => {
                if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }, 0);
            }
          }}
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

  const CommissionerControls = () => {
    // Get commissioner's team (Team 1)
    const commissionerTeam = league?.teams?.[0];
    
    return (
      <div className="space-y-4">
        {/* Commissioner Team Dashboard */}
        {commissionerTeam && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg">My Team Dashboard</CardTitle>
              <div className="text-slate-300 text-sm">{commissionerTeam.name} (Commissioner)</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Budget Info */}
              <div className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-emerald-500">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300 font-medium">MAX BID:</span>
                  <span className={`text-xl ${getMaxBidColorClass(commissionerTeam.max_bid)}`}>
                    ${commissionerTeam.max_bid}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Budget Left:</span>
                    <span className="text-emerald-400 font-medium">${commissionerTeam.remaining}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Spots Left:</span>
                    <span className="text-white font-medium">{commissionerTeam.remaining_spots || 0}</span>
                  </div>
                </div>
              </div>

              {/* My Roster */}
              <div>
                <h3 className="text-white font-medium mb-2">My Roster ({commissionerTeam.roster.length}/{league.roster_size})</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {commissionerTeam.roster.slice(-3).map(pick => (
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
                  {commissionerTeam.roster.length === 0 && (
                    <div className="text-slate-500 text-sm italic">No players drafted yet</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              ref={bidInputRef}
              type="number"
              placeholder="Winning bid amount"
              value={bidAmount}
              onChange={(e) => handleBidAmountChange(e.target.value)}
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
  };

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

        {/* Team-Restricted Draft Controls */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">Submit Draft Pick</CardTitle>
            <div className="text-slate-400 text-sm">Request a player for your team</div>
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

            <Input
              ref={bidInputRef}
              type="number"
              placeholder="Bid amount"
              value={bidAmount}
              onChange={(e) => handleBidAmountChange(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              min="1"
              step="1"
              inputMode="numeric"
              autoComplete="off"
            />

            {searchResults.length === 1 && bidAmount && parseInt(bidAmount) > 0 && (
              <Button
                onClick={() => addDraftPick(searchResults[0])}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={currentTeam.remaining < parseInt(bidAmount)}
              >
                Request {searchResults[0].name} for ${bidAmount}
                {currentTeam.remaining < parseInt(bidAmount) && (
                  <span className="text-red-300 ml-2">(Insufficient Budget)</span>
                )}
              </Button>
            )}
            
            <div className="text-xs text-slate-400">
              Note: Team members can only draft to their own team
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
      
      {/* SMS Messages Dialog */}
      <SMSMessagesDialog />
      
      {/* Value Validation Debug */}
      <ValueValidationDebug />
      
      {/* View Toggle */}
      <div className="mb-6">
        <Tabs value={activeView} onValueChange={setActiveView} className="w-fit">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="control" className="text-white">Draft HQ</TabsTrigger>
            <TabsTrigger value="display" className="text-white">Auction Tracker</TabsTrigger>
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