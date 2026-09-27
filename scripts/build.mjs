// Walk the league chain back through previous_league_id, freeze complete seasons, refresh the
// current draft and the player map, and write the manifest. The site reads only these files.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getJson, getJsonRequired } from "../lib/sleeper.mjs";
import { assertCompleteArchive, buildSeasonArchive, trimDraft, trimRosters, trimRows, weeksToArchive } from "../lib/archive.mjs";
import { collectPlayerIds, slimPlayers } from "../lib/players.mjs";

const LEAGUE_ID = process.env.LEAGUE_ID ?? "1389693644998471680";
const FORCE = process.argv.includes("--force");
const DOCS = new URL("../docs/", import.meta.url);
const at = (rel) => new URL(rel, DOCS);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function writeJson(rel, data) {
  await mkdir(new URL("./", at(rel)), { recursive: true });
  await writeFile(at(rel), JSON.stringify(data) + "\n");
}
const readJson = async (rel) => JSON.parse(await readFile(at(rel), "utf8"));

async function fetchSeason(league) {
  const id = league.league_id;
  const weeks = weeksToArchive(league);
  // A complete league never lacks these. A 404 is a fault, not an empty week: the run fails rather than freezing a hole.
  const [users, rosters, drafts, winners, losers] = await Promise.all([
    getJsonRequired(`/league/${id}/users`),
    getJsonRequired(`/league/${id}/rosters`),
    getJsonRequired(`/league/${id}/drafts`),
    getJsonRequired(`/league/${id}/winners_bracket`),
    getJsonRequired(`/league/${id}/losers_bracket`),
  ]);
  const matchups = {};
  const transactions = {};
  for (const w of weeks) {
    matchups[w] = await getJsonRequired(`/league/${id}/matchups/${w}`);
    transactions[w] = await getJsonRequired(`/league/${id}/transactions/${w}`);
  }
  const draft = Array.isArray(drafts) && drafts[0] ? drafts[0] : null;
  const picks = draft ? await getJsonRequired(`/draft/${draft.draft_id}/picks`) : [];
  return assertCompleteArchive(
    buildSeasonArchive({ league, users, rosters, matchups, draft, picks, winners, losers, transactions, fetchedAt: new Date().toISOString() }),
  );
}

async function main() {
  const chain = [];
  for (let id = LEAGUE_ID; id; ) {
    const league = await getJson(`/league/${id}`);
    if (!league) throw new Error(`league ${id} not found`);
    chain.push(league);
    id = league.previous_league_id;
  }
  log(`chain: ${chain.map((l) => `${l.season} (${l.status})`).join(", ")}`);

  const archives = [];
  const manifestSeasons = [];
  let current = null;
  const drafts = [];
  const extraIds = [];

  for (const league of chain) {
    const season = league.season;
    if (league.status === "complete") {
      const rel = `seasons/${season}.json`;
      let archive;
      if (existsSync(at(rel)) && !FORCE) {
        archive = assertCompleteArchive(await readJson(rel));
        log(`${season}: kept existing archive`);
      } else {
        archive = await fetchSeason(league);
        await writeJson(rel, archive);
        log(`${season}: wrote ${rel}`);
      }
      archives.push(archive);
      manifestSeasons.push({ season, leagueId: league.league_id, status: "complete", file: rel, fetchedAt: archive.fetchedAt });
    } else {
      current = { season, leagueId: league.league_id, status: league.status };
      const list = await getJson(`/league/${league.league_id}/drafts`);
      const draft = Array.isArray(list) && list[0] ? list[0] : null;
      if (draft) {
        const picks = (await getJson(`/draft/${draft.draft_id}/picks`)) ?? [];
        const rel = `drafts/${season}.json`;
        const trimmed = trimDraft(draft, picks);
        await writeJson(rel, { schema: 1, season, leagueId: league.league_id, draft: trimmed, fetchedAt: new Date().toISOString() });
        drafts.push({ season, file: rel });
        extraIds.push(trimmed.picks.map((p) => p.playerId));
        log(`${season}: wrote ${rel} (${trimmed.picks.length} picks)`);
      }
      const rosters = trimRosters(await getJson(`/league/${league.league_id}/rosters`));
      extraIds.push(rosters.flatMap((r) => r.players));
      const state = await getJson("/state/nfl");
      const upto = state && state.season === season && Number.isInteger(state.week) ? state.week : 0;
      for (let w = 1; w <= upto; w++) {
        const rows = trimRows(await getJson(`/league/${league.league_id}/matchups/${w}`));
        extraIds.push(rows.flatMap((r) => [...r.starters, ...Object.keys(r.playersPoints)]));
      }
      log(`${season}: current season, player ids from rosters and weeks 1 to ${upto}`);
    }
  }

  const ids = collectPlayerIds(archives, extraIds);
  log(`players needed: ${ids.length}; fetching Sleeper's player file`);
  const all = await getJson("/players/nfl");
  const players = slimPlayers(all, ids);
  await writeJson("players.json", players);
  log(`players.json: ${Object.keys(players).length} named`);

  manifestSeasons.sort((a, b) => a.season.localeCompare(b.season));
  await writeJson("manifest.json", {
    schema: 1,
    generatedAt: new Date().toISOString(),
    leagueId: LEAGUE_ID,
    seasons: manifestSeasons,
    current,
    drafts,
    players: { count: Object.keys(players).length, file: "players.json" },
  });
  log("manifest.json written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
