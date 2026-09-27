import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertCompleteArchive,
  buildSeasonArchive,
  trimDraft,
  trimLeague,
  trimRosters,
  trimRows,
  trimTransactions,
  trimUsers,
  weeksToArchive,
} from "../lib/archive.mjs";

const league = {
  league_id: "L1",
  season: "2025",
  name: "Jeffymen",
  status: "complete",
  previous_league_id: "L0",
  metadata: { division_1: "Jeffs", division_2: "Jeffys", division_1_avatar: "x" },
  settings: { playoff_week_start: 15, playoff_teams: 6, playoff_round_type: 0, start_week: 1, waiver_budget: 500, trade_deadline: 13, playoff_seed_type: 1 },
  roster_positions: ["QB", "RB", "BN"],
  scoring_settings: { rec: 1, pass_yd: 0.05000000074505806 },
};

test("trimLeague keeps the settings the site shows and rounds scoring", () => {
  const t = trimLeague(league);
  assert.equal(t.leagueId, "L1");
  assert.equal(t.previousLeagueId, "L0");
  assert.deepEqual(t.settings.divisions, { 1: "Jeffs", 2: "Jeffys" });
  assert.equal(t.settings.playoffWeekStart, 15);
  assert.deepEqual(t.scoring, { rec: 1, pass_yd: 0.05 });
  assert.deepEqual(trimLeague({ ...league, metadata: null }).settings.divisions, {});
});

test("weeksToArchive covers the regular season and every playoff round", () => {
  assert.deepEqual(weeksToArchive(league), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.equal(weeksToArchive({ settings: { playoff_week_start: 15, playoff_teams: 6, playoff_round_type: 1 } }).length, 18);
});

test("trimUsers and trimRosters keep ids, names, records and points", () => {
  const users = trimUsers([{ user_id: "u1", display_name: "alec", is_owner: true, metadata: { team_name: "Lord Snow" } }, { user_id: "u2", display_name: "bob" }]);
  assert.deepEqual(users[0], { userId: "u1", displayName: "alec", teamName: "Lord Snow", isCommissioner: true });
  assert.deepEqual(users[1], { userId: "u2", displayName: "bob", teamName: null, isCommissioner: false });
  const rosters = trimRosters([{ roster_id: 1, owner_id: "u1", players: ["1", "2"], starters: ["1"], settings: { wins: 11, losses: 3, ties: 0, fpts: 2171, fpts_decimal: 5, fpts_against: 1632, fpts_against_decimal: 75, division: 2, total_moves: 34 } }, { roster_id: 2, owner_id: null, settings: {} }]);
  assert.deepEqual(rosters[0], { rosterId: 1, ownerId: "u1", division: 2, wins: 11, losses: 3, ties: 0, pf: 2171.05, pa: 1632.75, moves: 34, players: ["1", "2"], starters: ["1"] });
  assert.deepEqual(rosters[1], { rosterId: 2, ownerId: "", division: null, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, moves: 0, players: [], starters: [] });
});

test("trimRows keeps scores, overrides and player points, and drops junk rows", () => {
  const rows = trimRows([{ roster_id: 1, matchup_id: 3, points: 99.5, custom_points: null, starters: ["a"], starters_points: [10.2], players: ["a", "b"], players_points: { a: 10.2, b: 3 } }, { roster_id: 2, matchup_id: null, points: 50 }, { nope: 1 }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { rosterId: 1, matchupId: 3, points: 99.5, customPoints: null, starters: ["a"], startersPoints: [10.2], playersPoints: { a: 10.2, b: 3 } });
  assert.deepEqual(rows[1], { rosterId: 2, matchupId: null, points: 50, customPoints: null, starters: [], startersPoints: [], playersPoints: {} });
});

test("trimDraft keeps the order and every pick with its name", () => {
  const d = trimDraft({ draft_id: "D1", type: "snake", status: "complete", start_time: 1, settings: { rounds: 18, teams: 12 }, draft_order: { u1: 9 } }, [{ round: 1, pick_no: 1, draft_slot: 1, roster_id: 10, picked_by: "u9", player_id: "7564", is_keeper: null, metadata: { first_name: "Ja'Marr", last_name: "Chase", position: "WR", team: "CIN" } }]);
  assert.equal(d.rounds, 18);
  assert.deepEqual(d.order, { u1: 9 });
  assert.deepEqual(d.picks[0], { round: 1, pickNo: 1, slot: 1, rosterId: 10, pickedBy: "u9", playerId: "7564", firstName: "Ja'Marr", lastName: "Chase", position: "WR", team: "CIN", keeper: false });
  assert.equal(trimDraft(null, []), null);
});

test("trimTransactions keeps completed moves only", () => {
  const t = trimTransactions([{ transaction_id: "t1", type: "waiver", status: "complete", roster_ids: [5], adds: { "4177": 5 }, drops: { "4981": 5 }, leg: 1, created: 5, settings: { waiver_bid: 41 } }, { transaction_id: "t2", type: "waiver", status: "failed", roster_ids: [5], leg: 1, created: 6 }]);
  assert.deepEqual(t, [{ id: "t1", type: "waiver", rosterIds: [5], adds: { "4177": 5 }, drops: { "4981": 5 }, leg: 1, created: 5, bid: 41 }]);
});

test("buildSeasonArchive assembles a schema 1 archive", () => {
  const a = buildSeasonArchive({ league, users: [], rosters: [], matchups: { 1: [{ roster_id: 1, matchup_id: 1, points: 1 }] }, draft: null, picks: [], winners: [{ m: 1 }], losers: [], transactions: { 1: [] }, fetchedAt: "2026-09-27T00:00:00Z" });
  assert.equal(a.schema, 1);
  assert.equal(a.season, "2025");
  assert.equal(a.weeks["1"].length, 1);
  assert.deepEqual(a.brackets, { winners: [{ m: 1 }], losers: [] });
  assert.equal(a.draft, null);
  assert.equal(a.fetchedAt, "2026-09-27T00:00:00Z");
});

const complete = () => ({
  season: "2025",
  status: "complete",
  settings: { playoffWeekStart: 3, playoffTeams: 2, playoffRoundType: 0, startWeek: 1, divisions: {} },
  users: [{ userId: "u1" }, { userId: "u2" }],
  rosters: [{ rosterId: 1, ownerId: "u1" }, { rosterId: 2, ownerId: "u2" }],
  weeks: {
    1: [{ rosterId: 1, matchupId: 1, points: 100 }, { rosterId: 2, matchupId: 1, points: 90 }],
    2: [{ rosterId: 1, matchupId: 1, points: 100 }, { rosterId: 2, matchupId: 1, points: 90 }],
    3: [{ rosterId: 1, matchupId: 1, points: 100 }, { rosterId: 2, matchupId: 1, points: 90 }],
  },
  brackets: { winners: [{ m: 1, r: 1, p: 1, t1: 1, t2: 2, w: 1, l: 2 }], losers: [] },
});

test("assertCompleteArchive accepts a season with every roster in every regular week, every playoff week and a decided final", () => {
  const a = complete();
  assert.equal(assertCompleteArchive(a), a);
});

test("assertCompleteArchive refuses holes: a roster missing from a regular week, an absent playoff week, no decided final, no users", () => {
  const noRow = complete();
  noRow.weeks[2] = noRow.weeks[2].slice(0, 1);
  assert.throws(() => assertCompleteArchive(noRow), /week 2 .*roster 2/);
  const noPlayoffWeek = complete();
  delete noPlayoffWeek.weeks[3];
  assert.throws(() => assertCompleteArchive(noPlayoffWeek), /week 3/);
  const noFinal = complete();
  noFinal.brackets.winners = [{ m: 1, r: 1, p: 1, t1: 1, t2: 2 }];
  assert.throws(() => assertCompleteArchive(noFinal), /final/);
  const noUsers = complete();
  noUsers.users = [];
  assert.throws(() => assertCompleteArchive(noUsers), /users/);
});

test("the archives the robot has published pass the completeness check", () => {
  for (const y of ["2023", "2024", "2025"]) {
    const a = JSON.parse(readFileSync(new URL(`../docs/seasons/${y}.json`, import.meta.url), "utf8"));
    assert.equal(assertCompleteArchive(a), a, y);
  }
});
