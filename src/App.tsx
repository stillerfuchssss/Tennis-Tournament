import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';

import {

  Trophy, Users, Plus, Trash2, Activity,

  Medal, UserPlus,

  CheckCircle2, AlertCircle, X, ChevronRight, ChevronLeft, PlayCircle,

  Search, Calendar, Settings, Unlock, ShieldCheck,

  ClipboardList, UserCheck, XCircle, LayoutList, CalendarDays,

  PlusCircle, Database, Loader2, Info, Filter, HardDrive,

  Bell, GitFork, Shuffle, UserCog, Edit2, Check, TrendingUp,

  BarChart3, Scale, Users2, Table2, ArrowRightCircle, Sun, Moon,
  History as HistoryIcon
} from 'lucide-react';

// --- SERVER CONNECTION ---
// Wenn wir lokal entwickeln (localhost), nutzen wir Port 3000. 
// Auf dem echten Server (Production) nutzen wir den gleichen Pfad.
const API_URL = (import.meta as any).env.DEV ? 'http://localhost:3000' : '';

// Flag um zu verhindern, dass bei Verbindungsproblemen leere Daten gespeichert werden
let serverConnectionOK = false;

const apiSave = async (key: string, data: any) => {
  // Sicherheitscheck: Nur speichern wenn wir erfolgreich Daten geladen haben
  if (!serverConnectionOK) {
    console.warn("⚠️ Speichern verhindert - Server-Verbindung noch nicht bestätigt");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: data })
    });
    if (!res.ok) {
      console.error("Speicherfehler: Server antwortete mit", res.status);
    }
  } catch (e) {
    console.error("Speicherfehler:", e);
  }
};

const apiLoad = async (key: string, retries = 3): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/storage/${key}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`Ladefehler (Versuch ${attempt}/${retries}):`, e);
      if (attempt < retries) {
        // Warte kurz und versuche es erneut
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return null;
};

// --- ATOMIC MATCH API (Race Condition Fix) ---
// Diese Funktionen speichern/löschen einzelne Matches atomar,
// um Konflikte bei gleichzeitiger Bearbeitung zu vermeiden.

const apiSaveMatchAtomic = async (playerId: string, tournamentId: string, match: any): Promise<boolean | 'conflict'> => {
  if (!serverConnectionOK) {
    console.warn("⚠️ Atomares Speichern verhindert - Server-Verbindung noch nicht bestätigt");
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/results/match`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, tournamentId, match })
    });

    // Konflikt-Erkennung: Jemand anderes war schneller
    if (res.status === 409) {
      const data = await res.json();
      console.warn("⚠️ Konflikt erkannt:", data.message);
      return 'conflict';
    }

    if (!res.ok) {
      console.error("Atomarer Speicherfehler: Server antwortete mit", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Atomarer Speicherfehler:", e);
    return false;
  }
};

const apiDeleteMatchAtomic = async (playerId: string, tournamentId: string, roundId: string, opponentId: string): Promise<boolean> => {
  if (!serverConnectionOK) {
    console.warn("⚠️ Atomares Löschen verhindert - Server-Verbindung noch nicht bestätigt");
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/results/match`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, tournamentId, roundId, opponentId })
    });
    if (!res.ok) {
      console.error("Atomarer Löschfehler: Server antwortete mit", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Atomarer Löschfehler:", e);
    return false;
  }
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
  { id: 'Red', fromYear: 2017, description: '2017 und jünger' },
  { id: 'Orange', fromYear: 2016, toYear: 2016, description: '2016 und jünger' },
  { id: 'Green', fromYear: 2014, toYear: 2015, description: '2014 und jünger' },
  { id: 'Yellow', fromYear: 2011, toYear: 2013, description: '2013 bis 2011' },
];
const AGE_STAGE_LABELS: Record<AgeGroup, string> = {
  Red: 'Kleinfeld',
  Orange: 'Midcourt',
  Green: 'Bambini',
  Yellow: 'Großfeld'
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

  birthDate?: string;

  ageGroup?: AgeGroup;

  level?: Level;
  manualAgeGroup?: AgeGroup;
  club?: string;
  email?: string;

  isTestData?: boolean;

  isTeam?: boolean;

  memberIds?: string[];
  teamMembers?: string[];

};


type AdminPermissions = {
  canManagePlayers: boolean;      // Spieler erstellen/bearbeiten/löschen
  canManageTournaments: boolean;  // Turniere erstellen/bearbeiten/löschen
  canEnterResults: boolean;       // Ergebnisse eingeben
  canManagePlanner: boolean;      // Spielplan verwalten (Auslosung, Gruppen)
  canExportData: boolean;         // Daten exportieren (Excel, Backup)
};

const DEFAULT_PERMISSIONS: AdminPermissions = {
  canManagePlayers: true,
  canManageTournaments: true,
  canEnterResults: true,
  canManagePlanner: true,
  canExportData: true,
};

type AdminAccount = {

  id: string;

  username: string;

  password: string;

  isSuperAdmin?: boolean;

  permissions?: AdminPermissions;

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

  archived?: boolean;

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
  fixtureId?: string; // Unique fixture ID for proper identification

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
  court?: string; // Court-Nummer oder Name (z.B. "Court 1", "Platz A")
  time?: string;  // Spielzeit (z.B. "10:00", "14:30")
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
  PLANNER: 'tm_planner_fixtures',
  SETTINGS: 'tm_settings',
  GROUP_MEMBERS: 'tm_group_members' // Persistent group member assignments

};

// --- EXCEL IMPORT/EXPORT HELPERS ---
const exportPlayersToExcel = (players: Player[]) => {
  // Mapping AgeGroup zu Excel-Namen
  const ageGroupToExcel: Record<AgeGroup, string> = {
    Green: 'Bambini',
    Red: 'Kleinfeld',
    Orange: 'Midcourt',
    Yellow: 'Großfeld'
  };

  // Mapping Level zu Niveau-Namen
  const levelToNiveau: Record<Level, string> = {
    A: 'A-Turniererfahrene',
    B: 'B-Mittelstufe',
    C: 'C-Einsteiger'
  };

  // Spielerdaten vorbereiten
  const rows = players.map(p => {
    const nameParts = p.name.trim().split(' ');
    let nachname = p.name;
    let vorname = '';
    if (nameParts.length >= 2) {
      nachname = nameParts[nameParts.length - 1];
      vorname = nameParts.slice(0, -1).join(' ');
    }

    let birthYear = '';
    if (p.birthDate) {
      if (p.birthDate.includes('-')) {
        birthYear = p.birthDate.split('-')[0];
      } else if (p.birthDate.includes('.')) {
        const parts = p.birthDate.split('.');
        birthYear = parts[parts.length - 1];
      } else if (/^\d{4}$/.test(p.birthDate)) {
        birthYear = p.birthDate;
      }
    }

    return {
      nachname,
      vorname,
      verein: p.club || '',
      geburtsdatum: birthYear,
      altersklasse: p.ageGroup ? ageGroupToExcel[p.ageGroup] : '',
      niveau: p.level ? levelToNiveau[p.level] : '',
      email: p.email || ''
    };
  });

  // HTML-Tabelle mit Excel-Styling (exakt wie deine Meldeliste)
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Meldeliste</x:Name>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        .title { 
          font-size: 26pt; 
          font-weight: bold; 
          text-align: center; 
          color: #000000;
        }
        .header { 
          background-color: #4DD0E1; 
          color: #000000; 
          font-weight: bold; 
          border: 1px solid #26C6DA;
          padding: 8px 12px;
          text-align: left;
        }
        .data { 
          background-color: #E0F7FA; 
          border: 1px solid #B2EBF2;
          padding: 6px 10px;
        }
        .data-alt { 
          background-color: #B2EBF2; 
          border: 1px solid #80DEEA;
          padding: 6px 10px;
        }
        .email { color: #0066CC; text-decoration: underline; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="7" height="30"></td></tr>
        <tr><td colspan="7" class="title" height="40">Meldeliste</td></tr>
        <tr><td colspan="7" height="10"></td></tr>
        <tr>
          <td class="header" width="120">Name</td>
          <td class="header" width="120">Vorname</td>
          <td class="header" width="180">Verein</td>
          <td class="header" width="110">Geburtsdatum</td>
          <td class="header" width="110">Altersklasse</td>
          <td class="header" width="140">Niveau</td>
          <td class="header" width="250">Emailadresse</td>
        </tr>
        ${rows.map((r, i) => `
        <tr>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.nachname}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.vorname}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.verein}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.geburtsdatum}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.altersklasse}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'}">${r.niveau}</td>
          <td class="${i % 2 === 0 ? 'data' : 'data-alt'} email">${r.email}</td>
        </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;

  // Download als .xls (Excel öffnet HTML-Tabellen korrekt)
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `meldeliste_export_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const importPlayersFromCSV = (file: File, existingPlayers: Player[]): Promise<Player[]> => {
  return new Promise((resolve, reject) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm') || file.name.endsWith('.xls');

    const processData = (rows: string[][]) => {
      if (rows.length < 2) {
        reject(new Error('Datei ist leer oder ungültig'));
        return;
      }

      // Finde die Header-Zeile (suche nach "Name" oder "Vorname" in einer Zeile)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rowLower = rows[i].map(c => (c || '').toString().toLowerCase());
        if (rowLower.some(c => c.includes('name') || c.includes('vorname'))) {
          headerRowIndex = i;
          break;
        }
      }

      // Parse Header um Spalten zu identifizieren
      const headers = rows[headerRowIndex].map(h => (h || '').toString().trim().toLowerCase());

      // Finde Spalten-Indizes (flexibel für verschiedene Formate)
      const findColumn = (...names: string[]) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const nameCol = findColumn('name', 'nachname');
      const vornameCol = findColumn('vorname', 'firstname');
      const clubCol = findColumn('verein', 'club');
      const birthCol = findColumn('geburt', 'birth', 'datum');
      const ageGroupCol = findColumn('altersklasse', 'altersk', 'age');
      const levelCol = findColumn('niveau', 'level', 'leistung');
      const emailCol = findColumn('email', 'mail', 'adresse');

      // Überspringe Header (Zeilen bis inkl. Header-Zeile)
      const dataRows = rows.slice(headerRowIndex + 1);
      const newPlayers: Player[] = [];

      dataRows.forEach((values) => {
        if (values.length >= 2) {
          // Baue Namen zusammen
          let fullName = '';
          const nameVal = nameCol >= 0 ? (values[nameCol] || '').toString().trim() : '';
          const vornameVal = vornameCol >= 0 ? (values[vornameCol] || '').toString().trim() : '';

          if (nameVal && vornameVal) {
            fullName = `${vornameVal} ${nameVal}`.trim();
          } else if (nameVal) {
            fullName = nameVal;
          } else if (values[0]) {
            // Fallback: Erste Spalte als Name
            const v0 = (values[0] || '').toString().trim();
            const v1 = (values[1] || '').toString().trim();
            fullName = vornameCol >= 0 && v1 ? `${v0} ${v1}` : v0;
          }

          if (!fullName) return;

          // Prüfe ob Spieler bereits existiert (nach Name)
          const exists = existingPlayers.some(p => p.name.toLowerCase() === fullName.toLowerCase());
          if (exists) return;

          // Parse Altersklasse (Excel: Bambini/Kleinfeld/Midcourt/Großfeld → App: Green/Red/Orange/Yellow)
          let ageGroup: AgeGroup | undefined;
          if (ageGroupCol >= 0 && values[ageGroupCol]) {
            const ag = values[ageGroupCol].toString().toLowerCase();
            if (ag.includes('bambini')) ageGroup = 'Green';
            else if (ag.includes('kleinfeld')) ageGroup = 'Red';
            else if (ag.includes('midcourt')) ageGroup = 'Orange';
            else if (ag.includes('großfeld') || ag.includes('grossfeld')) ageGroup = 'Yellow';
          }

          // Parse Level aus Niveau-Spalte
          let level: Level = 'C';
          if (levelCol >= 0 && values[levelCol]) {
            const lv = values[levelCol].toString().toLowerCase();
            if (lv.includes('turniererfahren') || lv.includes('a-')) level = 'A';
            else if (lv.includes('mittelstufe') || lv.includes('b-')) level = 'B';
            else if (lv.includes('einsteiger') || lv.includes('c-')) level = 'C';
            else if (lv === 'a') level = 'A';
            else if (lv === 'b') level = 'B';
            else if (lv === 'c') level = 'C';
          }

          // Parse Geburtsdatum
          let birthDate: string | undefined;
          if (birthCol >= 0 && values[birthCol]) {
            const bd = values[birthCol].toString().trim();
            // Nur Jahr (z.B. "2015")
            if (/^\d{4}$/.test(bd)) {
              birthDate = `${bd}-01-01`;
            } else {
              birthDate = bd;
            }
          }

          newPlayers.push({
            id: generateId(),
            name: fullName,
            club: clubCol >= 0 ? (values[clubCol] || '').toString().trim() || undefined : undefined,
            email: emailCol >= 0 ? (values[emailCol] || '').toString().trim() || undefined : undefined,
            birthDate,
            ageGroup,
            level,
            isTeam: false,
            teamMembers: []
          });
        }
      });

      resolve(newPlayers);
    };

    if (isExcel) {
      // Excel-Datei (.xlsx, .xlsm, .xls)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          processData(rows);
        } catch (error) {
          reject(new Error('Fehler beim Parsen der Excel-Datei'));
        }
      };
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsArrayBuffer(file);
    } else {
      // CSV/TXT-Datei
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim());

          // Parse jede Zeile in Array von Werten
          const rows = lines.map(line => {
            const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
            return line.split(delimiter).map(v => v.replace(/^"|"$/g, '').trim());
          });

          processData(rows);
        } catch (error) {
          reject(new Error('Fehler beim Parsen der CSV-Datei'));
        }
      };
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file, 'UTF-8');
    }
  });
};

// --- PRINT HELPERS ---
const printMatchSchedule = (
  level: Level,
  ageGroup: AgeGroup,
  fixtures: PlannedMatch[],
  stats: any[],
  players: Player[],
  tournamentName: string,
  roundName: string
) => {
  const resolveName = (id: string) => players.find(p => p.id === id)?.name || 'Unbekannt';

  const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Spielplan - ${level} - ${ageGroup}</title>
  <style>
    @media print {
      @page { margin: 1.5cm; }
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      padding: 15px;
      background: white;
      color: black;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #10b981;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      color: #10b981;
    }
    .header p {
      margin: 3px 0;
      font-size: 11px;
      color: #666;
    }
    .section {
      margin-bottom: 20px;
    }
    .section h2 {
      font-size: 16px;
      margin-bottom: 8px;
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 5px;
    }
    .fixtures-container {
      column-count: 2;
      column-gap: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    th, td {
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #e2e8f0;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      font-weight: bold;
      color: #334155;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .fixture-card {
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 3px;
      page-break-inside: avoid;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
    }
    .fixture-round {
      min-width: 45px;
      font-size: 9px;
      font-weight: bold;
      color: #64748b;
    }
    .fixture-match {
      flex: 1;
      font-size: 11px;
      font-weight: bold;
    }
    .fixture-details {
      display: flex;
      gap: 6px;
      font-size: 9px;
      color: #64748b;
      min-width: 60px;
      justify-content: flex-end;
    }
    .rank-badge {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      border-radius: 50%;
      font-weight: bold;
      font-size: 11px;
    }
    .rank-1 { background: #fbbf24; color: #78350f; }
    .rank-2 { background: #d1d5db; color: #1f2937; }
    .rank-3 { background: #fb923c; color: #7c2d12; }
    .rank-other { background: #e2e8f0; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Spielplan - ${level} - ${ageGroup}</h1>
    <p><strong>${tournamentName}</strong> • ${roundName}</p>
    <p>Erstellt am: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <div class="section">
    <h2>📋 Rangliste</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 50px; text-align: center;">Platz</th>
          <th>Name</th>
          <th style="width: 80px; text-align: center;">Teiln.</th>
          <th style="width: 60px; text-align: center;">S</th>
          <th style="width: 60px; text-align: center;">KN</th>
          <th style="width: 60px; text-align: center;">N</th>
          <th style="width: 100px; text-align: right;">Punkte</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map((s, idx) => `
          <tr>
            <td style="text-align: center;">
              <span class="rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}">
                ${idx + 1}
              </span>
            </td>
            <td><strong>${s.player.name}</strong></td>
            <td style="text-align: center;">${s.participationPoints}</td>
            <td style="text-align: center;">${s.wins}</td>
            <td style="text-align: center;">${s.close}</td>
            <td style="text-align: center;">${s.losses}</td>
            <td style="text-align: right;"><strong>${s.points.toFixed(1)} Pkt</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>🎾 Spielpaarungen (${fixtures.length} Spiele)</h2>
    <div class="fixtures-container">
      ${fixtures.map(f => `
        <div class="fixture-card">
          <div class="fixture-round">Runde ${f.round}</div>
          <div class="fixture-match">
            ${resolveName(f.p1Id)} <span style="color: #94a3b8;">vs</span> ${resolveName(f.p2Id)}
          </div>
          <div class="fixture-details">
            ${f.time ? `<span>🕐 ${f.time}</span>` : '<span style="opacity: 0.3;">🕐 —</span>'}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

const printAllGroupsSchedule = (
  ageGroup: AgeGroup,
  allGroupsData: Array<{
    level: Level;
    fixtures: PlannedMatch[];
    stats: any[];
  }>,
  players: Player[],
  tournamentName: string,
  roundName: string
) => {
  const resolveName = (id: string) => players.find(p => p.id === id)?.name || 'Unbekannt';

  const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Spielplan - Alle Gruppen - ${ageGroup}</title>
  <style>
    @media print {
      @page { margin: 1.5cm; }
      body { margin: 0; }
      .page-break { page-break-before: always; }
    }
    body {
      font-family: Arial, sans-serif;
      padding: 15px;
      background: white;
      color: black;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #10b981;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      color: #10b981;
    }
    .header p {
      margin: 3px 0;
      font-size: 11px;
      color: #666;
    }
    .group-section {
      margin-bottom: 30px;
    }
    .group-title {
      font-size: 18px;
      font-weight: bold;
      color: #334155;
      margin-bottom: 15px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-left: 4px solid #10b981;
    }
    .section {
      margin-bottom: 20px;
    }
    .section h2 {
      font-size: 16px;
      margin-bottom: 8px;
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 5px;
    }
    .fixtures-container {
      column-count: 2;
      column-gap: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    th, td {
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #e2e8f0;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      font-weight: bold;
      color: #334155;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .fixture-card {
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 3px;
      page-break-inside: avoid;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
    }
    .fixture-round {
      min-width: 45px;
      font-size: 9px;
      font-weight: bold;
      color: #64748b;
    }
    .fixture-match {
      flex: 1;
      font-size: 11px;
      font-weight: bold;
    }
    .fixture-details {
      display: flex;
      gap: 6px;
      font-size: 9px;
      color: #64748b;
      min-width: 60px;
      justify-content: flex-end;
    }
    .rank-badge {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      border-radius: 50%;
      font-weight: bold;
      font-size: 11px;
    }
    .rank-1 { background: #fbbf24; color: #78350f; }
    .rank-2 { background: #d1d5db; color: #1f2937; }
    .rank-3 { background: #fb923c; color: #7c2d12; }
    .rank-other { background: #e2e8f0; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Spielplan - Alle Gruppen - ${ageGroup}</h1>
    <p><strong>${tournamentName}</strong> • ${roundName}</p>
    <p>Erstellt am: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  ${allGroupsData.map((groupData, idx) => `
    ${idx > 0 ? '<div class="page-break"></div>' : ''}
    <div class="group-section">
      <div class="group-title">Level ${groupData.level}</div>

      <div class="section">
        <h2>📋 Rangliste</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Platz</th>
              <th>Name</th>
              <th style="width: 80px; text-align: center;">Teiln.</th>
              <th style="width: 60px; text-align: center;">S</th>
              <th style="width: 60px; text-align: center;">KN</th>
              <th style="width: 60px; text-align: center;">N</th>
              <th style="width: 100px; text-align: right;">Punkte</th>
            </tr>
          </thead>
          <tbody>
            ${groupData.stats.map((s, idx) => `
              <tr>
                <td style="text-align: center;">
                  <span class="rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}">
                    ${idx + 1}
                  </span>
                </td>
                <td><strong>${s.player.name}</strong></td>
                <td style="text-align: center;">${s.participationPoints}</td>
                <td style="text-align: center;">${s.wins}</td>
                <td style="text-align: center;">${s.close}</td>
                <td style="text-align: center;">${s.losses}</td>
                <td style="text-align: right;"><strong>${s.points.toFixed(1)} Pkt</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>🎾 Spielpaarungen (${groupData.fixtures.length} Spiele)</h2>
        <div class="fixtures-container">
          ${groupData.fixtures.map(f => `
            <div class="fixture-card">
              <div class="fixture-round">Runde ${f.round}</div>
              <div class="fixture-match">
                ${resolveName(f.p1Id)} <span style="color: #94a3b8;">vs</span> ${resolveName(f.p2Id)}
              </div>
              <div class="fixture-details">
                ${f.time ? `<span>🕐 ${f.time}</span>` : '<span style="opacity: 0.3;">🕐 —</span>'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('')}
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

// --- BACKUP & RESTORE HELPERS ---
const exportBackup = (data: {
  players: Player[];
  tournaments: Tournament[];
  results: TournamentResult[];
  plannerFixtures: Record<string, PlannedMatch[]>;
  groupMatchModes: Record<string, string>;
  customGroupWeights: Record<string, number>;
}) => {
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tennis_manager_backup_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const importBackup = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.version || !backup.data) {
          reject(new Error('Ungültiges Backup-Format'));
          return;
        }

        resolve(backup.data);
      } catch (error) {
        reject(new Error('Fehler beim Lesen der Backup-Datei'));
      }
    };

    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
    reader.readAsText(file, 'UTF-8');
  });
};
// Komponente für Score-Input mit lokaler Live-Vorschau (performant)
const ScoreInputWithPreview = ({
  fixtureId,
  defaultValue,
  p1Name,
  p2Name,
  weight,
  scoringMode,
  darkMode,
  analyzeSingleScore: analyze,
  onScoreChange
}: {
  fixtureId: string;
  defaultValue: string;
  p1Name: string;
  p2Name: string;
  weight: number;
  scoringMode: ScoringMode;
  darkMode: boolean;
  analyzeSingleScore: (score: string, mode: ScoringMode) => { isWin: boolean; isCloseLoss: boolean };
  onScoreChange?: (fixtureId: string, score: string) => void;
}) => {
  const [localScore, setLocalScore] = useState(defaultValue);

  // CRITICAL FIX: Sync localScore when defaultValue changes (e.g., server refresh)
  useEffect(() => {
    setLocalScore(defaultValue);
  }, [defaultValue, fixtureId]);

  const handleChange = (value: string) => {
    setLocalScore(value);
    if (onScoreChange) {
      onScoreChange(fixtureId, value);
    }
  };

  // Analysiere aus P1 Perspektive
  const resultP1 = localScore ? analyze(localScore, scoringMode) : null;
  // Analysiere aus P2 Perspektive (umgekehrter Score)
  const reversedScore = localScore ? localScore.split(' ').map(set => {
    const [p1, p2] = set.split(':');
    return `${p2}:${p1}`;
  }).join(' ') : '';
  const resultP2 = reversedScore ? analyze(reversedScore, scoringMode) : null;

  // Korrekte Punkte-Berechnung:
  // Gewinner bekommt 2, Verlierer bekommt 1 bei knapper Niederlage
  const p1Points = resultP1 ? (resultP1.isWin ? 2 * weight : (resultP1.isCloseLoss ? 1 * weight : 0)) : 0;
  const p2Points = resultP2 ? (resultP2.isWin ? 2 * weight : (resultP2.isCloseLoss ? 1 * weight : 0)) : 0;

  return (
    <>
      <input
        type="text"
        id={`score-input-${fixtureId}`}
        placeholder="z.B. 6:4 4:6 10:8"
        className={`w-full p-2 border rounded text-xs transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}
        value={localScore}
        onChange={e => handleChange(e.target.value)}
      />
      {localScore && resultP1 && (
        <div className={`text-[10px] px-2 py-1 rounded transition-colors overflow-hidden ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-blue-50 text-slate-600'}`}>
          💡 <span className="truncate inline-block max-w-[80px] align-bottom">{p1Name}</span>: <b className={darkMode ? 'text-emerald-400' : 'text-emerald-700'}>{p1Points.toFixed(1)}P</b> • <span className="truncate inline-block max-w-[80px] align-bottom">{p2Name}</span>: <b className={darkMode ? 'text-emerald-400' : 'text-emerald-700'}>{p2Points.toFixed(1)}P</b> <span className="text-slate-400">(×{weight.toFixed(2)})</span>
        </div>
      )}
    </>
  );
};

const TennisManager = () => {

  // --- STATE ---

  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem('isAdmin');
    return saved ? JSON.parse(saved) : false;
  });

  const [currentUser, setCurrentUser] = useState<string>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : '';
  });

  const [currentAdminId, setCurrentAdminId] = useState<string>(() => {
    const saved = localStorage.getItem('currentAdminId');
    return saved ? JSON.parse(saved) : '';
  });


  // Login Inputs

  const [adminUsernameInput, setAdminUsernameInput] = useState('');

  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // Theme
  // Custom Group Weights
  const [customGroupWeights, setCustomGroupWeights] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('customGroupWeights');
    return saved ? JSON.parse(saved) : {};
  });

  // Data

  const [players, setPlayers] = useState<Player[]>([]);

  const [pendingRegistrations, setPendingRegistrations] = useState<RegistrationRequest[]>([]);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [results, setResults] = useState<TournamentResult[]>([]);


  // NEW: Multi-Bracket State

  const [brackets, setBrackets] = useState<Record<string, Bracket>>({});


  const [admins, setAdmins] = useState<AdminAccount[]>([]);


  // UI State

  const [darkMode, setDarkMode] = useState(() => {
    // Load dark mode preference from localStorage
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [activeTab, setActiveTab] = useState<PlannerTab>('ranking');

  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [editPlayerLevel, setEditPlayerLevel] = useState<Level>('C');
  const [editPlayerAgeGroup, setEditPlayerAgeGroup] = useState<AgeGroup | 'auto'>('auto');
  const [editPlayerClub, setEditPlayerClub] = useState('');
  const [editPlayerEmail, setEditPlayerEmail] = useState('');


  // Toasts & Dialogs

  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null);



  // Ranking Filters

  const [rankingScope, setRankingScope] = useState<string>('overall');
  const [rankingRoundScope, setRankingRoundScope] = useState<string>('all');
  const [rankingAgeGroup, setRankingAgeGroup] = useState<string>('All');
  const [rankingLevelFilter, setRankingLevelFilter] = useState<Level | 'All'>('All');
  const [rankingSearchQuery, setRankingSearchQuery] = useState('');
  const [rankingViewMode, setRankingViewMode] = useState<'overall' | 'tournament'>('overall');
  const [rankingTournamentSelection, setRankingTournamentSelection] = useState('');
  const [includeArchivedInRanking, setIncludeArchivedInRanking] = useState(false);

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
  const [regAllowAgeOverride, setRegAllowAgeOverride] = useState(false);
  const [regManualAgeGroup, setRegManualAgeGroup] = useState<AgeGroup | ''>('');
  const [regPlayersAgeFilter, setRegPlayersAgeFilter] = useState<AgeGroup | 'All'>('All');
  const [regPlayersLevelFilter, setRegPlayersLevelFilter] = useState<Level | 'All'>('All');
  const [regPlayersSearch, setRegPlayersSearch] = useState('');



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

  const [sets, setSets] = useState<{ p1: string, p2: string }[]>([{ p1: '', p2: '' }]);

  const [matchAnalysis, setMatchAnalysis] = useState<{ isWin: boolean, isCloseLoss: boolean, message: string } | null>(null);

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
  // Persistent group members - survives fixture deletion
  // Key: "{roundId}-{ageGroup}-{level}", Value: Array of player IDs
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [plannerAgeGroup, setPlannerAgeGroup] = useState<AgeGroup>('Red');
  const [plannerScoreInput, setPlannerScoreInput] = useState<Record<string, string>>({});
  const [plannerScoringMode, setPlannerScoringMode] = useState<ScoringMode>('race10');
  const [plannerSelectedPlayerId, setPlannerSelectedPlayerId] = useState('');
  const [plannerPlayerSearch, setPlannerPlayerSearch] = useState('');
  const [plannerFilterAgeGroup, setPlannerFilterAgeGroup] = useState<AgeGroup | 'All'>('All');
  const [plannerFilterLevel, setPlannerFilterLevel] = useState<Level | 'All'>('All');
  const [plannerNewLevel, setPlannerNewLevel] = useState<Level>('C');
  const [plannerTargetAgeGroup, setPlannerTargetAgeGroup] = useState<AgeGroup>('Red');
  const [editingWeightGroup, setEditingWeightGroup] = useState<string | null>(null);
  const [editingWeightValue, setEditingWeightValue] = useState('');
  const [plannerCurrentPage, setPlannerCurrentPage] = useState(1);
  const [showTournamentField, setShowTournamentField] = useState(() => {
    const saved = localStorage.getItem('showTournamentField');
    return saved ? JSON.parse(saved) : true;
  });
  const [enableTournamentMenu, setEnableTournamentMenu] = useState(true);
  const [editingFixtures, setEditingFixtures] = useState<Record<string, boolean>>({});

  // Neue States für Turniertag-basiertes System
  const [plannerSelectedTournamentId, setPlannerSelectedTournamentId] = useState<string>('');
  const [plannerSelectedRoundId, setPlannerSelectedRoundId] = useState<string>('');
  const [groupMatchModes, setGroupMatchModes] = useState<Record<string, 'auto' | 'single' | 'double'>>({});

  // Ausgeschlossene Spieler pro Turniertag (werden bei Auslosung nicht berücksichtigt)
  // Format: { "roundId-ageGroup-level": ["playerId1", "playerId2"] }
  const [excludedPlayers, setExcludedPlayers] = useState<Record<string, string[]>>({});
  const [showExcludedPlayersModal, setShowExcludedPlayersModal] = useState(false);

  // Spieler-Auswahl Modal vor Auslosung
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false);
  const [playerSelectionLevel, setPlayerSelectionLevel] = useState<Level>('C');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  // Filter für das Modal - ermöglicht Spieler aus anderen Gruppen hinzuzufügen
  const [modalFilterAgeGroup, setModalFilterAgeGroup] = useState<AgeGroup | 'All'>('All');
  const [modalFilterLevel, setModalFilterLevel] = useState<Level | 'All'>('All');
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Recently Played Matches Modal
  const [showRecentlyPlayedModal, setShowRecentlyPlayedModal] = useState(false);
  const [recentlyPlayedLevel, setRecentlyPlayedLevel] = useState<Level | null>(null);
  const [recentlyPlayedFixtures, setRecentlyPlayedFixtures] = useState<PlannedMatch[]>([]);

  // Synchronisiere Target-Altersgruppe mit plannerAgeGroup
  useEffect(() => {
    setPlannerTargetAgeGroup(plannerAgeGroup);
  }, [plannerAgeGroup]);

  // Custom group weights persistence
  useEffect(() => {
    localStorage.setItem('customGroupWeights', JSON.stringify(customGroupWeights));
  }, [customGroupWeights]);

  // Initialisiere Turnier/Round Auswahl
  useEffect(() => {
    if (tournaments.length > 0 && !plannerSelectedTournamentId) {
      setPlannerSelectedTournamentId(tournaments[0].id);
      if (tournaments[0].rounds.length > 0) {
        setPlannerSelectedRoundId(tournaments[0].rounds[0].id);
      }
    }
  }, [tournaments, plannerSelectedTournamentId]);

  // Dark Mode Effect
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    const htmlElement = document.documentElement;
    if (darkMode) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Session Persistence - Admin State
  useEffect(() => {
    localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
  }, [isAdmin]);

  // Session Persistence - Current User
  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }, [currentUser]);

  // --- LIVE POLLING: Auto-Refresh alle 10 Sekunden im Spielplan-Tab ---
  useEffect(() => {
    // Nur im Spielplan-Tab aktiv und nur wenn eingeloggt
    if (activeTab !== 'planner' || !isAdmin) return;

    const pollData = async () => {
      try {
        const [freshResults, freshFixtures] = await Promise.all([
          apiLoad(STORAGE_KEYS.RESULTS),
          apiLoad(STORAGE_KEYS.PLANNER)
        ]);

        // Vergleiche mit aktuellem State, aktualisiere nur bei Änderungen
        if (freshResults && JSON.stringify(freshResults) !== JSON.stringify(results)) {
          console.log('🔄 Neue Ergebnisse erkannt, aktualisiere...');
          setResults(freshResults);
        }
        if (freshFixtures && JSON.stringify(freshFixtures) !== JSON.stringify(plannerFixtures)) {
          console.log('🔄 Neue Fixtures erkannt, aktualisiere...');
          setPlannerFixtures(freshFixtures);
        }
      } catch (e) {
        console.error('Polling-Fehler:', e);
      }
    };

    const interval = setInterval(pollData, 10000); // Alle 10 Sekunden

    return () => clearInterval(interval);
    // Bewusst ohne results/plannerFixtures in deps um Endlosschleife zu vermeiden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin]);

  useEffect(() => {
    localStorage.setItem('currentAdminId', JSON.stringify(currentAdminId));
  }, [currentAdminId]);

  // Helper: Hole aktuellen Admin und dessen Berechtigungen
  const currentAdmin = useMemo(() => {
    if (!currentAdminId || !isAdmin) return null;
    return admins.find(a => a.id === currentAdminId) || null;
  }, [currentAdminId, isAdmin, admins]);

  const isSuperAdmin = currentAdmin?.isSuperAdmin ?? false;

  // Berechtigungsprüfung - Super-Admin hat immer alle Rechte
  const hasPermission = (permission: keyof AdminPermissions): boolean => {
    // Nicht eingeloggt = keine Berechtigung
    if (!isAdmin) return false;

    // Admins werden noch geladen - warte auf Daten
    if (admins.length === 0) return false;

    // Admin nicht gefunden - keine Berechtigung
    if (!currentAdmin) return false;

    // Super-Admin hat immer alle Rechte
    if (currentAdmin.isSuperAdmin) return true;

    // Prüfe die spezifische Berechtigung
    const permissions = currentAdmin.permissions;

    // Wenn keine Permissions definiert sind, nutze Default (alle erlaubt für Abwärtskompatibilität)
    if (!permissions) return true;

    // Prüfe die spezifische Berechtigung
    return permissions[permission] === true;
  };

  // Prüfe Berechtigung und zeige Fehlermeldung wenn nicht vorhanden
  const checkPermission = (permission: keyof AdminPermissions, actionName: string): boolean => {
    if (hasPermission(permission)) return true;
    addToast(`Keine Berechtigung: ${actionName}`, 'error');
    return false;
  };

  // Tournament Field Setting Persistence
  useEffect(() => {
    localStorage.setItem('showTournamentField', JSON.stringify(showTournamentField));
  }, [showTournamentField]);

  // Tournament Menu Setting Persistence (auf Server speichern)
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    // Erst speichern nachdem die Settings geladen wurden
    if (!settingsLoadedRef.current) return;
    saveData(STORAGE_KEYS.SETTINGS, { enableTournamentMenu });
  }, [enableTournamentMenu]);


  // Generator Config

  const [testPlayerCount, setTestPlayerCount] = useState(200);

  const [testMatchesPerPlayer, setTestMatchesPerPlayer] = useState(4);

  const [isGenerating, setIsGenerating] = useState(false);

  const [generationStatus, setGenerationStatus] = useState('');



  // --- INITIAL LOAD ---

  // --- INITIAL LOAD ---
  useEffect(() => {
    const loadData = async () => {
      // Wir laden alles parallel vom Server (mit Retry bei Verbindungsproblemen)
      const [p, t, r, reg, bMap, a, planner, settings, gMembers] = await Promise.all([
        apiLoad(STORAGE_KEYS.PLAYERS),
        apiLoad(STORAGE_KEYS.TOURNAMENTS),
        apiLoad(STORAGE_KEYS.RESULTS),
        apiLoad(STORAGE_KEYS.REGISTRATIONS),
        apiLoad(STORAGE_KEYS.BRACKETS),
        apiLoad(STORAGE_KEYS.ADMINS),
        apiLoad(STORAGE_KEYS.PLANNER),
        apiLoad(STORAGE_KEYS.SETTINGS),
        apiLoad(STORAGE_KEYS.GROUP_MEMBERS)
      ]);

      // Prüfe ob mindestens eine Abfrage erfolgreich war (nicht null)
      // Das zeigt dass der Server erreichbar ist
      const anySuccess = [p, t, r, reg, bMap, a, planner, settings, gMembers].some(x => x !== null);

      if (!anySuccess) {
        console.error("❌ Server nicht erreichbar! Daten werden NICHT überschrieben.");
        // Zeige eine Warnung an (Toast wird später initialisiert)
        alert("⚠️ Server-Verbindung fehlgeschlagen!\n\nDie Daten konnten nicht geladen werden. Bitte stelle sicher, dass der Server läuft und lade die Seite neu.");
        return;
      }

      // Server-Verbindung ist OK - ab jetzt dürfen Daten gespeichert werden
      serverConnectionOK = true;
      console.log("✅ Server-Verbindung erfolgreich, Daten geladen");

      if (p) setPlayers(p);
      if (t) {
        setTournaments(t);
        if (t.length > 0 && !selectedTournamentId) setSelectedTournamentId(t[0].id);
      }
      if (r) setResults(r);
      if (reg) setPendingRegistrations(reg);
      if (bMap) setBrackets(bMap);
      if (planner) setPlannerFixtures(planner);
      if (gMembers) setGroupMembers(gMembers);
      if (settings) {
        if (settings.enableTournamentMenu !== undefined) setEnableTournamentMenu(settings.enableTournamentMenu);
      }

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

      // Settings wurden geladen - ab jetzt dürfen Änderungen gespeichert werden
      settingsLoadedRef.current = true;
    };

    loadData();
  }, []);

  // --- TAB VISIBILITY SYNC (Multi-Tab Fix) ---
  // Lädt Daten automatisch neu wenn der Tab wieder aktiv wird
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && serverConnectionOK) {
        console.log('🔄 Tab ist aktiv - Lade Daten neu...');
        try {
          const [freshResults, freshBrackets, freshPlanner] = await Promise.all([
            apiLoad(STORAGE_KEYS.RESULTS),
            apiLoad(STORAGE_KEYS.BRACKETS),
            apiLoad(STORAGE_KEYS.PLANNER)
          ]);
          if (freshResults) setResults(freshResults);
          if (freshBrackets) setBrackets(freshBrackets);
          if (freshPlanner) setPlannerFixtures(freshPlanner);
          console.log('✅ Daten erfolgreich synchronisiert');
        } catch (err) {
          console.error('❌ Fehler beim Synchronisieren:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const saveData = async (key: string, data: any) => {
    await apiSave(key, data);
  };
  const updatePlayers = async (newPlayers: Player[]) => {
    setPlayers(newPlayers);
    await saveData(STORAGE_KEYS.PLAYERS, newPlayers);
  };



  const updateTournaments = async (newTournaments: Tournament[]) => {
    setTournaments(newTournaments);
    await saveData(STORAGE_KEYS.TOURNAMENTS, newTournaments);
  };



  // SERVER-FIRST: Speichere zum Server, dann lade frische Daten
  const updateResults = async (newResults: TournamentResult[]) => {
    // Erst zum Server speichern
    await saveData(STORAGE_KEYS.RESULTS, newResults);
    // Dann frische Daten vom Server laden (garantiert Konsistenz)
    const freshData = await apiLoad(STORAGE_KEYS.RESULTS);
    if (freshData) setResults(freshData);
    else setResults(newResults); // Fallback falls Server nicht erreichbar
  };



  const updateRegistrations = async (newRegs: RegistrationRequest[]) => {
    await saveData(STORAGE_KEYS.REGISTRATIONS, newRegs);
    const freshData = await apiLoad(STORAGE_KEYS.REGISTRATIONS);
    if (freshData) setPendingRegistrations(freshData);
    else setPendingRegistrations(newRegs);
  };


  const updateBracketMap = async (newBrackets: Record<string, Bracket>) => {
    await saveData(STORAGE_KEYS.BRACKETS, newBrackets);
    const freshData = await apiLoad(STORAGE_KEYS.BRACKETS);
    if (freshData) setBrackets(freshData);
    else setBrackets(newBrackets);
  };

  const updatePlannerFixtures = async (newFixtures: Record<string, PlannedMatch[]>) => {
    await saveData(STORAGE_KEYS.PLANNER, newFixtures);
    const freshData = await apiLoad(STORAGE_KEYS.PLANNER);
    if (freshData) setPlannerFixtures(freshData);
    else setPlannerFixtures(newFixtures);
  };

  // Update persistent group members (survives fixture deletion)
  const updateGroupMembers = async (newMembers: Record<string, string[]>) => {
    await saveData(STORAGE_KEYS.GROUP_MEMBERS, newMembers);
    const freshData = await apiLoad(STORAGE_KEYS.GROUP_MEMBERS);
    if (freshData) setGroupMembers(freshData);
    else setGroupMembers(newMembers);
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

  useEffect(() => {
    if (rankingViewMode !== 'tournament') {
      if (rankingScope !== 'overall') setRankingScope('overall');
      if (rankingRoundScope !== 'all') setRankingRoundScope('all');
      return;
    }

    if (!rankingTournamentSelection) {
      if (tournaments.length > 0) {
        setRankingTournamentSelection(tournaments[0].id);
      } else if (rankingScope !== 'overall') {
        setRankingScope('overall');
      }
      return;
    }

    if (rankingScope !== rankingTournamentSelection) {
      setRankingScope(rankingTournamentSelection);
      setRankingRoundScope('all');
    }
  }, [rankingViewMode, rankingTournamentSelection, rankingScope, rankingRoundScope, tournaments]);

  useEffect(() => {
    if (rankingViewMode !== 'tournament') return;
    if (!rankingTournamentSelection) return;
    if (!tournaments.some(t => t.id === rankingTournamentSelection)) {
      setRankingTournamentSelection(tournaments[0]?.id || '');
    }
  }, [rankingTournamentSelection, rankingViewMode, tournaments]);

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
    return AGE_RANK[playerAge] <= AGE_RANK[targetAge]; // jüngere dürfen nach oben, nicht umgekehrt
  };



  const getSortedAgeGroups = () => {

    const groups = new Set(players.map(p => calculateAgeGroup(p)));
    const validGroups = AGE_GROUP_ORDER.filter(g => groups.has(g));

    const present: (AgeGroup | 'All')[] = ["All", ...validGroups];
    AGE_GROUP_ORDER.forEach(d => { if (!present.includes(d)) present.push(d) });

    return present;

  };

  const regAutoAgeGroup = regBirthDate ? calculateAgeGroup(regBirthDate) : null;
  const regPreviewAge = regAutoAgeGroup ? formatAgeGroupLabel(regAutoAgeGroup) : 'wird automatisch zugewiesen';

  useEffect(() => {
    if (!regAllowAgeOverride) return;
    if (!regBirthDate) {
      setRegAllowAgeOverride(false);
      setRegManualAgeGroup('');
      return;
    }
    if (!regManualAgeGroup) {
      setRegManualAgeGroup(regAutoAgeGroup || 'Yellow');
    }
  }, [regAllowAgeOverride, regBirthDate, regAutoAgeGroup, regManualAgeGroup]);

  const displayAgeGroup = (g: AgeGroup | 'All') => g === 'All' ? 'Alle Altersklassen' : formatAgeGroupLabel(g);
  const renderLevelBadge = (level?: Level | null, size: 'sm' | 'md' = 'md') => {
    if (!level) return null;
    const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
    const levelColor = level === 'C' && darkMode ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' : LEVEL_COLORS[level];
    return (
      <span className={`inline-flex items-center font-semibold rounded-full ${levelColor} ${sizeClasses}`}>
        Leistungsklasse {level}
      </span>
    );
  };



  const getGroupSizeWeight = (participantCount: number, ageGroup?: AgeGroup, level?: Level) => {

    if (participantCount <= 0) return 1;

    // Check for custom weight override
    if (ageGroup && level) {
      const groupKey = `${ageGroup}-${level}`;
      if (customGroupWeights[groupKey] !== undefined) {
        return customGroupWeights[groupKey];
      }
    }

    // Finde die größte Gruppe ÜBER ALLE Leistungsklassen in dieser Altersklasse
    // Das sorgt dafür, dass kleinere Leistungsklassen eine höhere Gewichtung bekommen
    let maxGroupSize = participantCount; // Mindestens die aktuelle Gruppe

    if (ageGroup) {
      // Finde die größte Gruppe in dieser Altersklasse (über alle Levels A, B, C)
      const levelCounts = (['A', 'B', 'C'] as Level[]).map(l =>
        players.filter(p => calculateAgeGroup(p) === ageGroup && p.level === l).length
      );
      maxGroupSize = Math.max(...levelCounts, participantCount);
    }

    // Faire Gewichtungsberechnung mit Dämpfungsfaktor:
    // Kleinere Gruppen erhalten leicht HÖHERE Gewichtung (weniger Spiele = etwas mehr Punkte pro Spiel)
    // Größte Gruppe erhält Gewichtung 1.0 (Minimum)
    // Dämpfungsfaktor 0.2 (20%) macht die Unterschiede sehr klein und fair
    //
    // Formel: 1.0 + (sqrt(maxGroupSize) / sqrt(participantCount) - 1.0) * 0.2
    //
    // Beispiel bei maxGroupSize = 10:
    // - Gruppe mit 10 Spielern: 1.00 (Basisgewichtung)
    // - Gruppe mit 5 Spielern:  1.00 + (1.41 - 1.00) * 0.2 = 1.08 (nur 8% höher)
    // - Gruppe mit 3 Spielern:  1.00 + (1.83 - 1.00) * 0.2 = 1.17 (nur 17% höher)
    const baseWeight = Math.sqrt(maxGroupSize) / Math.sqrt(participantCount);
    const dampingFactor = 0.2; // Nur 20% des Unterschieds wird berücksichtigt
    const weight = 1.0 + (baseWeight - 1.0) * dampingFactor;

    // Stelle sicher, dass die Gewichtung mindestens 1.0 ist
    return parseFloat(Math.max(1.0, weight).toFixed(2));

  };

  const getMatchLevel = (match: MatchRecord, fallback?: Level | null) => match.levelAtMatch || fallback || null;

  // Key für Planner-Fixtures: enthält Spieltag, Altersgruppe und Level
  const getPlannerKey = (age: AgeGroup, level: Level, roundId?: string) =>
    roundId ? `${roundId}-${age}-${level}` : `${age}-${level}`;

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

  const collectPlannerStats = useMemo(() => {
    // Cache für berechnete Stats - wird bei useMemo dependencies reset
    const cache = new Map<string, { stats: any[], weight: number, participantCount: number }>();

    return (age: AgeGroup, level: Level, tournamentId?: string, roundId?: string, groupFixtures?: PlannedMatch[]) => {
      // Cache-Key erstellen - inkludiert jetzt auch relevante Match-Daten zur Invalidierung
      // WICHTIG: Wir hashen die Fixture-IDs und relevante Result-Daten für bessere Cache-Invalidierung
      const fixtureHash = groupFixtures?.map(f => f.id).join(',') || '';
      const resultsHash = results.filter(r =>
        !tournamentId || r.tournamentId === tournamentId
      ).map(r => `${r.playerId}:${r.matches.length}:${r.matches.map(m => m.isWin ? 'W' : m.isCloseLoss ? 'C' : 'L').join('')}`).join('|');

      const cacheKey = `${age}-${level}-${tournamentId || ''}-${roundId || ''}-${fixtureHash}-${resultsHash}`;

      // Prüfe ob im Cache
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      // Sammle Spieler-IDs, die in den Fixtures dieser Gruppe vorkommen
      const fixturePlayerIds = new Set<string>();
      if (groupFixtures) {
        groupFixtures.forEach(f => {
          fixturePlayerIds.add(f.p1Id);
          fixturePlayerIds.add(f.p2Id);
        });
      }

      // Hole persistente Gruppenmitglieder (überlebt Fixture-Löschung)
      const memberKey = `${roundId}-${age}-${level}`;
      const persistentMemberIds = new Set(groupMembers[memberKey] || []);

      // Filtere Spieler: Zeige Spieler die in Fixtures sind, in groupMembers gespeichert sind, oder Matches haben
      const eligible = players.filter(p => {
        if (calculateAgeGroup(p) !== age || p.level !== level) return false;

        // Spieler ist in Fixtures enthalten
        if (fixturePlayerIds.has(p.id)) return true;

        // ODER Spieler ist in persistenten Gruppenmitgliedern gespeichert
        if (persistentMemberIds.has(p.id)) return true;

        // ODER Spieler hat irgendwelche Matches in dieser Gruppe (planner oder normal)
        const res = results.find(r => r.playerId === p.id && (!tournamentId || r.tournamentId === tournamentId));
        if (res) {
          // Prüfe ob dieser Spieler Matches hat die zu dieser Altersgruppe/Level gehören
          const hasMatches = res.matches.some(m =>
            getMatchLevel(m, p.level || null) === level
          );
          if (hasMatches) return true;
        }

        return false;
      });

      // Für die Anzeige verwenden wir alle eligible Spieler
      const participantCount = eligible.length;

      // Für die Gewichtungsberechnung verwenden wir nur die Spieler, die aktuell in Fixtures sind
      // (nicht die mit alten Matches, die keine Fixtures mehr haben)
      const fixtureParticipantCount = fixturePlayerIds.size > 0 ? fixturePlayerIds.size : participantCount;
      const weight = getGroupSizeWeight(fixtureParticipantCount, age, level);
      const stats = eligible.map(p => {
        const res = results.find(r => r.playerId === p.id && (!tournamentId || r.tournamentId === tournamentId));
        // Sammle ALLE Matches (planner und normale) für dieses Level
        let matches = res ? res.matches.filter(m =>
          getMatchLevel(m, p.level || null) === level
        ) : [];

        // Filtere nach roundId wenn angegeben
        // Hinweis: roundId kann eine normale Round-ID sein oder eine planner-ID
        if (roundId) {
          matches = matches.filter(m => {
            // Match hat die exakt angegebene roundId
            if (m.roundId === roundId) return true;
            // Match ist ein planner-Match für diese Runde
            if (m.roundId === `planner-${roundId}`) return true;
            // Match wurde für den gleichen Spieltag erfasst (normale Eingabe)
            return false;
          });
        }

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
        const participationPoints = roundIds.size; // 1 Punkt pro Spieltag (ungewichtet)
        const points = parseFloat((basePoints * weight + participationPoints).toFixed(1));
        return { player: p, wins, losses, close, points, weight, participationPoints };
      });

      const result = { stats, weight, participantCount };
      cache.set(cacheKey, result);
      return result;
    };
  }, [players, results, customGroupWeights, groupMembers]);

  // Helper: Hole die ausgeschlossenen Spieler für eine Gruppe
  const getExcludedPlayerIds = (roundId: string, ageGroup: AgeGroup, level: Level): string[] => {
    const key = `${roundId}-${ageGroup}-${level}`;
    return excludedPlayers[key] || [];
  };

  // Spieler aus Gruppe ausschließen (wird nicht mehr bei Auslosung berücksichtigt)
  const excludePlayerFromGroup = (playerId: string, ageGroup: AgeGroup, level: Level) => {
    if (!checkPermission('canManagePlanner', 'Spieler aus Gruppe entfernen')) return;
    if (!plannerSelectedRoundId) {
      addToast('Bitte zuerst einen Turniertag auswählen', 'error');
      return;
    }

    const key = `${plannerSelectedRoundId}-${ageGroup}-${level}`;
    const current = excludedPlayers[key] || [];

    if (!current.includes(playerId)) {
      setExcludedPlayers(prev => ({
        ...prev,
        [key]: [...current, playerId]
      }));

      const player = players.find(p => p.id === playerId);
      addToast(`${player?.name || 'Spieler'} aus Gruppe entfernt`, 'info');
    }
  };

  // Spieler wieder zur Gruppe hinzufügen
  const includePlayerInGroup = (playerId: string, ageGroup: AgeGroup, level: Level, roundId?: string) => {
    if (!checkPermission('canManagePlanner', 'Spieler zur Gruppe hinzufügen')) return;
    const targetRound = roundId || plannerSelectedRoundId;
    if (!targetRound) return;

    const key = `${targetRound}-${ageGroup}-${level}`;
    const current = excludedPlayers[key] || [];

    setExcludedPlayers(prev => ({
      ...prev,
      [key]: current.filter(id => id !== playerId)
    }));

    const player = players.find(p => p.id === playerId);
    addToast(`${player?.name || 'Spieler'} wieder zur Gruppe hinzugefügt`, 'success');
  };

  // Hole alle Spieler ohne Gruppe für den aktuellen Turniertag
  const getPlayersWithoutGroup = useMemo(() => {
    if (!plannerSelectedRoundId) return [];

    // Sammle alle Spieler, die aktuell in einer Gruppe sind (in plannerFixtures)
    const playersInGroups = new Set<string>();
    Object.values(plannerFixtures).forEach(fixtures => {
      fixtures.forEach(f => {
        if (f.p1Id) playersInGroups.add(f.p1Id);
        if (f.p2Id) playersInGroups.add(f.p2Id);
      });
    });

    // Sammle alle Spieler die bereits Ergebnisse für diesen Turniertag haben
    const currentRoundId = `planner-${plannerSelectedRoundId}`;
    results.forEach(r => {
      r.matches.forEach(m => {
        if (m.roundId === currentRoundId) {
          playersInGroups.add(r.playerId);
        }
      });
    });

    // Finde alle Spieler die NICHT in einer Gruppe sind
    return players.filter(p => {
      // Prüfe ob Spieler in einer Gruppe ist
      if (playersInGroups.has(p.id)) return false;

      // Prüfe ob Spieler ausgeschlossen wurde
      const ageGroup = calculateAgeGroup(p);
      const level = p.level || 'C';
      const excludedKey = `${plannerSelectedRoundId}-${ageGroup}-${level}`;
      const isExcluded = (excludedPlayers[excludedKey] || []).includes(p.id);

      return isExcluded; // Nur ausgeschlossene Spieler anzeigen
    });
  }, [players, plannerFixtures, results, plannerSelectedRoundId, excludedPlayers]);

  const generatePlannerForAgeGroup = (age: AgeGroup) => {
    if (!checkPermission('canManagePlanner', 'Spielplan generieren')) return;
    const newMap = { ...plannerFixtures };
    (['A', 'B', 'C'] as Level[]).forEach(level => {
      // Berücksichtige ausgeschlossene Spieler
      const excludedIds = plannerSelectedRoundId
        ? getExcludedPlayerIds(plannerSelectedRoundId, age, level)
        : [];

      const eligible = players.filter(p =>
        calculateAgeGroup(p) === age &&
        p.level === level &&
        !excludedIds.includes(p.id) // Ausgeschlossene Spieler nicht berücksichtigen
      );

      const groupKey = `${age}-${level}`;
      const currentMode = groupMatchModes[groupKey] || 'auto';
      const mode: 'single' | 'double' = currentMode === 'auto'
        ? (eligible.length <= 4 ? 'double' : 'single')
        : currentMode;
      const fixtures = generateRoundRobin(eligible.map(p => p.id), mode).map(f => ({
        id: generateId(),
        ageGroup: age,
        level,
        round: f.round,
        p1Id: f.p1Id,
        p2Id: f.p2Id
      }));
      newMap[getPlannerKey(age, level, plannerSelectedRoundId)] = fixtures;
    });
    updatePlannerFixtures(newMap);
    addToast(`Auslosung für ${displayAgeGroup(age)} aktualisiert`, 'success');
  };

  const deletePlannerResult = async (fixture: PlannedMatch) => {
    if (!isAdmin) return;
    if (!plannerSelectedTournamentId || !plannerSelectedRoundId) return;

    const p1 = players.find(p => p.id === fixture.p1Id);
    const p2 = players.find(p => p.id === fixture.p2Id);
    if (!p1 || !p2) return;

    const tournamentId = plannerSelectedTournamentId;
    const roundId = `planner-${plannerSelectedRoundId}`;

    // --- ATOMIC DELETE (Race Condition Fix) ---
    // Lösche Matches für beide Spieler atomar (parallel)
    const [success1, success2] = await Promise.all([
      apiDeleteMatchAtomic(p1.id, tournamentId, roundId, p2.id),
      apiDeleteMatchAtomic(p2.id, tournamentId, roundId, p1.id)
    ]);

    if (!success1 || !success2) {
      addToast('Fehler beim Löschen - bitte erneut versuchen', 'error');
      return;
    }

    // Aktualisiere lokalen State
    let updatedResults = [...results];
    [p1.id, p2.id].forEach(playerId => {
      const idx = updatedResults.findIndex(r => r.playerId === playerId && r.tournamentId === tournamentId);
      if (idx >= 0) {
        updatedResults[idx] = {
          ...updatedResults[idx],
          matches: updatedResults[idx].matches.filter(m =>
            !(m.roundId === roundId && (m.opponentId === p1.id || m.opponentId === p2.id))
          )
        };
      }
    });
    setResults(updatedResults);

    // Entferne auch das Fixture aus dem Plan
    const newFixtures = { ...plannerFixtures };
    const key = getPlannerKey(fixture.ageGroup, fixture.level, plannerSelectedRoundId);
    if (newFixtures[key]) {
      newFixtures[key] = newFixtures[key].filter(f => f.id !== fixture.id);
      updatePlannerFixtures(newFixtures);
    }

    addToast('Spiel und Ergebnis gelöscht', 'success');
  };


  const savePlannerResult = async (fixture: PlannedMatch, directScore?: string) => {
    if (!isAdmin) return;
    // canEnterResults ODER canManagePlanner berechtigt zur Ergebniseingabe im Planner
    if (!hasPermission('canEnterResults') && !hasPermission('canManagePlanner')) {
      addToast('Keine Berechtigung: Ergebnisse eingeben', 'error');
      return;
    }
    const scoreStr = (directScore || plannerScoreInput[fixture.id] || '').trim();
    if (!scoreStr) { addToast('Bitte Spielstand eintragen', 'error'); return; }

    // Prüfe ob Turnier und Spieltag ausgewählt sind
    if (!plannerSelectedTournamentId || !plannerSelectedRoundId) {
      addToast('Bitte wähle zuerst ein Turnier und einen Spieltag aus', 'error');
      return;
    }

    const p1 = players.find(p => p.id === fixture.p1Id);
    const p2 = players.find(p => p.id === fixture.p2Id);
    if (!p1 || !p2) { addToast('Spieler nicht gefunden', 'error'); return; }
    const mode = plannerScoringMode;
    const res1 = analyzeSingleScore(scoreStr, mode);
    const res2 = analyzeSingleScore(reverseScoreString(scoreStr), mode);
    const tournamentId = plannerSelectedTournamentId;
    const roundId = `planner-${plannerSelectedRoundId}`;

    // --- ID REUSE: Prüfe ob bereits ein Match mit DIESER FIXTURE existiert ---
    // WICHTIG: Verwende fixtureId zur eindeutigen Identifikation, NICHT roundId+opponentId!
    // Sonst werden bei gleicher Spielerpaarung mehrere Fixtures überschrieben.
    const p1Result = results.find(r => r.playerId === p1.id && r.tournamentId === tournamentId);
    const existingMatch1 = p1Result?.matches.find(m => m.fixtureId === fixture.id);
    const p2Result = results.find(r => r.playerId === p2.id && r.tournamentId === tournamentId);
    const existingMatch2 = p2Result?.matches.find(m => m.fixtureId === fixture.id);

    // --- ATOMIC SAVE (Race Condition Fix) ---
    // Erstelle Match-Einträge für beide Spieler
    const match1: MatchRecord = {
      id: existingMatch1?.id || generateId(),
      roundId,
      opponentId: p2.id,
      opponentName: p2.name,
      score: scoreStr,
      isWin: res1.isWin,
      isCloseLoss: res1.isCloseLoss,
      timestamp: Date.now(),
      scoringMode: mode,
      levelAtMatch: fixture.level,
      fixtureId: fixture.id // Unique fixture identifier
    };

    const match2: MatchRecord = {
      id: existingMatch2?.id || generateId(),
      roundId,
      opponentId: p1.id,
      opponentName: p1.name,
      score: reverseScoreString(scoreStr),
      isWin: res2.isWin,
      isCloseLoss: res2.isCloseLoss,
      timestamp: Date.now(),
      scoringMode: mode,
      levelAtMatch: fixture.level,
      fixtureId: fixture.id // Unique fixture identifier
    };

    // Speichere beide Matches atomar (parallel)
    const [success1, success2] = await Promise.all([
      apiSaveMatchAtomic(p1.id, tournamentId, match1),
      apiSaveMatchAtomic(p2.id, tournamentId, match2)
    ]);

    // Konflikt-Erkennung: Jemand anderes hat bereits gespeichert
    if (success1 === 'conflict' || success2 === 'conflict') {
      addToast('⚠️ Ergebnis wurde bereits von jemand anderem eingetragen! Daten werden aktualisiert...', 'error');
      // Lade aktuelle Daten vom Server
      const freshResults = await apiLoad(STORAGE_KEYS.RESULTS);
      if (freshResults) setResults(freshResults);
      const freshFixtures = await apiLoad(STORAGE_KEYS.PLANNER);
      if (freshFixtures) setPlannerFixtures(freshFixtures);
      return;
    }

    if (!success1 || !success2) {
      addToast('Fehler beim Speichern - Daten werden aktualisiert...', 'error');
      // Lade aktuelle Daten vom Server, um Sync-Probleme zu vermeiden
      const freshResults = await apiLoad(STORAGE_KEYS.RESULTS);
      if (freshResults) setResults(freshResults);
      const freshFixtures = await apiLoad(STORAGE_KEYS.PLANNER);
      if (freshFixtures) setPlannerFixtures(freshFixtures);
      return;
    }

    // OPTIMISTIC UPDATE: Sofort lokalen State aktualisieren für schnelle UI-Reaktion
    // Dann im Hintergrund vom Server nachladen
    setResults(prevResults => {
      const newResults = [...prevResults];

      // Aktualisiere/Hinzufüge Match für Spieler 1
      const p1Idx = newResults.findIndex(r => r.playerId === p1.id && r.tournamentId === tournamentId);
      if (p1Idx >= 0) {
        // WICHTIG: Suche nach fixtureId, nicht roundId+opponentId!
        const existingIdx = newResults[p1Idx].matches.findIndex(m => m.fixtureId === fixture.id);
        if (existingIdx >= 0) {
          newResults[p1Idx].matches[existingIdx] = match1;
        } else {
          newResults[p1Idx].matches.push(match1);
        }
      } else {
        newResults.push({
          id: generateId(),
          playerId: p1.id,
          tournamentId,
          matches: [match1]
        });
      }

      // Aktualisiere/Hinzufüge Match für Spieler 2
      const p2Idx = newResults.findIndex(r => r.playerId === p2.id && r.tournamentId === tournamentId);
      if (p2Idx >= 0) {
        // WICHTIG: Suche nach fixtureId, nicht roundId+opponentId!
        const existingIdx = newResults[p2Idx].matches.findIndex(m => m.fixtureId === fixture.id);
        if (existingIdx >= 0) {
          newResults[p2Idx].matches[existingIdx] = match2;
        } else {
          newResults[p2Idx].matches.push(match2);
        }
      } else {
        newResults.push({
          id: generateId(),
          playerId: p2.id,
          tournamentId,
          matches: [match2]
        });
      }

      return newResults;
    });

    // Hintergrund-Sync: Lade frische Daten vom Server (für Multi-Tab Konsistenz)
    // Aber warte nicht darauf - UI ist bereits aktualisiert
    apiLoad(STORAGE_KEYS.RESULTS).then(freshResults => {
      if (freshResults) setResults(freshResults);
    });

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

    // Wenn das Level sich ändert, aktualisiere das Level des Spielers UND seiner Matches
    if (selectedPlayer.level !== plannerNewLevel) {
      // Aktualisiere Spieler-Level
      const updatedPlayers = players.map(p =>
        p.id === selectedPlayer.id ? { ...p, level: plannerNewLevel } : p
      );
      updatePlayers(updatedPlayers);

      // Aktualisiere levelAtMatch in allen Matches dieses Spielers
      const updatedResults = results.map(r => {
        if (r.playerId === selectedPlayer.id) {
          return {
            ...r,
            matches: r.matches.map(m => ({
              ...m,
              levelAtMatch: plannerNewLevel
            }))
          };
        }
        return r;
      });
      updateResults(updatedResults);
    }

    // Spieler wird zur Planung hinzugefügt (in der Ziel-Altersgruppe/Level)
    // Erlaubt jüngere Spieler in ältere Gruppen einzufügen
    const key = getPlannerKey(plannerTargetAgeGroup, plannerNewLevel, plannerSelectedRoundId);
    const newMatch: PlannedMatch = {
      id: generateId(),
      ageGroup: plannerTargetAgeGroup,
      level: plannerNewLevel,
      round: 1,
      p1Id: selectedPlayer.id,
      p2Id: ''
    };
    // WICHTIG: updatePlannerFixtures verwenden statt setPlannerFixtures, damit die DB aktualisiert wird!
    updatePlannerFixtures({
      ...plannerFixtures,
      [key]: [...(plannerFixtures[key] || []), newMatch]
    });
    setPlannerSelectedPlayerId('');
    setPlannerNewLevel('C');
    addToast(`${selectedPlayer.name} zu ${displayAgeGroup(plannerTargetAgeGroup)}, ${LEVEL_LABELS[plannerNewLevel]} hinzugefügt${selectedPlayer.level !== plannerNewLevel ? ' (Level & Punkte übertragen)' : ''}`, 'success');
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

    if (!checkPermission('canManagePlanner', 'Bracket generieren')) return;

    const targetAge = activeBracketAge;
    const targetLevel = activeBracketLevel;


    let selectedPlayers: (Player | null)[] = [];

    let targetSize = bracketSize;



    if (playerList) {

      // Transition from Group to KO or Manual Selection
      selectedPlayers = [...playerList];

      const count = selectedPlayers.length;
      // Bestimme nächste Zweierpotenz für Bracket
      if (count <= 4) targetSize = 4;
      else if (count <= 8) targetSize = 8;
      else if (count <= 16) targetSize = 16;
      else if (count <= 32) targetSize = 32;
      else targetSize = 64;

      if (randomize) selectedPlayers.sort(() => 0.5 - Math.random());

    } else {

      // Standard Generation (all from class) - Still needed as fallback or if called without list
      const candidates = players.filter(p => canPlayInAgeGroup(p, targetAge) && p.level === targetLevel);

      if (candidates.length === 0) {
        addToast("Keine Spieler für diese Alters- und Leistungsklasse", "error");
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

        p2: selectedPlayers[i + 1],

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



  const generateGroups = (playerList?: Player[]) => {

    if (!checkPermission('canManagePlanner', 'Gruppen generieren')) return;

    let candidates = playerList;

    if (!candidates) {
      candidates = players.filter(p => canPlayInAgeGroup(p, activeBracketAge) && p.level === activeBracketLevel);
    }

    const shuffled = [...candidates].sort(() => 0.5 - Math.random());

    if (shuffled.length === 0) {
      addToast("Keine passenden Spieler ausgewählt oder gefunden", "error");
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



  const clearGroupResults = async () => {

    const currentBracket = activeBracket || brackets[activeBracketAge];

    if (!currentBracket || !currentBracket.groups) return;

    if (!confirm("Alle Gruppenergebnisse löschen?")) return;

    // Phase 1: Lokale Matches im Bracket zurücksetzen
    const newGroups = currentBracket.groups.map(g => ({
      ...g,
      matches: g.matches.map(m => ({ ...m, score: '', winner: null }))
    }));
    updateSingleBracket(activeBracketAge, { ...currentBracket, groups: newGroups }, activeBracketLevel);

    // Phase 2: Ergebnisse in tm_results atomar löschen
    // Wir sammeln alle Paarungen und löschen sie auf dem Server
    const deletePromises: Promise<any>[] = [];
    currentBracket.groups.forEach(g => {
      g.matches.forEach(m => {
        if (m.p1 && m.p2) {
          deletePromises.push(apiDeleteMatchAtomic(m.p1.id, currentBracket.tournamentId || '', `bracket-${m.id}`, m.p2.id));
          deletePromises.push(apiDeleteMatchAtomic(m.p2.id, currentBracket.tournamentId || '', `bracket-${m.id}`, m.p1.id));
        }
      });
    });

    await Promise.all(deletePromises);

    // Phase 3: Lokalen results state bereinigen
    const tId = currentBracket.tournamentId;
    const updatedResults = results.map(playerResult => {
      if (playerResult.tournamentId !== tId) return playerResult;
      return {
        ...playerResult,
        matches: [] // In der Gruppenphase löschen wir hier radikal für dieses Turnier
      };
    });
    setResults(updatedResults);

    addToast("Ergebnisse gelöscht", "success");
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
          // Race-4: Keine knappe Niederlage
          isCloseLoss = false;
        } else if (mode === 'race10') {
          // Race-10: Knapp bei 10:8, 10:9 etc. (Verlierer mindestens 8)
          isCloseLoss = (p2 >= 10 && p1 >= 8 && diff <= 2);
        } else if (mode === 'race15') {
          // Race-15: Knapp ab 12:15 (Verlierer mindestens 12)
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



  const addSet = () => setSets([...sets, { p1: '', p2: '' }]);

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

      setCurrentAdminId('');

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

        setCurrentAdminId(account.id);

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

      isSuperAdmin: false,

      permissions: { ...DEFAULT_PERMISSIONS }

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

    if (!checkPermission('canManagePlayers', 'Spieler erstellen')) return;

    if (!regName || !regBirthDate) {

      addToast('Bitte Name und Datum ausfuellen', 'error');

      return;

    }

    const trimmedClub = regClub.trim();
    const trimmedEmail = regEmail.trim();
    const autoAgeGroup = calculateAgeGroup(regBirthDate);
    const overrideAgeGroup = regAllowAgeOverride && regManualAgeGroup ? regManualAgeGroup : null;
    const manualAgeGroup = overrideAgeGroup && overrideAgeGroup !== autoAgeGroup ? overrideAgeGroup : undefined;
    const playerPayload: Player = {
      id: generateId(),
      name: regName,
      birthDate: regBirthDate,
      level: regLevel,
      club: trimmedClub || undefined,
      email: trimmedEmail || undefined,
      ...(manualAgeGroup ? { manualAgeGroup } : {})
    };

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

      updatePlayers([...players, playerPayload]);

      addToast('Spieler hinzugefuegt');

    } else {

      updateRegistrations([...pendingRegistrations, data]);

      setShowRegSuccess(true);

      setTimeout(() => setShowRegSuccess(false), 3000);

      addToast('Anmeldung gesendet');

    }

    setRegName(''); setRegBirthDate(''); setRegTournamentId(''); setRegSelectedRounds([]); setRegLevel('C'); setRegClub(''); setRegEmail('');
    setRegAllowAgeOverride(false); setRegManualAgeGroup('');

  };

  const approveRegistration = (req: RegistrationRequest) => {

    if (!checkPermission('canManagePlayers', 'Spieler zulassen')) return;

    updatePlayers([...players, { id: generateId(), name: req.name, birthDate: req.birthDate, level: req.level, club: req.club, email: req.email }]);

    updateRegistrations(pendingRegistrations.filter(r => r.id !== req.id));

    addToast(`${req.name} zugelassen`);

  };



  const rejectRegistration = (id: string) => {

    if (!checkPermission('canManagePlayers', 'Anmeldung ablehnen')) return;

    triggerConfirm("Anmeldung wirklich ablehnen?", () => {

      updateRegistrations(pendingRegistrations.filter(r => r.id !== id));

      addToast('Anmeldung abgelehnt', 'info');

      closeConfirm();

    });

  };



  const deletePlayer = (id: string) => {

    if (!checkPermission('canManagePlayers', 'Spieler löschen')) return;

    triggerConfirm("Spieler und ALLE seine Ergebnisse löschen?", () => {

      updatePlayers(players.filter(p => p.id !== id));

      const cleanResults = results.filter(r => r.playerId !== id);

      updateResults(cleanResults);

      addToast('Spieler gelöscht', 'info');

      closeConfirm();

    });

  };



  const handleUpdateMatchScore = (matchId: string, playerId: string, newScoreRaw: string) => {

    if (!checkPermission('canEnterResults', 'Ergebnis bearbeiten')) return;

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

    if (!checkPermission('canManageTournaments', 'Turnier erstellen')) return;

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

    if (!checkPermission('canManageTournaments', 'Spieltag hinzufügen')) return;

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

    if (!checkPermission('canManageTournaments', 'Turnier löschen')) return;


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

    if (!checkPermission('canEnterResults', 'Ergebnisse eingeben')) return;

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

    setSets([{ p1: '', p2: '' }]); setSelectedOpponentId('');

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



      const relevantTournaments = (rankingScope === 'overall'

        ? tournaments

        : tournaments.filter(t => t.id === rankingScope))
        .filter(t => includeArchivedInRanking || !t.archived);



      relevantTournaments.forEach(tourn => {

        const res = results.find(r => r.playerId === player.id && r.tournamentId === tourn.id);

        if (!res) return;



        const countParticipants = (roundScope: 'all' | string | null, level: Level | null) => {

          return players.filter(p => {

            if (calculateAgeGroup(p) !== ageGroup) return false;

            const r = results.find(rr => rr.playerId === p.id && rr.tournamentId === tourn.id);

            if (!r) return false;

            return r.matches.some(m => {

              const matchesRoundScope = roundScope ? (m.roundId === roundScope || m.roundId === `planner-${roundScope}`) : false;

              const inScope = roundScope === 'all' ? true : roundScope === null ? !m.roundId : matchesRoundScope;

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

            const matchesInRound = res.matches.filter(m => m.roundId === round.id || m.roundId === `planner-${round.id}`);

            if (matchesInRound.length === 0) return;

            const roundLevel = getMatchLevel(matchesInRound[0], player.level || null);


            // Teilnahme bestätigt (hat Matches in einer Runde dieses Turniers)

            hasPlayedInScope = true;
            participationCount++;

            matchesInRound.forEach(m => {

              const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

              const levelForMatch = getMatchLevel(m, roundLevel);

              const matchWeight = getGroupSizeWeight(countParticipants(round.id, levelForMatch), ageGroup, levelForMatch || undefined);

              aggregatedPoints += base * matchWeight;

              if (m.isWin) totalWins++;

              else if (m.isCloseLoss) totalCL++;

            });

            totalMatches += matchesInRound.length;

          });



          const matchesNoRound = res.matches.filter(m => !m.roundId);

          if (matchesNoRound.length > 0) {

            hasPlayedInScope = true; // Hat Matches ohne Runde

            matchesNoRound.forEach(m => {

              const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

              const levelForMatch = getMatchLevel(m, player.level || null);

              const w = getGroupSizeWeight(countParticipants(null, levelForMatch), ageGroup, levelForMatch || undefined);

              aggregatedPoints += base * w;

              if (m.isWin) totalWins++;

              else if (m.isCloseLoss) totalCL++;

            });

            totalMatches += matchesNoRound.length;

          }



          if (totalMatches > 0) {

            const summaryLevel = getMatchLevel(res.matches[0], player.level || null);

            const uniqueTournParticipants = countParticipants('all', summaryLevel);

            const tournWeight = getGroupSizeWeight(uniqueTournParticipants, ageGroup, summaryLevel || undefined);
            // Teilnahmepunkte: 1 Punkt pro Spieltag (Round) + 1 für Matches ohne Round
            const participationBonus = participationCount + (matchesNoRound.length > 0 ? 1 : 0);

            aggregatedPoints += participationBonus;

            totalPoints += aggregatedPoints;



            details.push({

              tId: tourn.id, tName: tourn.name,

              raw: aggregatedPoints.toFixed(1),

              weighted: aggregatedPoints.toFixed(1),

              stats: `${totalWins} S (x${tournWeight.toFixed(2)}) / ${totalCL} KN (x${tournWeight.toFixed(2)})`,

              participationPoints: participationBonus, // Ungewichtet, pro Spieltag

              participants: uniqueTournParticipants,

              weight: tournWeight.toFixed(2)

            });

          }



        } else {

          // Scope: Einzelner Spieltag oder Turnier ohne Runden

          const matchesInScope = res.matches.filter(m =>
            rankingRoundScope === 'all' || m.roundId === rankingRoundScope || m.roundId === `planner-${rankingRoundScope}`
          );

          if (matchesInScope.length === 0) {
            return; // Keine Matches im Scope -> weiter zum nächsten Turnier
          }

          const requiresWinForScope = rankingScope !== 'overall';
          const hasRelevantWin = rankingRoundScope === 'all'
            ? matchesInScope.some(m => m.isWin)
            : matchesInScope.some(m => m.isWin && (m.roundId === rankingRoundScope || m.roundId === `planner-${rankingRoundScope}`));

          if (requiresWinForScope && !hasRelevantWin) {
            return; // Nur Spieler mit Siegen für diese Auswahl anzeigen
          }

          hasPlayedInScope = true;



          const levelInScope = getMatchLevel(matchesInScope[0], player.level || null);

          const participantCount = countParticipants(rankingRoundScope === 'all' ? 'all' : rankingRoundScope, levelInScope);



          const groupWeight = getGroupSizeWeight(participantCount, ageGroup, levelInScope || undefined);

          let matchPoints = 0;

          let wins = 0;

          let closeLosses = 0;



          matchesInScope.forEach(m => {

            const base = m.isWin ? 2 : m.isCloseLoss ? 1 : 0;

            const levelForMatch = getMatchLevel(m, levelInScope);

            const weight = getGroupSizeWeight(countParticipants(rankingRoundScope === 'all' ? 'all' : rankingRoundScope, levelForMatch), ageGroup, levelForMatch || undefined);

            matchPoints += base * weight;

            if (m.isWin) wins++; else if (m.isCloseLoss) closeLosses++;

          });



          // Zähle eindeutige Spieltage (RoundIds) für Teilnahmepunkte
          const uniqueRoundIds = new Set(matchesInScope.map(m => m.roundId).filter(rid => rid !== undefined));
          const participationPoints = rankingRoundScope === 'all' ? uniqueRoundIds.size : 1;

          const turnierScore = participationPoints + matchPoints;

          totalPoints += turnierScore;


          details.push({

            tId: tourn.id, tName: tourn.name,

            raw: turnierScore.toFixed(1),

            weighted: turnierScore.toFixed(1),

            stats: `${wins} S (x${groupWeight.toFixed(2)}) / ${closeLosses} KN (x${groupWeight.toFixed(2)})`,

            participationPoints: participationPoints, // Ungewichtet, pro Spieltag

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

  }, [players, results, tournaments, rankingScope, rankingAgeGroup, rankingLevelFilter, rankingRoundScope, rankingSearchQuery, includeArchivedInRanking]);





  // --- PAGINATION HELPERS ---

  const totalPages = Math.ceil(rankingData.length / ITEMS_PER_PAGE);

  const paginatedData = rankingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);



  // --- REGISTER TAB PLAYER PREVIEW ---

  const registrationPlayersPreview = useMemo(() => {
    if (!players) return [];
    return players
      .filter(p => regPlayersAgeFilter === 'All' || calculateAgeGroup(p) === regPlayersAgeFilter)
      .filter(p => regPlayersLevelFilter === 'All' || p.level === regPlayersLevelFilter)
      .filter(p => !regPlayersSearch || p.name.toLowerCase().includes(regPlayersSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, regPlayersAgeFilter, regPlayersLevelFilter, regPlayersSearch]);

  // --- FILTERED PLAYERS LIST FOR PLAYERS TAB ---

  const filteredPlayersList = useMemo(() => {

    if (!players) return [];

    return players

      .filter(p => !playersListSearch || p.name.toLowerCase().includes(playersListSearch.toLowerCase()))

      .filter(p => playersListAgeFilter === 'All' || calculateAgeGroup(p) === playersListAgeFilter)

      .sort((a, b) => a.name.localeCompare(b.name));

  }, [players, playersListSearch, playersListAgeFilter]);



  // --- EXCLUDED PLAYERS MODAL ---
  const ExcludedPlayersModal = () => {
    const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
    const [targetRoundId, setTargetRoundId] = useState<string>(plannerSelectedRoundId || '');

    if (!showExcludedPlayersModal) return null;

    const selectedTournament = tournaments.find(t => t.id === plannerSelectedTournamentId);
    const selectedRound = selectedTournament?.rounds.find(r => r.id === plannerSelectedRoundId);
    const allRounds = selectedTournament?.rounds || [];

    // Sammle ALLE ausgeschlossenen Spieler (über alle Altersgruppen und Levels)
    const allExcludedPlayers: { player: Player, originalAgeGroup: AgeGroup, originalLevel: Level }[] = [];

    if (plannerSelectedRoundId) {
      AGE_GROUP_ORDER.forEach(ageGroup => {
        (['A', 'B', 'C'] as Level[]).forEach(level => {
          const key = `${plannerSelectedRoundId}-${ageGroup}-${level}`;
          const excludedIds = excludedPlayers[key] || [];
          excludedIds.forEach(id => {
            const player = players.find(p => p.id === id);
            if (player && !allExcludedPlayers.some(e => e.player.id === id)) {
              allExcludedPlayers.push({ player, originalAgeGroup: ageGroup, originalLevel: level });
            }
          });
        });
      });
    }

    // Sortiere nach Name
    allExcludedPlayers.sort((a, b) => a.player.name.localeCompare(b.player.name));

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowExcludedPlayersModal(false)}>
        <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-4 md:p-6 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div>
              <h2 className={`text-lg md:text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                <Users className="text-amber-500" size={20} />
                Spieler ohne Gruppe
              </h2>
              <p className={`text-xs md:text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedRound?.name || 'Kein Spieltag'} - {selectedRound?.date || ''}
              </p>
            </div>
            <button onClick={() => setShowExcludedPlayersModal(false)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <X size={20} className={darkMode ? 'text-slate-400' : 'text-slate-600'} />
            </button>
          </div>

          {/* Spieltag-Auswahl für das Hinzufügen */}
          <div className={`px-4 md:px-6 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <label className={`text-xs font-medium block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Ziel-Spieltag beim Hinzufügen:
            </label>
            <select
              value={targetRoundId}
              onChange={(e) => setTargetRoundId(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition ${darkMode
                ? 'bg-slate-700 border-slate-600 text-slate-200'
                : 'bg-white border-slate-300 text-slate-800'
                }`}
            >
              {allRounds.map(round => (
                <option key={round.id} value={round.id}>
                  {round.name} - {round.date} {round.id === plannerSelectedRoundId ? '(aktuell)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            {allExcludedPlayers.length === 0 ? (
              <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Users size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Alle Spieler sind in einer Gruppe</p>
                <p className="text-xs mt-1">Keine ausgeschlossenen Spieler für diesen Spieltag</p>
              </div>
            ) : (
              allExcludedPlayers.map(({ player, originalAgeGroup, originalLevel }) => {
                const isExpanded = expandedPlayerId === player.id;
                const playerAgeGroup = calculateAgeGroup(player);

                return (
                  <div key={player.id} className={`border rounded-xl overflow-hidden transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    {/* Header - immer sichtbar */}
                    <div
                      className={`flex items-center justify-between p-3 cursor-pointer transition ${darkMode ? 'hover:bg-slate-750' : 'hover:bg-slate-100'}`}
                      onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{player.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {displayAgeGroup(playerAgeGroup)}
                            </span>
                            {renderLevelBadge(player.level, 'sm')}
                            {player.club && <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>• {player.club}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight size={18} className={`transition-transform ${isExpanded ? 'rotate-90' : ''} ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                      </div>
                    </div>

                    {/* Erweiterte Optionen */}
                    {isExpanded && (
                      <div className={`p-4 border-t ${darkMode ? 'border-slate-700 bg-slate-850' : 'border-slate-200 bg-white'}`}>
                        <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Wähle aus, in welche Gruppe der Spieler hinzugefügt werden soll:
                        </p>

                        {/* Altersgruppen-Auswahl */}
                        <div className="space-y-3">
                          {AGE_GROUP_ORDER.filter(ag => AGE_RANK[playerAgeGroup] <= AGE_RANK[ag]).map(ageGroup => (
                            <div key={ageGroup} className={`border rounded-lg p-3 ${darkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                              <div className={`text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {displayAgeGroup(ageGroup)}
                                {ageGroup === playerAgeGroup && <span className="text-xs ml-2 text-emerald-500">(Standard)</span>}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {(['A', 'B', 'C'] as Level[]).map(level => {
                                  const isPlayerLevel = level === player.level;
                                  const targetRound = allRounds.find(r => r.id === targetRoundId);

                                  return (
                                    <button
                                      key={level}
                                      onClick={() => {
                                        // Entferne aus alter Position (vom aktuellen Spieltag)
                                        const oldKey = `${plannerSelectedRoundId}-${originalAgeGroup}-${originalLevel}`;
                                        setExcludedPlayers(prev => ({
                                          ...prev,
                                          [oldKey]: (prev[oldKey] || []).filter(id => id !== player.id)
                                        }));

                                        // Aktualisiere Spieler-Level falls nötig
                                        if (player.level !== level) {
                                          const updatedPlayers = players.map(p =>
                                            p.id === player.id ? { ...p, level } : p
                                          );
                                          updatePlayers(updatedPlayers);
                                        }

                                        // Füge zur neuen Gruppe hinzu
                                        const targetRoundName = targetRound?.name || 'Spieltag';
                                        addToast(`${player.name} zu ${displayAgeGroup(ageGroup)} ${LEVEL_LABELS[level]} (${targetRoundName}) hinzugefügt`, 'success');
                                        setExpandedPlayerId(null);
                                      }}
                                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${isPlayerLevel
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : darkMode
                                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                                        }`}
                                    >
                                      {renderLevelBadge(level, 'sm')}
                                      {isPlayerLevel && <span className="text-[10px]">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Schnell-Aktion: Zurück zur Original-Gruppe */}
                        <button
                          onClick={() => {
                            includePlayerInGroup(player.id, originalAgeGroup, originalLevel, targetRoundId);
                            setExpandedPlayerId(null);
                          }}
                          className="w-full mt-3 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition"
                        >
                          <ArrowRightCircle size={14} /> Zurück zu {displayAgeGroup(originalAgeGroup)} {LEVEL_LABELS[originalLevel]}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex gap-2">
              {allExcludedPlayers.length > 0 && (
                <button
                  onClick={() => {
                    // Alle Spieler zurück zu ihren Original-Gruppen zum Ziel-Spieltag
                    allExcludedPlayers.forEach(({ player, originalAgeGroup, originalLevel }) => {
                      includePlayerInGroup(player.id, originalAgeGroup, originalLevel, targetRoundId);
                    });
                    setShowExcludedPlayersModal(false);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} /> Alle hinzufügen
                </button>
              )}
              <button
                onClick={() => setShowExcludedPlayersModal(false)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- PLAYER SELECTION MODAL (vor Auslosung) ---
  const PlayerSelectionModal = () => {
    if (!showPlayerSelectionModal) return null;

    const level = playerSelectionLevel;
    const excludedIds = (activeTab === 'planner' && plannerSelectedRoundId)
      ? getExcludedPlayerIds(plannerSelectedRoundId, plannerAgeGroup, level)
      : [];

    // Gefilterte Spielerliste mit Modal-Filtern für Cross-Group Auswahl
    const eligiblePlayers = players.filter(p => {
      // Suche nach Name
      const matchesSearch = !modalSearchQuery || p.name.toLowerCase().includes(modalSearchQuery.toLowerCase());
      // Altersgruppen-Filter
      const matchesAge = modalFilterAgeGroup === 'All' || calculateAgeGroup(p) === modalFilterAgeGroup;
      // Leistungsklassen-Filter  
      const matchesLevel = modalFilterLevel === 'All' || p.level === modalFilterLevel;
      // Ausgeschlossene Spieler
      const notExcluded = !excludedIds.includes(p.id);
      return matchesSearch && matchesAge && matchesLevel && notExcluded;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const allSelected = eligiblePlayers.every(p => selectedPlayerIds.has(p.id));
    const noneSelected = eligiblePlayers.every(p => !selectedPlayerIds.has(p.id));

    const togglePlayer = (playerId: string) => {
      const newSet = new Set(selectedPlayerIds);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      setSelectedPlayerIds(newSet);
    };

    const selectAll = () => {
      setSelectedPlayerIds(new Set(eligiblePlayers.map(p => p.id)));
    };

    const selectNone = () => {
      setSelectedPlayerIds(new Set());
    };

    const startDraw = () => {
      const selectedPlayers = eligiblePlayers.filter(p => selectedPlayerIds.has(p.id));
      if (selectedPlayers.length < 2) {
        addToast('Mindestens 2 Spieler benötigt', 'error');
        return;
      }

      if (activeTab === 'planner') {
        // NUR Spieler zur Gruppe hinzufügen (keine Fixtures generieren)
        // Die eigentliche Auslosung erfolgt über den separaten "Auslosen"-Button
        const memberKey = `${plannerSelectedRoundId}-${plannerAgeGroup}-${level}`;
        const playerIds = selectedPlayers.map(p => p.id);
        updateGroupMembers({ ...groupMembers, [memberKey]: playerIds });

        addToast(`${selectedPlayers.length} Spieler zu ${LEVEL_LABELS[level]} hinzugefügt`, 'success');
      } else if (activeTab === 'bracket') {
        if (bracketType === 'ko') {
          generateBracket(true, selectedPlayers);
        } else {
          generateGroups(selectedPlayers);
        }
      }

      setShowPlayerSelectionModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPlayerSelectionModal(false)}>
        <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-4 md:p-6 border-b flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div>
              <h2 className={`text-lg md:text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                <UserPlus className="text-blue-500" size={20} />
                Spieler hinzufügen
              </h2>
              <p className={`text-xs md:text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {displayAgeGroup(plannerAgeGroup)} - {LEVEL_LABELS[level]}
              </p>
            </div>
            <button onClick={() => setShowPlayerSelectionModal(false)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <X size={20} className={darkMode ? 'text-slate-400' : 'text-slate-600'} />
            </button>
          </div>

          {/* Filter-Optionen für Cross-Group Auswahl */}
          <div className={`px-4 md:px-6 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50'}`}>
            <div className="flex flex-wrap gap-2 mb-2">
              <select
                value={modalFilterAgeGroup}
                onChange={e => setModalFilterAgeGroup(e.target.value as AgeGroup | 'All')}
                className={`flex-1 min-w-[100px] p-2 border rounded-lg text-xs ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
              >
                <option value="All">Alle Alter</option>
                {getSortedAgeGroups().filter(g => g !== 'All').map(g => (
                  <option key={g} value={g}>{displayAgeGroup(g)}</option>
                ))}
              </select>
              <select
                value={modalFilterLevel}
                onChange={e => setModalFilterLevel(e.target.value as Level | 'All')}
                className={`flex-1 min-w-[100px] p-2 border rounded-lg text-xs ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
              >
                <option value="All">Alle Klassen</option>
                <option value="A">{LEVEL_LABELS.A}</option>
                <option value="B">{LEVEL_LABELS.B}</option>
                <option value="C">{LEVEL_LABELS.C}</option>
              </select>
            </div>
            <input
              type="text"
              value={modalSearchQuery}
              onChange={e => setModalSearchQuery(e.target.value)}
              placeholder="Name suchen..."
              className={`w-full p-2 border rounded-lg text-sm ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}
            />
          </div>

          {/* Alle auswählen / Alle abwählen */}
          <div className={`px-4 md:px-6 py-3 border-b flex gap-2 ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <button
              onClick={selectAll}
              disabled={allSelected || eligiblePlayers.length === 0}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${allSelected || eligiblePlayers.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                } ${darkMode ? 'disabled:bg-slate-700' : 'disabled:bg-slate-200'}`}
            >
              Alle auswählen ({eligiblePlayers.length})
            </button>
            <button
              onClick={selectNone}
              disabled={noneSelected}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${noneSelected
                ? 'opacity-50 cursor-not-allowed'
                : ''
                } ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
            >
              Alle abwählen
            </button>
          </div>

          {/* Spieler-Liste */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
            {eligiblePlayers.length === 0 ? (
              <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Users size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Keine Spieler in dieser Gruppe</p>
              </div>
            ) : (
              eligiblePlayers.map(player => (
                <label
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedPlayerIds.has(player.id)
                    ? darkMode ? 'bg-emerald-900/40 border-emerald-600' : 'bg-emerald-50 border-emerald-300'
                    : darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    } border`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.has(player.id)}
                    onChange={() => togglePlayer(player.id)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {player.name}
                    </div>
                    {player.club && (
                      <div className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {player.club}
                      </div>
                    )}
                  </div>
                  {renderLevelBadge(player.level, 'sm')}
                </label>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 md:p-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className={`text-xs mb-3 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedPlayerIds.size} von {eligiblePlayers.length} Spielern ausgewählt
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPlayerSelectionModal(false)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Abbrechen
              </button>
              <button
                onClick={startDraw}
                disabled={selectedPlayerIds.size < 2}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${selectedPlayerIds.size < 2
                  ? 'opacity-50 cursor-not-allowed bg-slate-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                <UserPlus size={16} /> Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

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

    const allMatches = playerResults.flatMap(r => r.matches).sort((a, b) => b.timestamp - a.timestamp);

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

      if (!checkPermission('canManagePlayers', 'Spieler bearbeiten')) return;

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

      .sort((a, b) => a.name.localeCompare(b.name));



    return (

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">

        <div className={`rounded-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>

          <div className="bg-slate-800 text-white p-4 md:p-6 sticky top-0 z-10">

            <div className="flex justify-between items-start">

              <div>

                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">

                  {viewingPlayer.isTeam && <Users2 size={24} />}

                  {viewingPlayer.name}

                </h2>

                <div className="flex gap-2 mt-2 items-center text-slate-300 text-sm">

                  <span>{formatAgeGroupLabel(calculateAgeGroup(viewingPlayer))}</span>

                  <span>•</span>

                  {renderLevelBadge(viewingPlayer.level)}

                </div>

              </div>

              <button onClick={() => setViewingPlayer(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>

            </div>


            <div className="flex gap-4 mt-6 text-sm font-bold">

              <button onClick={() => setStatsView('history')} className={`pb-2 border-b-2 ${statsView === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>Spielverlauf</button>

              <button onClick={() => setStatsView('stats')} className={`pb-2 border-b-2 ${statsView === 'stats' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>Statistiken & H2H</button>

            </div>

          </div>



          <div className="p-6">

            {isAdmin && (

              <div className={`border rounded-lg p-4 mb-4 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-emerald-50 border-emerald-100'}`}>

                <div className="grid md:grid-cols-2 gap-3">

                  <div>

                    <label className={`text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Leistungsklasse</label>

                    <select value={editPlayerLevel} onChange={e => setEditPlayerLevel(e.target.value as Level)} className={`w-full p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>

                      <option value="A">{LEVEL_LABELS.A}</option>

                      <option value="B">{LEVEL_LABELS.B}</option>

                      <option value="C">{LEVEL_LABELS.C}</option>

                    </select>

                  </div>

                  <div>

                    <label className={`text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Altersklasse (manuell)</label>

                    <select value={editPlayerAgeGroup} onChange={e => setEditPlayerAgeGroup(e.target.value as AgeGroup | 'auto')} className={`w-full p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>

                      <option value="auto">Automatisch ({formatAgeGroupLabel(calculateAgeGroup(viewingPlayer))})</option>

                      {AGE_GROUP_ORDER.map(g => (

                        <option key={g} value={g}>{formatAgeGroupLabel(g)}</option>

                      ))}

                    </select>

                  </div>

                  <div>

                    <label className={`text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Verein</label>

                    <input type="text" value={editPlayerClub} onChange={e => setEditPlayerClub(e.target.value)} className={`w-full p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-500'}`} placeholder="Optional eintragen" />

                  </div>

                  <div>

                    <label className={`text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>E-Mail</label>

                    <input type="email" value={editPlayerEmail} onChange={e => setEditPlayerEmail(e.target.value)} className={`w-full p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-500'}`} placeholder="Optional eintragen" />

                  </div>

                </div>

                <div className="flex justify-end mt-3">

                  <button onClick={savePlayerMeta} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded">Speichern</button>

                </div>

              </div>

            )}

            {statsView === 'history' ? (

              playerResults.length === 0 ? (

                <p className={`italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Noch keine Spiele eingetragen.</p>

              ) : (

                <div className="space-y-6">

                  {tournaments.map(t => {

                    const r = playerResults.find(res => res.tournamentId === t.id);

                    if (!r) return null;

                    return (

                      <div key={t.id} className={`border rounded-xl overflow-hidden shadow-md ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>

                        <div className={`p-4 border-b font-bold flex justify-between transition-colors ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-emerald-50 border-emerald-200 text-slate-800'}`}>

                          <span className="text-base">{t.name}</span>

                          <span className={`text-xs font-normal ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{new Date(t.date).toLocaleDateString('de-DE')}</span>

                        </div>

                        <div className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>

                          {r.matches.map(m => {

                            const roundName = m.roundId

                              ? t.rounds.find(rd => rd.id === m.roundId)?.name || '?'

                              : '';


                            const isEditing = editingMatchId === m.id;



                            return (

                              <div key={m.id} className={`p-4 flex justify-between items-center transition-colors ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-emerald-50'}`}>

                                <div className="flex-1">

                                  <div className="flex items-center gap-2 flex-wrap">

                                    <span className={`text-base font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>vs. {m.opponentName}</span>

                                    {roundName && <span className={`text-xs px-2 py-1 rounded font-medium ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{roundName}</span>}

                                    {!isEditing && (

                                      <span className={`text-xs px-2 py-1 rounded font-bold uppercase shadow-sm ${m.isWin ? 'bg-green-500 dark:bg-green-600 text-white' : m.isCloseLoss ? 'bg-orange-500 dark:bg-orange-600 text-white' : 'bg-red-500 dark:bg-red-600 text-white'}`}>

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

                                        className={`border rounded p-1 text-xs w-32 font-mono transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}

                                      />

                                      <button onClick={() => saveEdit(m)} className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-green-50'} text-green-600`}><Check size={16} /></button>

                                      <button onClick={() => setEditingMatchId(null)} className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-red-50'} text-red-500`}><X size={16} /></button>

                                    </div>

                                  ) : (

                                    <div className={`text-sm font-mono font-bold mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{m.score}</div>

                                  )}

                                </div>

                                <div className="flex items-center gap-4">

                                  <div className="text-right font-bold text-emerald-600">

                                    {m.isWin ? '+2' : m.isCloseLoss ? '+1' : '+0'}

                                  </div>

                                  {isAdmin && !isEditing && (

                                    <button onClick={() => startEdit(m)} className="text-slate-300 hover:text-blue-500"><Edit2 size={14} /></button>

                                  )}

                                </div>

                              </div>

                            )
                          })}

                        </div>

                      </div>

                    );

                  })}

                </div>

              )

            ) : (

              <div className="space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} p-4 rounded-xl border`}>

                    <div className={`text-xs uppercase font-bold mb-2 flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}><TrendingUp size={14} /> Formkurve</div>

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

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} p-4 rounded-xl border`}>

                    <div className={`text-xs uppercase font-bold mb-2 flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}><Scale size={14} /> Satzbilanz</div>

                    <div className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>

                      {totalSetsWon} : {totalSetsLost}

                    </div>

                  </div>

                  <div className={`p-4 rounded-xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-emerald-50 border-emerald-200'}`}>

                    <div className={`text-xs uppercase font-bold mb-2 flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-emerald-600'}`}><Trophy size={14} /> Teilnahmen</div>

                    <div className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-emerald-700'}`}>

                      {playerResults.length}

                    </div>

                    <div className="text-[10px] text-emerald-600 mt-1">Turniere gespielt</div>

                  </div>

                </div>



                <div className={`p-4 rounded-xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

                  <div className={`text-xs uppercase font-bold mb-4 flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}><BarChart3 size={14} /> Head-to-Head (Direktvergleich)</div>

                  <input

                    type="text"

                    placeholder="Gegner suchen..."

                    className={`w-full p-2 border rounded text-xs mb-2 transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                    value={h2hSearch}

                    onChange={(e) => setH2hSearch(e.target.value)}

                  />

                  <select className={`w-full p-2 border rounded text-sm mb-4 transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={h2hOpponentId} onChange={(e) => setH2hOpponentId(e.target.value)}>

                    <option value="">-- Gegner wählen --</option>

                    {h2hPlayers.map(p => (

                      <option key={p.id} value={p.id}>{p.name}</option>

                    ))}

                  </select>


                  {h2hOpponentId && (

                    <div className="text-center animate-in fade-in">

                      <div className={`text-4xl font-black mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{h2hWins} : {h2hMatches.length - h2hWins}</div>

                      <div className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{h2hMatches.length} Spiele gesamt</div>

                      <div className="mt-4 space-y-2 text-left">

                        {h2hMatches.map(m => (

                          <div key={m.id} className={`text-sm flex justify-between items-center p-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-700 border border-slate-600' : 'bg-white border border-slate-200'}`}>

                            <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{new Date(m.timestamp).toLocaleDateString()}</span>

                            <span className={`font-mono font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{m.score}</span>

                            <span className={m.isWin ? 'text-green-500 dark:text-green-400 font-bold px-2 py-1 rounded bg-green-100 dark:bg-green-900/30' : 'text-red-500 dark:text-red-400 font-bold px-2 py-1 rounded bg-red-100 dark:bg-red-900/30'}>{m.isWin ? 'Sieg' : 'Ndlg'}</span>

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

      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-2 md:p-4 animate-in fade-in">

        <div className={`rounded-xl shadow-2xl p-4 md:p-6 max-w-sm w-full animate-in zoom-in-95 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>

          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 text-red-600">

            <AlertCircle size={20} className="md:w-6 md:h-6" />

            <h3 className="text-base md:text-lg font-bold">Bestätigung</h3>

          </div>

          <p className={`mb-4 md:mb-6 text-sm md:text-base ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{confirmDialog.message}</p>

          <div className="flex justify-end gap-2 md:gap-3 flex-wrap">

            <button onClick={closeConfirm} className={`px-3 md:px-4 py-2 font-medium text-sm md:text-base rounded-lg transition ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>Abbrechen</button>

            <button onClick={confirmDialog.onConfirm} className="px-3 md:px-4 py-2 bg-red-600 text-white text-sm md:text-base font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200">Ja, ausführen</button>

          </div>

        </div>

      </div>

    );

  };



  // --- TOASTS COMPONENT ---

  const ToastContainer = () => {

    return (

      <div className="fixed bottom-2 right-2 md:bottom-4 md:right-4 z-[70] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-1rem)] md:max-w-none">

        {toasts.map(toast => (

          <div key={toast.id} className={`p-3 md:p-4 rounded-xl shadow-xl flex items-center gap-2 md:gap-3 min-w-[200px] md:min-w-[300px] animate-in slide-in-from-right-full transition-all pointer-events-auto

${toast.type === 'success' ? 'bg-emerald-600 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}

`}>

            {toast.type === 'success' ? <CheckCircle2 size={16} className="md:w-5 md:h-5 flex-shrink-0" /> : toast.type === 'error' ? <XCircle size={16} className="md:w-5 md:h-5 flex-shrink-0" /> : <Bell size={16} className="md:w-5 md:h-5 flex-shrink-0" />}

            <span className="font-medium text-xs md:text-sm">{toast.message}</span>

          </div>

        ))}

      </div>

    );

  };



  // --- RENDER ---

  return (

    <div className={`min-h-screen font-sans transition-colors duration-300 p-2 md:p-6 pb-24 md:pb-6 relative overflow-x-hidden ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      <PlayerDetailModal />

      <ExcludedPlayersModal />

      <PlayerSelectionModal />

      <ConfirmModal />

      <ToastContainer />



      <div className={`w-full max-w-6xl mx-auto shadow-xl rounded-2xl overflow-hidden border transition-colors duration-300 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>


        {/* HEADER */}

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 md:p-6 text-white">

          <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">

            <div>

              <h1 className="text-lg md:text-xl lg:text-2xl font-bold flex items-center gap-2 md:gap-3">

                <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />

                Tennis Turnier Manager

              </h1>

              <p className="text-slate-400 text-[10px] md:text-xs mt-1 ml-8 md:ml-11 flex items-center gap-1 md:gap-2">

                {isAdmin ? <><ShieldCheck size={10} className="md:w-3 md:h-3 text-emerald-400" /> Admin: {currentUser}</> : 'ðŸ‘ï¸ Zuschauer Modus'}


              </p>

            </div>



            <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg backdrop-blur-sm w-full md:w-auto">

              <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-white/20 rounded-lg transition">

                {darkMode ? <Sun size={20} /> : <Moon size={20} />}

              </button>

              {!isAdmin ? (

                <div className="flex gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">

                  <input type="text" placeholder="Admin User" className="bg-transparent border-b border-slate-500 focus:border-white focus:outline-none text-white text-xs md:text-sm placeholder-slate-500 w-20 md:w-24 px-1"

                    value={adminUsernameInput} onChange={(e) => setAdminUsernameInput(e.target.value)} />

                  <input type="password" placeholder="Passwort" className="bg-transparent border-b border-slate-500 focus:border-white focus:outline-none text-white text-xs md:text-sm placeholder-slate-500 w-20 md:w-24 px-1"

                    value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} />

                  <button onClick={toggleAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2 md:px-3 py-1.5 rounded transition md:ml-2">Login</button>

                </div>

              ) : (

                <button onClick={toggleAdmin} className="flex items-center gap-2 text-xs text-red-300 hover:text-red-100 px-3 py-1"><Unlock size={14} /> Abmelden</button>

              )}

            </div>

          </div>

        </div>



        {/* NAVIGATION */}

        <div className={`flex border-b overflow-x-auto sticky top-0 z-10 scrollbar-hide transition-colors duration-300 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>

          <button onClick={() => setActiveTab('ranking')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[80px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'ranking' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

            <Medal size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Rangliste</span><span className="sm:hidden">Rang</span>

          </button>

          {enableTournamentMenu && (
            <button onClick={() => setActiveTab('bracket')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[100px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'bracket' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

              <span className="hidden lg:inline">Turnier ({displayAgeGroup(activeBracketAge)} / Level {activeBracketLevel})</span>
              <span className="lg:hidden">Turnier</span>

            </button>
          )}

          <button onClick={() => setActiveTab('planner')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[80px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'planner' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

            <Calendar className="text-emerald-600" size={16} /> <span className="hidden sm:inline">Spielplan</span><span className="sm:hidden">Plan</span>

          </button>

          {(isAdmin && hasPermission('canManagePlayers')) && (
            <button onClick={() => setActiveTab('players')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[80px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'players' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

              <Users size={16} /> <span className="hidden sm:inline">Spieler</span><span className="sm:hidden">Spieler</span>

            </button>
          )}

          <button onClick={() => setActiveTab('register')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[100px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'register' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

            <ClipboardList size={16} /> <span className="hidden lg:inline">{isAdmin ? 'Spieler Hinzufügen' : 'Anmeldung'}</span><span className="lg:hidden">{isAdmin ? 'Hinzu.' : 'Anm.'}</span>

          </button>

          {isAdmin && (

            <>

              <button onClick={() => setActiveTab('input')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[80px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'input' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

                <Activity size={16} /> <span className="hidden sm:inline">Eingabe</span><span className="sm:hidden">Eingabe</span>

              </button>

              <button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 md:py-4 px-2 md:px-4 min-w-[80px] md:min-w-[120px] font-medium flex justify-center items-center gap-1 md:gap-2 border-b-2 transition text-xs md:text-base ${activeTab === 'admin' ? 'border-emerald-500 text-emerald-700' : `border-transparent ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}`}>

                <Settings size={16} /> <span className="hidden sm:inline">Verwaltung</span><span className="sm:hidden">Admin</span> {pendingRegistrations.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center">{pendingRegistrations.length}</span>}

              </button>

            </>

          )}

        </div>



        {/* CONTENT AREA */}

        <div className="p-4 md:p-8 min-h-[600px]">


          {/* --- TAB: RANGLISTE --- */}

          {activeTab === 'ranking' && (

            <div className="space-y-6 animate-in fade-in">

              <div className={`flex flex-col xl:flex-row xl:flex-wrap gap-4 p-3 md:p-4 rounded-xl border items-stretch xl:items-center transition-colors overflow-x-auto ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>


                <div className="flex flex-col gap-3 w-full md:w-auto">

                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">

                    <LayoutList className="text-slate-400 w-4 h-4 md:w-5 md:h-5" />

                    <div className={`border rounded-lg flex overflow-hidden transition-colors ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                      <button
                        onClick={() => setRankingViewMode('overall')}
                        className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold transition ${rankingViewMode === 'overall' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Gesamt
                      </button>
                      <button
                        onClick={() => setRankingViewMode('tournament')}
                        className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold transition border-l border-slate-200 ${rankingViewMode === 'tournament' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Turnier
                      </button>
                    </div>

                  </div>

                  {rankingViewMode === 'tournament' && (
                    <div className="ml-4 md:ml-7 flex flex-col gap-2">
                      <select
                        value={rankingTournamentSelection}
                        onChange={(e) => { setRankingTournamentSelection(e.target.value); setRankingRoundScope('all'); }}
                        className={`bg-slate-50 border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm transition-colors ${darkMode ? 'text-slate-100 bg-slate-700 border-slate-600' : 'text-slate-700 bg-white border-slate-200'}`}
                      >
                        <option value="">-- Turnier wählen --</option>
                        {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>

                      <select
                        value={rankingRoundScope}
                        onChange={(e) => setRankingRoundScope(e.target.value)}
                        disabled={!rankingTournamentSelection}
                        className={`px-2 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs border rounded-lg transition-colors ${darkMode ? 'text-slate-100 bg-slate-700 border-slate-600' : 'text-slate-600 bg-white border-slate-200'}`}
                      >
                        <option value="all">Alle Spieltage</option>
                        {tournaments.find(t => t.id === rankingScope)?.rounds.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.date})</option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>



                <div className="relative w-full xl:w-80 xl:flex-1 min-w-0">

                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} size={16} />

                  <input type="text" placeholder="Spieler suchen..." value={rankingSearchQuery} onChange={(e) => setRankingSearchQuery(e.target.value)} className={`w-full pl-9 pr-4 py-2 border rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-200 placeholder-slate-600'}`} />

                </div>



                <div className="w-full xl:w-auto flex gap-2 min-w-0">
                  <select value={rankingAgeGroup} onChange={e => setRankingAgeGroup(e.target.value)} className={`flex-1 min-w-0 p-1.5 md:p-2 border rounded-lg text-xs md:text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                    {getSortedAgeGroups().map(group => (
                      <option key={group} value={group}>{displayAgeGroup(group)}</option>
                    ))}
                  </select>
                  <select value={rankingLevelFilter} onChange={e => setRankingLevelFilter(e.target.value as Level | 'All')} className={`flex-1 min-w-0 max-w-[140px] p-1.5 md:p-2 border rounded-lg text-xs md:text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                    <option value="All">Alle Level</option>
                    <option value="A">{LEVEL_LABELS.A}</option>
                    <option value="B">{LEVEL_LABELS.B}</option>
                    <option value="C">{LEVEL_LABELS.C}</option>
                  </select>
                </div>

              </div>



              <div className="flex justify-end">

                <button onClick={() => setShowPointsInfo(!showPointsInfo)} className={`text-[10px] md:text-xs flex items-center gap-1 transition-colors ${darkMode ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-600'}`}>

                  <Info size={12} className="md:w-[14px] md:h-[14px]" /> <span className="hidden sm:inline">Wie werden Punkte berechnet?</span><span className="sm:hidden">Punkte?</span>

                </button>

              </div>


              {showPointsInfo && (

                <div className={`p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-blue-50 border-blue-100 text-slate-700'}`}>

                  <h4 className={`font-bold mb-2 ${darkMode ? 'text-slate-100' : 'text-blue-800'}`}>Fair-Play Punktesystem:</h4>

                  <ul className="list-disc pl-5 space-y-1">

                    <li><b>Sieg:</b> 2 Punkte (x Gruppengewicht)</li>

                    <li><b>Knappe Niederlage:</b> 1 Punkt (x Gruppengewicht) – Race-4 (keine), Race-10 (knapp ab 8:10), Race-15 (knapp ab 12:15)</li>

                    <li><b>Teilnahme:</b> 1 Punkt (ohne Gewichtung)</li>

                    <li><b>Gruppengewicht:</b> Basis ist die größte Gruppe der gleichen Altersklasse (über alle Leistungsklassen A/B/C). Kleinere Gruppen bekommen etwas mehr Punkte (gedämpft, max ~20% Bonus), große Gruppen werden nicht bestraft (min 1.0).</li>

                  </ul>

                </div>

              )}



              <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col w-full transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <div className="overflow-x-auto w-full">

                  <table className="w-full text-left">

                    <thead className={`text-[10px] md:text-xs uppercase font-bold tracking-wider transition-colors ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>

                      <tr>

                        <th className="p-2 md:p-4 w-12 md:w-16 text-center">Rang</th>

                        <th className="p-2 md:p-4">Spieler</th>

                        <th className="p-2 md:p-4 hidden sm:table-cell">Altersklasse</th>

                        <th className="p-2 md:p-4 text-right">Punkte</th>

                        <th className="p-2 md:p-4 w-8 md:w-10"></th>

                        {isAdmin && <th className="p-2 md:p-4 w-12 md:w-16">Aktion</th>}

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">

                      {paginatedData.length === 0 ? (

                        <tr><td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500">Keine Spieler gefunden {rankingScope !== 'overall' ? 'für diesen Zeitraum' : ''}.</td></tr>

                      ) : (

                        paginatedData.map((player, idx) => {

                          const realRank = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;

                          return (

                            <tr key={player.id} onClick={() => setViewingPlayer(player)} className={`cursor-pointer transition group ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-emerald-50/50'}`}>

                              <td className="p-2 md:p-4 text-center">

                                <span className={`inline-block w-8 h-8 leading-8 md:w-10 md:h-10 md:leading-10 rounded-full font-bold text-xs md:text-sm shadow-md ${realRank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' :
                                  realRank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900' :
                                    realRank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' :
                                      darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                                  }`}>{realRank}</span>

                              </td>

                              <td className="p-2 md:p-4">

                                <div className={`font-bold text-sm md:text-lg flex items-center gap-1 md:gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>

                                  {player.isTeam && <Users2 size={14} className="md:w-4 md:h-4 text-blue-500 dark:text-blue-400" />}

                                  <span className="truncate max-w-[120px] sm:max-w-none">{player.name}</span>

                                </div>

                                <div className="mt-0.5 md:mt-1">
                                  {renderLevelBadge(player.level, 'sm')}
                                </div>

                              </td>

                              <td className="p-2 md:p-4 text-xs md:text-sm hidden sm:table-cell">

                                <span className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-semibold shadow-sm text-xs ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-emerald-100 text-emerald-800'}`}>{player.ageGroup}</span>

                              </td>

                              <td className="p-2 md:p-4 text-right">

                                <div className="flex flex-col items-end gap-0.5 md:gap-1">
                                  <span className={`text-xl md:text-3xl font-black ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{player.totalPoints}</span>

                                  <div className={`text-[9px] md:text-[10px] font-medium ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>

                                    {(() => {
                                      const totalParticipation = player.details.reduce((sum: number, d: any) => sum + (d.participationPoints || 0), 0);
                                      return totalParticipation > 0 ? `+${totalParticipation} Teiln. • ` : '';
                                    })()}

                                    {player.details[0]?.stats}

                                  </div>
                                </div>

                              </td>

                              <td className={`p-2 md:p-4 transition-colors ${darkMode ? 'text-slate-600 group-hover:text-emerald-400' : 'text-slate-300 group-hover:text-emerald-500'}`}><ChevronRight size={16} className="md:w-5 md:h-5" /></td>

                            </tr>

                          )
                        })

                      )}

                    </tbody>

                  </table>

                </div>


                {/* Pagination Controls */}

                {rankingData.length > 0 && (

                  <div className={`border-t p-3 md:p-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

                    <div className={`text-[10px] md:text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>

                      Seite {currentPage} von {Math.max(1, totalPages)} <span className="hidden sm:inline">• {rankingData.length} Spieler</span>

                    </div>

                    <div className="flex gap-2">

                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`p-1.5 md:p-2 border rounded transition-colors disabled:opacity-50 ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600 disabled:hover:bg-slate-700' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 disabled:hover:bg-white'}`}><ChevronLeft size={14} className="md:w-4 md:h-4" /></button>

                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className={`p-1.5 md:p-2 border rounded transition-colors disabled:opacity-50 ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600 disabled:hover:bg-slate-700' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 disabled:hover:bg-white'}`}><ChevronRight size={14} className="md:w-4 md:h-4" /></button>

                    </div>

                  </div>

                )}

              </div>

            </div>

          )}



          {/* --- TAB: BRACKET & GROUPS --- */}

          {activeTab === 'bracket' && (

            <div className="animate-in fade-in space-y-4">

              <div className={`rounded-xl shadow-sm border p-4 md:p-6 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">

                  <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">

                    {activeBracket?.type === 'group' ? <Table2 size={18} className="md:w-5 md:h-5 text-emerald-600" /> : <GitFork size={18} className="md:w-5 md:h-5 text-emerald-600" />}

                    <span className="truncate">Turnier ({displayAgeGroup(activeBracketAge)} / Level {activeBracketLevel})</span>

                  </h2>

                  {isAdmin && activeBracket && (

                    <button onClick={() => updateSingleBracket(activeBracketAge, null, activeBracketLevel)} className="text-red-500 text-xs md:text-sm hover:underline">Aktuellen Plan löschen</button>

                  )}

                </div>

                <div className="grid md:grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4 overflow-x-hidden">
                  <div className="min-w-0">
                    <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase block mb-1">Altersklasse</label>
                    <select value={activeBracketAge} onChange={(e) => setActiveBracketAge(e.target.value as AgeGroup)} className={`w-full min-w-0 p-1.5 md:p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300'}`}>
                      {getSortedAgeGroups().filter(g => g !== "All").map(g => (
                        <option key={g} value={g}>{displayAgeGroup(g)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase block mb-1">Leistungsklasse</label>
                    <select value={activeBracketLevel} onChange={(e) => setActiveBracketLevel(e.target.value as Level)} className={`w-full min-w-0 p-1.5 md:p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300'}`}>
                      <option value="A">{LEVEL_LABELS.A}</option>
                      <option value="B">{LEVEL_LABELS.B}</option>
                      <option value="C">{LEVEL_LABELS.C}</option>
                    </select>
                  </div>
                </div>

                <p className={`text-xs md:text-sm mb-3 md:mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Turnier-Übersicht: alle Gruppen dieser Alters- und Leistungsklasse auf einer Seite. Gruppenspiele fließen in die Rangliste ein.</p>


                {!activeBracket ? (

                  isAdmin ? (

                    <div className={`flex flex-col md:flex-row gap-4 items-end p-4 rounded-lg border transition-colors overflow-x-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>

                      <div className="min-w-0 w-full md:w-auto">

                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Modus</label>

                        <select value={bracketType} onChange={(e) => setBracketType(e.target.value as 'ko' | 'group')} className="p-2 border rounded w-full md:w-32 text-sm">

                          <option value="ko">K.O.-System</option>

                          <option value="group">Gruppenphase</option>

                        </select>

                      </div>

                      <div className="min-w-0 w-full md:w-auto">

                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Leistungsklasse</label>

                        <select value={activeBracketLevel} onChange={(e) => setActiveBracketLevel(e.target.value as Level)} className="p-2 border rounded w-full md:w-40 text-sm">

                          <option value="A">{LEVEL_LABELS.A}</option>

                          <option value="B">{LEVEL_LABELS.B}</option>

                          <option value="C">{LEVEL_LABELS.C}</option>

                        </select>

                      </div>

                      {bracketType === 'ko' ? (

                        <div className="min-w-0 w-full md:w-auto">

                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Größe</label>

                          <select value={bracketSize} onChange={(e) => setBracketSize(parseInt(e.target.value))} className="p-2 border rounded w-full md:w-32 text-sm">

                            <option value="4">4 (Halbfinale)</option>

                            <option value="8">8 (Viertelfinale)</option>

                            <option value="16">16 (Achtelfinale)</option>

                            <option value="32">32 Spieler</option>

                            <option value="64">64 Spieler</option>

                          </select>

                        </div>

                      ) : (

                        <div className="min-w-0 w-full md:w-auto">

                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Spieler / Gruppe</label>

                          <input type="number" min="3" max="10" value={groupSizeInput} onChange={e => setGroupSizeInput(parseInt(e.target.value))} className="p-2 border rounded w-full md:w-24 text-sm" />

                        </div>

                      )}

                      {bracketType === 'group' && (

                        <div className="min-w-0 w-full md:w-auto">

                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Matches je Gegner</label>

                          <select value={groupMatchMode} onChange={e => setGroupMatchMode(e.target.value as 'auto' | 'single' | 'double')} className="p-2 border rounded w-full md:w-40 text-sm">

                            <option value="auto">Automatisch</option>

                            <option value="single">1x jeder gegen jeden</option>

                            <option value="double">2x jeder gegen jeden</option>

                          </select>

                          <p className="text-[11px] text-slate-500 mt-1">Auto: bis 4 Spieler doppelt, sonst einfach.</p>

                        </div>

                      )}



                      <div className="flex gap-2">

                        <button
                          onClick={() => {
                            if (!checkPermission('canManagePlanner', 'Turnier generieren')) return;

                            // Berechne berechtigte Spieler und öffne Auswahl-Modal
                            const eligible = players.filter(p =>
                              calculateAgeGroup(p) === activeBracketAge &&
                              p.level === activeBracketLevel
                            );

                            // Alle standardmäßig ausgewählt
                            setSelectedPlayerIds(new Set(eligible.map(p => p.id)));
                            setPlayerSelectionLevel(activeBracketLevel);
                            // Filter auf Zielgruppe setzen
                            setModalFilterAgeGroup(activeBracketAge);
                            setModalFilterLevel(activeBracketLevel);
                            setModalSearchQuery('');
                            setShowPlayerSelectionModal(true);
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 flex items-center gap-2 text-sm"
                        >

                          <Shuffle size={16} /> {bracketType === 'ko' ? 'Baum' : 'Gruppen'} Generieren

                        </button>

                      </div>

                    </div>

                  ) : (

                    <div className={`text-center p-12 rounded-lg border border-dashed transition-colors ${darkMode ? 'text-slate-500 bg-slate-900 border-slate-700' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>

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

                                <div className={`w-48 border rounded-lg shadow-sm overflow-hidden text-sm relative z-10 transition-colors ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>{/* Player 1 Slot */}

                                  <div

                                    className={`p-2 border-b flex justify-between items-center cursor-pointer transition-colors ${darkMode ? `hover:bg-slate-700 ${match.winner?.id === match.p1?.id && match.winner ? 'bg-emerald-900' : ''}` : `hover:bg-slate-50 ${match.winner?.id === match.p1?.id && match.winner ? 'bg-green-50' : ''}`}`}

                                    onClick={() => match.p1 && isAdmin && advanceBracket(rIndex, mIndex, match.p1)}

                                  >

                                    {match.p1 ? (

                                      <span className={`truncate max-w-[120px] ${match.winner?.id === match.p1.id ? 'font-bold text-green-700' : ''}`}>{match.p1.name}</span>

                                    ) : (

                                      isAdmin ? (

                                        <select

                                          className={`w-full text-xs p-1 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 border-slate-300'}`}

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

                                    {match.winner?.id === match.p1?.id && match.p1 && <CheckCircle2 size={12} className="text-green-600" />}

                                  </div>


                                  {/* Player 2 Slot */}

                                  <div

                                    className={`p-2 flex justify-between items-center cursor-pointer transition-colors ${darkMode ? `hover:bg-slate-700 ${match.winner?.id === match.p2?.id && match.winner ? 'bg-emerald-900' : ''}` : `hover:bg-slate-50 ${match.winner?.id === match.p2?.id && match.winner ? 'bg-green-50' : ''}`}`}

                                    onClick={() => match.p2 && isAdmin && advanceBracket(rIndex, mIndex, match.p2)}

                                  >

                                    {match.p2 ? (

                                      <span className={`truncate max-w-[120px] ${match.winner?.id === match.p2.id ? 'font-bold text-green-700' : ''}`}>{match.p2.name}</span>

                                    ) : (

                                      isAdmin ? (

                                        <select

                                          className={`w-full text-xs p-1 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 border-slate-300'}`}

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

                                    {match.winner?.id === match.p2?.id && match.p2 && <CheckCircle2 size={12} className="text-green-600" />}

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

                          <div className={`w-32 h-32 border-2 border-dashed rounded-full flex flex-col items-center justify-center transition-colors ${darkMode ? 'border-emerald-800 text-emerald-400 bg-emerald-950' : 'border-emerald-200 text-emerald-600 bg-emerald-50'}`}>

                            <Trophy size={32} className="mb-2" />

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

                        <div className="flex flex-col sm:flex-row gap-2 justify-end mb-3 md:mb-4">

                          <button onClick={fillRandomGroupResults} className={`text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>

                            <Shuffle size={10} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">Test: Zufallsergebnisse</span><span className="sm:hidden">Zufall</span>

                          </button>

                          <button onClick={clearGroupResults} className={`text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded flex items-center justify-center gap-1 font-bold transition-colors ${darkMode ? 'bg-red-900 text-red-300 hover:bg-red-800' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>

                            <Trash2 size={10} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">Ergebnisse löschen</span><span className="sm:hidden">Löschen</span>

                          </button>

                          <button onClick={advanceGroupsToKO} className="text-[10px] md:text-xs bg-blue-600 px-2 md:px-3 py-1 md:py-1.5 rounded hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1 shadow-lg shadow-blue-200 dark:shadow-blue-900/30">

                            <ArrowRightCircle size={10} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">KO-Phase erstellen</span><span className="sm:hidden">KO-Phase</span>

                          </button>

                        </div>

                      )}


                      <div className="grid md:grid-cols-2 gap-6">

                        {activeBracket.groups?.map((group, gIndex) => {

                          const standings = calculateGroupStandings(group);

                          return (

                            <div key={gIndex} className={`rounded-xl overflow-hidden shadow-sm border transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                              <div className="bg-slate-100 p-2 font-bold text-slate-700 text-center border-b border-slate-200">{group.name}</div>


                              {/* STANDINGS TABLE */}

                              <div className={`p-2 border-b transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

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

                                  <div key={m.id} className={`p-2 flex justify-between items-center transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-slate-50'}`}><div className="text-xs">

                                    <div className={m.winner?.id === m.p1.id ? 'font-bold text-green-700' : ''}>{m.p1.name}</div>

                                    <div className={m.winner?.id === m.p2.id ? 'font-bold text-green-700' : ''}>{m.p2.name}</div>

                                  </div>

                                    {isAdmin ? (

                                      <input

                                        type="text"

                                        placeholder="6:4 6:2"

                                        className={`w-16 text-[10px] p-1 border rounded text-right font-mono transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                                        value={m.score}

                                        onChange={(e) => updateGroupMatch(gIndex, mIndex, e.target.value)}

                                      />

                                    ) : <span className="font-mono text-xs font-bold text-slate-600">{m.score || '-:-'}</span>}

                                  </div>

                                ))}

                              </div>

                            </div>

                          )
                        })}

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

              <div className={`rounded-xl shadow-sm border p-4 md:p-6 flex flex-col gap-3 md:gap-4 transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-col gap-3 md:gap-4">
                  <div>
                    <h2 className={`text-lg md:text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><Calendar className="text-emerald-600 w-4 h-4 md:w-[18px] md:h-[18px]" size={16} /> Spielplan nach Turniertag & Alters-/Leistungsklasse</h2>
                    <p className={`text-xs md:text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Wähle einen Turniertag und lose pro Level aus. Der Spielmodus kann für jede Gruppe einzeln festgelegt werden.</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full overflow-x-hidden">
                    <div className="grid md:grid-cols-2 gap-2 md:gap-3 w-full">
                      <div className="flex flex-col gap-1 md:gap-2 min-w-0">
                        <label className={`text-[10px] md:text-xs font-bold uppercase ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Turnier</label>
                        <select value={plannerSelectedTournamentId} onChange={e => {
                          setPlannerSelectedTournamentId(e.target.value);
                          const t = tournaments.find(t => t.id === e.target.value);
                          if (t && t.rounds.length > 0) setPlannerSelectedRoundId(t.rounds[0].id);
                        }} className={`w-full p-2 md:p-3 border rounded-lg text-xs md:text-sm font-medium transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                          {tournaments.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 md:gap-2 min-w-0">
                        <label className={`text-[10px] md:text-xs font-bold uppercase ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Spieltag</label>
                        <select value={plannerSelectedRoundId} onChange={e => setPlannerSelectedRoundId(e.target.value)} className={`w-full p-2 md:p-3 border rounded-lg text-xs md:text-sm font-medium transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                          {(() => {
                            const selectedTournament = tournaments.find(t => t.id === plannerSelectedTournamentId);
                            if (!selectedTournament || selectedTournament.rounds.length === 0) {
                              return <option value="">Keine Spieltage vorhanden</option>;
                            }
                            return selectedTournament.rounds.map(r => (
                              <option key={r.id} value={r.id}>{r.name} ({r.date})</option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const selectedTournament = tournaments.find(t => t.id === plannerSelectedTournamentId);
                      const selectedRound = selectedTournament?.rounds.find(r => r.id === plannerSelectedRoundId);

                      return (
                        <>
                          {selectedTournament && selectedRound && (
                            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-3 md:p-5 rounded-xl border border-emerald-800 shadow-lg">
                              <div className="flex items-center gap-2 md:gap-3 text-white">
                                <CalendarDays size={20} className="md:w-6 md:h-6 text-emerald-100 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[10px] md:text-xs font-semibold text-emerald-200 uppercase tracking-wide">Aktuelle Auswahl</div>
                                  <div className="text-base md:text-xl font-bold truncate">{selectedTournament.name}</div>
                                  <div className="text-xs md:text-sm text-emerald-100 flex items-center gap-1 md:gap-2 mt-0.5 md:mt-1">
                                    <Calendar size={12} className="md:w-[14px] md:h-[14px] flex-shrink-0" />
                                    <span className="truncate">{selectedRound.name} - {selectedRound.date}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 md:gap-2 min-w-0 w-full">
                            <label className={`text-[10px] md:text-xs font-bold uppercase ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Altersklasse</label>
                            <select value={plannerAgeGroup} onChange={e => setPlannerAgeGroup(e.target.value as AgeGroup)} className={`w-full p-2 md:p-3 border rounded-lg text-xs md:text-sm font-medium transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                              {getSortedAgeGroups().filter(g => g !== 'All').map(g => (
                                <option key={g} value={g}>{displayAgeGroup(g)}</option>
                              ))}
                            </select>
                          </div>
                          {isAdmin && hasPermission('canManagePlanner') && (
                            <>
                              <button onClick={() => triggerConfirm(
                                `Alle Leistungsklassen für ${displayAgeGroup(plannerAgeGroup)} neu auslosen? Bestehende Fixtures werden ersetzt.`,
                                () => { generatePlannerForAgeGroup(plannerAgeGroup); closeConfirm(); }
                              )} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all">
                                <Shuffle size={16} className="md:w-[18px] md:h-[18px]" /> Alle Leistungsklassen auslosen
                              </button>

                              {/* Button für Spieler ohne Gruppe */}
                              <button
                                onClick={() => setShowExcludedPlayersModal(true)}
                                className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all ${getPlayersWithoutGroup.length > 0
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300'
                                  }`}
                              >
                                <Users size={16} className="md:w-[18px] md:h-[18px]" />
                                Spieler ohne Gruppe {getPlayersWithoutGroup.length > 0 && `(${getPlayersWithoutGroup.length})`}
                              </button>

                              {hasPermission('canExportData') && (
                                <button
                                  onClick={() => {
                                    const selectedTournament = tournaments.find(t => t.id === plannerSelectedTournamentId);
                                    const selectedRound = selectedTournament?.rounds.find(r => r.id === plannerSelectedRoundId);

                                    // Sammle Daten für alle drei Levels
                                    const allGroupsData = (['A', 'B', 'C'] as Level[]).map(level => {
                                      const key = getPlannerKey(plannerAgeGroup, level, plannerSelectedRoundId);
                                      const fixtures = (plannerFixtures[key] || []).slice().sort((a, b) => a.round - b.round);
                                      const { stats: unsortedStats } = collectPlannerStats(plannerAgeGroup, level, plannerSelectedTournamentId, plannerSelectedRoundId, fixtures);
                                      const stats = unsortedStats.slice().sort((a, b) => b.points - a.points);

                                      return { level, fixtures, stats };
                                    }).filter(group => group.fixtures.length > 0 || group.stats.length > 0); // Nur Gruppen mit Daten

                                    if (allGroupsData.length === 0) {
                                      addToast('Keine Daten zum Drucken vorhanden', 'info');
                                      return;
                                    }

                                    printAllGroupsSchedule(
                                      plannerAgeGroup,
                                      allGroupsData,
                                      players,
                                      selectedTournament?.name || 'Turnier',
                                      selectedRound?.name + ' - ' + selectedRound?.date || 'Spieltag'
                                    );
                                  }}
                                  className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                                >
                                  <ClipboardList size={16} className="md:w-[18px] md:h-[18px]" /> Alle Gruppen drucken
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    message: `Alle Gruppen für ${displayAgeGroup(plannerAgeGroup)} löschen? Alle Fixtures und Punkte werden gelöscht.`,
                                    onConfirm: async () => {
                                      // Lösche alle drei Leistungsklassen (A, B, C) für die aktuelle Altersgruppe
                                      const levels: Level[] = ['A', 'B', 'C'];

                                      // Sammle ALLE Fixtures, die gelöscht werden sollen
                                      const allFixturesToDelete: PlannedMatch[] = [];
                                      levels.forEach(level => {
                                        const key = getPlannerKey(plannerAgeGroup, level, plannerSelectedRoundId);
                                        const groupFixtures = plannerFixtures[key] || [];
                                        allFixturesToDelete.push(...groupFixtures);
                                      });

                                      // ATOMAR LÖSCHEN auf dem Server
                                      const currentRoundId = `planner-${plannerSelectedRoundId}`;
                                      const deletePromises: Promise<any>[] = [];
                                      allFixturesToDelete.forEach(f => {
                                        deletePromises.push(apiDeleteMatchAtomic(f.p1Id, plannerSelectedTournamentId, currentRoundId, f.p2Id));
                                        deletePromises.push(apiDeleteMatchAtomic(f.p2Id, plannerSelectedTournamentId, currentRoundId, f.p1Id));
                                      });
                                      await Promise.all(deletePromises);

                                      // Lokalen results state bereinigen
                                      const updatedResults = results.map(playerResult => {
                                        const player = players.find(p => p.id === playerResult.playerId);
                                        if (!player) return playerResult;
                                        const pAge = calculateAgeGroup(player);
                                        if (pAge !== plannerAgeGroup) return playerResult;

                                        return {
                                          ...playerResult,
                                          matches: playerResult.matches.filter(m => {
                                            const mLevel = getMatchLevel(m, player.level || null);
                                            const isThisLevel = levels.includes(mLevel as Level);
                                            const isThisRound = m.roundId === currentRoundId;
                                            return !(isThisLevel && isThisRound);
                                          })
                                        };
                                      });

                                      // Fixtures im Plan leeren
                                      const updatedFixtures = { ...plannerFixtures };
                                      levels.forEach(level => {
                                        const key = getPlannerKey(plannerAgeGroup, level, plannerSelectedRoundId);
                                        updatedFixtures[key] = [];
                                      });

                                      updateResults(updatedResults);
                                      updatePlannerFixtures(updatedFixtures);
                                      addToast(`Alle Gruppen für ${displayAgeGroup(plannerAgeGroup)} gelöscht`, 'success');
                                      closeConfirm();
                                    }
                                  });
                                }}
                                className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                              >
                                <Trash2 size={14} className="md:w-4 md:h-4" /> Alle Gruppen löschen
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {isAdmin && (
                    <div className={`border rounded-xl p-4 md:p-6 space-y-4 md:space-y-5 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex items-center gap-2 mb-3 md:mb-4">
                        <UserPlus size={18} className={`md:w-5 md:h-5 ${darkMode ? 'text-slate-400' : 'text-blue-600'}`} />
                        <h3 className={`text-sm md:text-base font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Spieler hinzufügen</h3>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2 md:mb-3 tracking-wide">Spieler wählen</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <select
                              value={plannerFilterAgeGroup}
                              onChange={e => setPlannerFilterAgeGroup(e.target.value as AgeGroup | 'All')}
                              className={`flex-1 min-w-[120px] p-2 md:p-2.5 border rounded-lg text-xs md:text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}
                            >
                              <option value="All">Alle Alter</option>
                              {getSortedAgeGroups().filter(g => g !== 'All').map(g => (
                                <option key={g} value={g}>{displayAgeGroup(g)}</option>
                              ))}
                            </select>
                            <select
                              value={plannerFilterLevel}
                              onChange={e => setPlannerFilterLevel(e.target.value as Level | 'All')}
                              className={`flex-1 min-w-[120px] p-2 md:p-2.5 border rounded-lg text-xs md:text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}
                            >
                              <option value="All">Alle Leistungsklassen</option>
                              <option value="A">{LEVEL_LABELS.A}</option>
                              <option value="B">{LEVEL_LABELS.B}</option>
                              <option value="C">{LEVEL_LABELS.C}</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={plannerPlayerSearch}
                            onChange={e => setPlannerPlayerSearch(e.target.value)}
                            placeholder="Suche..."
                            className={`w-full mb-2 p-2 md:p-2.5 text-sm md:text-base border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}
                          />
                          <select
                            value={plannerSelectedPlayerId}
                            onChange={e => setPlannerSelectedPlayerId(e.target.value)}
                            className={`w-full p-2.5 md:p-3.5 border rounded-lg text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}
                          >
                            <option value="">-- Wählen --</option>
                            {players
                              .filter(p => {
                                const matchesAge = plannerFilterAgeGroup === 'All' || calculateAgeGroup(p) === plannerFilterAgeGroup;
                                const matchesLevel = plannerFilterLevel === 'All' || p.level === plannerFilterLevel;
                                const matchesSearch = !plannerPlayerSearch || p.name.toLowerCase().includes(plannerPlayerSearch.toLowerCase());
                                return matchesAge && matchesLevel && matchesSearch;
                              })
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({displayAgeGroup(calculateAgeGroup(p))}{p.level ? ` • ${LEVEL_LABELS[p.level]}` : ''})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2 md:mb-3 tracking-wide">Ziel-Altersklasse</label>
                          <select value={plannerTargetAgeGroup} onChange={e => setPlannerTargetAgeGroup(e.target.value as AgeGroup)} className={`w-full p-2.5 md:p-3.5 border rounded-lg text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}>
                            {getSortedAgeGroups().filter(g => g !== 'All').map(g => (
                              <option key={g} value={g}>{displayAgeGroup(g)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2 md:mb-3 tracking-wide">Leistungsklasse</label>
                          <select value={plannerNewLevel} onChange={e => setPlannerNewLevel(e.target.value as Level)} className={`w-full p-2.5 md:p-3.5 border rounded-lg text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:border-slate-500 focus:ring-blue-500' : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500'} focus:outline-none focus:ring-2`}>
                            <option value="A">{LEVEL_LABELS.A}</option>
                            <option value="B">{LEVEL_LABELS.B}</option>
                            <option value="C">{LEVEL_LABELS.C}</option>
                          </select>
                        </div>
                        <div>
                          <button onClick={quickAddPlannerPlayer} className="w-full px-3 md:px-4 py-2.5 md:py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700 text-white text-sm md:text-base font-bold rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg dark:shadow-blue-900/30 transition-all"><UserPlus size={16} className="md:w-[18px] md:h-[18px]" /> Hinzufügen</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showTournamentField && (
                    <div className={`rounded-xl shadow-sm border p-4 transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <h4 className={`text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}><CalendarDays size={16} /> Turniertage</h4>
                      {tournaments.length === 0 ? (
                        <p className={`text-center py-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Keine Turniere angelegt.</p>
                      ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {tournaments.map(t => (
                            <div key={t.id} className={`border rounded-lg p-3 transition-colors ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                              <div className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.name}</div>
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
                  )}
                </div>
              </div>

              {(['A', 'B', 'C'] as Level[]).map(level => {
                const key = getPlannerKey(plannerAgeGroup, level, plannerSelectedRoundId);
                const allFixtures = (plannerFixtures[key] || []).slice().sort((a, b) => a.round - b.round);

                // Trenne in offene und gespielte Spiele
                // WICHTIG: Verwende fixtureId zur eindeutigen Identifikation!
                // Bei Suche nach roundId+opponentId werden ALLE Fixtures mit gleicher Paarung als gespielt markiert.
                const playedFixtures = allFixtures.filter(f => {
                  const p1Result = results.find(r => r.playerId === f.p1Id && r.tournamentId === plannerSelectedTournamentId);
                  // Suche nach Match mit dieser spezifischen fixtureId
                  return p1Result?.matches.some(m => m.fixtureId === f.id);
                });
                const openFixtures = allFixtures.filter(f => !playedFixtures.some(pf => pf.id === f.id));

                // Zeige NUR Ergebnisse für den aktuell ausgewählten Spieltag (nicht Gesamtpunkte)
                const { stats: unsortedStats, weight, participantCount } = collectPlannerStats(plannerAgeGroup, level, plannerSelectedTournamentId, plannerSelectedRoundId, allFixtures);
                const stats = unsortedStats.slice().sort((a, b) => b.points - a.points);
                const resolveName = (id: string) => players.find(p => p.id === id)?.name || 'Unbekannt';

                // Paginierung für OFFENE Fixtures
                const FIXTURES_PER_PAGE = 5;
                const totalFixturePages = Math.max(1, Math.ceil(openFixtures.length / FIXTURES_PER_PAGE));
                const currentFixturePage = Math.min(plannerCurrentPage, totalFixturePages);
                const paginatedFixtures = openFixtures.slice((currentFixturePage - 1) * FIXTURES_PER_PAGE, currentFixturePage * FIXTURES_PER_PAGE);

                const groupKey = `${plannerAgeGroup}-${level}`;
                const currentMode = groupMatchModes[groupKey] || 'auto';

                return (
                  <div key={level} className={`rounded-xl shadow-sm border p-4 md:p-6 space-y-3 md:space-y-4 transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2">
                          {renderLevelBadge(level, 'md')}
                          <span className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">Altersklasse: {displayAgeGroup(plannerAgeGroup)}</span>
                        </h3>
                        <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>Teilnehmer: {participantCount} • Gruppengewicht: x{weight.toFixed(2)}</span>
                          {isAdmin && editingWeightGroup !== groupKey && (
                            <button
                              onClick={() => {
                                setEditingWeightGroup(groupKey);
                                setEditingWeightValue(weight.toFixed(2));
                              }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Gewichtung bearbeiten"
                            >
                              <Edit2 size={14} className="text-blue-600 dark:text-blue-400" />
                            </button>
                          )}
                          {isAdmin && editingWeightGroup === groupKey && (
                            <div className="flex flex-wrap items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="10"
                                value={editingWeightValue}
                                onChange={e => setEditingWeightValue(e.target.value)}
                                className="w-16 md:w-20 px-1 md:px-2 py-1 border border-blue-300 dark:border-blue-600 rounded text-[10px] md:text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  const newWeight = parseFloat(editingWeightValue);
                                  if (isNaN(newWeight) || newWeight <= 0) {
                                    addToast('Ungültige Gewichtung', 'error');
                                    return;
                                  }
                                  setCustomGroupWeights(prev => ({ ...prev, [groupKey]: newWeight }));
                                  setEditingWeightGroup(null);
                                  addToast('Gewichtung gespeichert', 'success');
                                }}
                                className="p-1 md:p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                                title="Speichern"
                              >
                                <Check size={12} className="md:w-3.5 md:h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingWeightGroup(null)}
                                className="p-1 md:p-1.5 bg-slate-400 hover:bg-slate-500 text-white rounded"
                                title="Abbrechen"
                              >
                                <X size={12} className="md:w-3.5 md:h-3.5" />
                              </button>
                              {customGroupWeights[groupKey] !== undefined && (
                                <button
                                  onClick={() => {
                                    const newWeights = { ...customGroupWeights };
                                    delete newWeights[groupKey];
                                    setCustomGroupWeights(newWeights);
                                    setEditingWeightGroup(null);
                                    addToast('Auf automatische Gewichtung zurückgesetzt', 'success');
                                  }}
                                  className="p-1 md:p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded ml-1"
                                  title="Auf automatisch zurücksetzen"
                                >
                                  <ArrowRightCircle size={12} className="md:w-3.5 md:h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isAdmin && hasPermission('canManagePlanner') && (
                        <div className="flex flex-col gap-2 w-full lg:min-w-[200px] lg:w-auto">
                          <select
                            value={currentMode}
                            onChange={e => setGroupMatchModes(prev => ({ ...prev, [groupKey]: e.target.value as 'auto' | 'single' | 'double' }))}
                            className={`p-2 md:p-2.5 border rounded-lg text-xs md:text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
                          >
                            <option value="auto">Automatisch</option>
                            <option value="single">1x gegen jeden</option>
                            <option value="double">2x gegen jeden</option>
                          </select>
                          <button
                            onClick={() => {
                              if (!checkPermission('canManagePlanner', 'Spielplan verwalten')) return;

                              // Berechne berechtigte Spieler und öffne Auswahl-Modal
                              const excludedIds = plannerSelectedRoundId
                                ? getExcludedPlayerIds(plannerSelectedRoundId, plannerAgeGroup, level)
                                : [];
                              const eligible = players.filter(p =>
                                calculateAgeGroup(p) === plannerAgeGroup &&
                                p.level === level &&
                                !excludedIds.includes(p.id)
                              );

                              // Alle standardmäßig ausgewählt
                              setSelectedPlayerIds(new Set(eligible.map(p => p.id)));
                              setPlayerSelectionLevel(level);
                              // Filter auf Zielgruppe setzen (nur eigene Gruppe anzeigen)
                              setModalFilterAgeGroup(plannerAgeGroup);
                              setModalFilterLevel(level);
                              setModalSearchQuery('');
                              setShowPlayerSelectionModal(true);
                            }}
                            className="w-full px-2 md:px-3 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-1"
                          >
                            <UserPlus size={12} className="md:w-4 md:h-4" /> Spieler hinzufügen
                          </button>
                          <button
                            onClick={() => {
                              if (!checkPermission('canManagePlanner', 'Spielplan verwalten')) return;

                              // Hole alle Spieler in der aktuellen Gruppe
                              const memberKey = `${plannerSelectedRoundId}-${plannerAgeGroup}-${level}`;
                              const currentMembers = groupMembers[memberKey] || [];

                              if (currentMembers.length < 2) {
                                addToast('Mindestens 2 Spieler erforderlich für Auslosung', 'error');
                                return;
                              }

                              // Erste Bestätigung
                              triggerConfirm(
                                `Spielplan für ${currentMembers.length} Spieler generieren?`,
                                () => {
                                  closeConfirm();
                                  // Zweite Bestätigung
                                  setTimeout(() => {
                                    triggerConfirm(
                                      `Bestehende Fixtures werden ersetzt. Fortfahren?`,
                                      () => {
                                        // Jetzt auslosen
                                        const mode: 'single' | 'double' = currentMode === 'auto'
                                          ? (currentMembers.length <= 4 ? 'double' : 'single')
                                          : currentMode;
                                        const fixtures = generateRoundRobin(currentMembers, mode).map(f => ({
                                          id: generateId(),
                                          ageGroup: plannerAgeGroup,
                                          level,
                                          round: f.round,
                                          p1Id: f.p1Id,
                                          p2Id: f.p2Id
                                        }));
                                        const newFixtures = { ...plannerFixtures, [key]: fixtures };
                                        updatePlannerFixtures(newFixtures);
                                        addToast(`Auslosung für ${LEVEL_LABELS[level]} abgeschlossen`, 'success');
                                        closeConfirm();
                                      }
                                    );
                                  }, 100);
                                }
                              );
                            }}
                            className="w-full px-2 md:px-3 py-2 md:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-1"
                          >
                            <Shuffle size={12} className="md:w-4 md:h-4" /> Auslosen
                          </button>
                          <button
                            onClick={() => {
                              if (!checkPermission('canManagePlanner', 'Spielplan verwalten')) return;
                              setConfirmDialog({
                                isOpen: true,
                                message: `Gesamte Gruppe ${LEVEL_LABELS[level]} (${displayAgeGroup(plannerAgeGroup)}) löschen? Alle Fixtures und Punkte werden gelöscht.`,
                                onConfirm: () => {
                                  // Sammle alle Spieler-IDs aus stats (enthält alle Spieler mit Punkten, auch ohne Fixtures)
                                  const playerIdsFromStats = new Set(stats.map(s => s.player.id));

                                  // Sammle auch Spieler-IDs aus Fixtures (falls vorhanden)
                                  const groupFixtures = allFixtures;
                                  groupFixtures.forEach(f => {
                                    playerIdsFromStats.add(f.p1Id);
                                    playerIdsFromStats.add(f.p2Id);
                                  });

                                  // Entferne alle gespeicherten Ergebnisse für diese Gruppe NUR für diesen Spieltag
                                  // Basierend auf: Spieler-ID, Level, und roundId (exakte Übereinstimmung)
                                  const currentRoundId = `planner-${plannerSelectedRoundId}`;
                                  const updatedResults = results.map(playerResult => {
                                    // Nur Ergebnisse für Spieler in dieser Gruppe bearbeiten
                                    if (!playerIdsFromStats.has(playerResult.playerId)) return playerResult;

                                    return {
                                      ...playerResult,
                                      matches: playerResult.matches.filter(m => {
                                        // Prüfe ob dieses Match zu dieser Gruppe gehört
                                        const player = players.find(p => p.id === playerResult.playerId);
                                        const matchLevel = getMatchLevel(m, player?.level || null);

                                        // Nur Matches für dieses Level löschen
                                        if (matchLevel !== level) return true; // Behalten

                                        // Prüfe ob es ein Planner-Match für genau diesen Spieltag ist (exakte Übereinstimmung)
                                        const isPlannerMatchForThisRound = m.roundId === currentRoundId;

                                        // Oder ein Match das zu einem Fixture in dieser Gruppe gehört
                                        const belongsToFixture = groupFixtures.some(f =>
                                          (m.roundId === currentRoundId) &&
                                          ((playerResult.playerId === f.p1Id && m.opponentId === f.p2Id) ||
                                            (playerResult.playerId === f.p2Id && m.opponentId === f.p1Id))
                                        );

                                        // Lösche wenn es ein Planner-Match für diesen Spieltag ist oder zu einem Fixture gehört
                                        return !(isPlannerMatchForThisRound || belongsToFixture);
                                      })
                                    };
                                  });
                                  updateResults(updatedResults);

                                  // Entferne alle Fixtures
                                  const newPlannerFixtures = { ...plannerFixtures, [key]: [] };
                                  updatePlannerFixtures(newPlannerFixtures);

                                  // Entferne auch alle groupMembers für diese Gruppe
                                  const memberKey = `${plannerSelectedRoundId}-${plannerAgeGroup}-${level}`;
                                  const newGroupMembers = { ...groupMembers };
                                  delete newGroupMembers[memberKey];
                                  updateGroupMembers(newGroupMembers);

                                  addToast(`Gruppe ${LEVEL_LABELS[level]} komplett gelöscht`, 'success');
                                  closeConfirm();
                                }
                              });
                            }}
                            className="w-full px-2 md:px-3 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-1"
                            title="Gesamte Gruppe löschen"
                          >
                            <Trash2 size={12} className="md:w-4 md:h-4" /> Gruppe löschen
                          </button>

                          {hasPermission('canExportData') && (
                            <button
                              onClick={() => {
                                const selectedTournament = tournaments.find(t => t.id === plannerSelectedTournamentId);
                                const selectedRound = selectedTournament?.rounds.find(r => r.id === plannerSelectedRoundId);
                                printMatchSchedule(
                                  level,
                                  plannerAgeGroup,
                                  allFixtures,
                                  stats,
                                  players,
                                  selectedTournament?.name || 'Turnier',
                                  selectedRound?.name + ' - ' + selectedRound?.date || 'Spieltag'
                                );
                              }}
                              className="w-full px-2 md:px-3 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-1"
                              title="Spielplan drucken"
                            >
                              <ClipboardList size={12} className="md:w-4 md:h-4" /> Drucken
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6">
                      <div className="lg:col-span-2 w-full overflow-x-auto space-y-3">
                        <table className="w-full text-left min-w-[400px] lg:min-w-full">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] md:text-xs font-bold tracking-wide sticky top-0 z-5">
                            <tr>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-center w-12 md:w-16 flex-shrink-0">Platz</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 min-w-[120px] md:min-w-0">Name</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 hidden lg:table-cell">Verein</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-center flex-shrink-0">Teiln.</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-center flex-shrink-0">S</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-center hidden sm:table-cell flex-shrink-0">KN</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-center flex-shrink-0">N</th>
                              <th className="px-2 md:px-4 py-2 md:py-3 text-right flex-shrink-0">Punkte</th>
                              {isAdmin && <th className="px-1 md:px-3 py-2 md:py-3 text-center w-10 md:w-14 flex-shrink-0">Aktion</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {stats.length === 0 ? (
                              <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Noch keine Spieler in dieser Leistungsklasse</td></tr>
                            ) : stats.map((s, idx) => (
                              <tr key={s.player.id} className={`cursor-pointer transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`} onClick={() => setViewingPlayer(s.player)}>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-center flex-shrink-0">
                                  <span className={`inline-block w-7 h-7 leading-7 md:w-8 md:h-8 md:leading-8 rounded-full font-bold text-xs md:text-sm shadow-sm ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' :
                                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900' :
                                      idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' :
                                        darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                                    }`}>{idx + 1}</span>
                                </td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 font-semibold text-xs md:text-base text-emerald-600 dark:text-emerald-400 hover:underline truncate min-w-0">{s.player.name}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-slate-500 dark:text-slate-400 text-xs md:text-sm hidden lg:table-cell">{s.player.club || '-'}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-center font-semibold text-xs md:text-base text-slate-700 dark:text-slate-300 flex-shrink-0">{s.participationPoints}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-center font-semibold text-xs md:text-base text-green-600 dark:text-green-400 flex-shrink-0">{s.wins}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-center font-semibold text-xs md:text-base text-orange-600 dark:text-orange-400 hidden sm:table-cell flex-shrink-0">{s.close}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-center font-semibold text-xs md:text-base text-red-600 dark:text-red-400 flex-shrink-0">{s.losses}</td>
                                <td className="px-2 md:px-4 py-2 md:py-3.5 text-right flex-shrink-0">
                                  <span className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400">
                                    {s.points.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 ml-1">Pkt</span>
                                </td>
                                {isAdmin && (
                                  <td className="px-1 md:px-2 py-2 md:py-3 text-center flex-shrink-0 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        setConfirmDialog({
                                          isOpen: true,
                                          message: `${s.player.name} aus ${LEVEL_LABELS[level]} entfernen? Alle Punkte dieses Spielers in dieser Gruppe werden gelöscht.`,
                                          onConfirm: () => {
                                            // Entferne alle Fixtures, die diesen Spieler betreffen
                                            const updatedFixtures = (plannerFixtures[key] || []).filter(
                                              f => f.p1Id !== s.player.id && f.p2Id !== s.player.id
                                            );
                                            const newPlannerFixtures = { ...plannerFixtures, [key]: updatedFixtures };
                                            updatePlannerFixtures(newPlannerFixtures);

                                            // Entferne NUR Ergebnisse für diesen Spieler in diesem Level UND diesem Spieltag
                                            // (nicht von anderen Spieltagen)
                                            const currentRoundId = `planner-${plannerSelectedRoundId}`;
                                            const updatedResults = results.map(playerResult => {
                                              // Für den zu löschenden Spieler: nur Matches dieses Spieltags in diesem Level löschen
                                              if (playerResult.playerId === s.player.id) {
                                                return {
                                                  ...playerResult,
                                                  matches: playerResult.matches.filter(m => {
                                                    const matchLevel = getMatchLevel(m, s.player.level || null);
                                                    // Behalte Matches wenn:
                                                    // - anderes Level ODER
                                                    // - nicht dieser Spieltag (exakte Übereinstimmung prüfen)
                                                    const isThisRound = m.roundId === currentRoundId;
                                                    return matchLevel !== level || !isThisRound;
                                                  })
                                                };
                                              }

                                              // Für andere Spieler: Matches gegen diesen Spieler nur für diesen Spieltag löschen
                                              return {
                                                ...playerResult,
                                                matches: playerResult.matches.filter(m => {
                                                  // Wenn Gegner der zu löschende Spieler ist und es genau dieser Spieltag ist
                                                  if (m.opponentId === s.player.id && m.roundId === currentRoundId) {
                                                    const matchLevel = getMatchLevel(m, players.find(p => p.id === playerResult.playerId)?.level || null);
                                                    return matchLevel !== level; // Löschen wenn gleiches Level
                                                  }
                                                  return true;
                                                })
                                              };
                                            });
                                            updateResults(updatedResults);

                                            // Entferne Spieler aus persistenten groupMembers
                                            const memberKey = `${plannerSelectedRoundId}-${plannerAgeGroup}-${level}`;
                                            const currentMembers = groupMembers[memberKey] || [];
                                            const updatedMembers = currentMembers.filter(id => id !== s.player.id);
                                            updateGroupMembers({ ...groupMembers, [memberKey]: updatedMembers });

                                            // Spieler zu ausgeschlossenen hinzufügen
                                            excludePlayerFromGroup(s.player.id, plannerAgeGroup, level);

                                            addToast(`${s.player.name} aus Gruppe entfernt`, 'success');
                                            closeConfirm();
                                          }
                                        });
                                      }}
                                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                      title="Spieler entfernen (wird bei Auslosung nicht mehr berücksichtigt)"
                                    >
                                      <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={`w-full border rounded-xl p-3 md:p-4 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-3 md:mb-4">
                          <span className={`text-xs md:text-sm font-bold uppercase tracking-wide ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Auslosung</span>
                          <div className="flex items-center gap-2">
                            {playedFixtures.length > 0 && (
                              <button
                                onClick={() => {
                                  setRecentlyPlayedFixtures(playedFixtures);
                                  setRecentlyPlayedLevel(level);
                                  setShowRecentlyPlayedModal(true);
                                }}
                                className={`text-[10px] md:text-xs px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${darkMode ? 'bg-blue-900/30 border-blue-800 text-blue-300 hover:bg-blue-900/50' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-sm'}`}
                              >
                                <HistoryIcon size={10} /> {playedFixtures.length} Gespielt
                              </button>
                            )}
                            <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-500'}`}>{allFixtures.length} geplant</span>
                          </div>
                        </div>
                        {openFixtures.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 gap-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Keine offenen Spiele.</p>
                            {playedFixtures.length > 0 && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Alle {playedFixtures.length} Spiele dieser Gruppe wurden bereits gewertet.</p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-3 md:space-y-4 mb-3 md:mb-4">
                              {paginatedFixtures.map(f => (
                                <div key={f.id} className={`rounded-lg border p-3 md:p-4 shadow-sm hover:shadow-md transition ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                  <div className={`flex justify-between items-center text-[10px] md:text-xs mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <span className="font-medium">Runde {f.round}</span>
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>{LEVEL_LABELS[level]}</span>
                                      {isAdmin && (
                                        <button
                                          onClick={() => {
                                            setConfirmDialog({
                                              isOpen: true,
                                              message: `Dieses Fixture (Runde ${f.round}) wirklich löschen? Falls bereits Punkte eingetragen wurden, werden diese ebenfalls gelöscht.`,
                                              onConfirm: () => {
                                                deletePlannerResult(f);
                                                closeConfirm();
                                              }
                                            });
                                          }}
                                          className="p-0.5 md:p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                          title="Fixture löschen"
                                        >
                                          <Trash2 size={10} className="md:w-3 md:h-3 text-red-600 dark:text-red-400" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`font-bold mb-2 md:mb-3 text-xs md:text-sm leading-relaxed ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                    <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer" onClick={() => setViewingPlayer(players.find(p => p.id === f.p1Id) || null)}>{resolveName(f.p1Id)}</span>
                                    {' '}<span className="text-slate-400 dark:text-slate-500 mx-1">vs</span>{' '}
                                    <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer" onClick={() => setViewingPlayer(players.find(p => p.id === f.p2Id) || null)}>{resolveName(f.p2Id)}</span>
                                  </div>

                                  {/* Zeit-Planung */}
                                  {isAdmin && (
                                    <div className="mb-2 md:mb-3">
                                      <label className={`text-[10px] font-bold uppercase mb-1 block ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Uhrzeit
                                      </label>
                                      <input
                                        type="time"
                                        value={f.time || ''}
                                        onChange={(e) => {
                                          const updated = (plannerFixtures[key] || []).map(fix =>
                                            fix.id === f.id ? { ...fix, time: e.target.value } : fix
                                          );
                                          // WICHTIG: updatePlannerFixtures statt setPlannerFixtures für DB-Persistenz!
                                          updatePlannerFixtures({ ...plannerFixtures, [key]: updated });
                                        }}
                                        className={`w-full px-2 py-1.5 text-xs md:text-sm border rounded transition-colors ${darkMode ? 'bg-slate-800 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
                                      />
                                    </div>
                                  )}

                                  {/* Anzeige für nicht-Admins */}
                                  {!isAdmin && f.time && (
                                    <div className={`flex items-center gap-2 md:gap-3 mb-2 md:mb-3 text-[10px] md:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                      <span className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <CalendarDays size={10} className="md:w-3 md:h-3" />
                                        {f.time} Uhr
                                      </span>
                                    </div>
                                  )}
                                  {isAdmin && hasPermission('canEnterResults') && (() => {
                                    // Prüfe ob Match bereits gespeichert wurde - via fixtureId!
                                    const p1Result = results.find(r => r.playerId === f.p1Id && r.tournamentId === plannerSelectedTournamentId);
                                    const savedMatch = p1Result?.matches.find(m => m.fixtureId === f.id);
                                    const isEditing = editingFixtures[f.id] || false;

                                    const scoreStr = plannerScoreInput[f.id] || (isEditing && savedMatch ? savedMatch.score : '');
                                    const weight = getGroupSizeWeight(participantCount, plannerAgeGroup, level);

                                    // Wenn gespeichert und nicht im Bearbeitungsmodus
                                    if (savedMatch && !isEditing) {
                                      // Berechne Punkte für gespeichertes Match - aus Perspektive beider Spieler
                                      const savedResultP1 = analyzeSingleScore(savedMatch.score, savedMatch.scoringMode || plannerScoringMode);
                                      const reversedSavedScore = savedMatch.score.split(' ').map((set: string) => {
                                        const [p1, p2] = set.split(':');
                                        return `${p2}:${p1}`;
                                      }).join(' ');
                                      const savedResultP2 = analyzeSingleScore(reversedSavedScore, savedMatch.scoringMode || plannerScoringMode);
                                      // Gewinner bekommt 2, Verlierer bekommt 1 bei knapper Niederlage
                                      const p1SavedPoints = savedResultP1.isWin ? 2 * weight : (savedResultP1.isCloseLoss ? 1 * weight : 0);
                                      const p2SavedPoints = savedResultP2.isWin ? 2 * weight : (savedResultP2.isCloseLoss ? 1 * weight : 0);

                                      return (
                                        <div className="flex flex-col gap-1">
                                          <div className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${darkMode ? 'bg-emerald-900' : 'bg-green-50'}`}>
                                            <span className={`text-xs font-mono font-bold ${darkMode ? 'text-emerald-300' : 'text-green-700'}`}>{savedMatch.score}</span>
                                            <div className="ml-auto flex gap-1">
                                              <button onClick={() => {
                                                setEditingFixtures(prev => ({ ...prev, [f.id]: true }));
                                                setPlannerScoreInput(prev => ({ ...prev, [f.id]: savedMatch.score }));
                                              }} className={`p-1 rounded transition-colors ${darkMode ? 'text-blue-400 hover:bg-slate-700' : 'text-blue-600 hover:bg-blue-100'}`} title="Bearbeiten">
                                                <Edit2 size={12} />
                                              </button>
                                              <button onClick={() => {
                                                setConfirmDialog({
                                                  isOpen: true,
                                                  message: 'Dieses Spiel wirklich löschen?',
                                                  onConfirm: () => {
                                                    deletePlannerResult(f);
                                                    closeConfirm();
                                                  }
                                                });
                                              }} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" title="Löschen">
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>
                                          <div className={`text-[10px] px-2 py-1 rounded transition-colors ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-blue-50 text-slate-600'}`}>
                                            ✓ <span className="truncate inline-block max-w-[80px] align-bottom">{resolveName(f.p1Id)}</span>: <b className={darkMode ? 'text-emerald-400' : 'text-emerald-700'}>{p1SavedPoints.toFixed(1)}P</b> • <span className="truncate inline-block max-w-[80px] align-bottom">{resolveName(f.p2Id)}</span>: <b className={darkMode ? 'text-emerald-400' : 'text-emerald-700'}>{p2SavedPoints.toFixed(1)}P</b>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="flex flex-col gap-2">
                                        <ScoreInputWithPreview
                                          fixtureId={f.id}
                                          defaultValue={scoreStr}
                                          p1Name={resolveName(f.p1Id)}
                                          p2Name={resolveName(f.p2Id)}
                                          weight={weight}
                                          scoringMode={plannerScoringMode}
                                          darkMode={darkMode}
                                          analyzeSingleScore={analyzeSingleScore}
                                          onScoreChange={(fId, score) => {
                                            setPlannerScoreInput(prev => ({ ...prev, [fId]: score }));
                                          }}
                                        />
                                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                          <select value={plannerScoringMode} onChange={e => setPlannerScoringMode(e.target.value as ScoringMode)} className={`flex-1 text-xs p-1.5 md:p-2 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                                            <option value="race4">Zählweise: bis 4</option>
                                            <option value="race10">Zählweise: bis 10</option>
                                            <option value="race15">Zählweise: bis 15</option>
                                            <option value="sets">Zählweise: Sätze</option>
                                          </select>
                                          <button onClick={() => {
                                            // FIXED: Read from React state, not DOM
                                            const currentValue = plannerScoreInput[f.id] || '';
                                            if (!currentValue.trim()) {
                                              // Fallback: Read from DOM if state is empty (first input before onChange fires)
                                              const inputEl = document.getElementById(`score-input-${f.id}`) as HTMLInputElement;
                                              savePlannerResult(f, inputEl?.value || '');
                                            } else {
                                              savePlannerResult(f, currentValue);
                                            }
                                            setEditingFixtures(prev => ({ ...prev, [f.id]: false }));
                                          }} className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded whitespace-nowrap">Speichern</button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                            {totalFixturePages > 1 && (
                              <div className="flex justify-center items-center gap-2 mt-3 md:mt-4">
                                <button
                                  onClick={() => setPlannerCurrentPage(Math.max(1, currentFixturePage - 1))}
                                  disabled={currentFixturePage === 1}
                                  className={`px-3 md:px-2 py-2 md:py-1 text-sm md:text-xs border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'}`}
                                >
                                  ←
                                </button>
                                <span className={`text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                  Seite {currentFixturePage} von {totalFixturePages}
                                </span>
                                <button
                                  onClick={() => setPlannerCurrentPage(Math.min(totalFixturePages, currentFixturePage + 1))}
                                  disabled={currentFixturePage === totalFixturePages}
                                  className={`px-3 md:px-2 py-2 md:py-1 text-sm md:text-xs border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'}`}
                                >
                                  →
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* TABELLEN-ANSICHT ENTFERNT - Informationen sind im Rangliste-Tab verfügbar */}

            </div>
          )}

          {/* --- TAB: SPIELER (NEU) --- */}

          {activeTab === 'players' && isAdmin && hasPermission('canManagePlayers') && (

            <div className="space-y-6 animate-in fade-in">

              <div className={`flex flex-col md:flex-row gap-4 justify-between p-4 rounded-xl border shadow-sm transition-colors overflow-x-hidden ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <div className="relative w-full md:w-64 min-w-0">

                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />

                  <input type="text" placeholder="Name suchen..." value={playersListSearch} onChange={(e) => setPlayersListSearch(e.target.value)} className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-slate-50 text-slate-900 border-slate-200 placeholder-slate-600'}`} />

                </div>

                <div className="flex gap-2 min-w-0 overflow-x-auto">

                  <select value={playersListAgeFilter} onChange={(e) => setPlayersListAgeFilter(e.target.value)} className={`min-w-0 p-2 border rounded-lg text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300'}`}>

                    <option value="All">Alle Altersklassen</option>

                    {getSortedAgeGroups().filter(g => g !== 'All').map(g => <option key={g} value={g}>{displayAgeGroup(g)}</option>)}

                  </select>

                  {isAdmin && (
                    <>
                      {hasPermission('canExportData') && (
                        <button
                          onClick={() => exportPlayersToExcel(players)}
                          className="bg-emerald-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 hover:bg-emerald-700"
                          title="Spielerliste als Excel exportieren"
                        >
                          <Database size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">Export Excel</span><span className="sm:hidden">Export</span>
                        </button>
                      )}

                      {hasPermission('canExportData') && (
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.csv,.txt,.xlsx,.xlsm,.xls';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  const newPlayers = await importPlayersFromCSV(file, players);
                                  if (newPlayers.length > 0) {
                                    updatePlayers([...players, ...newPlayers]);
                                    addToast(`${newPlayers.length} Spieler importiert`, 'success');
                                  } else {
                                    addToast('Keine neuen Spieler zum Importieren gefunden (evtl. bereits vorhanden)', 'info');
                                  }
                                } catch (error) {
                                  addToast((error as Error).message, 'error');
                                }
                              }
                            };
                            input.click();
                          }}
                          className="bg-blue-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 hover:bg-blue-700"
                          title="Spieler aus CSV/Excel importieren (Meldeliste)"
                        >
                          <Database size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">Import Meldeliste</span><span className="sm:hidden">Import</span>
                        </button>
                      )}

                      <button onClick={() => setIsCreatingTeam(!isCreatingTeam)} className="bg-purple-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 hover:bg-purple-700">

                        {isCreatingTeam ? <X size={14} className="md:w-4 md:h-4" /> : <Plus size={14} className="md:w-4 md:h-4" />} <span className="hidden sm:inline">Neues Doppel-Team</span><span className="sm:hidden">Team</span>

                      </button>
                    </>

                  )}

                </div>

              </div>



              {isCreatingTeam && (

                <div className={`p-4 rounded-xl border mb-4 animate-in slide-in-from-top-2 transition-colors overflow-x-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>

                  <h4 className={`font-bold mb-3 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Neues Doppel-Team erstellen</h4>

                  <div className="flex flex-col md:flex-row gap-4 items-center">

                    <div className="flex-1 w-full min-w-0">

                      <input

                        type="text"

                        placeholder="Suche Spieler 1..."

                        className={`w-full p-2 border rounded text-xs mb-1 transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                        value={teamSearch1}

                        onChange={e => setTeamSearch1(e.target.value)}

                      />

                      <select className={`w-full min-w-0 p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={teamMember1} onChange={e => setTeamMember1(e.target.value)}>

                        <option value="">Spieler 1 wählen</option>

                        {players.filter(p => !p.isTeam).filter(p => !teamSearch1 || p.name.toLowerCase().includes(teamSearch1.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}

                      </select>

                    </div>

                    <span className="font-bold text-slate-400 flex-shrink-0">+</span>

                    <div className="flex-1 w-full min-w-0">

                      <input

                        type="text"

                        placeholder="Suche Spieler 2..."

                        className={`w-full p-2 border rounded text-xs mb-1 transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                        value={teamSearch2}

                        onChange={e => setTeamSearch2(e.target.value)}

                      />

                      <select className={`w-full min-w-0 p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={teamMember2} onChange={e => setTeamMember2(e.target.value)}>

                        <option value="">Spieler 2 wählen</option>

                        {players.filter(p => !p.isTeam && p.id !== teamMember1).filter(p => !teamSearch2 || p.name.toLowerCase().includes(teamSearch2.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}

                      </select>

                    </div>

                    <button onClick={handleCreateTeam} className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded text-sm md:text-base font-bold hover:bg-blue-700 w-full md:w-auto flex-shrink-0">Erstellen</button>

                  </div>

                </div>

              )}



              <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <table className="w-full text-left">

                  <thead className={`text-[10px] md:text-xs uppercase font-bold tracking-wider transition-colors ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>

                    <tr>

                      <th className="p-2 md:p-4">Name</th>

                      <th className="p-2 md:p-4 hidden sm:table-cell">Altersklasse</th>

                      <th className="p-2 md:p-4">Level</th>

                      <th className="p-2 md:p-4 hidden lg:table-cell">Status</th>

                      {isAdmin && <th className="p-2 md:p-4 w-8 md:w-10">Aktion</th>}

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">

                    {filteredPlayersList.map(p => (

                      <tr key={p.id} onClick={() => setViewingPlayer(p)} className={`cursor-pointer group transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>

                        <td className={`p-2 md:p-4 font-bold text-xs md:text-sm flex items-center gap-1 md:gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>

                          {p.isTeam && <Users2 size={14} className="md:w-4 md:h-4 text-blue-500" />}

                          <span className="truncate max-w-[120px] sm:max-w-none">{p.name}</span>

                        </td>

                        <td className={`p-2 md:p-4 text-xs md:text-sm hidden sm:table-cell ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{formatAgeGroupLabel(calculateAgeGroup(p))}</td>

                        <td className={`p-2 md:p-4 text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{p.level ? LEVEL_LABELS[p.level] : '-'}</td>

                        <td className="p-2 md:p-4 text-[10px] md:text-xs hidden lg:table-cell">

                          {p.isTestData ? <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded transition-colors ${darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>Testdaten</span> : <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded transition-colors ${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'}`}>Registriert</span>}

                        </td>

                        {isAdmin && hasPermission('canManagePlayers') && (

                          <td className="p-2 md:p-4">

                            <button onClick={(e) => { e.stopPropagation(); deletePlayer(p.id); }} className={`transition-colors ${darkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}><Trash2 size={16} className="md:w-[18px] md:h-[18px]" /></button>

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

          {activeTab === 'register' && (

            <div className="max-w-xl mx-auto animate-in fade-in">

              <div className={`rounded-2xl p-4 md:p-8 shadow-lg text-center border transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 transition-colors ${darkMode ? 'bg-emerald-950' : 'bg-emerald-100'}`}>

                  <UserPlus className={`w-6 h-6 md:w-8 md:h-8 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />

                </div>

                <h2 className={`text-xl md:text-2xl font-bold mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{isAdmin ? 'Spieler direkt hinzufügen' : 'Spieler Anmeldung'}</h2>


                {!showRegSuccess ? (
                  <>
                    <div className="space-y-4 text-left">

                      <div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vor- & Nachname</label>

                        <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} placeholder="Max Mustermann" />

                      </div>

                      <div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Verein (optional)</label>

                        <input type="text" value={regClub} onChange={e => setRegClub(e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} placeholder="TC Musterstadt" />

                      </div>

                      <div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-Mail (optional)</label>

                        <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} placeholder="max@example.com" />

                      </div>

                      <div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Geburtsdatum</label>

                        <input type="date" value={regBirthDate} onChange={e => setRegBirthDate(e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} />

                        <div className="text-xs text-slate-500 mt-1">Altersklasse (automatisch): <span className="font-bold text-emerald-600">{regPreviewAge}</span> – anhand des Geburtsdatums</div>

                        {isAdmin && (
                          <div className={`border border-dashed rounded-lg p-3 mt-2 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-emerald-200'}`}>
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase">
                              <span>Manuelle Zuordnung</span>
                              <button
                                type="button"
                                onClick={() => setRegAllowAgeOverride(prev => {
                                  const next = !prev;
                                  if (!next) {
                                    setRegManualAgeGroup('');
                                  } else {
                                    setRegManualAgeGroup(regAutoAgeGroup || 'Yellow');
                                  }
                                  return next;
                                })}
                                disabled={!regBirthDate}
                                className={`text-xs font-bold ${regAllowAgeOverride ? 'text-red-500 hover:underline' : 'text-emerald-600 hover:underline'} disabled:text-slate-300`}
                              >
                                {regAllowAgeOverride ? 'Automatik nutzen' : 'Andere Klasse wählen'}
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">Standard ist die automatisch ermittelte Altersklasse. Nur ändern, wenn ein Spieler bewusst höher spielen soll.</p>
                            {regAllowAgeOverride && (
                              <select
                                value={regManualAgeGroup || regAutoAgeGroup || 'Yellow'}
                                onChange={e => setRegManualAgeGroup(e.target.value as AgeGroup)}
                                className={`mt-2 w-full p-2 border rounded text-sm transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
                              >
                                {AGE_GROUP_ORDER.map(group => (
                                  <option key={group} value={group}>{displayAgeGroup(group)}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                      </div>

                    </div>

                    <div>

                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Niveau</label>

                      <select value={regLevel} onChange={(e) => setRegLevel(e.target.value as Level)} className={`w-full p-3 border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>

                        <option value="A">{LEVEL_LABELS.A}</option>

                        <option value="B">{LEVEL_LABELS.B}</option>

                        <option value="C">{LEVEL_LABELS.C}</option>

                      </select>



                    </div>

                    <div>

                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Wunsch-Turnier</label>

                      <select value={regTournamentId} onChange={(e) => setRegTournamentId(e.target.value)} className={`w-full p-3 border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>

                        <option value="">-- Kein spezifisches Turnier --</option>

                        {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

                      </select>

                    </div>


                    {/* Round Select if Tournament Selected */}

                    {regTournamentId && (

                      <div className={`p-3 rounded-lg border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">An welchen Tagen?</label>

                        <div className="space-y-2">

                          {tournaments.find(t => t.id === regTournamentId)?.rounds.map(r => (

                            <label key={r.id} className="flex items-center gap-2 cursor-pointer">

                              <input

                                type="checkbox"

                                checked={regSelectedRounds.includes(r.id)}

                                onChange={(e) => {

                                  if (e.target.checked) setRegSelectedRounds([...regSelectedRounds, r.id]);

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



                    <button onClick={handleRegistration} disabled={!regName || !regBirthDate} className={`w-full font-bold py-3 md:py-4 text-sm md:text-base rounded-xl mt-4 transition shadow-xl text-white disabled:bg-slate-300 ${darkMode ? 'bg-emerald-700 hover:bg-emerald-600 shadow-emerald-950' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}>

                      {isAdmin ? 'Hinzufügen' : 'Anmelden'}

                    </button>

                    {isAdmin && (
                      <div className={`mt-6 p-4 rounded-xl border text-sm transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Users size={16} /> Bestehende Spieler</h3>
                          <span className="text-xs text-slate-500">{registrationPlayersPreview.length} Spieler</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <select value={regPlayersAgeFilter} onChange={e => setRegPlayersAgeFilter(e.target.value as AgeGroup | 'All')} className={`flex-1 min-w-[120px] p-2 border rounded text-xs transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                            <option value="All">Alle Altersklassen</option>
                            {AGE_GROUP_ORDER.map(group => <option key={group} value={group}>{displayAgeGroup(group)}</option>)}
                          </select>
                          <select value={regPlayersLevelFilter} onChange={e => setRegPlayersLevelFilter(e.target.value as Level | 'All')} className={`flex-1 min-w-[120px] p-2 border rounded text-xs transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                            <option value="All">Alle Leistungsklassen</option>
                            <option value="A">{LEVEL_LABELS.A}</option>
                            <option value="B">{LEVEL_LABELS.B}</option>
                            <option value="C">{LEVEL_LABELS.C}</option>
                          </select>
                          <input type="text" value={regPlayersSearch} onChange={e => setRegPlayersSearch(e.target.value)} className={`flex-1 min-w-[160px] p-2 border rounded text-xs transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} placeholder="Spieler suchen..." />
                        </div>
                        <div className={`max-h-64 overflow-y-auto divide-y rounded-lg border transition-colors ${darkMode ? 'divide-slate-700 bg-slate-800 border-slate-700' : 'divide-slate-200 bg-white border-slate-200'}`}>
                          {registrationPlayersPreview.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">Keine Spieler gefunden.</div>
                          ) : registrationPlayersPreview.map(p => (
                            <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-4 text-xs">
                              <div>
                                <div className="font-bold text-slate-700 text-sm">{p.name}</div>
                                <div className="text-slate-500">{displayAgeGroup(calculateAgeGroup(p))} • Level {p.level || '?'}</div>
                              </div>
                              <div className="text-right text-slate-400">
                                {p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </>

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

          {activeTab === 'input' && isAdmin && (

            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">

              <div className={`border rounded-xl shadow-lg overflow-hidden transition-colors ${darkMode ? 'bg-slate-900 border-slate-700 shadow-slate-950' : 'bg-white border-emerald-100 shadow-emerald-50'}`}>

                <div className={`p-4 border-b flex items-center gap-2 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-emerald-50 border-emerald-100'}`}>

                  <PlayCircle className={darkMode ? 'text-emerald-400' : 'text-emerald-600'} />

                  <h2 className={`font-bold ${darkMode ? 'text-slate-200' : 'text-emerald-900'}`}>Ergebnis erfassen</h2>

                </div>

                <div className="p-4 md:p-6 space-y-4 md:space-y-5">


                  {/* Tournament / Round Selection */}

                  <div className="grid grid-cols-1 gap-4">

                    <div>

                      <label className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">Turnier & Spieltag</label>

                      <div className="flex flex-col sm:flex-row gap-2 mt-1">

                        <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className={`flex-1 p-2.5 md:p-3 text-sm md:text-base border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>

                          <option value="">-- Turnierserie wählen --</option>

                          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

                        </select>

                        <select

                          value={selectedRoundId}

                          onChange={(e) => setSelectedRoundId(e.target.value)}

                          className={`flex-1 p-2.5 md:p-3 text-sm md:text-base border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 disabled:bg-slate-800 disabled:text-slate-500' : 'bg-slate-50 text-slate-900 border-slate-300 disabled:bg-slate-100 disabled:text-slate-400'} ${roundError ? 'border-red-500 ring-1 ring-red-500' : ''}`}

                          disabled={!selectedTournamentId}

                        >

                          <option value="">-- Spieltag / Runde wählen --</option>

                          {tournaments.find(t => t.id === selectedTournamentId)?.rounds.map(r => (

                            <option key={r.id} value={r.id}>{r.name} ({r.date})</option>

                          ))}

                        </select>

                      </div>

                      {roundError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">Bitte Spieltag auswählen!</p>}

                    </div>

                  </div>


                  {/* Filtering & Search for Input */}

                  <div className={`p-3 rounded-lg border mb-2 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

                    <div className="flex justify-between items-center mb-2">

                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1"><Filter size={12} /> Filter für Auswahl</span>

                    </div>

                    <div className="flex gap-2 flex-wrap items-center">

                      <select value={inputAgeGroupFilter} onChange={e => setInputAgeGroupFilter(e.target.value)} className="flex-1 min-w-[140px] text-xs md:text-sm p-2 md:p-2.5 border rounded transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600">

                        <option value="All">Alle Altersklassen</option>

                        {getSortedAgeGroups().filter(g => g !== 'All').map(g => <option key={g} value={g}>{displayAgeGroup(g)}</option>)}

                      </select>

                      <select value={scoringMode} onChange={e => setScoringMode(e.target.value as ScoringMode)} className={`flex-1 min-w-[140px] text-xs md:text-sm p-2 md:p-2.5 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}>
                        <option value="race4">Zählweise: bis 4</option>
                        <option value="race10">Zählweise: bis 10</option>
                        <option value="race15">Zählweise: bis 15</option>
                        <option value="sets">Zählweise: Sätze</option>
                      </select>

                    </div>

                  </div>



                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Player 1 Selection */}

                    <div>

                      <label className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">Unser Spieler</label>

                      <input

                        type="text"

                        placeholder="Suche..."

                        value={inputPlayerSearch}

                        onChange={e => setInputPlayerSearch(e.target.value)}

                        className={`w-full mb-1 p-2 md:p-2.5 text-xs md:text-sm border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                      />

                      <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className={`w-full mt-1 p-2.5 md:p-3 text-sm md:text-base border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>

                        <option value="">-- Wählen --</option>

                        {players

                          .filter(p => inputAgeGroupFilter === 'All' || calculateAgeGroup(p) === inputAgeGroupFilter)

                          .filter(p => !inputPlayerSearch || p.name.toLowerCase().includes(inputPlayerSearch.toLowerCase()))

                          .sort((a, b) => a.name.localeCompare(b.name))

                          .map(p => <option key={p.id} value={p.id}>{p.name} {p.isTeam && '(Team)'} ({calculateAgeGroup(p)})</option>

                          )}

                      </select>

                    </div>


                    {/* Player 2 Selection */}

                    <div>

                      <label className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">Gegner wählen</label>

                      <input

                        type="text"

                        placeholder="Suche..."

                        value={inputOpponentSearch}

                        onChange={e => setInputOpponentSearch(e.target.value)}

                        className={`w-full mb-1 p-2 md:p-2.5 text-xs md:text-sm border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`}

                      />

                      <select value={selectedOpponentId} onChange={(e) => setSelectedOpponentId(e.target.value)} className={`w-full mt-1 p-2.5 md:p-3 text-sm md:text-base border rounded-lg transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 focus:bg-slate-600' : 'bg-slate-50 border-slate-300 focus:bg-white'}`}>

                        <option value="">-- Gegner wählen --</option>

                        {players

                          .filter(p => p.id !== selectedPlayerId)

                          .filter(p => inputAgeGroupFilter === 'All' || calculateAgeGroup(p) === inputAgeGroupFilter)
                          .filter(p => !selectedPlayerLevel || p.level === selectedPlayerLevel)

                          .filter(p => !inputOpponentSearch || p.name.toLowerCase().includes(inputOpponentSearch.toLowerCase()))

                          .sort((a, b) => a.name.localeCompare(b.name))

                          .map(p => (

                            <option key={p.id} value={p.id}>{p.name} {p.isTeam && '(Team)'} ({calculateAgeGroup(p)})</option>

                          ))}

                      </select>

                    </div>

                  </div>



                  <div className={`p-4 rounded-xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>

                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2 block">Spielstand</label>

                    <div className="space-y-2">

                      {sets.map((set, idx) => (

                        <div key={idx} className="flex items-center gap-2">

                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-12">Satz {idx + 1}</span>

                          <input type="number" min="0" placeholder="6" className={`w-16 p-2 text-center border rounded font-bold transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={set.p1} onChange={(e) => updateSet(idx, 'p1', e.target.value)} />

                          <span className="text-slate-400">:</span>

                          <input type="number" min="0" placeholder="4" className={`w-16 p-2 text-center border rounded font-bold transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={set.p2} onChange={(e) => updateSet(idx, 'p2', e.target.value)} />

                          {sets.length > 1 && <button onClick={() => removeSet(idx)} className="text-slate-300 hover:text-red-500 ml-2"><X size={16} /></button>}

                        </div>

                      ))}

                    </div>

                    <button onClick={addSet} className="mt-3 text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"><Plus size={14} /> Weiteren Satz hinzufügen</button>

                  </div>



                  <div className="h-8">

                    {matchAnalysis && (

                      <div className={`flex items-center gap-2 p-2 rounded-lg text-sm font-bold animate-in zoom-in ${matchAnalysis.isWin ? 'bg-green-100 text-green-700' : matchAnalysis.isCloseLoss ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>

                        {matchAnalysis.isWin ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}

                        {matchAnalysis.message}

                      </div>

                    )}

                  </div>



                  <button onClick={handleAddResult} disabled={!selectedPlayerId || !selectedTournamentId || !matchAnalysis || !selectedOpponentId || !hasPermission('canEnterResults')} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">{hasPermission('canEnterResults') ? 'Match Speichern' : 'Keine Berechtigung'}</button>

                </div>

              </div>

            </div>

          )}

          {activeTab === 'admin' && isAdmin && (

            <div className="space-y-8 animate-in fade-in">


              {/* ADMIN ACCOUNT MANAGEMENT */}

              <div className="bg-slate-800 text-white rounded-xl p-4 md:p-6 shadow-xl">

                <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2 text-emerald-400"><UserCog size={18} className="md:w-5 md:h-5" /> Admin Konten</h3>

                {isSuperAdmin && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">

                    <input type="text" placeholder="Neuer Benutzername" className="flex-1 bg-slate-700 border-none rounded p-2 md:p-2.5 text-sm md:text-base text-white placeholder-slate-400" value={newAdminUser} onChange={e => setNewAdminUser(e.target.value)} />

                    <input type="text" placeholder="Passwort" className="flex-1 bg-slate-700 border-none rounded p-2 md:p-2.5 text-sm md:text-base text-white placeholder-slate-400" value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} />

                    <button onClick={handleAddAdmin} className="bg-emerald-600 hover:bg-emerald-500 px-3 md:px-4 py-2 md:py-2.5 rounded text-sm md:text-base font-bold whitespace-nowrap">Hinzufügen</button>

                  </div>
                )}

                <div className="space-y-3">

                  {admins.map(a => {
                    const permissions = a.permissions || DEFAULT_PERMISSIONS;
                    const PERMISSION_LABELS: Record<keyof AdminPermissions, string> = {
                      canManagePlayers: 'Spieler verwalten',
                      canManageTournaments: 'Turniere verwalten',
                      canEnterResults: 'Ergebnisse eingeben',
                      canManagePlanner: 'Spielplan verwalten',
                      canExportData: 'Daten exportieren',
                    };

                    return (
                      <div key={a.id} className={`p-3 rounded-lg transition-colors ${darkMode ? 'bg-slate-700' : 'bg-white/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.username}</span>
                            {a.isSuperAdmin && <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">Super Admin</span>}
                          </div>
                          {!a.isSuperAdmin && isSuperAdmin && (

                            <button onClick={() => handleDeleteAdmin(a.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>

                          )}
                        </div>

                        {/* Berechtigungen - nur für Super-Admins sichtbar und nur für Nicht-Super-Admins bearbeitbar */}
                        {isSuperAdmin && !a.isSuperAdmin && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="text-xs text-slate-400 mb-2 font-medium">Berechtigungen:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {(Object.keys(PERMISSION_LABELS) as (keyof AdminPermissions)[]).map(perm => (
                                <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/50 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={permissions[perm]}
                                    onChange={(e) => {
                                      const updatedAdmins = admins.map(admin => {
                                        if (admin.id !== a.id) return admin;
                                        return {
                                          ...admin,
                                          permissions: {
                                            ...permissions,
                                            [perm]: e.target.checked
                                          }
                                        };
                                      });
                                      updateAdmins(updatedAdmins);
                                    }}
                                    className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                  />
                                  <span className="text-xs text-slate-300">{PERMISSION_LABELS[perm]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Anzeige der Berechtigungen für Nicht-Super-Admins (nur lesen) */}
                        {!isSuperAdmin && a.id === currentAdminId && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="text-xs text-slate-400 mb-2 font-medium">Deine Berechtigungen:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(Object.keys(PERMISSION_LABELS) as (keyof AdminPermissions)[]).map(perm => (
                                <span
                                  key={perm}
                                  className={`text-xs px-2 py-1 rounded ${permissions[perm] ? 'bg-emerald-600/30 text-emerald-400' : 'bg-red-600/30 text-red-400'}`}
                                >
                                  {permissions[perm] ? '✓' : '✗'} {PERMISSION_LABELS[perm]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BACKUP & RESTORE */}

              <div className={`p-4 md:p-6 rounded-xl border transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <h3 className={`text-sm md:text-base font-bold mb-3 md:mb-4 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><HardDrive size={16} className="md:w-5 md:h-5 text-orange-500" /> Datensicherung</h3>

                <p className={`text-xs md:text-sm mb-3 md:mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Sichere alle Daten (Spieler, Turniere, Ergebnisse, Spielpläne) oder stelle sie aus einem Backup wieder her.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <button
                    onClick={() => {
                      if (!checkPermission('canExportData', 'Daten exportieren')) return;
                      exportBackup({
                        players,
                        tournaments,
                        results,
                        plannerFixtures,
                        groupMatchModes,
                        customGroupWeights
                      });
                      addToast('Backup erfolgreich exportiert', 'success');
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm md:text-base font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Database size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Backup erstellen</span><span className="sm:hidden">Erstellen</span>
                  </button>

                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          message: 'Backup wiederherstellen? ALLE aktuellen Daten werden überschrieben!',
                          onConfirm: () => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  const data = await importBackup(file);

                                  // Restore all data
                                  if (data.players) updatePlayers(data.players);
                                  if (data.tournaments) updateTournaments(data.tournaments);
                                  if (data.results) updateResults(data.results);
                                  if (data.plannerFixtures) updatePlannerFixtures(data.plannerFixtures);
                                  if (data.groupMatchModes) setGroupMatchModes(data.groupMatchModes);
                                  if (data.customGroupWeights) setCustomGroupWeights(data.customGroupWeights);

                                  addToast('Backup erfolgreich wiederhergestellt', 'success');
                                  closeConfirm();
                                } catch (error) {
                                  addToast((error as Error).message, 'error');
                                  closeConfirm();
                                }
                              }
                            };
                            input.click();
                          }
                        });
                      }}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm md:text-base font-bold flex items-center justify-center gap-2 transition"
                    >
                      <Database size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Backup wiederherstellen</span><span className="sm:hidden">Wiederherstellen</span>
                    </button>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className={`mt-3 md:mt-4 p-2 md:p-3 rounded-lg border text-[10px] md:text-xs ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                    <strong>⚠️ Wichtig:</strong> Das Wiederherstellen eines Backups überschreibt ALLE aktuellen Daten. Erstelle vorher ein aktuelles Backup!
                  </div>
                )}

              </div>

              {/* EINSTELLUNGEN */}

              <div className={`p-4 md:p-6 rounded-xl border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>

                <h3 className={`text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><Settings size={18} className="md:w-5 md:h-5 text-blue-500" /> Einstellungen</h3>

                <div className="space-y-4">

                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg border transition-colors ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex-1">
                      <div className={`text-sm md:text-base font-medium ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Turniertage im Spielplan anzeigen</div>
                      <div className={`text-[10px] md:text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Zeigt die Liste der Turniere und Spieltage im Spielplan-Tab an</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTournamentField}
                        onChange={e => setShowTournamentField(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg border transition-colors ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex-1">
                      <div className={`text-sm md:text-base font-medium ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Turnierbaum-Menü aktivieren</div>
                      <div className={`text-[10px] md:text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Aktiviert das Turnier-Tab mit K.O.-System und Gruppenauslosung</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTournamentMenu}
                        onChange={e => setEnableTournamentMenu(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                </div>

              </div>



              {/* PENDING REGISTRATIONS */}

              {pendingRegistrations.length > 0 && (

                <div className={`border rounded-xl p-4 md:p-6 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-orange-50 border-orange-100'}`}>

                  <h3 className={`text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-orange-800'}`}><UserCheck size={18} className={`md:w-5 md:h-5 ${darkMode ? 'text-slate-400' : 'text-orange-600'}`} /> Offene Anmeldungen</h3>

                  <div className="space-y-3">

                    {pendingRegistrations.map(req => {

                      const tourName = tournaments.find(t => t.id === req.desiredTournamentId)?.name;
                      const ageLabel = formatAgeGroupLabel(calculateAgeGroup(req.birthDate));

                      return (

                        <div key={req.id} className={`p-3 md:p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-orange-100'}`}>

                          <div className="flex-1 min-w-0">

                            <div className={`text-sm md:text-base font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{req.name} <span className={`font-normal ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>({ageLabel})</span></div>

                            <div className={`text-[10px] md:text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'} break-words`}>

                              Niveau {req.level || '?'} - Altersklasse {ageLabel} {req.club ? ` - ${req.club}` : ''} {req.email ? ` - ${req.email}` : ''} {tourName ? ` - Will zu: ${tourName}` : ''}

                            </div>

                          </div>

                          <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">

                            <button onClick={() => rejectRegistration(req.id)} className={`flex-1 sm:flex-none p-2 rounded transition-colors ${darkMode ? 'text-red-300 hover:bg-slate-700' : 'text-red-400 hover:bg-red-50'}`}><XCircle size={18} className="md:w-5 md:h-5" /></button>

                            <button onClick={() => approveRegistration(req)} className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-emerald-600 text-white text-xs md:text-sm font-bold rounded hover:bg-emerald-700 flex items-center justify-center gap-1 whitespace-nowrap"><CheckCircle2 size={14} className="md:w-4 md:h-4" /> Zulassen</button>

                          </div>

                        </div>

                      )
                    })}

                  </div>

                </div>

              )}



              {/* TOURNAMENTS */}

              <div className={`p-4 md:p-6 rounded-xl border transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className={`text-sm md:text-base font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><Calendar size={16} className="md:w-5 md:h-5 text-purple-500" /> Turnierserien</h3>

                  <button
                    onClick={() => setIncludeArchivedInRanking(!includeArchivedInRanking)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${includeArchivedInRanking
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    <Database size={14} /> {includeArchivedInRanking ? 'Archivierte in Rangliste' : 'Archivierte ausgeblendet'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mb-4 md:mb-6 overflow-x-hidden">

                  <input type="text" value={newTournamentName} onChange={e => setNewTournamentName(e.target.value)} className={`flex-1 min-w-0 p-2 border rounded text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} placeholder="Neue Serie anlegen" />

                  <input type="date" value={newTournamentDate} onChange={e => setNewTournamentDate(e.target.value)} className={`w-full sm:w-32 min-w-0 p-2 border rounded text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} />

                  <button onClick={handleAddTournament} className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition-colors flex-shrink-0"><Plus size={18} className="md:w-5 md:h-5" /></button>

                </div>

                <div className="space-y-4">

                  {tournaments.map(t => (

                    <div key={t.id} className={`border rounded-lg overflow-hidden transition-colors ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>

                      <div className={`p-2 md:p-3 flex justify-between items-center gap-2 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>

                        <div className={`font-bold text-sm md:text-base flex items-center gap-2 truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}><CalendarDays size={14} className="md:w-4 md:h-4 text-slate-400 flex-shrink-0" /><span className="truncate">{t.name}</span></div>

                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">

                          {t.archived && (
                            <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium border border-orange-200 dark:border-orange-800 hidden sm:inline">
                              Archiviert
                            </span>
                          )}

                          {isGenerating ? <Loader2 className="animate-spin text-slate-400 w-[14px] h-[14px] md:w-4 md:h-4" /> : (
                            <>
                              <button
                                onClick={() => {
                                  updateTournaments(tournaments.map(tour =>
                                    tour.id === t.id ? { ...tour, archived: !tour.archived } : tour
                                  ));
                                  addToast(t.archived ? 'Turnier reaktiviert' : 'Turnier archiviert', 'success');
                                }}
                                className={`px-1.5 md:px-2.5 py-1 md:py-1.5 rounded text-[10px] md:text-xs font-medium transition-all ${t.archived
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700'
                                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800'
                                  }`}
                                title={t.archived ? "Turnier reaktivieren" : "Turnier archivieren"}
                              >
                                <Database size={12} className="md:w-[14px] md:h-[14px] inline" /> <span className="hidden sm:inline">{t.archived ? 'Reaktivieren' : 'Archivieren'}</span>
                              </button>

                              <button onClick={() => deleteTournament(t.id)} className={`p-1 md:p-1.5 rounded transition-colors ${darkMode ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`} title="Turnier & Ergebnisse löschen"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                            </>
                          )}

                        </div>

                      </div>

                      <div className={`p-2 md:p-3 space-y-2 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>

                        {t.rounds.map(r => (

                          <div key={r.id} className={`flex justify-between items-center text-xs md:text-sm pl-4 md:pl-6 border-l-2 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>

                            <span className="truncate">{r.name} <span className={`text-[10px] md:text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>({r.date})</span></span>

                            <button onClick={() => deleteRound(t.id, r.id)} className={`transition-colors flex-shrink-0 ml-2 ${darkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}><X size={12} className="md:w-[14px] md:h-[14px]" /></button>

                          </div>

                        ))}

                        {addingRoundToTournamentId === t.id ? (

                          <div className="flex flex-col sm:flex-row gap-2 pl-4 md:pl-6 mt-2 overflow-x-hidden">

                            <input type="text" placeholder="Bezeichnung" className={`flex-1 min-w-0 text-xs md:text-sm p-1.5 md:p-1 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-400' : 'bg-white text-slate-900 border-slate-300 placeholder-slate-600'}`} value={newRoundName} onChange={e => setNewRoundName(e.target.value)} />

                            <input type="date" className={`w-full sm:w-28 min-w-0 text-xs md:text-sm p-1.5 md:p-1 border rounded transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} value={newRoundDate} onChange={e => setNewRoundDate(e.target.value)} />

                            <button onClick={() => handleAddRound(t.id)} className="bg-emerald-600 text-white text-xs px-2 py-1 rounded hover:bg-emerald-700 flex-shrink-0">Save</button>

                            <button onClick={() => setAddingRoundToTournamentId(null)} className={`transition-colors flex-shrink-0 ${darkMode ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}><X size={14} /></button>

                          </div>

                        ) : (

                          <button onClick={() => setAddingRoundToTournamentId(t.id)} className={`ml-4 md:ml-6 text-[10px] md:text-xs font-medium hover:underline flex items-center gap-1 mt-2 ${darkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}><PlusCircle size={10} className="md:w-3 md:h-3" /> Spieltag hinzufügen</button>

                        )}

                      </div>

                    </div>

                  ))}

                </div>

              </div>



              {/* TEST DATA GENERATOR */}

              <div className={`p-4 md:p-6 rounded-xl border mt-6 md:mt-8 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 md:mb-4">

                  <h3 className={`text-base md:text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><Database size={18} className="md:w-5 md:h-5 text-blue-500" /> Massen-Testdaten</h3>

                  {isGenerating && <span className={`text-[10px] md:text-xs animate-pulse flex items-center gap-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}><Loader2 size={12} className="md:w-[14px] md:h-[14px] animate-spin" /> {generationStatus}</span>}

                </div>

                <p className={`text-xs md:text-sm mb-3 md:mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>

                  Generiert lokale Testdaten.

                </p>



                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3 md:mb-4">

                  <div>

                    <label className={`text-[10px] md:text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>

                      Anzahl Test-Spieler

                    </label>

                    <input

                      type="number"

                      min={2}

                      max={10000}

                      className={`w-full p-2 md:p-3 border rounded-lg text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-blue-300'}`}

                      value={testPlayerCount}

                      onChange={(e) => setTestPlayerCount(parseInt(e.target.value) || 0)}

                    />

                  </div>

                  <div>

                    <label className={`text-[10px] md:text-xs font-bold uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>

                      Matches pro Spieler

                    </label>

                    <input

                      type="number"

                      min={1}

                      className={`w-full p-2 md:p-3 border rounded-lg text-sm md:text-base transition-colors ${darkMode ? 'bg-slate-700 text-slate-100 border-slate-600' : 'bg-white text-slate-900 border-blue-300'}`}

                      value={testMatchesPerPlayer}

                      onChange={(e) => setTestMatchesPerPlayer(parseInt(e.target.value) || 0)}

                    />

                  </div>

                </div>


                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">

                  <button onClick={generateTestData} disabled={isGenerating} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm md:text-base font-bold py-2 md:py-2.5 px-3 md:px-4 rounded-lg transition flex items-center justify-center gap-2">

                    <PlusCircle size={16} className="md:w-[18px] md:h-[18px]" /> Starten

                  </button>

                  <button onClick={deleteTestData} disabled={isGenerating} className={`flex-1 sm:flex-none border text-sm md:text-base font-bold py-2 md:py-2.5 px-3 md:px-4 rounded-lg transition flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500' : 'bg-white border-red-200 text-red-500 hover:bg-red-50 disabled:bg-slate-50 disabled:text-slate-300'}`}>

                    <Trash2 size={16} className="md:w-[18px] md:h-[18px]" /> Alles löschen

                  </button>

                </div>

              </div>

            </div>

          )}

        </div>

      </div>

      {/* Modal für zuletzt gespielte Spiele */}
      {showRecentlyPlayedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className={`p-4 md:p-6 border-b flex justify-between items-center ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <HistoryIcon size={20} />
                </div>
                <div>
                  <h3 className={`text-lg md:text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Gespielte Spiele</h3>
                  <p className={`text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {recentlyPlayedLevel && LEVEL_LABELS[recentlyPlayedLevel]} • {displayAgeGroup(plannerAgeGroup)}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowRecentlyPlayedModal(false)} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {recentlyPlayedFixtures.length === 0 ? (
                <div className="text-center py-12">
                  <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Keine Daten vorhanden.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {recentlyPlayedFixtures.map(f => {
                    const p1Result = results.find(r => r.playerId === f.p1Id && r.tournamentId === plannerSelectedTournamentId);
                    // Finde Match via fixtureId für eindeutige Identifikation
                    const savedMatch = p1Result?.matches.find(m => m.fixtureId === f.id);
                    const isEditing = editingFixtures[f.id] || false;
                    const scoreStr = plannerScoreInput[f.id] || (isEditing && savedMatch ? savedMatch.score : '');

                    return (
                      <div key={f.id} className={`p-4 rounded-xl border transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Runde {f.round}</span>
                          <div className="flex gap-1">
                            {!isEditing && (
                              <>
                                <button onClick={() => {
                                  setEditingFixtures(prev => ({ ...prev, [f.id]: true }));
                                  if (savedMatch) setPlannerScoreInput(prev => ({ ...prev, [f.id]: savedMatch.score }));
                                }} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-blue-400 hover:bg-slate-700' : 'text-blue-600 hover:bg-blue-100'}`}>
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    message: 'Dieses Spielergebnis wirklich löschen?',
                                    onConfirm: () => {
                                      deletePlannerResult(f);
                                      // Fixtures im Modal aktualisieren (einfach rausfiltern)
                                      setRecentlyPlayedFixtures(prev => prev.filter(pf => pf.id !== f.id));
                                      closeConfirm();
                                    }
                                  });
                                }} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-red-400 hover:bg-slate-700' : 'text-red-600 hover:bg-red-50'}`}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 text-right truncate">
                            <span className={`font-bold text-sm md:text-base ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{players.find(p => p.id === f.p1Id)?.name || 'Unbekannt'}</span>
                          </div>

                          <div className="flex flex-col items-center gap-1 min-w-[80px]">
                            {isEditing ? (
                              <div className="flex flex-col gap-2 w-full">
                                <input
                                  id={`modal-score-input-${f.id}`}
                                  type="text"
                                  defaultValue={scoreStr}
                                  className={`w-full text-center p-1 text-sm border rounded ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <button onClick={() => {
                                    const input = document.getElementById(`modal-score-input-${f.id}`) as HTMLInputElement;
                                    savePlannerResult(f, input?.value || '');
                                    setEditingFixtures(prev => ({ ...prev, [f.id]: false }));
                                  }} className="flex-1 bg-emerald-600 text-white text-[10px] py-1 rounded">OK</button>
                                  <button onClick={() => setEditingFixtures(prev => ({ ...prev, [f.id]: false }))} className="flex-1 bg-slate-500 text-white text-[10px] py-1 rounded">X</button>
                                </div>
                              </div>
                            ) : (
                              <div className={`px-3 py-1 rounded-full font-mono font-black text-sm md:text-base ${darkMode ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-700 shadow-sm'}`}>
                                {savedMatch?.score || '?-?'}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 text-left truncate">
                            <span className={`font-bold text-sm md:text-base ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{players.find(p => p.id === f.p2Id)?.name || 'Unbekannt'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`p-4 md:p-6 border-t ${darkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <button
                onClick={() => setShowRecentlyPlayedModal(false)}
                className={`w-full py-3 rounded-xl font-bold transition-all ${darkMode ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default TennisManager;
