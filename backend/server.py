from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import csv
import requests
from io import StringIO
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Data Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    position: str
    nfl_team: str
    etr_rank: Optional[int] = None
    adp: Optional[float] = None
    pos_rank: Optional[int] = None

class DraftPick(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player: Player
    team_id: str
    amount: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    budget: int
    spent: int = 0
    remaining: int
    roster: List[DraftPick] = []
    roster_spots: Dict[str, int] = {}
    max_bid: int = 0
    remaining_spots: int = 0
    avg_per_spot: float = 0.0
    budget_utilization: float = 0.0

class League(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    total_teams: int
    budget_per_team: int
    roster_size: int
    position_requirements: Dict[str, int]
    teams: List[Team] = []
    all_picks: List[DraftPick] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LeagueCreate(BaseModel):
    name: str
    total_teams: int = 12
    budget_per_team: int = 200
    roster_size: int = 16
    position_requirements: Dict[str, int] = {
        "QB": 1, "RB": 2, "WR": 2, "TE": 1, 
        "FLEX": 1, "K": 1, "DEF": 1
    }

class PlayerCreate(BaseModel):
    name: str
    position: str
    nfl_team: str
    etr_rank: Optional[int] = None
    adp: Optional[float] = None
    pos_rank: Optional[int] = None

class DraftPickCreate(BaseModel):
    player: PlayerCreate
    team_id: str
    amount: int

# Helper functions
def calculate_team_metrics(team: Team, position_requirements: Dict[str, int], roster_size: int) -> Team:
    """Calculate remaining budget, max bid, and other critical metrics for a team"""
    team.remaining = team.budget - team.spent
    
    # Calculate remaining roster spots
    current_roster_size = len(team.roster)
    remaining_roster_spots = roster_size - current_roster_size
    
    # CRITICAL: Max bid calculation
    # Formula: Remaining Budget - (Remaining Roster Spots - 1)
    # This ensures $1 minimum for each remaining spot after this pick
    team.max_bid = max(0, team.remaining - max(0, remaining_roster_spots - 1))
    
    # Additional metrics
    team.remaining_spots = remaining_roster_spots
    team.avg_per_spot = round(team.remaining / max(1, remaining_roster_spots), 1) if remaining_roster_spots > 0 else 0
    team.budget_utilization = round((team.spent / team.budget) * 100, 1) if team.budget > 0 else 0
    
    return team

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Fantasy Football Auction Draft Tracker API"}

@api_router.post("/leagues", response_model=League)
async def create_league(league_data: LeagueCreate):
    # Create teams
    teams = []
    for i in range(league_data.total_teams):
        team = Team(
            name=f"Team {i + 1}",
            budget=league_data.budget_per_team,
            remaining=league_data.budget_per_team,
            roster_spots=league_data.position_requirements.copy()
        )
        team = calculate_team_metrics(team, league_data.position_requirements, league_data.roster_size)
        teams.append(team)
    
    league = League(
        name=league_data.name,
        total_teams=league_data.total_teams,
        budget_per_team=league_data.budget_per_team,
        roster_size=league_data.roster_size,
        position_requirements=league_data.position_requirements,
        teams=teams
    )
    
    await db.leagues.insert_one(league.dict())
    return league

@api_router.get("/leagues/{league_id}", response_model=League)
async def get_league(league_id: str):
    league_data = await db.leagues.find_one({"id": league_id})
    if not league_data:
        raise HTTPException(status_code=404, detail="League not found")
    return League(**league_data)

@api_router.get("/leagues", response_model=List[League])
async def get_leagues():
    leagues = await db.leagues.find().to_list(100)
    return [League(**league) for league in leagues]

@api_router.post("/leagues/{league_id}/draft", response_model=League)
async def add_draft_pick(league_id: str, pick_data: DraftPickCreate):
    # Get league
    league_data = await db.leagues.find_one({"id": league_id})
    if not league_data:
        raise HTTPException(status_code=404, detail="League not found")
    
    league = League(**league_data)
    
    # Find team
    team_index = None
    for i, team in enumerate(league.teams):
        if team.id == pick_data.team_id:
            team_index = i
            break
    
    if team_index is None:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = league.teams[team_index]
    
    # Validate pick
    if pick_data.amount > team.remaining:
        raise HTTPException(status_code=400, detail="Insufficient budget")
    
    # Create player and draft pick
    player = Player(**pick_data.player.dict())
    draft_pick = DraftPick(
        player=player,
        team_id=pick_data.team_id,
        amount=pick_data.amount
    )
    
    # Update team
    team.roster.append(draft_pick)
    team.spent += pick_data.amount
    team = calculate_team_metrics(team, league.position_requirements, league.roster_size)
    
    # Update league
    league.teams[team_index] = team
    league.all_picks.append(draft_pick)
    
    # Save to database
    await db.leagues.replace_one({"id": league_id}, league.dict())
    
    return league

@api_router.delete("/leagues/{league_id}/picks/{pick_id}")
async def undo_pick(league_id: str, pick_id: str):
    # Get league
    league_data = await db.leagues.find_one({"id": league_id})
    if not league_data:
        raise HTTPException(status_code=404, detail="League not found")
    
    league = League(**league_data)
    
    # Find and remove pick from league
    pick_to_remove = None
    for i, pick in enumerate(league.all_picks):
        if pick.id == pick_id:
            pick_to_remove = pick
            league.all_picks.pop(i)
            break
    
    if not pick_to_remove:
        raise HTTPException(status_code=404, detail="Pick not found")
    
    # Find team and remove pick
    for team_index, team in enumerate(league.teams):
        if team.id == pick_to_remove.team_id:
            for j, roster_pick in enumerate(team.roster):
                if roster_pick.id == pick_id:
                    team.roster.pop(j)
                    team.spent -= pick_to_remove.amount
                    team = calculate_team_metrics(team, league.position_requirements, league.roster_size)
                    league.teams[team_index] = team
                    break
            break
    
    # Save to database
    await db.leagues.replace_one({"id": league_id}, league.dict())
    
    return {"message": "Pick undone successfully"}

@api_router.post("/demo-league", response_model=League)
async def create_demo_league():
    # Create the "Pipelayer Pro Bowl" demo league
    teams = []
    for i in range(14):
        team = Team(
            name=f"Team {i + 1}",
            budget=300,
            remaining=300,
            roster_spots={
                "QB": 1, "RB": 2, "WR": 2, "TE": 1, 
                "FLEX": 1, "K": 1, "DEF": 1
            }
        )
        team = calculate_team_metrics(team, {
            "QB": 1, "RB": 2, "WR": 2, "TE": 1, 
            "FLEX": 1, "K": 1, "DEF": 1
        }, 16)
        teams.append(team)
    
    league = League(
        name="Pipelayer Pro Bowl",
        total_teams=14,
        budget_per_team=300,
        roster_size=16,
        position_requirements={
            "QB": 1, "RB": 2, "WR": 2, "TE": 1, 
            "FLEX": 1, "K": 1, "DEF": 1
        },
        teams=teams
    )
    
    # Delete existing demo league if it exists
    await db.leagues.delete_many({"name": "Pipelayer Pro Bowl"})
    
    await db.leagues.insert_one(league.dict())
    return league

@api_router.put("/leagues/{league_id}/settings")
async def update_league_settings(league_id: str, settings: LeagueCreate):
    """Update league settings"""
    try:
        league_data = await db.leagues.find_one({"id": league_id})
        if not league_data:
            raise HTTPException(status_code=404, detail="League not found")
        
        league = League(**league_data)
        
        # Update basic settings
        league.name = settings.name
        league.total_teams = settings.total_teams
        league.budget_per_team = settings.budget_per_team
        league.roster_size = settings.roster_size
        league.position_requirements = settings.position_requirements
        
        # Update team budgets and recalculate metrics if budget changed
        if league.budget_per_team != league_data['budget_per_team']:
            for i, team in enumerate(league.teams):
                # Adjust remaining budget proportionally
                old_budget = league_data['budget_per_team']
                spent_ratio = team.spent / old_budget if old_budget > 0 else 0
                team.budget = settings.budget_per_team
                team.remaining = team.budget - team.spent
                team = calculate_team_metrics(team, league.position_requirements, league.roster_size)
                league.teams[i] = team
        
        # Adjust number of teams if changed
        current_team_count = len(league.teams)
        if settings.total_teams > current_team_count:
            # Add new teams
            for i in range(current_team_count, settings.total_teams):
                new_team = Team(
                    name=f"Team {i + 1}",
                    budget=settings.budget_per_team,
                    remaining=settings.budget_per_team,
                    roster_spots=settings.position_requirements.copy()
                )
                new_team = calculate_team_metrics(new_team, settings.position_requirements, settings.roster_size)
                league.teams.append(new_team)
        elif settings.total_teams < current_team_count:
            # Remove teams (only if they have no players)
            teams_to_remove = []
            for i in range(settings.total_teams, current_team_count):
                if len(league.teams[i].roster) == 0:
                    teams_to_remove.append(i)
                else:
                    raise HTTPException(status_code=400, detail=f"Cannot remove Team {i+1} - they have drafted players")
            
            # Remove teams in reverse order to maintain indices
            for i in reversed(teams_to_remove):
                league.teams.pop(i)
        
        # Save updated league
        await db.leagues.replace_one({"id": league_id}, league.dict())
        return league
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating league settings: {str(e)}")

@api_router.put("/leagues/{league_id}/teams/{team_id}")
async def update_team(league_id: str, team_id: str, team_data: dict):
    """Update team details"""
    try:
        league_data = await db.leagues.find_one({"id": league_id})
        if not league_data:
            raise HTTPException(status_code=404, detail="League not found")
        
        league = League(**league_data)
        
        # Find and update team
        team_found = False
        for i, team in enumerate(league.teams):
            if team.id == team_id:
                if 'name' in team_data:
                    team.name = team_data['name']
                league.teams[i] = team
                team_found = True
                break
        
        if not team_found:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Save updated league
        await db.leagues.replace_one({"id": league_id}, league.dict())
        return league
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating team: {str(e)}")

# Sample NFL players data
@api_router.get("/players/search")
async def search_players(q: str = "", position: str = "", limit: int = 50):
    """Search players by name, position, or team - now using real CSV data"""
    try:
        # Load CSV data from the public URL
        csv_url = "https://customer-assets.emergentagent.com/job_draft-wizard-2/artifacts/3gaj8jfg_ETR_New_Rankings_Redraft_PPR.csv"
        response = requests.get(csv_url)
        csv_data = StringIO(response.text)
        
        players = []
        csv_reader = csv.DictReader(csv_data)
        
        for row in csv_reader:
            # Clean and parse the data
            player = {
                "name": row["Name"].strip('"'),
                "position": row["Position"].strip('"'),
                "nfl_team": row["Team"].strip('"'),
                "etr_rank": int(row["ETR Rank"]) if row["ETR Rank"].strip('"') else None,
                "adp": float(row["ADP"]) if row["ADP"].strip('"') else None,
                "pos_rank": row["Pos Rank ETR"].strip('"')
            }
            players.append(player)
        
        # Filter players based on search criteria
        filtered_players = []
        search_query = q.lower() if q else ""
        
        for player in players:
            # Check name match
            name_match = search_query in player["name"].lower() if search_query else True
            # Check team match
            team_match = search_query in player["nfl_team"].lower() if search_query else True
            # Check position match
            position_match = not position or player["position"] == position
            
            if (name_match or team_match) and position_match:
                filtered_players.append(player)
                
            if len(filtered_players) >= limit:
                break
        
        # Sort by ETR rank
        filtered_players.sort(key=lambda x: x["etr_rank"] if x["etr_rank"] else 999)
        
        return filtered_players[:limit]
        
    except Exception as e:
        # Fallback to sample data if CSV loading fails
        sample_players = [
            {"name": "Josh Allen", "position": "QB", "nfl_team": "BUF", "etr_rank": 40, "adp": 23.6, "pos_rank": "QB01"},
            {"name": "Christian McCaffrey", "position": "RB", "nfl_team": "SF", "etr_rank": 7, "adp": 9.4, "pos_rank": "RB04"},
            {"name": "Ja'Marr Chase", "position": "WR", "nfl_team": "CIN", "etr_rank": 1, "adp": 1.0, "pos_rank": "WR01"},
            {"name": "Travis Kelce", "position": "TE", "nfl_team": "KC", "etr_rank": 79, "adp": 62.8, "pos_rank": "TE06"},
            {"name": "Brandon Aubrey", "position": "K", "nfl_team": "DAL", "etr_rank": 151, "adp": 111.2, "pos_rank": "K01"},
            {"name": "DEN DST", "position": "DST", "nfl_team": "DEN", "etr_rank": 150, "adp": 114.0, "pos_rank": "DST01"},
        ]
        
        # Filter fallback data
        filtered_players = []
        for player in sample_players:
            if (not q or q.lower() in player["name"].lower() or q.lower() in player["nfl_team"].lower()) and \
               (not position or player["position"] == position):
                filtered_players.append(player)
        
        return filtered_players[:limit]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()