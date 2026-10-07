# Audited Premier League match results

This extract contains **3,800 completed English Premier League matches**, 2015–16 through 2024–25. `season` is the ending year (2016 through 2025). Results are full-time league results, including 886 draws, 1,691 home wins and 1,223 away wins. No cup, playoff, friendly, extra-time or penalty-shootout results are included.

## Source and reproducibility

The primary data publisher is [OpenFootball football.json](https://github.com/openfootball/football.json), a community dataset, not an official league feed. The publisher explains that JSON is generated from its upstream Football.TXT country repositories and dedicates the data to the public domain under CC0. Its pinned README and license are in `raw/`.

All ten existing October 5, 2026 cached files were checked against immutable commit `e6744429ee395bc86f247348c6184bb08d4eb361` on October 7, 2026. Every file was byte-identical. The originals remain unmodified in `raw/`; `sources.json` records exact commit URLs and SHA-256 hashes. `build.py` is an offline standard-library Python rebuild. Run `python3 work/empirical-soccer/build.py` from the workspace root.

`games.json` is an array sorted by season, actual played date, then stable match ID. Home and away club identifiers are stable club-name strings. The provider sometimes adds ` FC` between seasons; extraction removes that terminal suffix and records every mapping in `club-aliases.json`. Existing `AFC` names are preserved. Each ID combines season and ordered club names, which are unique within a double round-robin season.

## Date defect found and corrected

The generated 2019–20 JSON puts **66 July 2020 restart matches in July 2019**, which would leak future outcomes into pre-match records. These dates must not be used unchanged.

The upstream [2019–20 Football.TXT source](https://raw.githubusercontent.com/openfootball/england/b17e8f01707d83d2ce1790c14d4a5eeb35987825/2019-20/1-premierleague.txt), pinned at commit `b17e8f01707d83d2ce1790c14d4a5eeb35987825`, explicitly ends the season on July 26, 2020. Its July weekday/date headers match 2020, and every affected fixture and score matches the JSON. The builder independently parses and asserts all 66 upstream pairs, results, dates and weekdays before making the year correction. It never makes a general season-date guess.

The league's own revised schedules corroborate the corrected dates:

- [June 17–July 2 restart fixtures](https://www.premierleague.com/en/news/1676010).
- [July 4–13 revised fixtures](https://www.premierleague.com/en/news/1682467).
- [July 14–22 revised fixtures and July 26 final day](https://www.premierleague.com/en/news/1702418).
- [Final-day fixture pairings](https://www.premierleague.com/en/news/1678153). This earlier provisional article is used for final-day pairings only; its earlier rounds were superseded by the revised articles above.

`date-corrections.json` records the original and corrected date for each fixture and its source IDs. The downloaded official schedule pages have exact URLs and response hashes in `sources.json`. No goals or outcomes were changed.

Two other rescheduled matches were spot-checked against primary league reporting: [Bournemouth–Luton, March 13, 2024, 4–3](https://www.premierleague.com/en/news/3930809) and [Manchester United–Liverpool, May 13, 2021, 2–4](https://www.premierleague.com/en/match/2128621/manchester-united-vs-liverpool/commentary). The extract uses those played dates. The abandoned Bournemouth–Luton fixture is not counted as a second completed game. This is targeted date auditing plus full structural validation, **not an independent official re-verification of all 3,800 dates and scores**.

## Validation

The builder asserts for every season:

- 380 completed matches and 20 distinct clubs.
- 38 matches per club: 19 home and 19 away.
- Every ordered pair of distinct clubs appears exactly once.
- Unique deterministic match IDs; valid ISO dates inside the actual season window.
- No club plays twice on one date.
- Full-time goals are nonnegative integers.
- Each of the 66 corrections matches upstream date and result evidence.

`validation.json` reports season totals, date bounds, results and goals. The corrected 2019–20 bounds are August 9, 2019–July 26, 2020. Season draw counts are 107, 84, 99, 71, 92, 83, 88, 87, 82 and 93.

## Fit boundaries

Use dates rather than matchday labels for pre-match features: postponed games were played out of nominal round order. Compute both clubs' records using strictly earlier dates, then update after all matches on the current date are scored. This deliberately avoids any same-day result leakage; exact kickoff times are not required. The proposed model's minimum of ten previous league games for each team belongs in the modeling layer, not this raw results extract. No final-season record feature is embedded here.

Standings strength means **earned points**: three per win, one per draw, zero per loss, divided by actual prior matches or three times that number as appropriate. Administrative points deductions are ignored; these features measure football results rather than disciplinary table adjustments. Draws must remain a distinct observed outcome for model fitting and assessment; treating every non-win as a loss silently changes the target.

`neutral=false` means the club was the designated home team at its home venue. Closed-door matches remain home fixtures; lack of spectators is not a neutral site. The extract contains no reliable crowd/attendance covariate, lineup, injury, shot, possession or expected-goals data. COVID seasons may have a different home effect. Model evaluation should report temporal holdout results and consider that limitation.

This match-result dataset can estimate associations between prior earned points, home status, goals and outcomes. It cannot by itself identify a causal effect of changing scoring opportunities or rules, or establish what an NBA team would do in a soccer match. Those counterfactual boundaries remain explicit even when the baseline is fitted to real results.

## Release packaging note

The paths above describe the original development evidence package. In the portable release, normalized outcomes are `soccer-games.json`, sources are `soccer-game-sources.json`, and counts/audits are `soccer-games-audit.json`. Raw caches and ingestion scripts are retained in the local development workspace. The supported portable offline reproduction entrypoint is `python3 scripts/history/build.py` from the project root; it reads these bundled clean outcomes.
