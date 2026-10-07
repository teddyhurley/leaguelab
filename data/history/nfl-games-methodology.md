# NFL game evidence, 2015–2024

`games.json` contains 2,743 completed games: 2,623 regular-season and 120
postseason games. `summary.json` contains all season counts and exceptional-game
checks. `build.py` reproduces the normalized files offline from `raw/games.csv`.
No application code or fitted parameters are changed by this package.

## Source identity

The original publisher is [nflverse / Lee Sharpe](https://github.com/nflverse/nfldata).
The CSV was retrieved on October 5, 2026 from
`https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv`.
On October 7, the preserved bytes were independently verified against the
[immutable GitHub blob](https://api.github.com/repos/nflverse/nfldata/git/blobs/b12039baced608536036a307343706293a2b7ecd)
using normal TLS and base64 decoding. They match exactly.

- Bytes: 2,182,715.
- SHA-256: `55fba77115761381052fd7aa0218294a31596c3e476744c24074ba52367ccf17`.
- Git blob SHA-1: `b12039baced608536036a307343706293a2b7ecd`.

`sources.json` also preserves source URLs, hashes, normalized-file hash and
documentation identity. The raw file includes other seasons, but only the
specified decade is normalized. No betting-market columns are used.

## Definitions and transformations

The [maintainer's data dictionary](https://raw.githubusercontent.com/nflverse/nflreadr/main/data-raw/dictionary_schedules.csv)
defines season by the NFL season year, including games played the next January
or February. We filter by season and source phase, never by calendar year or
week number. `REG` maps to `regular`; `WC`, `DIV`, `CON`, and `SB` map to
`playoff`. The source game identifier is retained verbatim.

Both final scores must be present and nonnegative integers. Dates are preserved
as ISO dates. The overtime flag is preserved; all scores are final scores,
including overtime. Tied final scores remain tied. Home is the designated home
team, which may not have home-field advantage. `neutral` is true for source
`location == Neutral` or `game_type == SB`.

For stable franchise identity, STL maps to LA, SD to LAC, and OAK to LV. Other
codes stay unchanged. Original codes are preserved separately in `homeCode` and
`awayCode`; readable names follow those codes. Washington uses the neutral name
"Washington" across its name changes. No franchises are merged within a season.

## Validation

| Seasons | Regular games per season | Playoff games per season |
| --- | ---: | ---: |
| 2015–2019 | 256 | 11 |
| 2020 | 256 | 13 |
| 2021 | 272 | 13 |
| 2022 | 271 | 13 |
| 2023–2024 | 272 | 13 |

Checks passed for unique game IDs, 32 franchises, exact season/phase counts,
team appearance totals, score totals/margins, all playoff teams joining to their
regular-season data, and all regular games preceding playoffs within a season.
There are 53 neutral-venue games, 160 overtime games and nine tied games. Every
tie is a regular-season overtime game. There are no missing-score rows in this
decade and no excluded scored rows.

The [canceled 2022 Buffalo–Cincinnati game](https://www.nfl.com/news/week-17-buffalo-cincinnati-game-will-not-be-resumed-neutral-afc-championship-gam)
is absent from the raw source and normalized output. Buffalo and Cincinnati's
other completed games are retained, giving each 16 actual regular-season games
in 2022. Other teams have 16 games through 2020 and 17 from 2021 onward.

Neutral handling includes international games, displaced home games and the
2024-season Minnesota–Los Angeles wild card game. Super Bowls stay neutral even
where a participant used its usual home stadium; this follows the source's
convention rather than estimating crowd or venue familiarity.

## Modeling limits

For a playoff fit, aggregate regular-season wins and actual games separately
by season and stable franchise ID, then join the playoff outcomes. All those
regular-season records were known before the playoff games. Preserve the nine
regular-season ties: literal `wins / games` differs from official NFL winning
percentage, which gives a half win for a tie. Neither definition is interchangeable
without disclosure.

There are only 120 postseason games; a 2023–2024 holdout contains 26. Parameter
uncertainty and validation uncertainty can therefore be substantial. A score
dataset identifies observed final-score distributions, not drive counts, event
probabilities, individual injuries, or a causal effect of changing the rules.
Hypothetical NFL best-of-seven series have no observed counterpart here.

This is a community-maintained dataset, not an official NFL statistical feed.
The package records provenance; it does not assign a new license to upstream
data or claim that the app's software license covers it.

## Release packaging note

The paths above describe the original development evidence package. In the portable release, normalized outcomes are `nfl-games.json`, sources are `nfl-game-sources.json`, and counts/audits are `nfl-games-audit.json`. Raw caches and ingestion scripts are retained in the local development workspace. The supported portable offline reproduction entrypoint is `python3 scripts/history/build.py` from the project root; it reads these bundled clean outcomes.
