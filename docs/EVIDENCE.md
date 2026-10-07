# Historical game evidence · model v4

LeagueLab now derives baseline game odds for all five sports from **5,012 actual game outcomes**. This removes the assumed common strength response from the default MLB/NFL/Premier League odds. It does not make rule changes, cross-sport matchups or independent series assumptions observed facts.

## What was learned from what?

| Sport | Fit target | Strength information available before the outcome |
| --- | --- | --- |
| NBA | 834 playoff games, 2016–2025 | Final regular-season wins/game |
| NHL | 870 playoff games, 2016–2025 | Final regular-season standings points/(2×games) |
| MLB | 393 playoff games, 2015–2024 | Final regular-season wins/actual games |
| NFL | 120 playoff games, 2015–2024 | Final regular-season wins/actual games |
| Premier League | 2,795 league matches, 2015–16 to 2024–25 | Earned points/(3×prior matches), with both clubs having at least ten prior matches |

The same-day Premier League snapshot excludes all outcomes on the predicted game's date. Its 634 draws receive half-win credit, representing a hypothetical fair decider. This is not a three-way win/draw/loss prediction. Transporting partial-season form to a full-season-pace slider is an explicit assumption.

## A test the model had not seen

For each sport, train on the first seven seasons and test on the last three. The rank distribution is also built from training seasons only. Model family, ridge penalty 4 and minimum ten prior soccer matches are fixed before reading holdout results. The final shipped coefficients then refit on all ten seasons.

| Sport | All fitted games | Train / test | Model Brier ↓ | Home-only Brier ↓ | 50–50 Brier ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| NBA | 834 | 584 / 250 | 0.231355 | 0.243581 | 0.250000 |
| NHL | 870 | 608 / 262 | 0.248505 | 0.250034 | 0.250000 |
| MLB | 393 | 269 / 124 | 0.259993 | 0.254940 | 0.250000 |
| NFL | 120 | 81 / 39 | 0.210839 | 0.213841 | 0.250000 |
| Premier League | 2795 | 1958 / 837 | 0.218431 | 0.246852 | 0.250000 |

**MLB does not pass this comparison.** Its fitted record-strength relationship performs worse than both home-only and 50–50 on 124 later playoff games. The app labels MLB as weak validation beside its results and in the five-sport table. We retain this measured finding instead of tuning the model against the test set or claiming predictive accuracy.

NBA, NHL, NFL and Premier League have lower error on this split. NHL/NFL improvements are small, and NFL has only 39 test games. These are point estimates, not evidence of statistically significant improvement. Within-series dependence, playoff selection, changing eras and missing player/schedule context limit generalization. A stronger next check would use rolling temporal splits and uncertainty clustered by series or season.

Brier scores for drawn soccer matches integrate a fair binary decider: `(p-y)^2 + y*(1-y)` for `y=0.5`. Log loss uses the same fractional target. Thus the comparison is about win credit with a hypothetical decider, not observed regulation-win frequency. Five probability bins are included in the new validation artifacts for calibration inspection; small bins should not be overinterpreted.


## Shipped coefficients

| League | Strength coefficient | Home coefficient | Mean regular-season score / team |
| --- | ---: | ---: | ---: |
| nba | 0.328775 | 0.394797 | 110.259538 |
| nhl | 0.079859 | 0.097185 | 2.957336 |
| mlb | 0.105595 | 0.104026 | 4.503273 |
| nfl | 0.197036 | 0.398998 | 22.770301 |
| soccer | 0.273896 | 0.318602 | 1.415000 |

The home term is fitted for adjustment; default simulations remove it for neutral venues. These final coefficients use all ten seasons, so they differ from the training-only coefficients in the validation artifact.

## Provenance and corrections

- MLB: [official StatsAPI schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2024&gameTypes=R,F,D,L,W). Retained 22,763 regular + 393 postseason games. Reconciled all 300 team-season win/loss totals to separate official standings. Kept the 2016 Cubs–Pirates tie in games played. The documented 2020 Division Series onward are neutral; other designated home venues are treated as home in the playoff fit.
- NFL: [nflverse game records](https://github.com/nflverse/nfldata/blob/master/data/games.csv) and [maintainer's dictionary](https://nflreadr.nflverse.com/articles/dictionary_schedules.html). Retained 2,623 regular + 120 postseason games, stable franchise IDs, source neutral flags, and actual 16-game denominators for Buffalo/Cincinnati 2022. No betting-market fields are used.
- Premier League: [OpenFootball football.json](https://github.com/openfootball/football.json). All 3,800 matches pass fixture/club/count checks. Sixty-six July 2020 dates were mislabeled July 2019; the correction audit preserves original values and pinned upstream text evidence corroborated by official revised fixtures. Earned points ignore administrative deductions.
- NBA/NHL: existing source snapshots and exclusions remain documented in [HISTORY.md](HISTORY.md).

Exact URLs, immutable identities where available, SHA-256 hashes and cleaning audits are bundled in `data/history/`. The packaged clean data reproduce all fits without network access. Upstream sources retain their own terms; the software MIT license does not relicense them.

## What is still modeled?

Historical outcome fits anchor neutral, standard-rule single-game odds. The event model is numerically matched to those odds. All five mean scoring levels now come from actual regular-season results, including overtime/extra innings where played; NHL removes the artificial shootout goal. Opportunity counts, reward mixtures and game-day shocks are still simplified. Matching an average score does not validate score-margin or draw distributions.

Changing scoring, opportunities, skill response, form, home or rest produces a labeled counterfactual. The available data do not identify the causal effect of those changes. Best-of-series odds combine fitted game odds under independence and standardized hosting assumptions; they are not directly fitted to series winners. Cross-sport rarity matching does not model real athletes switching sports. These limits remain visible rather than being hidden behind a historical-data badge.

## Reproduce

```sh
npm run check:history
npm test
```

Python 3 is required for the offline historical check. `scripts/history/build.py` and `empirical.py` rebuild five record scales, coefficients, holdout metrics and every new pregame feature row. Verification compares these against the shipped artifacts without modifying canonical source. To intentionally regenerate, run `python3 scripts/history/build.py`.
