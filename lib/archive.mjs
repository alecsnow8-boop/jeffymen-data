// Pure trims from Sleeper's raw shapes to the archive shape (schema 1). No fetching here.
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const num0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v) => (typeof v === "number" && Number.isInteger(v) ? v : null);
const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const strArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const round4 = (v) => Math.round(v * 10000) / 10000;

export function trimLeague(league) {
  const l = isObj(league) ? league : {};
  const s = isObj(l.settings) ? l.settings : {};
  const meta = isObj(l.metadata) ? l.metadata : {};
  const divisions = {};
  for (const d of [1, 2, 3, 4]) if (typeof meta[`division_${d}`] === "string" && meta[`division_${d}`]) divisions[d] = meta[`division_${d}`];
  const scoring = {};
  for (const [k, v] of Object.entries(isObj(l.scoring_settings) ? l.scoring_settings : {})) if (typeof v === "number" && Number.isFinite(v)) scoring[k] = round4(v);
  return {
    leagueId: str(l.league_id),
    season: str(l.season),
    name: str(l.name),
    status: str(l.status),
    previousLeagueId: l.previous_league_id ? str(l.previous_league_id) : null,
    settings: {
      playoffWeekStart: int(s.playoff_week_start) ?? 15,
      playoffTeams: int(s.playoff_teams) ?? 6,
      playoffRoundType: int(s.playoff_round_type) ?? 0,
      startWeek: int(s.start_week) ?? 1,
      waiverBudget: int(s.waiver_budget),
      tradeDeadline: int(s.trade_deadline),
      playoffSeedType: int(s.playoff_seed_type),
      divisions,
    },
    rosterPositions: strArr(l.roster_positions),
    scoring,
  };
}

/** The last week a season holds: the regular season plus every playoff round, from trimmed settings. */
export function lastWeekOf(t) {
  const rounds = t.playoffTeams > 1 ? Math.ceil(Math.log2(t.playoffTeams)) : 0;
  const extra = t.playoffRoundType === 1 ? 1 : t.playoffRoundType === 2 ? rounds : 0;
  return t.playoffWeekStart + rounds - 1 + extra;
}

/** Weeks 1 through the last playoff week, the same arithmetic the site uses. */
export function weeksToArchive(league) {
  const t = trimLeague(league).settings;
  const out = [];
  for (let w = t.startWeek; w <= lastWeekOf(t); w++) out.push(w);
  return out;
}

/** Refuse to freeze a season with holes. A transient miss must fail the run, never become the permanent archive. */
export function assertCompleteArchive(a) {
  const problems = [];
  const s = isObj(a?.settings) ? a.settings : {};
  const users = Array.isArray(a?.users) ? a.users : [];
  const rosters = Array.isArray(a?.rosters) ? a.rosters : [];
  const weeks = isObj(a?.weeks) ? a.weeks : {};
  if (users.length === 0) problems.push("no users");
  if (rosters.length === 0) problems.push("no rosters");
  const t = { playoffWeekStart: int(s.playoffWeekStart) ?? 15, playoffTeams: int(s.playoffTeams) ?? 6, playoffRoundType: int(s.playoffRoundType) ?? 0, startWeek: int(s.startWeek) ?? 1 };
  for (let w = t.startWeek; w <= lastWeekOf(t); w++) {
    const rows = weeks[String(w)];
    if (!Array.isArray(rows) || rows.length === 0) {
      problems.push(`week ${w} is missing`);
      continue;
    }
    if (w < t.playoffWeekStart) for (const r of rosters) if (!rows.some((x) => isObj(x) && x.rosterId === r.rosterId)) problems.push(`week ${w} has no row for roster ${r.rosterId}`);
  }
  const winners = Array.isArray(a?.brackets?.winners) ? a.brackets.winners : [];
  const final = winners.find((g) => isObj(g) && g.p === 1);
  if (!final || typeof final.w !== "number" || typeof final.l !== "number") problems.push("winners bracket has no decided final");
  if (problems.length > 0) throw new Error(`incomplete archive for ${a?.season ?? "?"}: ${problems.join("; ")}`);
  return a;
}

export function trimUsers(users) {
  return (Array.isArray(users) ? users : []).filter(isObj).map((u) => ({
    userId: str(u.user_id),
    displayName: str(u.display_name),
    teamName: isObj(u.metadata) && typeof u.metadata.team_name === "string" ? u.metadata.team_name : null,
    isCommissioner: u.is_owner === true,
  }));
}

export function trimRosters(rosters) {
  return (Array.isArray(rosters) ? rosters : []).filter((r) => isObj(r) && int(r.roster_id) !== null).map((r) => {
    const s = isObj(r.settings) ? r.settings : {};
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id ? str(r.owner_id) : "",
      division: int(s.division),
      wins: num0(s.wins),
      losses: num0(s.losses),
      ties: num0(s.ties),
      pf: num0(s.fpts) + num0(s.fpts_decimal) / 100,
      pa: num0(s.fpts_against) + num0(s.fpts_against_decimal) / 100,
      moves: num0(s.total_moves),
      players: strArr(r.players),
      starters: strArr(r.starters),
    };
  });
}

export function trimRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((m) => isObj(m) && int(m.roster_id) !== null).map((m) => {
    const pp = {};
    for (const [k, v] of Object.entries(isObj(m.players_points) ? m.players_points : {})) if (typeof v === "number" && Number.isFinite(v)) pp[k] = v;
    return {
      rosterId: m.roster_id,
      matchupId: int(m.matchup_id),
      points: numOrNull(m.points),
      customPoints: numOrNull(m.custom_points),
      starters: strArr(m.starters),
      startersPoints: Array.isArray(m.starters_points) ? m.starters_points.map(num0) : [],
      playersPoints: pp,
    };
  });
}

export function trimDraft(draft, picks) {
  if (!isObj(draft)) return null;
  const s = isObj(draft.settings) ? draft.settings : {};
  return {
    draftId: str(draft.draft_id),
    type: str(draft.type),
    rounds: int(s.rounds) ?? 0,
    teams: int(s.teams) ?? 0,
    startTime: numOrNull(draft.start_time),
    status: str(draft.status),
    order: isObj(draft.draft_order) ? draft.draft_order : {},
    picks: (Array.isArray(picks) ? picks : []).filter(isObj).map((p) => {
      const md = isObj(p.metadata) ? p.metadata : {};
      return {
        round: int(p.round) ?? 0,
        pickNo: int(p.pick_no) ?? 0,
        slot: int(p.draft_slot) ?? 0,
        rosterId: int(p.roster_id),
        pickedBy: str(p.picked_by),
        playerId: str(p.player_id),
        firstName: str(md.first_name),
        lastName: str(md.last_name),
        position: str(md.position),
        team: md.team ? str(md.team) : null,
        keeper: p.is_keeper === true,
      };
    }),
  };
}

export function trimTransactions(list) {
  return (Array.isArray(list) ? list : []).filter((t) => isObj(t) && t.status === "complete").map((t) => ({
    id: str(t.transaction_id),
    type: str(t.type),
    rosterIds: Array.isArray(t.roster_ids) ? t.roster_ids.filter(Number.isInteger) : [],
    adds: isObj(t.adds) ? t.adds : {},
    drops: isObj(t.drops) ? t.drops : {},
    leg: int(t.leg),
    created: numOrNull(t.created),
    bid: isObj(t.settings) ? numOrNull(t.settings.waiver_bid) : null,
  }));
}

export function buildSeasonArchive({ league, users, rosters, matchups, draft, picks, winners, losers, transactions, fetchedAt }) {
  const weeks = {};
  for (const [w, rows] of Object.entries(matchups ?? {})) weeks[w] = trimRows(rows);
  const txns = {};
  for (const [w, list] of Object.entries(transactions ?? {})) txns[w] = trimTransactions(list);
  return {
    schema: 1,
    ...trimLeague(league),
    users: trimUsers(users),
    rosters: trimRosters(rosters),
    weeks,
    draft: trimDraft(draft, picks),
    brackets: { winners: Array.isArray(winners) ? winners : [], losers: Array.isArray(losers) ? losers : [] },
    transactions: txns,
    fetchedAt,
  };
}
