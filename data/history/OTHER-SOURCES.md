# Historical season-record reference: MLB, NFL, Premier League

Snapshot retrieved October 5, 2026. These are observed historical team-season
distributions, **not estimates of a team's next-game win probability**.

## Sources

- MLB: official MLB StatsAPI final regular-season standings, 2015–2024.
  Each exact request URL and response SHA-256 appears in `other-team-seasons.json`.
  Example: https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason
- NFL: nflverse `nfldata/data/games.csv`, maintained by Lee Sharpe and the
  nflverse community. Aggregate completed games where `game_type == REG`
  and season is 2015–2024. Original publisher:
  https://github.com/nflverse/nfldata/blob/master/data/games.csv
- Soccer: English Premier League only, OpenFootball public-domain (CC0)
  `football.json` season files, 2015–16 through 2024–25. Aggregate full-time
  match outcomes, including draws. Original publisher:
  https://github.com/openfootball/football.json
  License: https://github.com/openfootball/football.json/blob/master/LICENSE.md
  This dataset does not represent every soccer league.

## Inclusion and normalization

The raw cleaned dataset contains 820 team-seasons with an `included` flag.
The core reference includes 788: MLB 270, NFL 318, Premier League 200.

- MLB: exclude the 30 team-seasons from the pandemic-shortened 2020 season.
  Other seasons require at least 160 games. Actual included counts are 252
  team-seasons with 162 games, 14 with 161, and four with 163. Use actual
  games as denominator to handle cancellations and regular-season tiebreakers.
- NFL: regular seasons were 16 games through 2020 and 17 starting in 2021.
  Include full scheduled seasons and normalize by that year's actual games.
  Exclude Buffalo and Cincinnati 2022 (16 games from a 17-game schedule,
  following the canceled matchup). Core sample: 192 sixteen-game and 126
  seventeen-game team-seasons. Both excluded rows are retained for auditing.
- Premier League: every included season has exactly 380 completed matches,
  20 teams, 38 matches per team, and exactly one fixture in each home/away
  direction for every pair. The delayed 2019–20 season was eventually
  completed and is included.

MLB/NFL use `winRate = wins / games` and a modern win pace of
`winRate * currentSeasonGames`, using 162 / 17 games respectively. Premier
League uses earned points `3 * wins + draws`, before administrative deductions,
and a record rate of `earnedPoints / (3 * games)`. Its current scale is
0–114 points over 38 matches. Compare unrounded rates for rarity; rounding
is presentation only. The original win fields remain in the source snapshots.

Each row also retains `draws` and `resultShare = (wins + 0.5*draws) / games`.
This is intentionally separate from literal wins per game. Premier League
official table points use three points per win and one per draw, and do not
equal resultShare. NFL official winning percentage gives half credit to ties.
MLB official standings exclude ties from PCT; Cubs and Pirates each have one
2016 tied game retained here as a played game, so literal wins/game differs
slightly from official PCT for those two records.

## Interpretation

For a requested record, compare its share of maximum available wins or points
with the corresponding observed team-season rates. An empirical percentile can use midranks:
`(count_below + 0.5*count_equal) / sample_size`. Equal-or-better rarity is
`count_at_or_above / sample_size`. Zero observed examples means outside this
sample, not an impossible event or a proven zero probability.

Season record contains schedule difficulty, injuries, roster changes, and
randomness. Rarity is useful for cross-sport UI context and a disclosed
latent-strength mapping, but rarity itself is not matchup probability.
There is no fitted scoring-response, home-advantage, or causal decomposition
in this dataset. Premier League earned points include draws, but do not uniquely identify
the underlying win/draw/loss record.

## Official schedule checks and special cases

- MLB 162-game schedule:
  https://www.mlb.com/amp/press-release/royals-announce-2025-regular-season-schedule.html
- NFL 17 games and scheduling formula:
  https://amp.nfl.com/news/2025-nfl-season-team-by-team-opponents-for-every-game
- Premier League: 20 teams playing each opponent home and away, hence 38 per
  team: https://www.premierleague.com/en/news/58905
- MLB 2016 tie:
  https://www.mlb.com/news/cubs-pirates-game-suspended-ends-in-tie-c204121484
- NFL canceled 2022 game:
  https://www.nfl.com/_amp/week-17-buffalo-cincinnati-game-will-not-be-resumed-neutral-afc-championship-gam

## Reproduction

From the project root, run `npm run check:history` to verify that the bundled
clean snapshots reproduce the browser model, or `python3 scripts/history/build.py`
to regenerate it. The release contains clean snapshots and source manifests;
it does not include the original retrieval/cache utilities. A future refresh
must fetch the recorded sources, repeat the inclusion and fixture checks above,
and update the manifests and model version explicitly.

## Model v3.0 record measure

The source snapshots above retain their original win/draw fields. The current browser build uses literal wins for MLB/NFL and derives Premier League earned points as `3 * wins + draws`, before administrative deductions. Premier League rarity uses `earnedPoints / (3 * games)`; the slider is 0–114 points for 38 matches. Legacy win-rate knots are retained only to translate older configurations.
