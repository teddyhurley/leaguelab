# MLB completed games, 2015–2024

This dataset contains **23,156 completed MLB games: 22,763 regular-season games and 393 postseason games**. It was retrieved from the official MLB StatsAPI on October 7, 2026. It is an archived historical extract, not a live prediction feed.

## Sources and completeness

`retrieve.py` requests one complete calendar year per season from the official `statsapi.mlb.com/api/v1/schedule` endpoint, filtered to sport ID 1 and game types R (regular season), F (wild card), D (division series), L (league championship series), and W (World Series). Spring training, exhibitions and All-Star games are excluded. Each response supplies all date buckets for that year; this is a complete schedule response rather than a paged endpoint. `clean.py` asserts that enumerated rows equal the response's `totalGames` and the sum of the per-date totals. All ten requested seasons are present.

Exact request URLs, local raw paths, retrieval times and SHA-256 hashes are in `sources.json`. That manifest also records a hash of the normalized `games.json`. `audit.json` records counts, exclusions and repeated game IDs by season. The raw response files are kept in `raw/`.

| Season | Regular-season games | Postseason games |
| --- | ---: | ---: |
| 2015 | 2,429 | 36 |
| 2016 | 2,428 | 35 |
| 2017 | 2,430 | 38 |
| 2018 | 2,431 | 33 |
| 2019 | 2,429 | 37 |
| 2020 | 898 | 53 |
| 2021 | 2,429 | 37 |
| 2022 | 2,430 | 40 |
| 2023 | 2,430 | 41 |
| 2024 | 2,429 | 43 |

The shortened 2020 season is retained. The two 2018 regular-season tiebreaker games are regular games under MLB's classification. Nonstandard schedules and canceled games mean that multiplying 30 teams by 162 games is not a completeness test.

## Finality, duplicates and dates

Only rows with `detailedState` equal to `Final` or `Completed Early`, with integer scores for both teams, are retained. **The source's `abstractGameState` alone is unsafe:** some postponed/canceled rows also report `Final` at that abstraction level. Of 23,666 raw rows, 478 unplayed/status rows are excluded and 32 additional completed rows are consolidated.

`gameId` is the stable official `gamePk` serialized as a string. Postponed and suspended games can appear under multiple schedule dates with the same ID. For duplicate completed rows, the script asserts that participants, game type and final scores agree before keeping one record. It fails rather than silently accepting conflicting outcomes. The final normalized file has no duplicate game IDs.

`date` is MLB's `officialDate`; `completionDate` is the latest containing calendar bucket for that completed game. This preserves the distinction when a suspended game finishes later. `homeId` and `awayId` are stable official team IDs. Names preserve the historical naming in the response (including franchise rebranding). Home and away are the official designated batting sides, not an assurance about geographic home advantage.

## Ties and independent validation

The September 29, 2016 Cubs–Pirates game (ID `449244`, 1–1) is retained as a completed tie, with `isTie: true`. It counts as a game for actual-games denominators and score summaries; neither team receives a win. A binary winner model must omit this tied outcome. The tie occurred in the regular season; there are no tied postseason games in this extract. For the affected teams, wins divided by all completed games differs slightly from the official win percentage, which excludes ties.

Regular-season wins and losses reconstructed from game results match the separate official final-standings snapshots for **all 300 team-seasons**. The standings source URLs and hashes are included in `sources.json`. This independent check catches missing, doubled or incorrectly assigned outcomes; it does not establish that any prediction model is calibrated.

## Neutral venues

The [official MLB 2020 postseason announcement](https://www.mlb.com/press-release/press-release-2020-postseason-schedule-announced) establishes neutral venues from the Division Series onward. Accordingly, all **35** 2020 D/L/W games have `neutral: true`. The 2020 wild-card round is not marked neutral by this rule.

All other rows use `neutral: null` because the schedule response does not provide a reliable neutral flag. Venue IDs, names and any site description are preserved for further auditing. International games, special-event games, temporary home parks and other unusual sites have not been comprehensively classified here. Do not interpret `null` as verified nonneutral. For postseason fitting, the documented 2020 bubble games should not receive the ordinary home-venue covariate; designated home still has the batting-order advantage.

## Intended use and limits

For a postseason strength model, derive each participant's regular-season wins and actual completed games from the same season, then use those **pre-postseason** quantities to predict its postseason results. This avoids using future playoff results to define team strength. Historical season distributions or fitted coefficients used in a held-out-year evaluation must also be trained only on earlier years. Pitchers, injuries, roster changes, travel and rest are not included in this extract.

Final game scores include extra innings. The dataset spans changed extra-inning and doubleheader rules and a shortened 2020 season. Raw scoring means are 4.5033 runs per team per regular-season game and 4.1158 per postseason game; those are descriptive aggregates, not independent-event scoring rates. A mechanism that turns more scoring into changed win probabilities still requires an explicit model and validation.

This is official source data, not a statement about redistribution rights. MLB's copyright notice is preserved in `sources.json`; the app's software license does not relicense upstream data.

## Rebuild

Run `python3 work/empirical-mlb/retrieve.py`, then `python3 work/empirical-mlb/clean.py` from the workspace root. Downloads use curl with ordinary certificate validation. The independent cross-check reuses the earlier official standings files in `work/other-leagues-history/raw/`. No canonical app files are modified by these scripts.

## Release packaging note

The paths above describe the original development evidence package. In the portable release, normalized outcomes are `mlb-games.json`, sources are `mlb-game-sources.json`, and counts/audits are `mlb-games-audit.json`. Raw caches and ingestion scripts are retained in the local development workspace. The supported portable offline reproduction entrypoint is `python3 scripts/history/build.py` from the project root; it reads these bundled clean outcomes.
