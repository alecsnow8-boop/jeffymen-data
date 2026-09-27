import test from "node:test";
import assert from "node:assert/strict";
import { collectPlayerIds, slimPlayers } from "../lib/players.mjs";

test("collectPlayerIds gathers rostered, started, scored and drafted players once each", () => {
  const archive = {
    rosters: [{ players: ["1", "2"] }],
    weeks: { 1: [{ starters: ["2", "3"], playersPoints: { 3: 1, 4: 2 } }] },
    draft: { picks: [{ playerId: "5" }] },
  };
  assert.deepEqual(collectPlayerIds([archive], [["6", "1"]]), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(collectPlayerIds([{ rosters: [], weeks: {}, draft: null }]), []);
});

test("slimPlayers keeps only known ids with name, position and team", () => {
  const all = {
    1: { full_name: "Josh Allen", position: "QB", team: "BUF" },
    2: { first_name: "Denver", last_name: "Broncos", position: "DEF", team: "DEN" },
    3: { position: "RB", team: null },
  };
  assert.deepEqual(slimPlayers(all, ["1", "2", "3", "9"]), {
    1: { n: "Josh Allen", pos: "QB", t: "BUF" },
    2: { n: "Denver Broncos", pos: "DEF", t: "DEN" },
    3: { n: "3", pos: "RB", t: null },
  });
});
