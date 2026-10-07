# Historical evidence and provenance

Snapshot date: October 5, 2026. This release deliberately uses a fixed ten-season reference ending in 2024–25 (NBA/NHL/Premier League) or 2024 (MLB/NFL), not a live or all-time database.

## Sources

| League | Original data / public collection | Files in `data/history/` |
| --- | --- | --- |
| NBA | [SportsDataverse hoopR ESPN collection](https://github.com/sportsdataverse/hoopR-nba-raw), standings JSON and schedules RDS | `nba-team-seasons.json`, `nba-playoff-games.json`, `nba-playoff-series.json`, `nba-sources.json` |
| NHL | [Official NHL team statistics API](https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=100&cayenneExp=seasonId%3D20242025%20and%20gameTypeId%3D2), game API, [official brackets](https://api-web.nhle.com/v1/playoff-bracket/2025) | `nhl-team-seasons.json`, `nhl-playoff-games.json`, `nhl-playoff-series.json`, `nhl-sources.json` |
| MLB | [Official MLB StatsAPI standings](https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason) | `other-team-seasons.json` (includes URL/hash manifest) |
| NFL | [nflverse game data](https://github.com/nflverse/nfldata/blob/master/data/games.csv) | `other-team-seasons.json` |
| Premier League | [OpenFootball football.json](https://github.com/openfootball/football.json), [CC0/public domain](https://github.com/openfootball/football.json/blob/master/LICENSE.md) | `other-team-seasons.json` |

NBA data are an ESPN collection maintained by SportsDataverse, not an official NBA feed. NHL/MLB use their official APIs. NFL/OpenFootball are community collections. The software MIT license does not purport to relicense upstream data; preserve source attribution and upstream terms when redistributing.

Exact request URLs and Git blob identifiers or SHA-256 hashes are retained in the manifests. Clean rows retain their source URLs. Raw API responses are development caches and are not required by the browser. The NHL team API caps responses at 100 even when a larger limit is requested; retrieval uses one season per request and checks returned total counts.

## What is counted

The app has 1,278 included team-seasons: NBA 240, NHL 250, MLB 270, NFL 318, Premier League 200. Full details and validation exceptions are in `nba-methodology.json`, `nhl-methodology.json`, and `OTHER-SOURCES.md` alongside the snapshots.

For rarity, NBA/NHL require 82 actual games. MLB excludes the shortened 2020 season but keeps other completed 161–163-game records, normalized by actual games. NFL includes 16/17-game full schedules and excludes BUF/CIN 2022 after their canceled game. Premier League includes all 38-match seasons. A team-season is one team in one season, not one independent season-level observation.

NBA/MLB/NFL inputs use literal wins/game; NHL uses standings points/(2×games); Premier League uses earned points/(3×matches). NHL API points are validated against 2×wins + overtime/shootout losses. Premier League points are derived from 3×wins + draws before administrative deductions. They describe on-field results and can differ from a penalized club’s published table total. NFL half-credit for ties is not used. The 2016 Cubs/Pirates tie counts as a played game but not a win. Do not infer losses from games-minus-wins where draws or overtime losses exist. NHL wins include OT and shootouts; playoff games do not have shootouts.

The current display schedules are NBA 82, NHL 84, MLB 162, NFL 17 and Premier League 38. [The NHL 2026–27 schedule has 84 games per team](https://www.nhl.com/news/nhl-stats-pack-2026-27-regular-season-schedule). Historical NHL records are normalized by points percentage, not reclassified as actual 84-game seasons. The slider allows 168 points; 100 points is 100/168 of the current maximum. Premier League’s 38 matches allow 114 points. Schedule references for MLB/NFL/Premier League are in `OTHER-SOURCES.md`.

## Descriptive findings

| Better record wins, 2016–2025 playoffs | NBA (win percentage) | NHL (points percentage) |
| --- | ---: | ---: |
| Game |486/778 =62.47% |443/852 =52.00% |
| Best-of-seven series |101/141 =71.63% |84/147 =57.14% |
| All retained games / series |834 /150 |870 /150 |

“Better” uses final regular-season wins/game for NBA and points/(2×games) for NHL. The NHL figures come from the audited `byPointsPct` summary; the old win-based summary remains in the snapshot. Exact ties are excluded only from the better-record percentages. NBA play-ins and NHL 2020 preliminary/round-robin rounds are excluded. Every included series ends with four wins by its winner; series counts reconcile with the source brackets. Teams and games were also reconciled against regular-season standings before fitting.

Observed sample maxima are 73 NBA wins, 135 NHL points across 82 games, and 100 Premier League earned points across 38 matches. The NHL current-season equivalent of its historical maximum is about 138.3 points across 84 games. Values beyond the sample retain their input value but cap modeled strength. Record rarity, playoff win association and causal scoring effects are different questions.

The summary files include gap bins, yearly rates, bubble exclusions, and NHL points-percentage sensitivity. These small bins are descriptive; the fit pools games with regularization instead of forcing each bin to determine predictions. Historical Wilson intervals are stored for auditing but not treated as series-cluster confidence intervals.

## Reproduce the shipped model offline

From the project root, using Python 3's standard library:

```sh
npm run check:history
# To deliberately regenerate the canonical evidence:
python3 scripts/history/build.py
npm test
```

`check:history` rebuilds in a temporary directory and checks that the shipped results match. The Python script consumes the included clean snapshots, rebuilds wins/points empirical rank knots, retains legacy win knots only for old-link conversion, performs the regularized two-parameter fits (NBA wins, NHL points), runs the temporal validation and writes `dist/src/history-data.js` and `data/history/validation.json`. No API keys or network are needed. The generation is deterministic. The application performs no network data retrieval.

[MODEL.md](MODEL.md) specifies equations, training/test separation, regularization, endpoint caps, fitted-to-event-model translation and limitations. Clean snapshots allow the exact shipped result to be reproduced even if mutable upstream URLs later change. A future refresh should update snapshots, record hashes and sample audit before rebuilding; it must not silently replace the data behind a model version.

## Points rules

- [NHL standings points explanation](https://www.nhl.com/kraken/news/understanding-nhl-standings-and-points-313505214): wins and overtime/shootout losses determine the season total. The article’s old 82-game schedule is superseded by the current schedule reference above.
- [Premier League explanation](https://www.premierleague.com/en/news/58905): three points per win and one per draw. LeagueLab computes earned points from match results and explicitly excludes administrative deductions.

Model v3.0 refits NHL using points rarity. Its slope is 0.079859, home coefficient 0.097185, and held-out Brier score 0.248505 versus 0.250034 for home alone. This is a small improvement on one temporal split, not evidence that switching inputs makes the model generally more accurate. NBA coefficients and validation are unchanged.
