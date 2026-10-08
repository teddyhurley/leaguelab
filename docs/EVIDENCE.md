# Historical game evidence · model v8.0.0

LeagueLab fits baseline outcomes from **53,355 regular-season games**: 11,979 NBA, 12,200 NHL, 22,762 MLB, 2,614 decisive NFL and 3,800 Premier League matches. NBA/NHL/NFL now include teams that missed the playoffs. Their older playoff-only models are replaced, with playoff transfer checked separately and no automatic playoff adjustment.

The separate rarity reference contains 2,849 team-seasons over 20 eligible seasons per league. Outcome cohorts span ten seasons and include COVID years; expanding game coverage does not change the rarity exclusions. Evaluation ranks exclude reference records beyond each training cutoff. These already examined evaluation periods are exploratory, not a new independent test. All five leagues use season-end hindsight, excluding every head-to-head meeting from the strength records. Regular lookback accuracy is not forecasting accuracy.

## The core comparison

Observed better-record wins: NBA 7,610/11,691 (65.1%), NHL 7,035/12,012 (58.6%), MLB 12,640/22,106 (57.2%). All use other-opponent season-end rates, exclude equal-rate pairs and ties, and include COVID years. NBA/NHL cover 2015–16 to 2024–25; MLB covers 2015–2024. Different record gaps and venues contribute to these descriptive averages.

The opening interactive cards instead compare fixed team caliber at neutral venues: the 75th percentile versus the 25th yields 67.9% NBA, 58.2% NHL and 56.5% MLB in one game. Matching rarity and extending game odds to independent series are model conventions. Neither observed nor fitted comparisons identify the causal contribution of scoring frequency. Source counts are rebuilt from the feature audit, not hand-entered in the interface.

## Premier League: season-end strength, three actual outcomes

For every match, remove **both meetings between those clubs** from each club’s completed season. Compute earned points / (3 × 36) from the other 36 matches and translate that rate through historical points rarity. The UI keeps the familiar 38-match season-points scale. Applying other-36-match strength to a selected 38-match caliber is a disclosed transport assumption.

Fit a symmetric Davidson model for home win, draw and away win. Draws are observed outcomes, not half-wins. Strength and home coefficients use fixed ridge 4; the draw intercept is unpenalized. [Model-family reference](https://pmc.ncbi.nlm.nih.gov/articles/PMC9374650/). Numerical choice and regularization are assumptions; coefficients are fitted to the bundled match outcomes.

**This uses hindsight.** Removing the two meetings reduces direct circularity, but later results still enter the strength estimate. The separate-season check measures descriptive transfer, not pregame forecasting accuracy. Teams within a season share opponents; observations are not independent evidence about true ability.

Fit 2,660 matches in 2015–16 through 2021–22. Evaluate 1,140 matches in 2022–23 through 2024–25. Only reference team-seasons at or before the training cutoff set the evaluation rank scale. Three-outcome Brier is the summed squared error across win/draw/loss, so it is **not comparable** to binary Brier below.

| Premier League retrospective check | Three-outcome Brier ↓ | Log loss ↓ |
| --- | ---: | ---: |
| Strength + home + draw | 0.573334 | 0.965150 |
| Home + draw only | 0.642057 | 1.061777 |
| Equal thirds | 0.666667 | 1.098612 |

The model averages 23.29% draws on those seasons versus 22.98% observed. Category calibration bins are in `validation.json`; this average alone does not establish calibration for every strength gap. The old pre-match binary score is not an apples-to-apples comparison.

## MLB: completed-season records, separate playoff evidence

The primary v8 model learns from **22,762 decisive regular-season games** in 2015–2024, covering all 300 team-seasons. Each strength record excludes every regular-season meeting between the pair. The sole 2016 tie remains in games-played denominators but is excluded as a target. There is no early-season eligibility threshold: completed-season hindsight is the intended question.

Strength is the logit of the other-opponent record’s historical percentile, with fixed ridge 4 and a nonnegative slope. The app transports that relationship to the displayed season caliber. Train 15,473 regular games in 2015–2021; evaluate 7,289 regular games and 124 playoff games in 2022–2024 separately. Evaluation ranks use only reference seasons through 2021. These already-examined evaluation seasons remain exploratory.

| MLB evaluation | Model Brier ↓ | Home-only ↓ | 50–50 ↓ |
| --- | ---: | ---: | ---: |
| Regular season | 0.241668 | 0.249471 | 0.250000 |
| Playoff transfer | 0.258322 | 0.252396 | 0.250000 |

Regular-season error improves on the home-only baseline. **Playoff transfer still fails both simple baselines.** Regular games between two eventual playoff teams also fail home-only (1,053 games; details below). Pitchers, rotations and lineups are absent; series combine generic game probabilities under independence. Missing MLB neutral flags retain the designated-home assumption; known neutral games use venue=0.

The pregame wins and Pythagorean run-based candidates in `mlb.py` and `mlb-model-comparison.json` remain research references, with `usedInApp: false`. They answer a different timing question. The run model needs actual run totals the wins slider cannot supply. [MLB explanation of run-based expected records](https://www.mlb.com/glossary/advanced-stats/pythagorean-winning-percentage). The [release review](RELEASE-MODEL-REVIEW.md) compares completed-season candidates with five rolling evaluations; rarity was effectively tied with direct-record alternatives and retained for consistency.

## NBA, NHL and NFL: all teams, not only playoff qualifiers

For every regular-season game, construct both clubs’ completed-season records **excluding every regular-season meeting between that pair**. NBA/NFL use literal wins/game; NHL uses actual standings points/(2×games). Rank those other-opponent rates and fit a regularized binary logistic relationship, with a separate home term and audited neutral venues. The model uses later-season games: removing head-to-head results prevents direct self-contribution but does not eliminate hindsight or shared-schedule dependence.

NBA/NHL train 2015–16 through 2021–22, then evaluate 2022–23 through 2024–25. NFL trains 2015–2021 and evaluates 2022–2024. All final app coefficients refit only on the complete ten-season regular-season cohorts. Nine NFL ties are retained in records but excluded from binary outcomes; NFL odds are conditional winner-selection probabilities, not a model of actual regular-season ties.

| Sport | Fitted games | Train / test | Model binary Brier ↓ | Home-only ↓ |
| --- | ---: | ---: | ---: | ---: |
| NBA | 11,979 | 8,289 / 3,690 | 0.215066 | 0.247034 |
| NHL | 12,200 | 8,264 / 3,936 | 0.236032 | 0.248234 |
| NFL | 2,614 | 1,801 / 813 | 0.221779 | 0.247606 |

### Check the teams that missed the playoffs

Subgroups below come from the same later-season evaluation games. “At least one missed” includes “both missed”; those two rows overlap. Playoff membership refers to the retained main bracket, excluding NHL 2020 qualifying/round-robin games. These are descriptive checks without clustered uncertainty estimates, not claims of statistical significance.

| Sport | Matchup group | Games | Model Brier ↓ | Home-only ↓ | Lower error? |
| --- | --- | ---: | ---: | ---: | --- |
| NBA | At least one missed | 2,684 | 0.205820 | 0.248290 | Yes |
| NBA | Both missed | 760 | 0.230245 | 0.247434 | Yes |
| NBA | Both reached | 1,006 | 0.239732 | 0.243682 | Yes |
| NHL | At least one missed | 2,991 | 0.230921 | 0.247906 | Yes |
| NHL | Both missed | 945 | 0.243880 | 0.248865 | Yes |
| NHL | Both reached | 945 | 0.252206 | 0.249271 | **No** |
| NFL | At least one missed | 673 | 0.214407 | 0.248246 | Yes |
| NFL | Both missed | 242 | 0.250579 | 0.249214 | **No** |
| NFL | Both reached | 140 | 0.257218 | 0.244532 | **No** |
| MLB | At least one missed | 6,236 | 0.240308 | 0.249482 | Yes |
| MLB | Both missed | 2,512 | 0.245245 | 0.249337 | Yes |
| MLB | Both reached | 1,053 | 0.249721 | 0.249404 | **No** |

**NFL games between two non-playoff teams still fail the home-only baseline. NFL, NHL and MLB games between two playoff teams also fail.** These failures remain visible beside results and in the methodology. Broader source coverage does not establish calibrated odds for every record or subgroup.

**Broader NBA weak-record check:** The frozen five-rolling-season review finds Brier 0.255792 versus 0.255262 for home-only on 305 games between bottom-quarter records. This exploratory failure remains visible alongside the primary three-season check. These are different windows/subgroups, not contradictory claims that all weak teams are calibrated.

### Separate playoff transfer

Apply the earlier-regular-season-trained model to the later playoff games. Strength uses each team’s completed regular-season record against other opponents; postseason results never enter that strength record. The home-only baseline below is also trained on earlier regular games. A separate challenger fits earlier playoff games but is **not used by the app**.

| Sport | Playoff test games | Regular-model Brier ↓ | Transferred home-only ↓ | 50–50 ↓ | Playoff-refit challenger ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| NBA | 250 | 0.232698 | 0.243139 | 0.250000 | 0.232996 |
| NHL | 262 | 0.249861 | 0.250484 | 0.250000 | 0.248533 |
| MLB | 124 | 0.258322 | 0.252396 | 0.250000 | 0.260910 |
| NFL | 39 | 0.203867 | 0.229587 | 0.250000 | 0.210088 |

The challenger’s own playoff-trained home baseline is retained in `validation.json`. No playoff adjustment was chosen from these test results. NHL’s transfer improvement over the baselines is tiny; NFL has just 39 playoff test games; MLB fails both baselines. NHL playoff overtime rules differ from regular-season shootouts. None of these game checks validates independent-series odds, rotations or a championship forecast.

## Shipped coefficients

| League | Strength coefficient | Home log-odds | Draw log-weight |
| --- | ---: | ---: | ---: |
| NBA | 0.341447 | 0.302567 | — |
| NHL | 0.150236 | 0.176583 | — |
| MLB | 0.118464 | 0.133113 | — |
| NFL | 0.285326 | 0.213886 | — |
| Premier League | 0.432593 | 0.387256 | -0.351635 |

NBA/NHL/MLB/NFL share the rarity-logit transform. Premier League has a different three-outcome likelihood; coefficient sizes are not directly comparable across all five sports. The fixed ridge penalty of 4 and nonnegative slope are model choices. Neutral app odds remove the fitted home term. Each individual strength and the strength gap are checked against fitted ranges; those coverage checks cannot certify calibration within the range.

## Provenance and corrections

- MLB: [official StatsAPI schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2024&gameTypes=R,F,D,L,W). Retained 22,763 regular + 393 postseason games. Reconciled all 300 team-season win/loss totals to separate official standings. Kept the 2016 Cubs–Pirates tie in games played. The documented 2020 Division Series onward are neutral; other designated home venues are treated as home in the playoff fit.
- NFL: [nflverse game records](https://github.com/nflverse/nfldata/blob/master/data/games.csv) and [maintainer's dictionary](https://nflreadr.nflverse.com/articles/dictionary_schedules.html). Retained 2,623 regular + 120 postseason games, stable franchise IDs, source neutral flags, and actual 16-game denominators for Buffalo/Cincinnati 2022. No betting-market fields are used.
- Premier League: [OpenFootball football.json](https://github.com/openfootball/football.json). All 3,800 matches pass fixture/club/count checks. Sixty-six July 2020 dates were mislabeled July 2019; the correction audit preserves original values and pinned upstream text evidence corroborated by official revised fixtures. Earned points ignore administrative deductions.
- NBA: the SportsDataverse/ESPN game collection now contributes all 11,979 regular games, with exact games/wins/losses reconciliation for 300 team-seasons. Twenty-three tiny score-total discrepancies are preserved in a dedicated audit; they do not affect wins or the retained standings-based scoring mean. Neutral flags include corrected Las Vegas Cup semifinals.
- NHL: official per-game team statistics contribute 12,200 regular games; all 312 team-seasons reconcile ten standings fields. Independent official club-season schedules confirm every game’s date, clubs, score, decision and venue status. Actual point credits preserve the rare forfeited overtime-loss point. [HISTORY.md](HISTORY.md) names the complete audit and source files.

Exact URLs, immutable identities where available, SHA-256 hashes and cleaning audits are bundled in `data/history/`. The packaged clean data reproduce all fits without network access. Upstream sources retain their own terms; the software MIT license does not relicense them.

## What remains modeled?

Neutral standard-rule game odds are anchored to the fitted models. Premier League’s baseline win/draw/loss masses all match the historical model, using a fixed outcome-category correction to the mechanistic score grid. That correction stays fixed when rules change; changed draws and margins are therefore counterfactual, not observed facts. Conditional score shapes and mean scores after this adjustment are not separately fitted.

Opportunity counts, reward mixtures, game-day shocks, home/rest controls, cross-sport rarity matching and independent series remain assumptions. Regular single-game soccer retains draws; hypothetical series resolve them with fair deciders. Historical score means anchor event rates but do not validate score-margin distributions. The release review includes rolling splits and season-bootstrap comparisons. A stronger next check needs independent newer seasons, season/series-cluster uncertainty, opponent adjustment and real pitcher context.

## Reproduce

`npm run check:history` rebuilds all models, feature audits and MLB comparisons in a temporary directory. `npm test` runs the JavaScript suite; `python3 -m unittest discover -s tests -p 'test_*.py'` checks baseball date handling, all-team other-opponent records, explicit NHL point credits, NFL ties and exclusion invariance. Mutating all head-to-head results cannot change those same matchups’ strength features. All use bundled snapshots without network access.
