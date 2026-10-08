# Historical evidence and provenance

Snapshot date: **October 7, 2026**. Record rarity uses the latest **20 eligible completed regular seasons per league**, backfilling excluded seasons. This is a fixed snapshot, not a live feed. The separate game-outcome cohorts still cover ten seasons and include COVID years; their dates and counts appear below.

## Sources

| League | Original data / public collection | Files in `data/history/` |
| --- | --- | --- |
| NBA | [SportsDataverse hoopR ESPN collection](https://github.com/sportsdataverse/hoopR-nba-raw), standings JSON and schedules RDS | `nba-games.json`, `nba-team-seasons.json`, `nba-audit.json`, `nba-neutral-overrides.json`; legacy playoff summaries and `nba-sources.json` |
| NHL | [Official NHL team statistics API](https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=100&cayenneExp=seasonId%3D20242025%20and%20gameTypeId%3D2), game API, [official brackets](https://api-web.nhle.com/v1/playoff-bracket/2025) | `nhl-games.json`, `nhl-team-seasons.json`, `nhl-game-sources.json`, `nhl-games-audit.json`; legacy playoff summaries and `nhl-sources.json` |
| MLB | [Official MLB StatsAPI standings](https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason) | `other-team-seasons.json` (includes URL/hash manifest) |
| NFL | [nflverse game data](https://github.com/nflverse/nfldata/blob/master/data/games.csv) | `other-team-seasons.json` |
| Premier League | [OpenFootball football.json](https://github.com/openfootball/football.json), [CC0/public domain](https://github.com/openfootball/football.json/blob/master/LICENSE.md) | `other-team-seasons.json` |

NBA data are an ESPN collection maintained by SportsDataverse, not an official NBA feed. NHL/MLB use their official APIs. NFL/OpenFootball are community collections. The software MIT license does not purport to relicense upstream data; preserve source attribution and upstream terms when redistributing.

Exact request URLs and Git blob identifiers or SHA-256 hashes are retained in the manifests. Clean rows retain their source URLs. Raw API responses are development caches and are not required by the browser. The NHL team API caps responses at 100 even when a larger limit is requested; retrieval uses one season per request and checks returned total counts.

## What is counted

The app has **2,849 included team-seasons**. A team-season is one team in one season, not an independent season-level observation.

| League | 20 eligible seasons within | Team-seasons | Exclusions / treatment |
| --- | --- | ---: | --- |
| NBA | 2003–04 to 2025–26 | 599 | Excludes 2011–12 (lockout), 2019–20 and 2020–21 (COVID); Boston/Indiana’s 81-game 2012–13 records included and normalized by actual games. |
| NHL | 2002–03 to 2025–26 | 612 | Excludes 2004–05 and 2012–13 (lockouts), 2019–20 and 2020–21 (COVID). Includes pre-2005 ties; 82-game history normalized to 84-game pace. |
| MLB | 2006 to 2026 | 600 | Excludes 2020 (COVID); includes 2021. Completed 161–163-game records normalized by actual games. |
| NFL | 2005 to 2025 | 638 | Excludes 2020 (COVID); includes 2021. Full 16/17-game schedules normalized; incomplete BUF/CIN 2022 records omitted. |
| Premier League | 2004–05 to 2025–26 | 400 | Excludes 2019–20 and 2020–21 (COVID). Each team played 38 matches; earned points before deductions. |

Exact rows and included year lists live in `rarity-reference.json`; request URLs, SHA-256 hashes, immutable source identities, per-season reconciliation and completion evidence live in `rarity-sources.json`. NBA rarity uses direct ESPN standings; the older SportsDataverse team files remain for the outcome join. Premier League rarity uses pinned OpenFootball England text results; the earlier JSON game collection remains for the 3,800-match fit.

**2021 MLB and NFL are included.** MLB uses full scheduled regular seasons even when a few clubs finish with 161 games or play a 163rd tiebreaker; rates use actual games. NFL 2021 has 32 clubs with 17 games each. NFL 2026 is still in progress and excluded. MLB 2026 ended September 27; [MLB confirmed the canceled Orioles–Yankees finale](https://www.mlb.com/orioles/news/orioles-yankees-september-27-game-canceled-due-to-weather), explaining those two 161-game records.

NBA’s 599 rows reflect 29 franchises in 2003–04. Boston/Indiana’s 81-game 2012–13 records are included using wins divided by actual games; [the NBA confirmed that cancellation](https://pr.nba.com/pacers-celtics-game-canceled/). NHL’s 612 rows reflect expansion over the selected seasons. Its 2002–03 and 2003–04 seasons include ties, each worth one standings point. Mixing pre- and post-shootout eras broadens the reference but is an era-comparability limitation. Premier League has 400 rows: 20 clubs × 20 seasons. All latest-season records were reconciled to the [official final Premier League table](https://www.premierleague.com/en/tables/premier-league/2025-26).


NBA/MLB/NFL inputs use literal wins/game; NHL uses standings points/(2×games); Premier League uses earned points/(3×matches). NHL API points are validated against 2×wins + overtime/shootout losses + legacy ties. Premier League points are derived from 3×wins + draws before administrative deductions. They describe on-field results and can differ from a penalized club’s published table total. NFL half-credit for ties is not used. The 2016 Cubs/Pirates tie counts as a played game but not a win. Do not infer losses from games-minus-wins where draws or overtime losses exist. NHL wins include OT and shootouts; playoff games do not have shootouts.

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

`check:history` rebuilds in a temporary directory and checks that the shipped results match. The Python script consumes the included clean snapshots, rebuilds wins/points empirical rank knots, retains legacy win knots only for old-link conversion, fits binary NBA/NHL/MLB/NFL all-team regular-season lookbacks with separate playoff/subgroup checks and retrospective Premier League win/draw/loss; retains pregame MLB research candidates, runs the temporal validation and writes `dist/src/history-data.js` , `data/history/validation.json` and `data/history/feature-audit.json`. No API keys or network are needed. The generation is deterministic. The application performs no network data retrieval.

[MODEL.md](MODEL.md) specifies equations, training/test separation, regularization, endpoint caps, fitted-to-event-model translation and limitations. Clean snapshots allow the exact shipped result to be reproduced even if mutable upstream URLs later change. A future refresh should update snapshots, record hashes and sample audit before rebuilding; it must not silently replace the data behind a model version.

## Points rules

- [NHL standings points explanation](https://www.nhl.com/kraken/news/understanding-nhl-standings-and-points-313505214): wins and overtime/shootout losses determine the season total. The article’s old 82-game schedule is superseded by the current schedule reference above.
- [Premier League explanation](https://www.premierleague.com/en/news/58905): three points per win and one per draw. LeagueLab computes earned points from match results and explicitly excludes administrative deductions.

Earlier model v3.0 refitted NHL using points rarity. Its slope is 0.079859, home coefficient 0.097185, and held-out Brier score 0.248505 versus 0.250034 for home alone. This is a small improvement on one temporal split, not evidence that switching inputs makes the model generally more accurate. Those figures describe the earlier release; current coefficients and checks are in EVIDENCE.md.

## Earlier v4 outcome extension · October 7, 2026

Model v4 adds all completed MLB/NFL games for 2015–2024 and Premier League matches for 2015–16 through 2024–25. NBA/NHL playoff fits retain their original samples and coefficients. New files are `{mlb,nfl,soccer}-games.json`, `*-game-sources.json`, `*-games-audit.json`, and `*-games-methodology.md`. The Premier League correction audit is `soccer-date-corrections.json`. Raw retrieval caches are development files; the release includes normalized outcomes and provenance sufficient to reproduce the shipped fitting pipeline offline.

MLB: 22,763 regular-season games plus 393 playoff games from official StatsAPI schedules; 300 team-season win/loss totals reconcile with independent official standings. NFL: 2,623 regular-season games plus 120 playoffs from a hash-verified nflverse snapshot. Premier League: 3,800 matches, 380 per season, 886 draws; all 3,800 enter the v5 season-end lookback fit (v4 used 2,795 pre-match observations). Sixty-six July 2020 dates in generated JSON were incorrectly in 2019 and are corrected using pinned upstream text plus official revised schedules.

In v4, `feature-audit.json` recorded predictors, source game IDs and pregame through-dates. The current audits instead identify pregame versus season-end timing explicitly. Playoff predictors use final regular-season wins/games, including shortened/incomplete records excluded from the rarity cohort. The v4 soccer predictors used prior points; v5 onward uses season-end points excluding both meetings. Rarity and outcome samples follow different inclusion rules. The current rarity cohort has 2,849 rows. See [EVIDENCE.md](EVIDENCE.md) for coefficients, split counts, source links and the failed MLB playoff-transfer comparison.

## v5 model extension

MLB now fits 19,651 eligible regular games; both clubs have 20 prior games and same-day records are frozen using completion dates. `mlb-model-comparison.json` records wins, run-based and legacy challengers. Premier League now excludes both head-to-head fixtures from each club’s final season record (36 matches), keeps all 886 draws as a third outcome, and explicitly uses hindsight. See [EVIDENCE.md](EVIDENCE.md). Source game snapshots are unchanged.


## v6 record-reference expansion

Added the latest 20 eligible completed regular seasons per league, with the exclusions above. NBA/NHL/NFL/Premier League rank-based fits and their evaluation are regenerated on the expanded scale. The primary MLB smoothed-wins fit is unchanged; its rarity translation and legacy challenger use the larger reference. No outcome games were added. Evaluation rank knots use only reference records at or before the training cutoff. The same evaluation periods have already been inspected, so this is a transparent model revision, not new independent validation.


### v6.0.1 cancellation policy correction

Boston and Indiana’s completed 2012–13 records are included in the rarity reference. Each retained row stores 81 actual games; wins/81 is compared with other historical win rates, and the interface expresses the equivalent pace over 82 games. The source manifest retains the cancellation evidence under `includedTeamExceptions`; `full82TeamSeasons` remains 597, while the included NBA total is 599. This isolated cancellation does not change which full-schedule league seasons qualify.


## v7: regular-season evidence across all teams

The primary NBA/NHL/NFL fits now use 11,979 / 12,200 / 2,614 decisive regular-season games, respectively. Combined with MLB and Premier League, there are **50,244 fitted outcomes**. The game cohorts still cover ten seasons and include COVID; the separate 20-season rarity cohort and its exclusions are unchanged. NBA/NHL cover 2015–16 through 2024–25; NFL covers 2015–2024.

- **NBA:** all 11,979 regular games reconcile to games played and win/loss totals for all 300 team-seasons in the independent standings snapshot. There are 112 neutral regular games, including 88 bubble games and the two 2023 Las Vegas Cup semifinals; the Cup final does not count in regular standings. All 83 bubble playoff games are neutral. Source score sums differ from standings by 1–3 points for 23 team-seasons; original scores are retained, those differences are recorded in `nba-score-total-discrepancies.json`, and outcome/record totals reconcile exactly. The existing standings scoring mean is retained. `nba-audit.json` records original URLs and source identities, `nba-team-season-reconciliation.json` records checks, and exclusions and neutral overrides have their own files.
- **NHL:** 12,200 regular games plus 870 retained playoff games, with 48 regular and 86 playoff neutral games. Per-game records reconcile all 312 team-seasons on ten standings fields. Every game date, club ID, score, decision and neutral status was independently checked against official club-season schedules. Actual standings-point credits retain Minnesota’s March 30, 2024 forfeited overtime-loss point; do not infer every overtime loss earns one. Shootout-winning artificial goals are removed for scoring totals. Provenance and checks are in `nhl-game-sources.json`, `nhl-games-audit.json`, `nhl-team-season-audit.json` and `nhl-games-methodology.json`.
- **NFL:** the existing 2,623 regular games include nine ties. They stay in season-record denominators but are excluded as binary targets, leaving 2,614 decisive games and all 320 team-seasons. The 120 playoff games are retained for separate checks. Source location flags identify neutral venues.

For each matchup, `regular.py` removes every regular-season meeting between those clubs from both season-end records. Audits retain the full and reduced records, excluded game IDs, season-end dates, venue and playoff membership. Regular targets use later games and therefore hindsight. Playoff checks use each club’s already-completed regular record. The primary fit never uses playoff outcomes. A separate earlier-playoff challenger is reported but not applied. [EVIDENCE.md](EVIDENCE.md) reports subgroup failures and transfer results.

Playoff membership means appearing in the retained main bracket. NBA play-ins, NHL 2020 qualifiers/round-robin games and the NBA Cup final remain excluded; the retained playoff samples still have 834 NBA, 870 NHL and 120 NFL games. The older playoff summaries are descriptive context, not the default probability model.

## v8: completed-season MLB and the comparable opening view

MLB’s primary fit now uses all 22,762 decisive regular-season games, with every direct meeting excluded from both strength records. One tie is retained in record denominators. This raises total production fit outcomes to **53,355**, without adding new raw games or changing the 2,849-row rarity reference. The outcome windows and COVID treatment remain unchanged.

`feature-audit.mlbLookback` is the production MLB audit. `mlbRegular` preserves 19,651 pregame research observations; `mlb` preserves legacy playoff features. All are explicitly labeled. Known neutral games use venue=0; missing MLB neutral flags retain the designated-home assumption. The release review’s rolling evaluation remains a frozen v7 comparison artifact; NBA game/reference hashes guard reuse of its weak-quarter evidence. No new independent evaluation season is claimed.
