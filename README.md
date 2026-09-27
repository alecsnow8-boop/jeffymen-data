# Jeffymen league data

Public Sleeper data for the League of Extraordinary Jeffymen, written by a scheduled robot and served by GitHub Pages at https://alecsnow8-boop.github.io/jeffymen-data/. The site reads these files; it never fetches Sleeper's big player file itself.

| File | Contents | Refresh |
| --- | --- | --- |
| `docs/manifest.json` | Generated time, one entry per season and draft file, player count | every run |
| `docs/seasons/<year>.json` | A complete season: settings, users, rosters, every week's matchup rows with player points, the draft, both brackets, completed transactions | written once; `--force` rewrites |
| `docs/drafts/<year>.json` | The current season's draft | every run |
| `docs/players.json` | `{ "<player_id>": { "n": "Name", "pos": "RB", "t": "DET" } }` for players this league has rostered, started or drafted | every run |

Run locally: `npm test`, then `npm run build` (add `--force` to rewrite complete seasons). The workflow runs Tuesdays at 12:00 UTC and on demand, and commits `docs/` when anything changed.

No real names, no form responses, nothing private. Sleeper usernames and team names only.
