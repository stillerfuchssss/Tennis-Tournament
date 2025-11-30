import { useState, useEffect, useMemo } from 'react';

import {

Trophy, Users, Plus, Trash2, Activity,

Medal, UserPlus,

CheckCircle2, AlertCircle, X, ChevronRight, ChevronLeft, PlayCircle,

Search, Calendar, Settings, Unlock, ShieldCheck,

ClipboardList, UserCheck, XCircle, LayoutList, CalendarDays,

PlusCircle, Database, Loader2, Info, Filter, HardDrive,

Bell, GitFork, Shuffle,  UserCog, Edit2, Check, TrendingUp,

BarChart3, Scale, Users2, Table2, ArrowRightCircle, 

} from 'lucide-react';
// --- SERVER CONNECTION ---
// Wenn wir lokal entwickeln (localhost), nutzen wir Port 3000. 
// Auf dem echten Server (Production) nutzen wir den gleichen Pfad.
const API_URL = import.meta.env.DEV ? 'http://localhost:3000' : '';

const apiSave = async (key: string, data: any) => {
  try {
    await fetch(`${API_URL}/api/storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: data })
    });
  } catch (e) {
    console.error("Speicherfehler:", e);
  }
};

const apiLoad = async (key: string) => {
  try {
    const res = await fetch(`${API_URL}/api/storage/${key}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("Ladefehler:", e);
  }
  return null;
};


// --- HELPER ---

const generateId = () => {

return Date.now().toString(36) + Math.random().toString(36).substr(2);

};



const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Passwort-Hashing (SHA-256 über Web Crypto API)

const hashPassword = async (password: string): Promise<string> => {

const enc = new TextEncoder();

const data = enc.encode(password);

const hashBuffer = await crypto.subtle.digest('SHA-256', data);

const hashArray = Array.from(new Uint8Array(hashBuffer));

// in Hex-String umwandeln

const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

return hashHex;

};





// --- KONSTANTEN ---

type Level = 'A' | 'B' | 'C';
type AgeGroup = 'Red' | 'Orange' | 'Green' | 'Yellow';
type ScoringMode = 'sets' | 'race4' | 'race10' | 'race15';
type PlannerTab = 'ranking' | 'bracket' | 'planner' | 'players' | 'register' | 'input' | 'admin';

const LEVEL_LABELS: Record<Level, string> = {
  A: 'A - Turniererfahren',
  B: 'B - Mittelstufe',
  C: 'C - Einsteiger'
};
const LEVEL_COLORS: Record<Level, string> = {
  A: 'bg-red-100 text-red-800 border border-red-200',
  B: 'bg-amber-100 text-amber-800 border border-amber-200',
  C: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
};

const AGE_GROUP_ORDER: AgeGroup[] = ['Red', 'Orange', 'Green', 'Yellow'];
const AGE_GROUP_RULES: { id: AgeGroup; fromYear: number; toYear?: number; description: string }[] = [
  { id: 'Red', fromYear: 2017, description: '2017 und juenger' },
  { id: 'Orange', fromYear: 2016, toYear: 2016, description: '2016 und juenger' },
  { id: 'Green', fromYear: 2014, toYear: 2015, description: '2014 und juenger' },
  { id: 'Yellow', fromYear: 2011, toYear: 2013, description: '2013 bis 2011' },
];
const AGE_STAGE_LABELS: Record<AgeGroup, string> = {
  Red: 'Kleinfeld',
  Orange: 'Midcourt',
  Green: 'Bambini',
  Yellow: 'Grossfeld'
};

const formatAgeGroupLabel = (ageGroup: AgeGroup) => {
  const rule = AGE_GROUP_RULES.find(r => r.id === ageGroup);
  const stage = AGE_STAGE_LABELS[ageGroup] ? ` - ${AGE_STAGE_LABELS[ageGroup]}` : '';
  return rule ? `${ageGroup} (${rule.description})${stage}` : `${ageGroup}${stage}`;
};
const AGE_RANK: Record<AgeGroup, number> = { Red: 0, Orange: 1, Green: 2, Yellow: 3 };


// --- TYPEN ---

type Player = {

id: string;

name: string;

birthDate: string;

level?: Level;
manualAgeGroup?: AgeGroup;
club?: string;
email?: string;

isTestData?: boolean;

isTeam?: boolean;

memberIds?: string[];

};


type AdminAccount = {

id: string;

username: string;

password: string;

isSuperAdmin?: boolean;

};



type RegistrationRequest = {

id: string;

name: string;

birthDate: string;

level?: Level;
club?: string;
email?: string;

desiredTournamentId?: string;

desiredRoundIds?: string[];

timestamp: number;

};



type TournamentRound = {

id: string;

name: string;

date: string;

};



type Tournament = {

id: string;

name: string;

date: string;

isActive: boolean;

isTestData?: boolean;

rounds: TournamentRound[];

mode?: 'singles' | 'doubles';

};



type TournamentResult = {

id: string;

playerId: string;

tournamentId: string;

isTestData?: boolean;

matches: MatchRecord[];

};

type GroupPlayer = {
    id: string;
    name: string;
    ageGroup: string;
    level?: Level;
};



type MatchRecord = {

id: string;

roundId?: string;

opponentId: string;

opponentName: string;

score: string;

isWin: boolean;

isCloseLoss: boolean;

timestamp: number;
scoringMode?: ScoringMode;
levelAtMatch?: Level;

};



type BracketMatch = {

id: string;

p1: Player | null;

p2: Player | null;

winner: Player | null;

};



type GroupMatch = {

id: string;

p1: Player;

p2: Player;

winner: Player | null;

score: string;

};

type PlannedMatch = {
  id: string;
  ageGroup: AgeGroup;
  level: Level;
  round: number;
  p1Id: string;
  p2Id: string;
};



type Group = {

name: string;

players: Player[];

matches: GroupMatch[];

};



type Bracket = {

type: 'ko' | 'group';

rounds?: BracketMatch[][];

groups?: Group[];

ageGroup: string;

tournamentId: string;
level?: Level;

};



type ToastMsg = {

id: string;

message: string;

type: 'success' | 'error' | 'info';

};



// --- DATA SERVICE (LOCAL STORAGE) ---

const STORAGE_KEYS = {

PLAYERS: 'tm_players',

TOURNAMENTS: 'tm_tournaments',

RESULTS: 'tm_results',

REGISTRATIONS: 'tm_registrations',

BRACKETS: 'tm_brackets_map', // Changed from single bracket to map

ADMINS: 'tm_admins',
PLANNER: 'tm_planner_fixtures'

};



const TennisManager = () => {

// --- STATE ---

const [isAdmin, setIsAdmin] = useState(false);

const [currentUser, setCurrentUser] = useState<string>('');


// Login Inputs

const [adminUsernameInput, setAdminUsernameInput] = useState('');

const [adminPasswordInput, setAdminPasswordInput] = useState('');



// Data

const [players, setPlayers] = useState<Player[]>([]);

const [pendingRegistrations, setPendingRegistrations] = useState<RegistrationRequest[]>([]);

const [tournaments, setTournaments] = useState<Tournament[]>([]);

const [results, setResults] = useState<TournamentResult[]>([]);


// NEW: Multi-Bracket State

const [brackets, setBrackets] = useState<Record<string, Bracket>>({});


const [admins, setAdmins] = useState<AdminAccount[]>([]);


// UI State

const [activeTab, setActiveTab] = useState<PlannerTab>('ranking');

const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

const [showPointsInfo, setShowPointsInfo] = useState(false);
const [editPlayerLevel, setEditPlayerLevel] = useState<Level>('C');
const [editPlayerAgeGroup, setEditPlayerAgeGroup] = useState<AgeGroup | 'auto'>('auto');
const [editPlayerClub, setEditPlayerClub] = useState('');
const [editPlayerEmail, setEditPlayerEmail] = useState('');


// Toasts & Dialogs

const [toasts, setToasts] = useState<ToastMsg[]>([]);

const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);



// Ranking Filters

const [rankingScope, setRankingScope] = useState<string>('overall');

const [rankingRoundScope, setRankingRoundScope] = useState<string>('all');

const [rankingAgeGroup, setRankingAgeGroup] = useState<string>('All');
const [rankingLevelFilter, setRankingLevelFilter] = useState<Level | 'All'>('All');

const [rankingSearchQuery, setRankingSearchQuery] = useState('');

const [currentPage, setCurrentPage] = useState(1);

const ITEMS_PER_PAGE = 50;


// Players List Filters & Team Creation

const [playersListSearch, setPlayersListSearch] = useState('');

const [playersListAgeFilter, setPlayersListAgeFilter] = useState('All');

const [isCreatingTeam, setIsCreatingTeam] = useState(false);

const [teamMember1, setTeamMember1] = useState('');

const [teamMember2, setTeamMember2] = useState('');

const [teamSearch1, setTeamSearch1] = useState('');

const [teamSearch2, setTeamSearch2] = useState('');



// Input Filters

const [inputAgeGroupFilter, setInputAgeGroupFilter] = useState<string>('All');

const [inputPlayerSearch, setInputPlayerSearch] = useState('');

const [inputOpponentSearch, setInputOpponentSearch] = useState('');



// Registration Inputs

const [regName, setRegName] = useState('');

const [regBirthDate, setRegBirthDate] = useState('');

const [regLevel, setRegLevel] = useState<Level>('C');
const [regClub, setRegClub] = useState('');
const [regEmail, setRegEmail] = useState('');

const [regTournamentId, setRegTournamentId] = useState('');

const [regSelectedRounds, setRegSelectedRounds] = useState<string[]>([]);

const [showRegSuccess, setShowRegSuccess] = useState(false);



// Admin Inputs

const [newTournamentName, setNewTournamentName] = useState('');

const [newTournamentDate, setNewTournamentDate] = useState(new Date().toISOString().split('T')[0]);

const [addingRoundToTournamentId, setAddingRoundToTournamentId] = useState<string | null>(null);

const [newRoundName, setNewRoundName] = useState('');

const [newRoundDate, setNewRoundDate] = useState('');

const [newAdminUser, setNewAdminUser] = useState('');

const [newAdminPass, setNewAdminPass] = useState('');



// Match Inputs

const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');

const [selectedRoundId, setSelectedRoundId] = useState<string>('');

const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');

const [sets, setSets] = useState<{p1: string, p2: string}[]>([{p1: '', p2: ''}]);

const [matchAnalysis, setMatchAnalysis] = useState<{isWin: boolean, isCloseLoss: boolean, message: string} | null>(null);

const [roundError, setRoundError] = useState(false);
const [scoringMode, setScoringMode] = useState<ScoringMode>('race10');
const selectedPlayerLevel = players.find(p => p.id === selectedPlayerId)?.level || null;



// Bracket Inputs & View

const [activeBracketAge, setActiveBracketAge] = useState<AgeGroup>('Red'); // The tab currently viewed in Brackets
const [activeBracketLevel, setActiveBracketLevel] = useState<Level>('C'); // Match only within level

const [bracketSize, setBracketSize] = useState<number>(8);

const [bracketType, setBracketType] = useState<'ko' | 'group'>('ko');

const [groupSizeInput, setGroupSizeInput] = useState<number>(4);
const [groupMatchMode, setGroupMatchMode] = useState<'auto' | 'single' | 'double'>('auto');

// Planner Tab
const [plannerFixtures, setPlannerFixtures] = useState<Record<string, PlannedMatch[]>>({});
const [plannerAgeGroup, setPlannerAgeGroup] = useState<AgeGroup>('Red');
const [plannerMatchMode, setPlannerMatchMode] = useState<'auto' | 'single' | 'double'>('auto');
const [plannerScoreInput, setPlannerScoreInput] = useState<Record<string, string>>({});
const [plannerScoringMode, setPlannerScoringMode] = useState<ScoringMode>('race10');
const [plannerSelectedPlayerId, setPlannerSelectedPlayerId] = useState('');
  const [plannerPlayerSearch, setPlannerPlayerSearch] = useState('');
  const [plannerNewLevel, setPlannerNewLevel] = useState<Level>('C');



// Generator Config

const [testPlayerCount, setTestPlayerCount] = useState(200);

const [testMatchesPerPlayer, setTestMatchesPerPlayer] = useState(4);

const [isGenerating, setIsGenerating] = useState(false);

const [generationStatus, setGenerationStatus] = useState('');



// --- INITIAL LOAD ---

// --- INITIAL LOAD ---
useEffect(() => {
  const loadData = async () => {
    // HIER ÄNDERN WIR WAS:
    
    // Wir laden alles parallel vom Server
    const [p, t, r, reg, bMap, a, planner] = await Promise.all([
       apiLoad(STORAGE_KEYS.PLAYERS),
       apiLoad(STORAGE_KEYS.TOURNAMENTS),
       apiLoad(STORAGE_KEYS.RESULTS),
       apiLoad(STORAGE_KEYS.REGISTRATIONS),
       apiLoad(STORAGE_KEYS.BRACKETS),
       apiLoad(STORAGE_KEYS.ADMINS),
       apiLoad(STORAGE_KEYS.PLANNER)
    ]);

    if (p) setPlayers(p);
    if (t) {
      setTournaments(t);
      if (t.length > 0 && !selectedTournamentId) setSelectedTournamentId(t[0].id);
    }
    if (r) setResults(r);
    if (reg) setPendingRegistrations(reg);
    if (bMap) setBrackets(bMap);
    if (planner) setPlannerFixtures(planner);
    
    // Admin Init
    if (a) {
      setAdmins(a);
    } else {
      // Default Admin erstellen, falls keiner da ist
      const defaultAdmin: AdminAccount = { 
        id: 'root', 
        username: 'Admin', 
        password: await hashPassword('tennis'), 
        isSuperAdmin: true 
      };
      setAdmins([defaultAdmin]);
      // WICHTIG: Auch gleich speichern!
      apiSave(STORAGE_KEYS.ADMINS, [defaultAdmin]);
    }
  };

  loadData();
}, []);
const saveData = (key: string, data: any) => {
    apiSave(key, data);
  };
const updatePlayers = (newPlayers: Player[]) => {

setPlayers(newPlayers);

saveData(STORAGE_KEYS.PLAYERS, newPlayers);

};



const updateTournaments = (newTournaments: Tournament[]) => {

setTournaments(newTournaments);

saveData(STORAGE_KEYS.TOURNAMENTS, newTournaments);

};



const updateResults = (newResults: TournamentResult[]) => {

setResults(newResults);

saveData(STORAGE_KEYS.RESULTS, newResults);

};



const updateRegistrations = (newRegs: RegistrationRequest[]) => {

setPendingRegistrations(newRegs);

saveData(STORAGE_KEYS.REGISTRATIONS, newRegs);

};


const updateBracketMap = (newBrackets: Record<string, Bracket>) => {

setBrackets(newBrackets);

saveData(STORAGE_KEYS.BRACKETS, newBrackets);

};

const updatePlannerFixtures = (newFixtures: Record<string, PlannedMatch[]>) => {
  setPlannerFixtures(newFixtures);
  saveData(STORAGE_KEYS.PLANNER, newFixtures);
};



// Helper to update a specific bracket

const makeBracketKey = (ageGroup: string, level?: Level | null) => `${ageGroup}-${level || 'all'}`;

const updateSingleBracket = (ageGroup: string, bracketData: Bracket | null, level?: Level) => {

const newMap = { ...brackets };
const key = makeBracketKey(ageGroup, level || bracketData?.level);

if (bracketData) {

newMap[key] = bracketData;

} else {

delete newMap[key];
delete newMap[ageGroup]; // legacy key cleanup

}

updateBracketMap(newMap);

};



const updateAdmins = (newAdmins: AdminAccount[]) => {

setAdmins(newAdmins);

saveData(STORAGE_KEYS.ADMINS, newAdmins);

};



// --- TOAST HELPER ---

const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {

const id = generateId();

setToasts(prev => [...prev, { id, message, type }]);

setTimeout(() => {

setToasts(prev => prev.filter(t => t.id !== id));

}, 3000);

};



const triggerConfirm = (message: string, onConfirm: () => void) => {

setConfirmDialog({ isOpen: true, message, onConfirm });

};



const closeConfirm = () => {

setConfirmDialog(null);

};



// --- LOGIC HELPER ---

useEffect(() => {

setSelectedRoundId('');

setRankingRoundScope('all');

setCurrentPage(1);

}, [selectedTournamentId, rankingScope, rankingAgeGroup, rankingSearchQuery]);



useEffect(() => {

setRegSelectedRounds([]);

}, [regTournamentId]);

useEffect(() => {
if (!viewingPlayer) return;
setEditPlayerLevel(viewingPlayer.level || 'C');
setEditPlayerAgeGroup(viewingPlayer.manualAgeGroup || 'auto');
setEditPlayerClub(viewingPlayer.club || '');
setEditPlayerEmail(viewingPlayer.email || '');
}, [viewingPlayer]);



const calculateAgeGroup = (input: string | Player): AgeGroup => {

const manual = typeof input === 'string' ? undefined : input.manualAgeGroup;
const birthDateStr = typeof input === 'string' ? input : input.birthDate;
if (manual) return manual;

if (!birthDateStr) return "Yellow";

const year = new Date(birthDateStr).getFullYear();
if (!Number.isFinite(year)) return "Yellow";

if (year >= 2017) return "Red";
if (year === 2016) return "Orange";
if (year >= 2014 && year <= 2015) return "Green";

// 2013 bis 2011 (und aelter) laufen in Yellow
return "Yellow";

};

const canPlayInAgeGroup = (player: Player, targetAge: AgeGroup) => {
  const playerAge = calculateAgeGroup(player);
  return AGE_RANK[playerAge] <= AGE_RANK[targetAge]; // juengere d�rfen nach oben, nicht umgekehrt
};



const getSortedAgeGroups = () => {

const groups = new Set(players.map(p => calculateAgeGroup(p)));
const validGroups = AGE_GROUP_ORDER.filter(g => groups.has(g));

const present: (AgeGroup | 'All')[] = ["All", ...validGroups];
AGE_GROUP_ORDER.forEach(d => { if(!present.includes(d)) present.push(d) });

return present;

};

const regPreviewAge = regBirthDate ? formatAgeGroupLabel(calculateAgeGroup(regBirthDate)) : 'wird automatisch zugewiesen';
const displayAgeGroup = (g: AgeGroup | 'All') => g === 'All' ? 'Alle Altersklassen' : formatAgeGroupLabel(g);
const renderLevelBadge = (level?: Level | null, size: 'sm' | 'md' = 'md') => {
  if (!level) return null;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${LEVEL_COLORS[level]} ${sizeClasses}`}>
      Level {level}
    </span>
  );
};



const getLargestGroupCount = (ageGroup: AgeGroup, level?: Level | null) => {
const same = players.filter(p => calculateAgeGroup(p) === ageGroup && (!level || p.level === level));
return Math.max(1, same.length);
};

const getGroupSizeWeight = (participantCount: number, ageGroup: AgeGroup, level?: Level | null) => {

if (participantCount <= 0) return 1;

const maxGroup = getLargestGroupCount(ageGroup, level);
const weight = Math.max(1, maxGroup / participantCount);

return parseFloat(weight.toFixed(2));

};

const getMatchLevel = (match: MatchRecord, fallback?: Level | null) => match.levelAtMatch || fallback || null;

const getPlannerKey = (age: AgeGroup, level: Level) => `${age}-${level}`;

const generateRoundRobin = (ids: string[], mode: 'single' | 'double') => {
  const players = [...ids];
  if (players.length % 2 === 1) players.push('bye');
  const totalRounds = players.length - 1;
  const fixtures: { round: number; p1Id: string; p2Id: string }[] = [];
  for (let r = 0; r < totalRounds; r++) {
    for (let i = 0; i < players.length / 2; i++) {
      const p1 = players[i];
      const p2 = players[players.length - 1 - i];
      if (p1 !== 'bye' && p2 !== 'bye') {
        fixtures.push({ round: r + 1, p1Id: p1, p2Id: p2 });
      }
    }
    // Rotate (keep first fixed)
    const last = players.pop();
    if (last) players.splice(1, 0, last);
  }
  if (mode === 'double') {
    const extra = fixtures.map(f => ({ round: f.round + totalRounds, p1Id: f.p2Id, p2Id: f.p1Id }));
    fixtures.push(...extra);
  }
  return fixtures;
};

const ensurePlannerTournament = (age: AgeGroup, level: Level) => {
  const id = `planner-${age}-${level}`;
  const exists = tournaments.find(t => t.id === id);
  if (exists) return id;
  const newT = {
    id,
    name: `Spielplan ${age}/${level}`,
    date: new Date().toISOString().split('T')[0],
    isActive: false,
    rounds: []
  } as Tournament;
  updateTournaments([...tournaments, newT]);
  return id;
};

const collectPlannerStats = (age: AgeGroup, level: Level) => {
  const eligible = players.filter(p => calculateAgeGroup(p) === age && p.level === level);
  const participantCount = eligible.length;
  const weight = getGroupSizeWeight(participantCount, age, level);
  const stats = eligible.map(p => {
    const res = results.find(r => r.playerId === p.id);
    const matches = res ? res.matches.filter(m => getMatchLevel(m, p.level || null) === level) : [];
    let wins = 0, close = 0, losses = 0;
    // Teilnahme pro Turniertag: wir zählen jedes RoundId einmal, wenn ein Match dort vorliegt
    const roundIds = new Set<string>();
    matches.forEach(m => {
      if (m.isWin) wins++;
      else if (m.isCloseLoss) close++;
      else losses++;
      if (m.roundId) roundIds.add(m.roundId);
    });
    const basePoints = wins * 2 + close * 1;
    const participationPoints = roundIds.size > 0 ? roundIds.size : (matches.length > 0 ? 1 : 0);
    const points = parseFloat((basePoints * weight + participationPoints).toFixed(1));
    return { player: p, wins, losses, close, points, weight, participationPoints };
  });
  return { stats, weight, participantCount };
};

const generatePlannerForAgeGroup = (age: AgeGroup) => {
  const newMap = { ...plannerFixtures };
  (['A','B','C'] as Level[]).forEach(level => {
    const eligible = players.filter(p => calculateAgeGroup(p) === age && p.level === level);
    const mode: 'single' | 'double' = plannerMatchMode === 'auto'
      ? (eligible.length <= 4 ? 'double' : 'single')
      : plannerMatchMode;
    const fixtures = generateRoundRobin(eligible.map(p => p.id), mode).map(f => ({
      id: generateId(),
      ageGroup: age,
      level,
      round: f.round,
      p1Id: f.p1Id,
      p2Id: f.p2Id
    }));
    newMap[getPlannerKey(age, level)] = fixtures;
  });
  updatePlannerFixtures(newMap);
  addToast(`Auslosung für ${displayAgeGroup(age)} aktualisiert`, 'success');
};

const savePlannerResult = (fixture: PlannedMatch) => {
  if (!isAdmin) return;
  const scoreStr = (plannerScoreInput[fixture.id] || '').trim();
  if (!scoreStr) { addToast('Bitte Spielstand eintragen', 'error'); return; }
  const p1 = players.find(p => p.id === fixture.p1Id);
  const p2 = players.find(p => p.id === fixture.p2Id);
  if (!p1 || !p2) { addToast('Spieler nicht gefunden', 'error'); return; }
  const mode = plannerScoringMode;
  const res1 = analyzeSingleScore(scoreStr, mode);
  const res2 = analyzeSingleScore(reverseScoreString(scoreStr), mode);
  const tournamentId = ensurePlannerTournament(fixture.ageGroup, fixture.level);
  let updatedResults = [...results];
  const addMatch = (playerId: string, opponentId: string, opponentName: string, res: {isWin:boolean; isCloseLoss:boolean}) => {
    const matchId = generateId();
    const entry: MatchRecord = {
      id: matchId,
      roundId: `planner-${fixture.round}`,
      opponentId,
      opponentName,
      score: playerId === p1.id ? scoreStr : reverseScoreString(scoreStr),
      isWin: res.isWin,
      isCloseLoss: res.isCloseLoss,
      timestamp: Date.now(),
      scoringMode: mode,
      levelAtMatch: fixture.level
    };
    const idx = updatedResults.findIndex(r => r.playerId === playerId && r.tournamentId === tournamentId);
    if (idx >= 0) {
      updatedResults[idx].matches.push(entry);
    } else {
      updatedResults.push({ id: generateId(), playerId, tournamentId, matches: [entry] });
    }
  };
  addMatch(p1.id, p2.id, p2.name, res1);
  addMatch(p2.id, p1.id, p1.name, res2);
  updateResults(updatedResults);
  const newMap = { ...plannerFixtures };
  newMap[getPlannerKey(fixture.ageGroup, fixture.level)] = (newMap[getPlannerKey(fixture.ageGroup, fixture.level)] || []).filter(f => f.id !== fixture.id);
  updatePlannerFixtures(newMap);
  setPlannerScoreInput(prev => {
    const copy = { ...prev };
    delete copy[fixture.id];
    return copy;
  });
  addToast('Ergebnis gespeichert', 'success');
};

const quickAddPlannerPlayer = () => {
  if (!plannerSelectedPlayerId) {
    addToast('Bitte wählen Sie einen Spieler aus', 'error');
    return;
  }
  const selectedPlayer = players.find(p => p.id === plannerSelectedPlayerId);
  if (!selectedPlayer) {
    addToast('Spieler nicht gefunden', 'error');
    return;
  }
  // Spieler wird zur Planung hinzugefügt (in der Altersgruppe/Level)
  const key = getPlannerKey(plannerAgeGroup, plannerNewLevel);
  const newMatch: PlannedMatch = {
    id: generateId(),
    ageGroup: plannerAgeGroup,
    level: plannerNewLevel,
    round: 1,
    p1Id: selectedPlayer.id,
    p2Id: ''
  };
  setPlannerFixtures({
    ...plannerFixtures,
    [key]: [...(plannerFixtures[key] || []), newMatch]
  });
  setPlannerSelectedPlayerId('');
  setPlannerNewLevel('C');
  addToast(`${selectedPlayer.name} hinzugefügt`, 'success');
};



// --- TEAM CREATION ---

const handleCreateTeam = () => {

if (!teamMember1 || !teamMember2 || teamMember1 === teamMember2) {

addToast("Bitte zwei unterschiedliche Spieler wählen", "error");

return;

}

const p1 = players.find(p => p.id === teamMember1);

const p2 = players.find(p => p.id === teamMember2);

if (!p1 || !p2) return;



const teamName = `${p1.name} / ${p2.name}`;

const newTeam: Player = {

id: generateId(),

name: teamName,

birthDate: p1.birthDate,

level: p1.level,

isTeam: true,

memberIds: [p1.id, p2.id]

};

updatePlayers([...players, newTeam]);

setIsCreatingTeam(false);

setTeamMember1(''); setTeamMember2('');

setTeamSearch1(''); setTeamSearch2('');

addToast(`Doppel-Team "${teamName}" erstellt`);

};



// --- TOURNAMENT TOOLS LOGIC (Bracket & Groups) ---

const activeBracketKey = makeBracketKey(activeBracketAge, activeBracketLevel);
const activeBracket = brackets[activeBracketKey] || brackets[activeBracketAge];


// Generates Bracket for CURRENTLY SELECTED tab (activeBracketAge)

const generateBracket = (randomize: boolean, playerList?: Player[]) => {

const targetAge = playerList ? activeBracketAge : activeBracketAge; // Simplification, usually same
const targetLevel = activeBracketLevel;


let selectedPlayers: (Player | null)[] = [];

let targetSize = bracketSize;



if (playerList) {

// Transition from Group to KO

const count = playerList.length;

targetSize = 4;

if (count > 4) targetSize = 8;

if (count > 8) targetSize = 16;

if (count > 16) targetSize = 32;

if (count > 32) targetSize = 64;


selectedPlayers = [...playerList];

selectedPlayers = selectedPlayers.filter((p): p is Player => p !== null && p.level === targetLevel);

if (selectedPlayers.length === 0) {
addToast("Keine Spieler in dieser Leistungsklasse f\u00fcr die KO-Phase", "error");
return;
}

if (randomize) selectedPlayers.sort(() => 0.5 - Math.random());

} else {

// Standard Generation

const candidates = players.filter(p => canPlayInAgeGroup(p, targetAge) && p.level === targetLevel);

if (candidates.length === 0) {
addToast("Keine Spieler f\u00fcr diese Alters- und Leistungsklasse", "error");
return;
}

if (randomize) {

const shuffled = [...candidates].sort(() => 0.5 - Math.random());

selectedPlayers = shuffled.slice(0, targetSize);

} else {

selectedPlayers = Array(targetSize).fill(null);

}

}



while (selectedPlayers.length < targetSize) {

selectedPlayers.push(null);

}



const numRounds = Math.log2(targetSize);

const rounds: BracketMatch[][] = [];

const round1: BracketMatch[] = [];

for (let i = 0; i < targetSize; i += 2) {

round1.push({

id: generateId(),

p1: selectedPlayers[i],

p2: selectedPlayers[i+1],

winner: null

});

}

rounds.push(round1);


let matchCount = targetSize / 2;

for (let r = 1; r < numRounds; r++) {

matchCount /= 2;

const roundMatches: BracketMatch[] = [];

for (let m = 0; m < matchCount; m++) {

roundMatches.push({ id: generateId(), p1: null, p2: null, winner: null });

}

rounds.push(roundMatches);

}



updateSingleBracket(targetAge, {

type: 'ko',

rounds,

ageGroup: targetAge,

tournamentId: 'ko-stage-' + generateId(),
level: targetLevel

}, targetLevel);

addToast(`Turnierbaum (${targetAge}) erstellt`);

};



const generateGroups = () => {

const candidates = players.filter(p => canPlayInAgeGroup(p, activeBracketAge) && p.level === activeBracketLevel);

const shuffled = [...candidates].sort(() => 0.5 - Math.random());

if (shuffled.length === 0) {
addToast("Keine passenden Spieler f\u00fcr diese Alters- und Leistungsklasse", "error");
return;
}


const numGroups = Math.ceil(shuffled.length / groupSizeInput);

const groups: Group[] = [];



for (let i = 0; i < numGroups; i++) {

groups.push({

name: `Gruppe ${String.fromCharCode(65 + i)}`,

players: [],

matches: []

});

}



shuffled.forEach((p, idx) => {

groups[idx % numGroups].players.push(p);

});



groups.forEach(g => {

const matchesPerPair = groupMatchMode === 'auto'
  ? (g.players.length <= 4 ? 2 : 1)
  : groupMatchMode === 'double' ? 2 : 1;

for (let i = 0; i < g.players.length; i++) {

for (let j = i + 1; j < g.players.length; j++) {

for (let repeat = 0; repeat < matchesPerPair; repeat++) {

const swap = repeat % 2 === 1;

g.matches.push({

id: generateId(),

p1: swap ? g.players[j] : g.players[i],

p2: swap ? g.players[i] : g.players[j],

winner: null,

score: ''

});

}

}

}

});



updateSingleBracket(activeBracketAge, {

type: 'group',

groups: groups,

ageGroup: activeBracketAge,

tournamentId: 'group-stage-' + generateId(),
level: activeBracketLevel

}, activeBracketLevel);

addToast(`Gruppenphase (${activeBracketAge}) erstellt`);

};



const fillRandomGroupResults = () => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.groups) return;


// Deep copy to trigger re-render properly

const newGroups = currentBracket.groups.map(g => ({

...g,

matches: g.matches.map(m => {

if (m.score) return m; // keep existing




let s1_1 = 6, s1_2 = Math.floor(Math.random() * 5);

if (Math.random() > 0.5) { s1_1 = Math.floor(Math.random() * 5); s1_2 = 6; }


let score = `${s1_1}:${s1_2} `;

if (Math.random() > 0.5) score += "6:4"; else score += "4:6";


const analysis = analyzeSingleScore(score);

let winner = null;

if (analysis.isWin) winner = m.p1;

else winner = m.p2;



return { ...m, score, winner };

})

}));


updateSingleBracket(activeBracketAge, { ...currentBracket, groups: newGroups }, activeBracketLevel);

addToast("Zufallsergebnisse eingetragen");

};



const clearGroupResults = () => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.groups) return;

if (!confirm("Alle Gruppenergebnisse löschen?")) return;


const newGroups = currentBracket.groups.map(g => ({

...g,

matches: g.matches.map(m => ({ ...m, score: '', winner: null }))

}));

updateSingleBracket(activeBracketAge, { ...currentBracket, groups: newGroups }, activeBracketLevel);

addToast("Ergebnisse gelöscht");

};



const calculateGroupStandings = (group: Group) => {

const stats = group.players.map(p => ({

id: p.id,

name: p.name,

wins: 0,

losses: 0,

setsWon: 0,

setsLost: 0,

gamesWon: 0,

gamesLost: 0,

points: 0

}));



group.matches.forEach(m => {

if (!m.score) return;

const p1Stats = stats.find(s => s.id === m.p1.id);

const p2Stats = stats.find(s => s.id === m.p2.id);

if (!p1Stats || !p2Stats) return;



// Simple Win Logic

if (m.winner?.id === m.p1.id) { p1Stats.wins++; p1Stats.points++; p2Stats.losses++; }

else if (m.winner?.id === m.p2.id) { p2Stats.wins++; p2Stats.points++; p1Stats.losses++; }



// Sets & Games Parsing

m.score.split(' ').forEach(setScore => {

const [g1, g2] = setScore.split(/[:\-]/).map(n => parseInt(n));

if (isNaN(g1) || isNaN(g2)) return;


p1Stats.gamesWon += g1; p1Stats.gamesLost += g2;

p2Stats.gamesWon += g2; p2Stats.gamesLost += g1;



if (g1 > g2) { p1Stats.setsWon++; p2Stats.setsLost++; }

else if (g2 > g1) { p2Stats.setsWon++; p1Stats.setsLost++; }

});

});



return stats.sort((a, b) => {

if (b.points !== a.points) return b.points - a.points;

const setDiffA = a.setsWon - a.setsLost;

const setDiffB = b.setsWon - b.setsLost;

if (setDiffA !== setDiffB) return setDiffB - setDiffA;

const gameDiffA = a.gamesWon - a.gamesLost;

const gameDiffB = b.gamesWon - b.gamesLost;

return gameDiffB - gameDiffA;

});

};

const getPlayerById = (id: string | undefined | null): Player | null => {

if (!id) return null;

const p = players.find(pl => pl.id === id);

return p || null;

};



const advanceGroupsToKO = () => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.groups) {

addToast("Keine Gruppenphase für diese Altersklasse vorhanden", "error");

return;

}



// Wir nutzen dein zentrales Confirm-Modal

triggerConfirm(

"KO-Phase aus den aktuellen Tabellenständen generieren? Die Gruppenansicht wird überschrieben.",

() => {

const groups = currentBracket.groups!;

const allStandings = groups.map(g => calculateGroupStandings(g));



// Erste und zweite der Gruppen herausholen

const firsts = allStandings.map(s => s[0]).filter(Boolean);

const seconds = allStandings.map(s => s[1]).filter(Boolean);



const qualifiers: Player[] = [];



// Standard: 1A vs 2B, 1B vs 2C, ..., 1X vs 2A

for (let i = 0; i < firsts.length; i++) {

const first = firsts[i];

if (!first) continue;



const secondIndex = (i + 1) % seconds.length;

const second = seconds[secondIndex];

if (!second) continue;



const p1 = getPlayerById(first.id);

const p2 = getPlayerById(second.id);

if (p1 && p2) {

qualifiers.push(p1, p2);

}

}



// Falls noch zweite übrig sind (z.B. Gruppen mit nur 1 Qualifizierten),

// hängen wir sie hinten dran -> ggf. Freilos im Baum.

seconds.forEach(sec => {

if (!sec) return;

const alreadyIn = qualifiers.some(q => q.id === sec.id);

if (!alreadyIn) {

const p = getPlayerById(sec.id);

if (p) qualifiers.push(p);

}

});



if (qualifiers.length < 2) {

addToast("Zu wenige Spieler für eine KO-Phase", "error");

closeConfirm();

return;

}



// Jetzt KO-Baum aus den Qualifizierten bauen

generateBracket(false, qualifiers);



addToast(`KO-Phase (${activeBracketAge}) aus Gruppen erstellt`, "success");

closeConfirm();

}

);

};





const updateGroupMatch = (groupIndex: number, matchIndex: number, score: string) => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.groups) return;


const newGroups = [...currentBracket.groups];

// Deep copy match to avoid mutation issues

const match = { ...newGroups[groupIndex].matches[matchIndex] };

match.score = score;


const analysis = analyzeSingleScore(score);

if (analysis.isWin) match.winner = match.p1;

else if (analyzeSingleScore(reverseScoreString(score)).isWin) match.winner = match.p2;

else match.winner = null;



newGroups[groupIndex].matches[matchIndex] = match;



updateSingleBracket(activeBracketAge, { ...currentBracket, groups: newGroups }, activeBracketLevel);

};



const advanceBracket = (roundIndex: number, matchIndex: number, winner: Player) => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.rounds) return;


const newRounds = [...currentBracket.rounds];

newRounds[roundIndex][matchIndex].winner = winner;

const nextRoundIndex = roundIndex + 1;

if (nextRoundIndex < newRounds.length) {

const nextMatchIndex = Math.floor(matchIndex / 2);

const isPlayer1Position = matchIndex % 2 === 0;

if (isPlayer1Position) newRounds[nextRoundIndex][nextMatchIndex].p1 = winner;

else newRounds[nextRoundIndex][nextMatchIndex].p2 = winner;

}

updateSingleBracket(activeBracketAge, { ...currentBracket, rounds: newRounds }, activeBracketLevel);

};



const setBracketPlayer = (roundIndex: number, matchIndex: number, slot: 'p1' | 'p2', playerId: string) => {

const currentBracket = activeBracket || brackets[activeBracketAge];

if (!currentBracket || !currentBracket.rounds) return;

const player = players.find(p => p.id === playerId) || null;

const newRounds = [...currentBracket.rounds];

newRounds[roundIndex][matchIndex][slot] = player;

updateSingleBracket(activeBracketAge, { ...currentBracket, rounds: newRounds }, activeBracketLevel);

};



// --- MATCH ANALYSIS LOGIC ---

const reverseScoreString = (scoreStr: string) => {

return scoreStr.split(' ').map(set => {

const [p1, p2] = set.split(':');

return `${p2}:${p1}`;

}).join(' ');

};



const analyzeSingleScore = (scoreStr: string, mode: ScoringMode = 'sets') => {

const cleanScore = scoreStr.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();

if (!cleanScore) return { isWin: false, isCloseLoss: false };

const sets = cleanScore.split(' ');

// Punktemodi (race) werden als Einzel-Set interpretiert
if (mode !== 'sets') {
  const [first] = sets;
  const [aStr, bStr] = (first || '').split(/[:\-]/);
  const p1 = parseInt(aStr);
  const p2 = parseInt(bStr);
  if (isNaN(p1) || isNaN(p2)) return { isWin: false, isCloseLoss: false };
  const isWin = p1 > p2;
  const diff = Math.abs(p1 - p2);
  let isCloseLoss = false;
  if (!isWin) {
    if (mode === 'race4') {
      isCloseLoss = (p2 >= 4 && p1 >= 3 && diff === 1);
    } else if (mode === 'race10') {
      isCloseLoss = (p2 >= 10 && p1 >= 9 && diff === 1);
    } else if (mode === 'race15') {
      isCloseLoss = (p2 >= 15 && p1 >= 12 && diff <= 3);
    } else {
      isCloseLoss = false;
    }
  }
  return { isWin, isCloseLoss };
}

let setsWon = 0;

let setsLost = 0;

let hasCloseSetLoss = false;

let matchTiebreakIsClose = false;



sets.forEach((s, index) => {

const parts = s.split(/[:\-]/);

if (parts.length !== 2) return;

const p1 = parseInt(parts[0]);

const p2 = parseInt(parts[1]);

if (isNaN(p1) || isNaN(p2)) return;



if (p1 > p2) {

setsWon++;

} else {

setsLost++;

const isMatchTiebreak = (sets.length === 3 && index === 2) || (p1 >= 9 || p2 >= 9);

const diff = p2 - p1;

if (isMatchTiebreak) {

if (diff <= 2) matchTiebreakIsClose = true;

} else {

if (diff < 2) hasCloseSetLoss = true;

}

}

});

const isWin = setsWon > setsLost;

const isCloseLoss = !isWin && (hasCloseSetLoss || matchTiebreakIsClose);

return { isWin, isCloseLoss };

};



const updateSet = (index: number, field: 'p1' | 'p2', value: string) => {

if (parseInt(value) < 0) return;

const newSets = [...sets];

newSets[index][field] = value;

setSets(newSets);

};



const addSet = () => setSets([...sets, {p1: '', p2: ''}]);

const removeSet = (index: number) => setSets(sets.filter((_, i) => i !== index));



useEffect(() => {

const scoreStr = sets

.filter(s => s.p1 !== '' && s.p2 !== '')

.map(s => `${s.p1}:${s.p2}`)

.join(' ');



if (!scoreStr) {

setMatchAnalysis(null);

return;

}

const result = analyzeSingleScore(scoreStr, scoringMode);

let message = result.isWin ? "Sieg (+2)" : result.isCloseLoss ? "Knapp (+1)" : "Teilnahme (+0)";

setMatchAnalysis({ ...result, message });

}, [sets, scoringMode]);



// --- ADMIN LOGIC ---

const toggleAdmin = async () => {

if (isAdmin) {

setIsAdmin(false);

setCurrentUser('');

setAdminPasswordInput('');

setAdminUsernameInput('');

setActiveTab('ranking');

addToast('Abgemeldet', 'info');

} else {

const account = admins.find(a => a.username === adminUsernameInput);

if (!account) {

addToast('Falsche Zugangsdaten!', 'error');

return;

}



const inputHash = await hashPassword(adminPasswordInput);



if (inputHash === account.password) { // Vergleich mit gespeichertem Hash

setIsAdmin(true);

setCurrentUser(account.username);

setAdminPasswordInput('');

addToast(`Willkommen, ${account.username}!`);

} else {

addToast('Falsche Zugangsdaten!', 'error');

}

}

};





const handleAddAdmin = async () => {

if (!newAdminUser || !newAdminPass) return;

if (admins.some(a => a.username === newAdminUser)) {

addToast('Benutzername existiert bereits', 'error');

return;

}



const passwordHash = await hashPassword(newAdminPass);



const newAdmin: AdminAccount = {

id: generateId(),

username: newAdminUser,

password: passwordHash, // Hash speichern

isSuperAdmin: false

};

updateAdmins([...admins, newAdmin]);

setNewAdminUser('');

setNewAdminPass('');

addToast('Admin Account erstellt');

};



const handleDeleteAdmin = (id: string) => {

if (!confirm("Diesen Admin Account löschen?")) return;

updateAdmins(admins.filter(a => a.id !== id));

};



// --- ACTIONS ---



const handleRegistration = () => {

if (!regName || !regBirthDate) {

addToast('Bitte Name und Datum ausfuellen', 'error');

return;

}

const trimmedClub = regClub.trim();
const trimmedEmail = regEmail.trim();

const data: RegistrationRequest = {

id: generateId(),

name: regName,

birthDate: regBirthDate,

level: regLevel,
club: trimmedClub || undefined,
email: trimmedEmail || undefined,

desiredTournamentId: regTournamentId,

desiredRoundIds: regSelectedRounds,

timestamp: Date.now()

};

if (isAdmin) {

updatePlayers([...players, { id: generateId(), name: regName, birthDate: regBirthDate, level: regLevel, club: trimmedClub || undefined, email: trimmedEmail || undefined }]);

addToast('Spieler hinzugefuegt');

} else {

updateRegistrations([...pendingRegistrations, data]);

setShowRegSuccess(true);

setTimeout(() => setShowRegSuccess(false), 3000);

addToast('Anmeldung gesendet');

}

setRegName(''); setRegBirthDate(''); setRegTournamentId(''); setRegSelectedRounds([]); setRegLevel('C'); setRegClub(''); setRegEmail('');

};

const approveRegistration = (req: RegistrationRequest) => {

updatePlayers([...players, { id: generateId(), name: req.name, birthDate: req.birthDate, level: req.level, club: req.club, email: req.email }]);

updateRegistrations(pendingRegistrations.filter(r => r.id !== req.id));

addToast(`${req.name} zugelassen`);

};



const rejectRegistration = (id: string) => {

triggerConfirm("Anmeldung wirklich ablehnen?", () => {

updateRegistrations(pendingRegistrations.filter(r => r.id !== id));

addToast('Anmeldung abgelehnt', 'info');

closeConfirm();

});

};



const deletePlayer = (id: string) => {

triggerConfirm("Spieler und ALLE seine Ergebnisse löschen?", () => {

updatePlayers(players.filter(p => p.id !== id));

const cleanResults = results.filter(r => r.playerId !== id);

updateResults(cleanResults);

addToast('Spieler gelöscht', 'info');

closeConfirm();

});

};



const handleUpdateMatchScore = (matchId: string, playerId: string, newScoreRaw: string) => {

if (!newScoreRaw) return;

const newScore = newScoreRaw.trim();

const reversedScore = reverseScoreString(newScore);

const updatedResults = results.map(res => {

const matchIndex = res.matches.findIndex(m => m.id === matchId);

if (matchIndex === -1) return res;



const newMatches = [...res.matches];

const match = newMatches[matchIndex];

const mode = match.scoringMode || scoringMode;

const statsP1 = analyzeSingleScore(newScore, mode);

const statsP2 = analyzeSingleScore(reversedScore, mode);



if (res.playerId === playerId) {

// Update for current player

newMatches[matchIndex] = {

...match,

score: newScore,

isWin: statsP1.isWin,

isCloseLoss: statsP1.isCloseLoss,
scoringMode: mode

};

} else {

// Update for opponent (must be same matchId)

newMatches[matchIndex] = {

...match,

score: reversedScore,

isWin: statsP2.isWin,

isCloseLoss: statsP2.isCloseLoss,
scoringMode: mode

};

}

return { ...res, matches: newMatches };

});



updateResults(updatedResults);

addToast('Spiel aktualisiert');

};



const handleAddTournament = () => {

if (!newTournamentName || !isAdmin) return;

const newTournament: Tournament = {

id: generateId(),

name: newTournamentName,

date: newTournamentDate,

isActive: true,

rounds: []

};

updateTournaments([...tournaments, newTournament]);

setNewTournamentName('');

if (!selectedTournamentId) setSelectedTournamentId(newTournament.id);

addToast('Turnier erstellt');

};



const handleAddRound = (tournamentId: string) => {

if (!newRoundName) return;

const updatedTournaments = tournaments.map(t => {

if (t.id === tournamentId) {

return {

...t,

rounds: [...t.rounds, { id: generateId(), name: newRoundName, date: newRoundDate || t.date }]

};

}

return t;

});

updateTournaments(updatedTournaments);

setNewRoundName(''); setNewRoundDate(''); setAddingRoundToTournamentId(null);

addToast('Spieltag hinzugefügt');

};



const deleteRound = (tournamentId: string, roundId: string) => {

triggerConfirm("Spieltag wirklich löschen?", () => {

const updatedTournaments = tournaments.map(t => {

if (t.id === tournamentId) {

return { ...t, rounds: t.rounds.filter(r => r.id !== roundId) };

}

return t;

});

updateTournaments(updatedTournaments);

addToast('Spieltag gelöscht', 'info');

closeConfirm();

});

};



const deleteTournament = (id: string) => {

if (!isAdmin) return;


triggerConfirm("Turnier und ALLE Ergebnisse endgültig löschen?", () => {

const newResults = results.filter(r => r.tournamentId !== id);

updateResults(newResults);

const newTournaments = tournaments.filter(t => t.id !== id);

updateTournaments(newTournaments);

if (selectedTournamentId === id) setSelectedTournamentId('');

addToast('Turnier gelöscht', 'info');

closeConfirm();

});

};



const handleAddResult = () => {

if (!selectedPlayerId || !selectedTournamentId || !matchAnalysis || !selectedOpponentId) return;

if (!selectedRoundId) { setRoundError(true); return; }

setRoundError(false);



const player1 = players.find(p => p.id === selectedPlayerId);

const player2 = players.find(p => p.id === selectedOpponentId);

if (player1 && player2) {
  const level1 = player1.level;
  const level2 = player2.level;
  if (!level1 || !level2) {
    addToast('Bitte beiden Spielern eine Leistungsklasse (A/B/C) zuweisen, bevor ein Match erfasst wird', 'error');
    return;
  }
  if (level1 !== level2) {
    addToast('Nur identische Leistungsklassen d\u00fcrfen gegeneinander spielen', 'error');
    return;
  }
}

const scoreStr = sets.map(s => `${s.p1}:${s.p2}`).join(' ');

const timestamp = Date.now();

const matchId = generateId();

const levelAtMatchP1 = player1?.level || null;
const levelAtMatchP2 = player2?.level || null;


const matchP1: MatchRecord = {

id: matchId, roundId: selectedRoundId, opponentId: selectedOpponentId,

opponentName: player2 ? player2.name : 'Unbekannt', score: scoreStr,

isWin: matchAnalysis.isWin, isCloseLoss: matchAnalysis.isCloseLoss, timestamp, scoringMode, levelAtMatch: levelAtMatchP1 || undefined

};


const reversedScore = reverseScoreString(scoreStr);

const resultP2 = analyzeSingleScore(reversedScore, scoringMode);

const matchP2: MatchRecord = {

id: matchId, roundId: selectedRoundId, opponentId: selectedPlayerId,

opponentName: player1 ? player1.name : 'Unbekannt', score: reversedScore,

isWin: resultP2.isWin, isCloseLoss: resultP2.isCloseLoss, timestamp, scoringMode, levelAtMatch: levelAtMatchP2 || undefined

};



let updatedResults = [...results];



// P1 Update

const resP1Index = updatedResults.findIndex(r => r.playerId === selectedPlayerId && r.tournamentId === selectedTournamentId);

if (resP1Index >= 0) {

updatedResults[resP1Index].matches.push(matchP1);

} else {

updatedResults.push({ id: generateId(), playerId: selectedPlayerId, tournamentId: selectedTournamentId, matches: [matchP1] });

}



// P2 Update

const resP2Index = updatedResults.findIndex(r => r.playerId === selectedOpponentId && r.tournamentId === selectedTournamentId);

if (resP2Index >= 0) {

updatedResults[resP2Index].matches.push(matchP2);

} else {

updatedResults.push({ id: generateId(), playerId: selectedOpponentId, tournamentId: selectedTournamentId, matches: [matchP2] });

}



updateResults(updatedResults);

setSets([{p1: '', p2: ''}]); setSelectedOpponentId('');

addToast('Ergebnis gespeichert');

};



// --- GENERATOR (SYNCHRON & SCHNELL) ---

const generateTestData = async () => {

if (!isAdmin) return;


setIsGenerating(true);

setGenerationStatus("Erstelle...");

addToast('Generierung gestartet...', 'info');



await delay(100);



const newPlayers = [...players];

const newTournaments = [...tournaments];

const newResults = [...results];



// 1. Turnier

const roundId1 = generateId();

const roundId2 = generateId();

const tId = generateId();


const testTourn: Tournament = {

id: tId,

name: "Test-Cup " + Math.floor(Math.random() * 1000),

date: new Date().toISOString().split("T")[0],

isActive: true,

isTestData: true,

rounds: [

{ id: roundId1, name: "Gruppenphase", date: "2025-06-01" },

{ id: roundId2, name: "Endrunde", date: "2025-06-15" }

]

};

newTournaments.push(testTourn);



// 2. Spieler - Angepasste Jahre für 2025

const ageTemplates = [

{ label: "Red", year: 2018 },

{ label: "Orange", year: 2016 },

{ label: "Green", year: 2014 },

{ label: "Yellow", year: 2012 },

];

const levels: Level[] = ["A", "B", "C"];

const createdPlayers: GroupPlayer[] = [];



const existingTestPlayers = newPlayers.filter(p => p.isTestData).map(p => ({

id: p.id, name: p.name, ageGroup: calculateAgeGroup(p), level: p.level

}));

createdPlayers.push(...existingTestPlayers);



let newPlayerCount = 0;


const remainingNeeded = Math.max(0, testPlayerCount - existingTestPlayers.length);

const perGroup = Math.ceil(remainingNeeded / ageTemplates.length);



for (const tpl of ageTemplates) {

for (let i = 0; i < perGroup; i++) {

if (newPlayers.length >= testPlayerCount + 50) break;



const name = `Test ${tpl.label} ${Math.floor(Math.random() * 90000) + 1000}`;

const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");

const newP: Player = {

id: generateId(),

name,

birthDate: `${tpl.year}-${birthMonth}-01`,

level: levels[Math.floor(Math.random() * 3)],

isTestData: true

};

newPlayers.push(newP);

createdPlayers.push({ id: newP.id, name: newP.name, ageGroup: tpl.label, level: newP.level });

newPlayerCount++;


if (newPlayerCount % 500 === 0) await delay(0);

}

}



// 3. Matches

const rounds = [roundId1, roundId2];

const groups: Record<string, GroupPlayer[]> = {};

createdPlayers.forEach(p => {

const key = `${p.ageGroup}-${p.level || 'X'}`;

if (!groups[key]) groups[key] = [];

groups[key].push(p);

});



let matchCount = 0;


createdPlayers.forEach(p => {

if (!newResults.find(r => r.playerId === p.id && r.tournamentId === tId)) {

newResults.push({

id: generateId(),

playerId: p.id,

tournamentId: tId,

isTestData: true,

matches: []

});

}

});



for (const group of Object.values(groups)) {

if (group.length < 2) continue;


for (const p1 of group) {

const myResultIndex = newResults.findIndex(r => r.playerId === p1.id && r.tournamentId === tId);

const currentMatches = newResults[myResultIndex].matches.length;


if (currentMatches >= testMatchesPerPlayer) continue;



for (let i = 0; i < (testMatchesPerPlayer - currentMatches); i++) {

const p2 = group[Math.floor(Math.random() * group.length)];

if (p1.id === p2.id) continue;



const setsPlayed = Math.random() > 0.3 ? 2 : 3;

let score = "";

for (let s = 0; s < setsPlayed; s++) {

const winner = Math.random() > 0.5 ? 1 : 2;

const isTight = Math.random() > 0.5;

let s1 = 0, s2 = 0;

if (s === 2) {

s1 = winner === 1 ? 10 : isTight ? 8 : 5;

s2 = winner === 2 ? 10 : isTight ? 8 : 5;

} else {

s1 = winner === 1 ? isTight ? 7 : 6 : isTight ? 5 : 2;

s2 = winner === 2 ? isTight ? 7 : 6 : isTight ? 5 : 2;

}

score += `${s1}:${s2} `;

}

score = score.trim();



const round = rounds[Math.floor(Math.random() * rounds.length)];

const matchId = generateId();

const timestamp = Date.now();



const resP1 = analyzeSingleScore(score);

const resP2 = analyzeSingleScore(reverseScoreString(score));



newResults[myResultIndex].matches.push({

id: matchId, roundId: round, opponentId: p2.id, opponentName: p2.name,

score, isWin: resP1.isWin, isCloseLoss: resP1.isCloseLoss, timestamp, scoringMode: 'sets', levelAtMatch: p1.level

});



const p2Index = newResults.findIndex(r => r.playerId === p2.id && r.tournamentId === tId);

if (p2Index >= 0) {

newResults[p2Index].matches.push({

id: matchId, roundId: round, opponentId: p1.id, opponentName: p1.name,

score: reverseScoreString(score), isWin: resP2.isWin, isCloseLoss: resP2.isCloseLoss, timestamp, scoringMode: 'sets', levelAtMatch: p2.level

});

}

matchCount++;

if (matchCount % 500 === 0) await delay(0);

}

}

}



updatePlayers(newPlayers);

updateTournaments(newTournaments);

updateResults(newResults);



setIsGenerating(false);

setGenerationStatus('');

addToast(`Fertig! ${newPlayerCount} Spieler, ${matchCount} Matches generiert.`, 'success');

};



const deleteTestData = () => {

if (!isAdmin) return;


triggerConfirm("Wirklich alle Testdaten löschen?", () => {

const cleanPlayers = players.filter(p => !p.isTestData);

const cleanTournaments = tournaments.filter(t => !t.isTestData);

const cleanResults = results.filter(r => !r.isTestData);



updatePlayers(cleanPlayers);

updateTournaments(cleanTournaments);

updateResults(cleanResults);


addToast('Testdaten vollständig bereinigt', 'success');

closeConfirm();

});

};



// --- RANGLISTE BERECHNUNG ---

const rankingData = useMemo(() => {

let data = players.map(player => {

let totalPoints = 0;

let hasPlayedInScope = false; // Flag für Teilnahme

const details: any[] = [];

const ageGroup = calculateAgeGroup(player);



const relevantTournaments = rankingScope === 'overall'

? tournaments

: tournaments.filter(t => t.id === rankingScope);



relevantTournaments.forEach(tourn => {

const res = results.find(r => r.playerId === player.id && r.tournamentId === tourn.id);

if (!res) return;



const countParticipants = (roundScope: 'all' | string | null, level: Level | null) => {

return players.filter(p => {

if (calculateAgeGroup(p) !== ageGroup) return false;

const r = results.find(rr => rr.playerId === p.id && rr.tournamentId === tourn.id);

if (!r) return false;

return r.matches.some(m => {

const inScope = roundScope === 'all' ? true : roundScope === null ? !m.roundId : m.roundId === roundScope;

const matchLevel = getMatchLevel(m, p.level || null);

return inScope && (level ? matchLevel === level : true);

});

}).length;

};



const aggregateRounds = rankingRoundScope === 'all' && tourn.rounds && tourn.rounds.length > 0;



if (aggregateRounds) {

let aggregatedPoints = 0;

let totalWins = 0;

let totalCL = 0;

let totalMatches = 0;

let participationCount = 0;



tourn.rounds.forEach(round => {

const matchesInRound = res.matches.filter(m => m.roundId === round.id);

if (matchesInRound.length === 0) return;

const roundLevel = getMatchLevel(matchesInRound[0], player.level || null);


// Teilnahme bestätigt (hat Matches in einer Runde dieses Turniers)

       hasPlayedInScope = true;
       participationCount++;

matchesInRound.forEach(m => {

const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

const levelForMatch = getMatchLevel(m, roundLevel);

const matchWeight = getGroupSizeWeight(countParticipants(round.id, levelForMatch), ageGroup as AgeGroup, levelForMatch);

aggregatedPoints += base * matchWeight;

if(m.isWin) totalWins++;

else if(m.isCloseLoss) totalCL++;

});

totalMatches += matchesInRound.length;

});



const matchesNoRound = res.matches.filter(m => !m.roundId);

if(matchesNoRound.length > 0) {

hasPlayedInScope = true; // Hat Matches ohne Runde

matchesNoRound.forEach(m => {

const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

const levelForMatch = getMatchLevel(m, player.level || null);

const w = getGroupSizeWeight(countParticipants(null, levelForMatch), ageGroup as AgeGroup, levelForMatch);

aggregatedPoints += base * w;

if(m.isWin) totalWins++;

else if(m.isCloseLoss) totalCL++;

});

totalMatches += matchesNoRound.length;

}



if (totalMatches > 0) {

const summaryLevel = getMatchLevel(res.matches[0], player.level || null);

const uniqueTournParticipants = countParticipants('all', summaryLevel);

const tournWeight = getGroupSizeWeight(uniqueTournParticipants, ageGroup as AgeGroup, summaryLevel);

aggregatedPoints += Math.max(1, participationCount); // Teilnahme: mind. 1, sonst pro Spieltag

totalPoints += aggregatedPoints;



details.push({

tId: tourn.id, tName: tourn.name,

raw: aggregatedPoints.toFixed(1),

weighted: aggregatedPoints.toFixed(1),

stats: `Teilnahme: ${Math.max(1, participationCount)} ? ${totalWins} S (x${tournWeight.toFixed(2)}) / ${totalCL} KN (x${tournWeight.toFixed(2)})`,

participationPoints: 1, // Ungewichtet

participants: uniqueTournParticipants,

weight: tournWeight.toFixed(2)

});

}



} else {

// Scope: Einzelner Spieltag oder Turnier ohne Runden

const matchesInScope = res.matches.filter(m =>

rankingRoundScope === 'all' || m.roundId === rankingRoundScope

);


if (matchesInScope.length > 0) {

hasPlayedInScope = true; // Hat Matches im gewählten Filter

} else {

return; // Keine Matches im Scope -> weiter zum nächsten Turnier

}



const levelInScope = getMatchLevel(matchesInScope[0], player.level || null);

const participantCount = countParticipants(rankingRoundScope === 'all' ? 'all' : rankingRoundScope, levelInScope);



const groupWeight = getGroupSizeWeight(participantCount, ageGroup as AgeGroup, levelInScope);

let matchPoints = 0;

let wins = 0;

let closeLosses = 0;



matchesInScope.forEach(m => {

const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

const levelForMatch = getMatchLevel(m, levelInScope);

const weight = getGroupSizeWeight(countParticipants(rankingRoundScope === 'all' ? 'all' : rankingRoundScope, levelForMatch), ageGroup as AgeGroup, levelForMatch);

matchPoints += base * weight;

if (m.isWin) wins++; else if (m.isCloseLoss) closeLosses++;

});



const participationPoints = 1; // Teilnahme ungewichtet (dieser Spieltag)

const turnierScore = participationPoints + matchPoints;

totalPoints += turnierScore;


details.push({

tId: tourn.id, tName: tourn.name,

raw: turnierScore.toFixed(1),

weighted: turnierScore.toFixed(1),

stats: `Teilnahme: ${participationPoints} ? ${wins} S (x${groupWeight.toFixed(2)}) / ${closeLosses} KN (x${groupWeight.toFixed(2)})`,

participationPoints: 1, // Ungewichtet

participants: participantCount,

weight: groupWeight.toFixed(2)

});

}

});



return {

...player, ageGroup, totalPoints: parseFloat(totalPoints.toFixed(1)), details, hasPlayedInScope

};

})

// FILTER: Nur Spieler anzeigen, die im Scope gespielt haben (außer bei Gesamtansicht, da zeigen wir alle mit Punkten > 0 oder wenn sie überhaupt mal gespielt haben)

.filter(p => {

if (!p) return false;

if (rankingScope === 'overall') {

return p.hasPlayedInScope || p.totalPoints > 0;

} else {

return p.hasPlayedInScope;

}

});



if (rankingAgeGroup !== 'All') {

data = data.filter(p => p.ageGroup === rankingAgeGroup);

}

if (rankingLevelFilter !== 'All') {
data = data.filter(p => p.level === rankingLevelFilter);
}


if (rankingSearchQuery) {

data = data.filter(p => p.name.toLowerCase().includes(rankingSearchQuery.toLowerCase()));

}



return data.sort((a, b) => b.totalPoints - a.totalPoints);

}, [players, results, tournaments, rankingScope, rankingAgeGroup, rankingLevelFilter, rankingRoundScope, rankingSearchQuery]);





// --- PAGINATION HELPERS ---

const totalPages = Math.ceil(rankingData.length / ITEMS_PER_PAGE);

const paginatedData = rankingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);



// --- FILTERED PLAYERS LIST FOR PLAYERS TAB ---

const filteredPlayersList = useMemo(() => {

if (!players) return [];

return players

.filter(p => !playersListSearch || p.name.toLowerCase().includes(playersListSearch.toLowerCase()))

.filter(p => playersListAgeFilter === 'All' || calculateAgeGroup(p) === playersListAgeFilter)

.sort((a,b) => a.name.localeCompare(b.name));

}, [players, playersListSearch, playersListAgeFilter]);



// --- PLAYER MODAL ---

const PlayerDetailModal = () => {

const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

const [editScoreInput, setEditScoreInput] = useState('');

const [statsView, setStatsView] = useState<'history' | 'stats'>('history');

const [h2hOpponentId, setH2hOpponentId] = useState('');

const [h2hSearch, setH2hSearch] = useState('');



if (!viewingPlayer) return null;

const playerResults = results.filter(r => r.playerId === viewingPlayer.id);



// Calc Stats

const allMatches = playerResults.flatMap(r => r.matches).sort((a,b) => b.timestamp - a.timestamp);

const last5 = allMatches.slice(0, 5);

const totalSetsWon = allMatches.reduce((acc, m) => {

if (!m.score) return acc;

return acc + m.score.split(' ').reduce((sAcc, s) => {

const [p1, p2] = s.split(/[:\-]/).map(n => parseInt(n));

return sAcc + (p1 > p2 ? 1 : 0);

}, 0);

}, 0);

const totalSetsLost = allMatches.reduce((acc, m) => {

if (!m.score) return acc;

return acc + m.score.split(' ').reduce((sAcc, s) => {

const [p1, p2] = s.split(/[:\-]/).map(n => parseInt(n));

return sAcc + (p2 > p1 ? 1 : 0);

}, 0);

}, 0);



const startEdit = (m: MatchRecord) => {

setEditingMatchId(m.id);

setEditScoreInput(m.score);

};



const saveEdit = (m: MatchRecord) => {

handleUpdateMatchScore(m.id, viewingPlayer.id, editScoreInput);

setEditingMatchId(null);

};

const savePlayerMeta = () => {

const manualAge = editPlayerAgeGroup === 'auto' ? undefined : editPlayerAgeGroup;
const cleanedClub = editPlayerClub.trim();
const cleanedEmail = editPlayerEmail.trim();

const updated = players.map(p => p.id === viewingPlayer.id ? { ...p, level: editPlayerLevel, manualAgeGroup: manualAge, club: cleanedClub || undefined, email: cleanedEmail || undefined } : p);

updatePlayers(updated);
const refreshed = updated.find(p => p.id === viewingPlayer.id) || null;
setViewingPlayer(refreshed);
addToast('Spieler aktualisiert');

};



// H2H Logic

const h2hMatches = h2hOpponentId ? allMatches.filter(m => m.opponentId === h2hOpponentId) : [];

const h2hWins = h2hMatches.filter(m => m.isWin).length;



// Filter players for H2H Dropdown

const h2hPlayers = players

.filter(p => p.id !== viewingPlayer.id)

.filter(p => !h2hSearch || p.name.toLowerCase().includes(h2hSearch.toLowerCase()))

.sort((a,b) => a.name.localeCompare(b.name));



return (

<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">

<div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">

<div className="bg-slate-800 text-white p-6 sticky top-0 z-10">

<div className="flex justify-between items-start">

<div>

<h2 className="text-2xl font-bold flex items-center gap-2">

{viewingPlayer.isTeam && <Users2 size={24}/>}

{viewingPlayer.name}

</h2>

<div className="flex gap-2 mt-2 items-center text-slate-300 text-sm">

<span>{formatAgeGroupLabel(calculateAgeGroup(viewingPlayer))}</span>

<span>•</span>

{renderLevelBadge(viewingPlayer.level)}

</div>

</div>

<button onClick={() => setViewingPlayer(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>

</div>


<div className="flex gap-4 mt-6 text-sm font-bold">

<button onClick={() => setStatsView('history')} className={`pb-2 border-b-2 ${statsView === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>Spielverlauf</button>

<button onClick={() => setStatsView('stats')} className={`pb-2 border-b-2 ${statsView === 'stats' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>Statistiken & H2H</button>

</div>

</div>



<div className="p-6">

{isAdmin && (

<div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-4">

<div className="grid md:grid-cols-2 gap-3">

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">Leistungsklasse</label>

<select value={editPlayerLevel} onChange={e => setEditPlayerLevel(e.target.value as Level)} className="w-full p-2 border rounded bg-white text-sm">

<option value="A">{LEVEL_LABELS.A}</option>

<option value="B">{LEVEL_LABELS.B}</option>

<option value="C">{LEVEL_LABELS.C}</option>

</select>

</div>

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">Altersklasse (manuell)</label>

<select value={editPlayerAgeGroup} onChange={e => setEditPlayerAgeGroup(e.target.value as AgeGroup | 'auto')} className="w-full p-2 border rounded bg-white text-sm">

<option value="auto">Automatisch ({formatAgeGroupLabel(calculateAgeGroup(viewingPlayer.birthDate))})</option>

{AGE_GROUP_ORDER.map(g => (

<option key={g} value={g}>{formatAgeGroupLabel(g)}</option>

))}

</select>

</div>

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">Verein</label>

<input type="text" value={editPlayerClub} onChange={e => setEditPlayerClub(e.target.value)} className="w-full p-2 border rounded bg-white text-sm" placeholder="Optional eintragen"/>

</div>

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">E-Mail</label>

<input type="email" value={editPlayerEmail} onChange={e => setEditPlayerEmail(e.target.value)} className="w-full p-2 border rounded bg-white text-sm" placeholder="Optional eintragen"/>

</div>

</div>

<div className="flex justify-end mt-3">

<button onClick={savePlayerMeta} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded">Speichern</button>

</div>

</div>

)}

{statsView === 'history' ? (

playerResults.length === 0 ? (

<p className="text-slate-400 italic">Noch keine Spiele eingetragen.</p>

) : (

<div className="space-y-6">

{tournaments.map(t => {

const r = playerResults.find(res => res.tournamentId === t.id);

if (!r) return null;

return (

<div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden">

<div className="bg-slate-50 p-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between">

<span>{t.name}</span>

<span className="text-slate-400 text-xs font-normal">{new Date(t.date).toLocaleDateString('de-DE')}</span>

</div>

<div className="divide-y divide-slate-100">

{r.matches.map(m => {

const roundName = m.roundId

? t.rounds.find(rd => rd.id === m.roundId)?.name || '?'

: '';


const isEditing = editingMatchId === m.id;



return (

<div key={m.id} className="p-3 flex justify-between items-center hover:bg-slate-50">

<div className="flex-1">

<div className="flex items-center gap-2">

<span className="text-sm font-bold text-slate-800">vs. {m.opponentName}</span>

{roundName && <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">{roundName}</span>}

{!isEditing && (

<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${m.isWin ? 'bg-green-100 text-green-700' : m.isCloseLoss ? 'bg-orange-100 text-orange-700' : 'bg-red-50 text-red-400'}`}>

{m.isWin ? 'Sieg' : m.isCloseLoss ? 'Knapp' : 'Ndlg'}

</span>

)}

</div>

{isEditing ? (

<div className="flex items-center gap-2 mt-2">

<input

type="text"

value={editScoreInput}

onChange={(e) => setEditScoreInput(e.target.value)}

className="border rounded p-1 text-xs w-32 font-mono"

/>

<button onClick={() => saveEdit(m)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16}/></button>

<button onClick={() => setEditingMatchId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={16}/></button>

</div>

) : (

<div className="text-xs text-slate-500 font-mono mt-1">{m.score}</div>

)}

</div>

<div className="flex items-center gap-4">

<div className="text-right font-bold text-emerald-600">

{m.isWin ? '+2' : m.isCloseLoss ? '+1' : '+0'}

</div>

{isAdmin && !isEditing && (

<button onClick={() => startEdit(m)} className="text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>

)}

</div>

</div>

)})}

</div>

</div>

);

})}

</div>

)

) : (

<div className="space-y-6">

<div className="grid grid-cols-2 gap-4">

<div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

<div className="text-xs text-slate-500 uppercase font-bold mb-2 flex items-center gap-1"><TrendingUp size={14}/> Formkurve</div>

<div className="flex gap-1">

{last5.map((m, i) => (

<div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white

${m.isWin ? 'bg-green-500' : m.isCloseLoss ? 'bg-orange-400' : 'bg-red-400'}

`} title={m.score}>

{m.isWin ? 'S' : m.isCloseLoss ? 'K' : 'N'}

</div>

))}

{last5.length === 0 && <span className="text-xs text-slate-400">-</span>}

</div>

</div>

<div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

<div className="text-xs text-slate-500 uppercase font-bold mb-2 flex items-center gap-1"><Scale size={14}/> Satzbilanz</div>

<div className="text-xl font-bold text-slate-700">

{totalSetsWon} : {totalSetsLost}

</div>

</div>

</div>



<div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

<div className="text-xs text-slate-500 uppercase font-bold mb-4 flex items-center gap-1"><BarChart3 size={14}/> Head-to-Head (Direktvergleich)</div>

<input

type="text"

placeholder="Gegner suchen..."

className="w-full p-2 border rounded text-xs mb-2"

value={h2hSearch}

onChange={(e) => setH2hSearch(e.target.value)}

/>

<select className="w-full p-2 border rounded text-sm mb-4" value={h2hOpponentId} onChange={(e) => setH2hOpponentId(e.target.value)}>

<option value="">-- Gegner wählen --</option>

{h2hPlayers.map(p => (

<option key={p.id} value={p.id}>{p.name}</option>

))}

</select>


{h2hOpponentId && (

<div className="text-center animate-in fade-in">

<div className="text-3xl font-bold text-slate-800 mb-1">{h2hWins} : {h2hMatches.length - h2hWins}</div>

<div className="text-xs text-slate-500">{h2hMatches.length} Spiele gesamt</div>

<div className="mt-4 space-y-2 text-left">

{h2hMatches.map(m => (

<div key={m.id} className="text-xs flex justify-between border-b pb-1 border-slate-200">

<span>{new Date(m.timestamp).toLocaleDateString()}</span>

<span className="font-mono">{m.score}</span>

<span className={m.isWin ? 'text-green-600 font-bold' : 'text-red-500'}>{m.isWin ? 'Sieg' : 'Ndlg'}</span>

</div>

))}

</div>

</div>

)}

</div>

</div>

)}

</div>

</div>

</div>

);

};



// --- CONFIRM DIALOG ---

const ConfirmModal = () => {

if (!confirmDialog || !confirmDialog.isOpen) return null;

return (

<div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in">

<div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95">

<div className="flex items-center gap-3 mb-4 text-red-600">

<AlertCircle size={24}/>

<h3 className="text-lg font-bold">Bestätigung</h3>

</div>

<p className="text-slate-600 mb-6">{confirmDialog.message}</p>

<div className="flex justify-end gap-3">

<button onClick={closeConfirm} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Abbrechen</button>

<button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200">Ja, ausführen</button>

</div>

</div>

</div>

);

};



// --- TOASTS COMPONENT ---

const ToastContainer = () => {

return (

<div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">

{toasts.map(toast => (

<div key={toast.id} className={`p-4 rounded-xl shadow-xl flex items-center gap-3 min-w-[300px] animate-in slide-in-from-right-full transition-all pointer-events-auto

${toast.type === 'success' ? 'bg-emerald-600 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}

`}>

{toast.type === 'success' ? <CheckCircle2 size={20}/> : toast.type === 'error' ? <XCircle size={20}/> : <Bell size={20}/>}

<span className="font-medium text-sm">{toast.message}</span>

</div>

))}

</div>

);

};



// --- RENDER ---

return (

<div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-2 md:p-6 pb-24 md:pb-6 relative">

<PlayerDetailModal />

<ConfirmModal />

<ToastContainer />



<div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">


{/* HEADER */}

<div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">

<div className="flex flex-col md:flex-row justify-between items-center gap-4">

<div>

<h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">

<Trophy className="w-8 h-8 text-yellow-400" />

Tennis Turnier Manager

</h1>

<p className="text-slate-400 text-xs mt-1 ml-11 flex items-center gap-2">

{isAdmin ? <><ShieldCheck size={12} className="text-emerald-400"/> Admin: {currentUser}</> : 'ðŸ‘ï¸ Zuschauer Modus'}

<span className="bg-white/20 px-2 py-0.5 rounded ml-2 flex items-center gap-1"><HardDrive size={10}/> Local Storage</span>

</p>

</div>



<div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg backdrop-blur-sm w-full md:w-auto">

{!isAdmin ? (

<div className="flex gap-2 w-full md:w-auto">

<input type="text" placeholder="Admin User" className="bg-transparent border-b border-slate-500 focus:border-white focus:outline-none text-white text-sm placeholder-slate-500 w-24 px-1"

value={adminUsernameInput} onChange={(e) => setAdminUsernameInput(e.target.value)} />

<input type="password" placeholder="Passwort" className="bg-transparent border-b border-slate-500 focus:border-white focus:outline-none text-white text-sm placeholder-slate-500 w-24 px-1"

value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />

<button onClick={toggleAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded transition ml-2">Login</button>

</div>

) : (

<button onClick={toggleAdmin} className="flex items-center gap-2 text-xs text-red-300 hover:text-red-100 px-3 py-1"><Unlock size={14}/> Abmelden</button>

)}

</div>

</div>

</div>



{/* NAVIGATION */}

<div className="flex border-b border-slate-200 overflow-x-auto bg-white sticky top-0 z-10 scrollbar-hide">

<button onClick={() => setActiveTab('ranking')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'ranking' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<Medal size={18} /> Rangliste

</button>

<button onClick={() => setActiveTab('bracket')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'bracket' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

Turnier ({displayAgeGroup(activeBracketAge)} / Level {activeBracketLevel})

</button>

<button onClick={() => setActiveTab('planner')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'planner' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<Calendar className="text-emerald-600" size={18}/> Spielplan

</button>

<button onClick={() => setActiveTab('players')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'players' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<Users size={18} /> Spieler

</button>

<button onClick={() => setActiveTab('register')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'register' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<ClipboardList size={18} /> {isAdmin ? 'Spieler Hinzufügen' : 'Anmeldung'}

</button>

{isAdmin && (

<>

<button onClick={() => setActiveTab('input')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'input' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<Activity size={18} /> Eingabe

</button>

<button onClick={() => setActiveTab('admin')} className={`flex-1 py-4 px-4 min-w-[120px] font-medium flex justify-center gap-2 border-b-2 transition ${activeTab === 'admin' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>

<Settings size={18} /> Verwaltung {pendingRegistrations.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{pendingRegistrations.length}</span>}

</button>

</>

)}

</div>



{/* CONTENT AREA */}

<div className="p-4 md:p-8 min-h-[600px]">


{/* --- TAB: RANGLISTE --- */}

{activeTab === 'ranking' && (

<div className="space-y-6 animate-in fade-in">

<div className="flex flex-col xl:flex-row xl:flex-wrap gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 items-stretch xl:items-center">


<div className="flex flex-col gap-2 w-full md:w-auto">

<div className="flex items-center gap-2">

<LayoutList className="text-slate-400" size={20}/>

<select value={rankingScope} onChange={(e) => setRankingScope(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-auto">

<option value="overall">ðŸ† Gesamtwertung</option>

<optgroup label="Einzelne Turniere">

{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

</optgroup>

</select>

</div>


{rankingScope !== 'overall' && (

<div className="ml-7">

<select value={rankingRoundScope} onChange={(e) => setRankingRoundScope(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none w-full">

<option value="all">Alle Spieltage</option>

{tournaments.find(t => t.id === rankingScope)?.rounds.map(r => (

<option key={r.id} value={r.id}>{r.name} ({r.date})</option>

))}

</select>

</div>

)}

</div>



<div className="relative w-full xl:w-80 xl:flex-1">

<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />

<input type="text" placeholder="Spieler suchen..." value={rankingSearchQuery} onChange={(e) => setRankingSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />

</div>



<div className="w-full xl:w-auto flex gap-2">
<select value={rankingAgeGroup} onChange={e => setRankingAgeGroup(e.target.value)} className="flex-1 p-2 border rounded-lg bg-white text-sm">
{getSortedAgeGroups().map(group => (
<option key={group} value={group}>{displayAgeGroup(group)}</option>
))}
</select>
<select value={rankingLevelFilter} onChange={e => setRankingLevelFilter(e.target.value as Level | 'All')} className="w-32 min-w-[8rem] p-2 border rounded-lg bg-white text-sm">
<option value="All">Alle Level</option>
<option value="A">{LEVEL_LABELS.A}</option>
<option value="B">{LEVEL_LABELS.B}</option>
<option value="C">{LEVEL_LABELS.C}</option>
</select>
</div>

</div>



<div className="flex justify-end">

<button onClick={() => setShowPointsInfo(!showPointsInfo)} className="text-xs text-slate-500 flex items-center gap-1 hover:text-emerald-600">

<Info size={14}/> Wie werden Punkte berechnet?

</button>

</div>


{showPointsInfo && (

<div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-slate-700 animate-in fade-in slide-in-from-top-2">

<h4 className="font-bold mb-2 text-blue-800">Fair-Play Punktesystem:</h4>

<ul className="list-disc pl-5 space-y-1">

<li><b>Sieg:</b> 2 Punkte (x Gruppengewicht)</li>

<li><b>Knappe Niederlage:</b> 1 Punkt (x Gruppengewicht)</li>

<li><b>Teilnahme:</b> 1 Punkt (ohne Gewichtung)</li>

<li><b>Gruppengewicht:</b> Basis ist die groesste Gruppe gleicher Alters- & Leistungsklasse. Kleinere Gruppen bekommen mehr Punkte (bis Faktor 1.5), grosse Gruppen werden nicht bestraft (min 1.0).</li>
<li><b>Zaehlweisen:</b> Race-4 (knapp bei 4:3), Race-10 (knapp bei 10:9), Race-15 (knapp bis max. 2-3 Punkte Differenz ab 15).</li>

</ul>

</div>

)}



<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

<div className="overflow-x-auto">

<table className="w-full text-left">

<thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">

<tr>

<th className="p-4 w-16 text-center">Rang</th>

<th className="p-4">Spieler</th>

<th className="p-4">Altersklasse</th>

<th className="p-4 text-right">Punkte</th>

<th className="p-4 w-10"></th>

</tr>

</thead>

<tbody className="divide-y divide-slate-100">

{paginatedData.length === 0 ? (

<tr><td colSpan={5} className="p-8 text-center text-slate-400">Keine Spieler gefunden {rankingScope !== 'overall' ? 'für diesen Zeitraum' : ''}.</td></tr>

) : (

paginatedData.map((player, idx) => {

const realRank = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;

return (

<tr key={player.id} onClick={() => setViewingPlayer(player)} className="hover:bg-slate-50 cursor-pointer transition group">

<td className="p-4 text-center">

<span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold text-sm ${realRank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'text-slate-400'}`}>{realRank}</span>

</td>

<td className="p-4">

<div className="font-bold text-slate-800 text-lg flex items-center gap-2">

{player.isTeam && <Users2 size={16} className="text-blue-500"/>}

{player.name}

</div>

{renderLevelBadge(player.level, 'sm')}

</td>

<td className="p-4 text-sm text-slate-500">

<span className="bg-slate-100 px-2 py-1 rounded font-medium">{player.ageGroup}</span>

</td>

<td className="p-4 text-right">

<span className="text-2xl font-bold text-slate-800">{player.totalPoints}</span>

<div className="text-[10px] text-slate-400 mt-1">

{player.details[0]?.participationPoints ? `+${player.details[0].participationPoints} Teilnahme • ` : ''}

{player.details[0]?.stats}

</div>

</td>

<td className="p-4 text-slate-300 group-hover:text-emerald-500"><ChevronRight size={20}/></td>

</tr>

)})

)}

</tbody>

</table>

</div>


{/* Pagination Controls */}

{rankingData.length > 0 && (

<div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">

<div className="text-xs text-slate-500">

Seite {currentPage} von {Math.max(1, totalPages)} • {rankingData.length} Spieler

</div>

<div className="flex gap-2">

<button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"><ChevronLeft size={16}/></button>

<button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage >= totalPages} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"><ChevronRight size={16}/></button>

</div>

</div>

)}

</div>

</div>

)}



{/* --- TAB: BRACKET & GROUPS --- */}

{activeTab === 'bracket' && (

<div className="animate-in fade-in space-y-4">

<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

<div className="flex justify-between items-center mb-6">

<h2 className="text-xl font-bold flex items-center gap-2">

{activeBracket?.type === 'group' ? <Table2 className="text-emerald-600"/> : <GitFork className="text-emerald-600"/>}

Turnier ({displayAgeGroup(activeBracketAge)} / Level {activeBracketLevel})

</h2>

{isAdmin && activeBracket && (

<button onClick={() => updateSingleBracket(activeBracketAge, null, activeBracketLevel)} className="text-red-500 text-sm hover:underline">Aktuellen Plan löschen</button>

)}

</div>

<div className="grid md:grid-cols-2 gap-3 mb-4">
<div>
<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Altersklasse</label>
<select value={activeBracketAge} onChange={(e) => setActiveBracketAge(e.target.value as AgeGroup)} className="w-full p-2 border rounded bg-slate-50">
{getSortedAgeGroups().filter(g => g !== "All").map(g => (
<option key={g} value={g}>{displayAgeGroup(g)}</option>
))}
</select>
</div>
<div>
<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Leistungsklasse</label>
<select value={activeBracketLevel} onChange={(e) => setActiveBracketLevel(e.target.value as Level)} className="w-full p-2 border rounded bg-slate-50">
<option value="A">{LEVEL_LABELS.A}</option>
<option value="B">{LEVEL_LABELS.B}</option>
<option value="C">{LEVEL_LABELS.C}</option>
</select>
</div>
</div>

<p className="text-sm text-slate-600 mb-4">Turnier-Übersicht: alle Gruppen dieser Alters- und Leistungsklasse auf einer Seite. Gruppenspiele fließen in die Rangliste ein.</p>


{!activeBracket ? (

isAdmin ? (

<div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">

<div>

<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Modus</label>

<select value={bracketType} onChange={(e) => setBracketType(e.target.value as 'ko' | 'group')} className="p-2 border rounded w-32 text-sm">

<option value="ko">K.O.-System</option>

<option value="group">Gruppenphase</option>

</select>

</div>

<div>

<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Leistungsklasse</label>

<select value={activeBracketLevel} onChange={(e) => setActiveBracketLevel(e.target.value as Level)} className="p-2 border rounded w-40 text-sm">

<option value="A">{LEVEL_LABELS.A}</option>

<option value="B">{LEVEL_LABELS.B}</option>

<option value="C">{LEVEL_LABELS.C}</option>

</select>

</div>

{bracketType === 'ko' ? (

<div>

<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Größe</label>

<select value={bracketSize} onChange={(e) => setBracketSize(parseInt(e.target.value))} className="p-2 border rounded w-32 text-sm">

<option value="4">4 (Halbfinale)</option>

<option value="8">8 (Viertelfinale)</option>

<option value="16">16 (Achtelfinale)</option>

<option value="32">32 Spieler</option>

<option value="64">64 Spieler</option>

</select>

</div>

) : (

<div>

<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Spieler / Gruppe</label>

<input type="number" min="3" max="10" value={groupSizeInput} onChange={e => setGroupSizeInput(parseInt(e.target.value))} className="p-2 border rounded w-24 text-sm" />

</div>

)}

{bracketType === 'group' && (

<div>

<label className="text-xs font-bold text-slate-500 uppercase block mb-1">Matches je Gegner</label>

<select value={groupMatchMode} onChange={e => setGroupMatchMode(e.target.value as 'auto' | 'single' | 'double')} className="p-2 border rounded w-40 text-sm">

<option value="auto">Automatisch</option>

<option value="single">1x jeder gegen jeden</option>

<option value="double">2x jeder gegen jeden</option>

</select>

<p className="text-[11px] text-slate-500 mt-1">Auto: bis 4 Spieler doppelt, sonst einfach.</p>

</div>

)}



<div className="flex gap-2">

<button onClick={() => bracketType === 'ko' ? generateBracket(true) : generateGroups()} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 flex items-center gap-2 text-sm">

<Shuffle size={16}/> {bracketType === 'ko' ? 'Baum' : 'Gruppen'} Generieren

</button>

</div>

</div>

) : (

<div className="text-center p-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">

Kein aktives Turnier für {activeBracketAge}.

</div>

)

) : (

activeBracket.type === 'ko' && activeBracket.rounds ? (

<div className="overflow-x-auto pb-4 custom-scrollbar">

{/* DYNAMIC WIDTH BASED ON ROUNDS */}

<div className="flex gap-8 md:gap-16 pb-4" style={{ minWidth: `${Math.max(600, activeBracket.rounds!.length * 220)}px` }}>

{activeBracket.rounds!.map((round, rIndex) => (

<div key={rIndex} className="flex flex-col justify-around flex-1 relative gap-8">

{round.map((match, mIndex) => (

<div key={match.id} className="relative group">

{/* Match Box */}

<div className="w-48 bg-white border rounded-lg shadow-sm overflow-hidden text-sm relative z-10">

{/* Player 1 Slot */}

<div

className={`p-2 border-b flex justify-between items-center cursor-pointer hover:bg-slate-50 ${match.winner?.id === match.p1?.id && match.winner ? 'bg-green-50' : ''}`}

onClick={() => match.p1 && isAdmin && advanceBracket(rIndex, mIndex, match.p1)}

>

{match.p1 ? (

<span className={`truncate max-w-[120px] ${match.winner?.id === match.p1.id ? 'font-bold text-green-700' : ''}`}>{match.p1.name}</span>

) : (

isAdmin ? (

<select

className="w-full text-xs p-1 bg-slate-50 border rounded"

onChange={(e) => setBracketPlayer(rIndex, mIndex, 'p1', e.target.value)}

value=""

>

<option value="">+ Spieler</option>

{players.filter(p => calculateAgeGroup(p) === activeBracketAge && p.level === activeBracketLevel).map(p => (

<option key={p.id} value={p.id}>{p.name}</option>

))}

</select>

) : <span className="text-slate-300 italic">Leer</span>

)}

{match.winner?.id === match.p1?.id && match.p1 && <CheckCircle2 size={12} className="text-green-600"/>}

</div>


{/* Player 2 Slot */}

<div

className={`p-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 ${match.winner?.id === match.p2?.id && match.winner ? 'bg-green-50' : ''}`}

onClick={() => match.p2 && isAdmin && advanceBracket(rIndex, mIndex, match.p2)}

>

{match.p2 ? (

<span className={`truncate max-w-[120px] ${match.winner?.id === match.p2.id ? 'font-bold text-green-700' : ''}`}>{match.p2.name}</span>

) : (

isAdmin ? (

<select

className="w-full text-xs p-1 bg-slate-50 border rounded"

onChange={(e) => setBracketPlayer(rIndex, mIndex, 'p2', e.target.value)}

value=""

>

<option value="">+ Spieler</option>

{players.filter(p => calculateAgeGroup(p) === activeBracketAge && p.level === activeBracketLevel).map(p => (

<option key={p.id} value={p.id}>{p.name}</option>

))}

</select>

) : <span className="text-slate-300 italic">Leer</span>

)}

{match.winner?.id === match.p2?.id && match.p2 && <CheckCircle2 size={12} className="text-green-600"/>}

</div>

</div>



{/* Lines (Visuals) */}

{rIndex < activeBracket.rounds!.length - 1 && (

<div className="absolute top-1/2 -right-8 w-8 h-[1px] bg-slate-300 z-0"></div>

)}

{/* Connecting Lines for next round */}

{rIndex > 0 && (

<div className="absolute top-1/2 -left-8 w-8 h-[1px] bg-slate-300 z-0"></div>

)}

</div>

))}

</div>

))}

{/* Winner Box */}

<div className="flex flex-col justify-around">

<div className="w-32 h-32 border-2 border-dashed border-emerald-200 rounded-full flex flex-col items-center justify-center text-emerald-600 bg-emerald-50">

<Trophy size={32} className="mb-2"/>

<span className="text-xs font-bold uppercase">Sieger</span>

<div className="font-bold text-center px-2">

{activeBracket.rounds![activeBracket.rounds!.length - 1][0]?.winner?.name || '?'}

</div>

</div>

</div>

</div>

</div>

) : (

<div className="space-y-8">

{isAdmin && (

<div className="flex gap-2 justify-end mb-4">

<button onClick={fillRandomGroupResults} className="text-xs bg-slate-100 px-3 py-1 rounded hover:bg-slate-200 text-slate-600 flex items-center gap-1">

<Shuffle size={12}/> Test: Zufallsergebnisse

</button>

<button onClick={clearGroupResults} className="text-xs bg-red-50 px-3 py-1 rounded hover:bg-red-100 text-red-500 flex items-center gap-1">

<Trash2 size={12}/> Ergebnisse löschen

</button>

<button onClick={advanceGroupsToKO} className="text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 text-white font-bold flex items-center gap-1 shadow-lg shadow-blue-200">

<ArrowRightCircle size={12}/> KO-Phase aus Gruppen erstellen

</button>

</div>

)}


<div className="grid md:grid-cols-2 gap-6">

{activeBracket.groups?.map((group, gIndex) => {

const standings = calculateGroupStandings(group);

return (

<div key={gIndex} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

<div className="bg-slate-100 p-2 font-bold text-slate-700 text-center border-b border-slate-200">{group.name}</div>


{/* STANDINGS TABLE */}

<div className="bg-slate-50 p-2 border-b border-slate-200">

<table className="w-full text-xs text-left">

<thead>

<tr className="text-slate-400">

<th className="pb-1">Pl.</th>

<th className="pb-1">Name</th>

<th className="pb-1 text-center">S:N</th>

<th className="pb-1 text-center">Sätze</th>

<th className="pb-1 text-right">Pkt</th>

</tr>

</thead>

<tbody>

{standings.map((s, idx) => (

<tr key={s.id} className="border-t border-slate-200">

<td className="py-1 font-bold text-slate-500">{idx + 1}.</td>

<td className="py-1 font-bold text-slate-700 truncate max-w-[80px]">{s.name}</td>

<td className="py-1 text-center">{s.wins}:{s.losses}</td>

<td className="py-1 text-center">{s.setsWon}:{s.setsLost}</td>

<td className="py-1 text-right font-bold">{s.points}</td>

</tr>

))}

</tbody>

</table>

</div>



{/* MATCHES */}

<div className="divide-y divide-slate-100">

{group.matches.map((m, mIndex) => (

<div key={m.id} className="p-2 flex justify-between items-center bg-white hover:bg-slate-50">

<div className="text-xs">

<div className={m.winner?.id === m.p1.id ? 'font-bold text-green-700' : ''}>{m.p1.name}</div>

<div className={m.winner?.id === m.p2.id ? 'font-bold text-green-700' : ''}>{m.p2.name}</div>

</div>

{isAdmin ? (

<input

type="text"

placeholder="6:4 6:2"

className="w-16 text-[10px] p-1 border rounded text-right font-mono"

value={m.score}

onChange={(e) => updateGroupMatch(gIndex, mIndex, e.target.value)}

/>

) : <span className="font-mono text-xs font-bold text-slate-600">{m.score || '-:-'}</span>}

</div>

))}

</div>

</div>

)})}

</div>

</div>

)

)}

</div>

</div>

)}

{/* --- TAB: SPIELPLAN (AUSLOSUNG) --- */}

{activeTab === 'planner' && (
<div className="animate-in fade-in space-y-6">

<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
<div className="flex flex-col gap-4">
<div>
<h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-emerald-600" size={18}/> Spielplan nach Alters- & Leistungsklasse</h2>
<p className="text-sm text-slate-600">Eine Tabelle pro Level. Matches werden erst erzeugt, wenn du auf „Auslosen“ klickst.</p>
</div>
<div className="flex flex-col gap-3 w-full">
<div className="flex flex-col gap-2">
<label className="text-xs font-bold text-slate-600 uppercase">Altersklasse</label>
<select value={plannerAgeGroup} onChange={e => setPlannerAgeGroup(e.target.value as AgeGroup)} className="p-3 border border-slate-300 rounded-lg bg-white text-sm font-medium">
{getSortedAgeGroups().filter(g => g !== 'All').map(g => (
  <option key={g} value={g}>{displayAgeGroup(g)}</option>
))}
</select>
</div>
<div className="flex flex-col gap-2">
<label className="text-xs font-bold text-slate-600 uppercase">Spielmodus</label>
<select value={plannerMatchMode} onChange={e => setPlannerMatchMode(e.target.value as 'auto' | 'single' | 'double')} className="p-3 border border-slate-300 rounded-lg bg-white text-sm font-medium">
  <option value="auto">Automatisch</option>
  <option value="single">1x jeder gegen jeden</option>
  <option value="double">2x jeder gegen jeden</option>
</select>
</div>
{isAdmin && (
  <button onClick={() => generatePlannerForAgeGroup(plannerAgeGroup)} className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all">
    <Shuffle size={18}/> Auslosen
  </button>
)}
</div>

{isAdmin && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-5">
    <div className="flex items-center gap-2 mb-4">
      <UserPlus size={20} className="text-blue-600"/>
      <h3 className="text-base font-bold text-slate-800">Spieler hinzufügen</h3>
    </div>
    <div className="grid md:grid-cols-5 gap-4 items-end">
      <div className="md:col-span-2">
        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Spieler (Suche)</label>
        <input 
          type="text" 
          value={plannerPlayerSearch} 
          onChange={e => setPlannerPlayerSearch(e.target.value)} 
          placeholder="Name oder Geburtsjahr eingeben..."
          className="w-full p-3.5 border border-blue-300 rounded-lg text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        {plannerPlayerSearch && (
          <div className="absolute z-10 w-full mt-1 border border-blue-300 rounded-lg bg-white shadow-lg max-h-56 overflow-y-auto">
            {players
              .filter(p => 
                p.name.toLowerCase().includes(plannerPlayerSearch.toLowerCase()) || 
                p.birthDate.includes(plannerPlayerSearch)
              )
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(0, 10)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlannerSelectedPlayerId(p.id);
                    setPlannerPlayerSearch('');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-100 text-sm border-b border-slate-100 last:border-b-0"
                >
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">{new Date(p.birthDate).toLocaleDateString('de-DE')}</div>
                </button>
              ))}
            {players.filter(p => 
              p.name.toLowerCase().includes(plannerPlayerSearch.toLowerCase()) || 
              p.birthDate.includes(plannerPlayerSearch)
            ).length === 0 && (
              <div className="px-4 py-2 text-sm text-slate-500">Keine Spieler gefunden</div>
            )}
          </div>
        )}
        {plannerSelectedPlayerId && (
          <div className="text-xs text-slate-600 bg-blue-100 px-3 py-2 rounded-lg">
            ✓ {players.find(p => p.id === plannerSelectedPlayerId)?.name}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Wählen</label>
        <select value={plannerNewLevel} onChange={e => setPlannerNewLevel(e.target.value as Level)} className="w-full p-3.5 border border-blue-300 rounded-lg text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="A">{LEVEL_LABELS.A}</option>
          <option value="B">{LEVEL_LABELS.B}</option>
          <option value="C">{LEVEL_LABELS.C}</option>
        </select>
      </div>
      <div>
        <button onClick={quickAddPlannerPlayer} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"><UserPlus size={16}/> Hinzufügen</button>
      </div>
    </div>
  </div>
)}

<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><CalendarDays size={16}/> Turniertage</h4>
  {tournaments.length === 0 ? (
    <p className="text-slate-500 text-center py-6">Keine Turniere angelegt.</p>
  ) : (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {tournaments.map(t => (
        <div key={t.id} className="border border-slate-200 rounded-lg p-3">
          <div className="font-bold text-slate-800">{t.name}</div>
          <div className="text-xs text-slate-500 mb-2">{t.date}</div>
          {t.rounds && t.rounds.length > 0 ? (
            <ul className="text-xs text-slate-600 space-y-1">
              {t.rounds.map(r => <li key={r.id}>• {r.name} ({r.date})</li>)}
            </ul>
          ) : <div className="text-xs text-slate-400">Keine Spieltage hinterlegt</div>}
        </div>
      ))}
    </div>
  )}
</div>
</div>
</div>

{(['A','B','C'] as Level[]).map(level => {
  const key = getPlannerKey(plannerAgeGroup, level);
  const fixtures = (plannerFixtures[key] || []).slice().sort((a,b) => a.round - b.round);
  const { stats, weight, participantCount } = collectPlannerStats(plannerAgeGroup, level);
  const resolveName = (id: string) => players.find(p => p.id === id)?.name || 'Unbekannt';
  const upcoming = fixtures.slice(0, 5);
  return (
    <div key={level} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {renderLevelBadge(level, 'md')}
            <span className="text-slate-500 text-sm">Altersklasse: {displayAgeGroup(plannerAgeGroup)}</span>
          </h3>
          <div className="text-xs text-slate-500 mt-1">Teilnehmer: {participantCount} • Gruppengewicht: x{weight.toFixed(2)}</div>
        </div>
        {isAdmin && fixtures.length > 0 && (
          <div className="text-xs text-slate-500">Runden: {Math.max(...fixtures.map(f => f.round))}</div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Verein</th>
                <th className="p-2 text-center">Teiln.</th>
                <th className="p-2 text-center">S</th>
                <th className="p-2 text-center">KN</th>
                <th className="p-2 text-center">N</th>
                <th className="p-2 text-right">Punkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-slate-400 text-sm">Noch keine Spieler in diesem Level.</td></tr>
              ) : stats.map(s => (
                <tr key={s.player.id}>
                  <td className="p-2 font-bold text-slate-800">{s.player.name}</td>
                  <td className="p-2 text-slate-500">{s.player.club || '-'}</td>
                  <td className="p-2 text-center font-bold text-slate-700">{s.participationPoints}</td>
                  <td className="p-2 text-center font-bold text-green-600">{s.wins}</td>
                  <td className="p-2 text-center font-bold text-orange-500">{s.close}</td>
                  <td className="p-2 text-center font-bold text-red-500">{s.losses}</td>
                  <td className="p-2 text-right font-bold text-slate-800">{s.points.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Nächste Begegnungen</span>
            <span className="text-[11px] text-slate-400">{fixtures.length} geplant</span>
          </div>
          {fixtures.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Auslosung.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map(f => (
                <div key={f.id} className="bg-white rounded border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Runde {f.round}</span><span>{LEVEL_LABELS[level]}</span></div>
                  <div className="font-bold text-slate-800 mb-2">{resolveName(f.p1Id)} <span className="text-slate-400">vs</span> {resolveName(f.p2Id)}</div>
                  {isAdmin && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="z.B. 6:4 4:6 10:8"
                        className="w-full p-2 border rounded text-xs"
                        value={plannerScoreInput[f.id] || ''}
                        onChange={e => setPlannerScoreInput(prev => ({ ...prev, [f.id]: e.target.value }))}
                      />
                      <div className="flex gap-2 items-center justify-between">
                        <select value={plannerScoringMode} onChange={e => setPlannerScoringMode(e.target.value as ScoringMode)} className="p-1.5 border rounded text-xs">
                          <option value="race4">Zaehlweise: bis 4</option>
                          <option value="race10">Zaehlweise: bis 10</option>
                          <option value="race15">Zaehlweise: bis 15</option>
                          <option value="sets">Zaehlweise: Saetze</option>
                        </select>
                        <button onClick={() => savePlannerResult(f)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded">Speichern</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {fixtures.length > upcoming.length && <div className="text-[11px] text-slate-500">… weitere Begegnungen wurden geplant.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
})}

</div>
)}

{/* --- TAB: SPIELER (NEU) --- */}

{activeTab === 'players' && (

<div className="space-y-6 animate-in fade-in">

<div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">

<div className="relative w-full md:w-64">

<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />

<input type="text" placeholder="Name suchen..." value={playersListSearch} onChange={(e) => setPlayersListSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />

</div>

<div className="flex gap-2">

<select value={playersListAgeFilter} onChange={(e) => setPlayersListAgeFilter(e.target.value)} className="p-2 border rounded-lg bg-slate-50 text-sm">

<option value="All">Alle Altersklassen</option>

{getSortedAgeGroups().filter(g => g!=='All').map(g => <option key={g} value={g}>{displayAgeGroup(g)}</option>)}

</select>

{isAdmin && (

<button onClick={() => setIsCreatingTeam(!isCreatingTeam)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700">

{isCreatingTeam ? <X size={16}/> : <Plus size={16}/>} Neues Doppel-Team

</button>

)}

</div>

</div>



{isCreatingTeam && (

<div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 animate-in slide-in-from-top-2">

<h4 className="font-bold text-blue-800 mb-3">Neues Doppel-Team erstellen</h4>

<div className="flex flex-col md:flex-row gap-4 items-center">

<div className="flex-1 w-full">

<input

type="text"

placeholder="Suche Spieler 1..."

className="w-full p-2 border rounded text-xs mb-1"

value={teamSearch1}

onChange={e => setTeamSearch1(e.target.value)}

/>

<select className="w-full p-2 border rounded" value={teamMember1} onChange={e => setTeamMember1(e.target.value)}>

<option value="">Spieler 1 wählen</option>

{players.filter(p => !p.isTeam).filter(p => !teamSearch1 || p.name.toLowerCase().includes(teamSearch1.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}

</select>

</div>

<span className="font-bold text-slate-400">+</span>

<div className="flex-1 w-full">

<input

type="text"

placeholder="Suche Spieler 2..."

className="w-full p-2 border rounded text-xs mb-1"

value={teamSearch2}

onChange={e => setTeamSearch2(e.target.value)}

/>

<select className="w-full p-2 border rounded" value={teamMember2} onChange={e => setTeamMember2(e.target.value)}>

<option value="">Spieler 2 wählen</option>

{players.filter(p => !p.isTeam && p.id !== teamMember1).filter(p => !teamSearch2 || p.name.toLowerCase().includes(teamSearch2.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}

</select>

</div>

<button onClick={handleCreateTeam} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto">Erstellen</button>

</div>

</div>

)}



<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

<table className="w-full text-left">

<thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">

<tr>

<th className="p-4">Name</th>

<th className="p-4">Altersklasse</th>

<th className="p-4">Level</th>

<th className="p-4">Status</th>

{isAdmin && <th className="p-4 w-10">Aktion</th>}

</tr>

</thead>

<tbody className="divide-y divide-slate-100">

{filteredPlayersList.map(p => (

<tr key={p.id} onClick={() => setViewingPlayer(p)} className="hover:bg-slate-50 cursor-pointer group">

<td className="p-4 font-bold text-slate-700 flex items-center gap-2">

{p.isTeam && <Users2 size={16} className="text-blue-500"/>}

{p.name}

</td>

<td className="p-4 text-sm text-slate-500">{formatAgeGroupLabel(calculateAgeGroup(p))}</td>

<td className="p-4 text-sm text-slate-500">{p.level ? LEVEL_LABELS[p.level] : '-'}</td>

<td className="p-4 text-xs">

{p.isTestData ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Testdaten</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Registriert</span>}

</td>

{isAdmin && (

<td className="p-4">

<button onClick={(e) => { e.stopPropagation(); deletePlayer(p.id); }} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>

</td>

)}

</tr>

))}

{filteredPlayersList.length === 0 && (

<tr><td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-slate-400">Keine Spieler gefunden.</td></tr>

)}

</tbody>

</table>

</div>

</div>

)}


{/* ... OTHER TABS ... */}

{activeTab === 'register' && (

<div className="max-w-xl mx-auto animate-in fade-in">

{/* ... (Existing Register Code) ... */}

<div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg text-center">

<div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">

<UserPlus className="text-emerald-600 w-8 h-8" />

</div>

<h2 className="text-2xl font-bold text-slate-800 mb-2">{isAdmin ? 'Spieler direkt hinzufügen' : 'Spieler Anmeldung'}</h2>


{!showRegSuccess ? (

<div className="space-y-4 text-left">

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vor- & Nachname</label>

<input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Max Mustermann"/>

</div>

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Verein (optional)</label>

<input type="text" value={regClub} onChange={e => setRegClub(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="TC Musterstadt"/>

</div>

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-Mail (optional)</label>

<input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="max@example.com"/>

</div>

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Geburtsdatum</label>

<input type="date" value={regBirthDate} onChange={e => setRegBirthDate(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"/>

<div className="text-xs text-slate-500 mt-1">Altersklasse (automatisch): <span className="font-bold text-emerald-600">{regPreviewAge}</span> â€“ anhand des Geburtsdatums</div>

</div>

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Niveau</label>

<select value={regLevel} onChange={(e) => setRegLevel(e.target.value as Level)} className="w-full p-3 border rounded-lg bg-white">

<option value="A">{LEVEL_LABELS.A}</option>

<option value="B">{LEVEL_LABELS.B}</option>

<option value="C">{LEVEL_LABELS.C}</option>

</select>



</div>

<div>

<label className="block text-xs font-bold text-slate-500 uppercase mb-1">Wunsch-Turnier</label>

<select value={regTournamentId} onChange={(e) => setRegTournamentId(e.target.value)} className="w-full p-3 border rounded-lg bg-white">

<option value="">-- Kein spezifisches Turnier --</option>

{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

</select>

</div>


{/* Round Select if Tournament Selected */}

{regTournamentId && (

<div className="bg-slate-50 p-3 rounded-lg border border-slate-200">

<label className="block text-xs font-bold text-slate-500 uppercase mb-2">An welchen Tagen?</label>

<div className="space-y-2">

{tournaments.find(t => t.id === regTournamentId)?.rounds.map(r => (

<label key={r.id} className="flex items-center gap-2 cursor-pointer">

<input

type="checkbox"

checked={regSelectedRounds.includes(r.id)}

onChange={(e) => {

if(e.target.checked) setRegSelectedRounds([...regSelectedRounds, r.id]);

else setRegSelectedRounds(regSelectedRounds.filter(id => id !== r.id));

}}

className="w-4 h-4 text-emerald-600 rounded"

/>

<span className="text-sm">{r.name} ({r.date})</span>

</label>

))}

</div>

</div>

)}



<button onClick={handleRegistration} disabled={!regName || !regBirthDate} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl mt-4 transition shadow-xl shadow-emerald-100">

{isAdmin ? 'Hinzufügen' : 'Anmelden'}

</button>

</div>

) : (

<div className="py-12 animate-in zoom-in">

<CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />

<h3 className="text-xl font-bold text-green-700">Erledigt!</h3>

<button onClick={() => setShowRegSuccess(false)} className="mt-8 text-emerald-600 font-bold hover:underline">Zurück</button>

</div>

)}

</div>

</div>

)}



{/* ... INPUT & ADMIN TABS FROM PREVIOUS ... */}

{activeTab === 'input' && isAdmin && (

<div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">

<div className="bg-white border border-emerald-100 rounded-xl shadow-lg shadow-emerald-50 overflow-hidden">

<div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center gap-2">

<PlayCircle className="text-emerald-600" />

<h2 className="font-bold text-emerald-900">Ergebnis erfassen</h2>

</div>

<div className="p-6 space-y-5">


{/* Tournament / Round Selection */}

<div className="grid grid-cols-1 gap-4">

<div>

<label className="text-xs font-bold text-slate-500 uppercase">Turnier & Spieltag</label>

<div className="flex gap-2 mt-1">

<select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className="flex-1 p-2.5 border rounded-lg bg-slate-50">

<option value="">-- Turnierserie wählen --</option>

{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

</select>

<select

value={selectedRoundId}

onChange={(e) => setSelectedRoundId(e.target.value)}

className={`flex-1 p-2.5 border rounded-lg bg-slate-50 disabled:bg-slate-100 ${roundError ? 'border-red-500 ring-1 ring-red-500' : ''}`}

disabled={!selectedTournamentId}

>

<option value="">-- Spieltag / Runde wählen --</option>

{tournaments.find(t => t.id === selectedTournamentId)?.rounds.map(r => (

<option key={r.id} value={r.id}>{r.name} ({r.date})</option>

))}

</select>

</div>

{roundError && <p className="text-red-500 text-xs mt-1">Bitte Spieltag auswählen!</p>}

</div>

</div>


{/* Filtering & Search for Input */}

<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2">

<div className="flex justify-between items-center mb-2">

<span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Filter size={12}/> Filter für Auswahl</span>

</div>

<div className="flex gap-2 flex-wrap items-center">

<select value={inputAgeGroupFilter} onChange={e => setInputAgeGroupFilter(e.target.value)} className="text-xs p-1 border rounded">

<option value="All">Alle Altersklassen</option>

{getSortedAgeGroups().filter(g => g!=='All').map(g => <option key={g} value={g}>{displayAgeGroup(g)}</option>)}

</select>

<select value={scoringMode} onChange={e => setScoringMode(e.target.value as ScoringMode)} className="text-xs p-1.5 border rounded bg-white">
<option value="race4">Zaehlweise: bis 4</option>
<option value="race10">Zaehlweise: bis 10</option>
<option value="race15">Zaehlweise: bis 15</option>
<option value="sets">Zaehlweise: Saetze</option>
</select>

</div>

</div>



<div className="grid grid-cols-2 gap-4">

{/* Player 1 Selection */}

<div>

<label className="text-xs font-bold text-slate-500 uppercase">Unser Spieler</label>

<input

type="text"

placeholder="Suche..."

value={inputPlayerSearch}

onChange={e => setInputPlayerSearch(e.target.value)}

className="w-full mb-1 p-1 text-xs border rounded"

/>

<select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="w-full mt-1 p-2.5 border rounded-lg bg-slate-50">

<option value="">-- Wählen --</option>

{players

.filter(p => inputAgeGroupFilter === 'All' || calculateAgeGroup(p) === inputAgeGroupFilter)

.filter(p => !inputPlayerSearch || p.name.toLowerCase().includes(inputPlayerSearch.toLowerCase()))

.sort((a,b) => a.name.localeCompare(b.name))

.map(p => <option key={p.id} value={p.id}>{p.name} {p.isTeam && '(Team)'} ({calculateAgeGroup(p)})</option>

)}

</select>

</div>


{/* Player 2 Selection */}

<div>

<label className="text-xs font-bold text-slate-500 uppercase">Gegner wählen</label>

<input

type="text"

placeholder="Suche..."

value={inputOpponentSearch}

onChange={e => setInputOpponentSearch(e.target.value)}

className="w-full mb-1 p-1 text-xs border rounded"

/>

<select value={selectedOpponentId} onChange={(e) => setSelectedOpponentId(e.target.value)} className="w-full mt-1 p-2.5 border rounded-lg bg-slate-50 focus:bg-white transition">

<option value="">-- Gegner wählen --</option>

{players

.filter(p => p.id !== selectedPlayerId)

.filter(p => inputAgeGroupFilter === 'All' || calculateAgeGroup(p) === inputAgeGroupFilter)
.filter(p => !selectedPlayerLevel || p.level === selectedPlayerLevel)

.filter(p => !inputOpponentSearch || p.name.toLowerCase().includes(inputOpponentSearch.toLowerCase()))

.sort((a,b) => a.name.localeCompare(b.name))

.map(p => (

<option key={p.id} value={p.id}>{p.name} {p.isTeam && '(Team)'} ({calculateAgeGroup(p)})</option>

))}

</select>

</div>

</div>



<div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

<label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Spielstand</label>

<div className="space-y-2">

{sets.map((set, idx) => (

<div key={idx} className="flex items-center gap-2">

<span className="text-xs font-bold text-slate-400 w-12">Satz {idx+1}</span>

<input type="number" min="0" placeholder="6" className="w-16 p-2 text-center border rounded font-bold" value={set.p1} onChange={(e) => updateSet(idx, 'p1', e.target.value)} />

<span className="text-slate-400">:</span>

<input type="number" min="0" placeholder="4" className="w-16 p-2 text-center border rounded font-bold" value={set.p2} onChange={(e) => updateSet(idx, 'p2', e.target.value)} />

{sets.length > 1 && <button onClick={() => removeSet(idx)} className="text-slate-300 hover:text-red-500 ml-2"><X size={16}/></button>}

</div>

))}

</div>

<button onClick={addSet} className="mt-3 text-xs flex items-center gap-1 text-emerald-600 font-bold hover:underline"><Plus size={14}/> Weiteren Satz hinzufügen</button>

</div>



<div className="h-8">

{matchAnalysis && (

<div className={`flex items-center gap-2 p-2 rounded-lg text-sm font-bold animate-in zoom-in ${matchAnalysis.isWin ? 'bg-green-100 text-green-700' : matchAnalysis.isCloseLoss ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>

{matchAnalysis.isWin ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}

{matchAnalysis.message}

</div>

)}

</div>



<button onClick={handleAddResult} disabled={!selectedPlayerId || !selectedTournamentId || !matchAnalysis || !selectedOpponentId} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-200">Match Speichern</button>

</div>

</div>

</div>

)}



{activeTab === 'admin' && isAdmin && (

<div className="space-y-8 animate-in fade-in">


{/* ADMIN ACCOUNT MANAGEMENT */}

<div className="bg-slate-800 text-white rounded-xl p-6 shadow-xl">

<h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-400"><UserCog size={20}/> Admin Konten</h3>

<div className="flex gap-2 mb-4">

<input type="text" placeholder="Neuer Benutzername" className="bg-slate-700 border-none rounded p-2 text-sm text-white" value={newAdminUser} onChange={e => setNewAdminUser(e.target.value)}/>

<input type="text" placeholder="Passwort" className="bg-slate-700 border-none rounded p-2 text-sm text-white" value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)}/>

<button onClick={handleAddAdmin} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded text-sm font-bold">Hinzufügen</button>

</div>

<div className="space-y-2">

{admins.map(a => (

<div key={a.id} className="bg-white/10 p-2 rounded flex justify-between items-center text-sm">

<span>{a.username} {a.isSuperAdmin && <span className="text-xs text-emerald-400 ml-2">(Super Admin)</span>}</span>

{!a.isSuperAdmin && (

<button onClick={() => handleDeleteAdmin(a.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>

)}

</div>

))}

</div>

</div>



{/* PENDING REGISTRATIONS */}

{pendingRegistrations.length > 0 && (

<div className="bg-orange-50 border border-orange-100 rounded-xl p-6">

<h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2"><UserCheck className="text-orange-600"/> Offene Anmeldungen</h3>

<div className="space-y-3">

{pendingRegistrations.map(req => {

const tourName = tournaments.find(t => t.id === req.desiredTournamentId)?.name;
const ageLabel = formatAgeGroupLabel(calculateAgeGroup(req.birthDate));

return (

<div key={req.id} className="bg-white p-4 rounded-lg shadow-sm border border-orange-100 flex justify-between items-center">

<div>

<div className="font-bold text-slate-800">{req.name} <span className="text-slate-400 font-normal">({ageLabel})</span></div>

<div className="text-xs text-slate-500 mt-1">

Niveau {req.level || '?'} - Altersklasse {ageLabel} {req.club ? ` - ${req.club}` : ''} {req.email ? ` - ${req.email}` : ''} {tourName ? ` - Will zu: ${tourName}` : ''}

</div>

</div>

<div className="flex gap-2">

<button onClick={() => rejectRegistration(req.id)} className="p-2 text-red-400 hover:bg-red-50 rounded"><XCircle size={20}/></button>

<button onClick={() => approveRegistration(req)} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 flex items-center gap-1"><CheckCircle2 size={14}/> Zulassen</button>

</div>

</div>

)})}

</div>

</div>

)}



{/* TOURNAMENTS */}

<div className="bg-white p-6 rounded-xl border border-slate-200">

<h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="text-purple-500"/> Turnierserien</h3>

<div className="flex gap-2 mb-6">

<input type="text" value={newTournamentName} onChange={e => setNewTournamentName(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Neue Serie anlegen"/>

<input type="date" value={newTournamentDate} onChange={e => setNewTournamentDate(e.target.value)} className="w-32 p-2 border rounded"/>

<button onClick={handleAddTournament} className="bg-purple-600 text-white p-2 rounded"><Plus/></button>

</div>

<div className="space-y-4">

{tournaments.map(t => (

<div key={t.id} className="border border-slate-200 rounded-lg overflow-hidden">

<div className="bg-slate-50 p-3 flex justify-between items-center">

<div className="font-bold text-slate-700 flex items-center gap-2"><CalendarDays size={16} className="text-slate-400"/>{t.name}</div>

<div className="flex items-center gap-2">

{isGenerating ? <Loader2 className="animate-spin text-slate-400" size={16}/> : (

<button onClick={() => deleteTournament(t.id)} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50" title="Turnier & Ergebnisse löschen"><Trash2 size={16}/></button>

)}

</div>

</div>

<div className="p-3 bg-white space-y-2">

{t.rounds.map(r => (

<div key={r.id} className="flex justify-between items-center text-sm pl-6 border-l-2 border-slate-100">

<span>{r.name} <span className="text-slate-400 text-xs">({r.date})</span></span>

<button onClick={() => deleteRound(t.id, r.id)} className="text-slate-300 hover:text-red-400"><X size={14}/></button>

</div>

))}

{addingRoundToTournamentId === t.id ? (

<div className="flex gap-2 pl-6 mt-2">

<input type="text" placeholder="Bezeichnung" className="flex-1 text-sm p-1 border rounded" value={newRoundName} onChange={e => setNewRoundName(e.target.value)} />

<input type="date" className="w-28 text-sm p-1 border rounded" value={newRoundDate} onChange={e => setNewRoundDate(e.target.value)} />

<button onClick={() => handleAddRound(t.id)} className="bg-emerald-600 text-white text-xs px-2 rounded">Save</button>

<button onClick={() => setAddingRoundToTournamentId(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>

</div>

) : (

<button onClick={() => setAddingRoundToTournamentId(t.id)} className="ml-6 text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-2"><PlusCircle size={12}/> Spieltag hinzufügen</button>

)}

</div>

</div>

))}

</div>

</div>



{/* TEST DATA GENERATOR */}

<div className="bg-slate-100 p-6 rounded-xl border border-slate-200 mt-8">

<div className="flex justify-between items-center mb-4">

<h3 className="font-bold text-slate-800 flex items-center gap-2"><Database className="text-blue-500"/> Massen-Testdaten</h3>

{isGenerating && <span className="text-xs text-slate-500 animate-pulse flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> {generationStatus}</span>}

</div>

<p className="text-sm text-slate-500 mb-4">

Generiert lokale Testdaten.

</p>



<div className="grid md:grid-cols-3 gap-3 mb-4">

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">

Anzahl Test-Spieler

</label>

<input

type="number"

min={2}

max={10000}

className="w-full p-3 border border-blue-300 rounded-lg text-sm bg-white"

value={testPlayerCount}

onChange={(e) => setTestPlayerCount(parseInt(e.target.value) || 0)}

/>

</div>

<div>

<label className="text-xs font-bold text-slate-600 uppercase block mb-1">

Matches pro Spieler

</label>

<input

type="number"

min={1}

className="w-full p-3 border border-blue-300 rounded-lg text-sm bg-white"

value={testMatchesPerPlayer}

onChange={(e) => setTestMatchesPerPlayer(parseInt(e.target.value) || 0)}

/>

</div>

</div>


<div className="flex gap-4">

<button onClick={generateTestData} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2">

<PlusCircle size={16}/> Starten

</button>

<button onClick={deleteTestData} disabled={isGenerating} className="bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:bg-slate-50 disabled:text-slate-300 text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2">

<Trash2 size={16}/> Alles löschen

</button>

</div>

</div>

</div>

)}



</div>

</div>

</div>

);

};



export default TennisManager;
