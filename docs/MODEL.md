# Model specification · v4.0.0

## Evidence and scope

League-specific wins/points inputs use 1,278 team-seasons across five leagues. Baseline game probabilities in all five sports use historical outcome fits: four postseason models and a pre-match Premier League model. MLB failed to improve on the simple holdout baselines. Counterfactual scoring mechanisms remain assumptions. This is not a calibrated real-team forecast or a causal explanation of league differences.

## Plain-language walkthrough of the numbers

The app has no remote simulation backend or live odds feed. It bundles a fixed historical snapshot and performs calculations in a browser worker. Four stages connect an input to an answer:

1. **Record → normalized rate.** NBA/MLB/NFL use wins/games; NHL uses standings points/(2×games); Premier League uses earned points/(3×matches), before administrative deductions. Historical rows use actual games; the UI translates to 82 NBA / 84 NHL / 162 MLB / 17 NFL / 38 Premier League games.
2. **Record rate → historical rank → strength.** Compare the record with its league’s included team-seasons; smooth and interpolate its percentile, then apply a logit transform. Choosing rarity as a strength proxy is an assumption. It retains luck, schedule and era effects embedded in the record.
3. **Strength gap → one-game probability.** NBA/NHL/MLB/NFL use fitted playoff-outcome relationships. Premier League uses pre-match records and a fair-decider win-credit target. All five baseline mean scoring levels are measured; their event count and reward mixtures remain assumed. The baseline fitted edge is held fixed for counterfactuals.
4. **Game odds → format → simulated outcomes.** Exact score/series calculations provide the headline odds. Seeded sampling produces illustrative wins, losses and squares. It does not add new evidence.

**Worked example:** 50 NBA wins gives smoothed rank 0.773859 and internal strength 1.230231. Ten NFL wins gives rank 0.673981 and strength 0.726247. Under neutral NBA rules, the fitted coefficient is 0.328775. Apply logistic(0.328775 × (1.230231 − 0.726247)) to get about 54.13% for A, and 45.87% for B. These are hypothetical cross-sport odds conditional on rarity matching, not a measured history of NBA teams playing NFL teams.

**Provenance:** the record counts and all five score means come from the bundled sources in [HISTORY.md](HISTORY.md). The fits use 834 NBA, 870 NHL, 393 MLB, 120 NFL and 2,795 Premier League games. All coefficients and holdout results are in [EVIDENCE.md](EVIDENCE.md). The regularization penalty of 4, nonnegative slope restriction, percentile smoothing, 0.12 controlled-mechanics strength response, opportunity counts, reward mixtures, game-day shock distribution, home/rest adjustments, tie decider and independent-game assumption are design choices. No claim is made that all of these were measured.

**Default controls:** scoring/opportunity/skill/form multipliers are 1, added reward volatility and home/rest adjustments are 0. Trial count 10,000 and random seed 42 are convenience defaults. The base event-rate cap at 0.95 is a numerical/modeling guardrail. The 95% simulation interval is a standard Wilson binomial interval using z≈1.96; it is not a confidence interval for real-world accuracy. The sections below give the complete formulas, presets, schedules, validation and computational tolerances.

## Record inputs, rarity and latent strength

Config v5 stores independent `recordSportA`, `recordSportB`, `recordA`, `recordB`; a `comparison` mode; `opponentRank`; `matching` (`rarity` or `recordRate`); and `basis` (`history` or `mechanics`). Record values carry the selected sport’s unit: wins for NBA/MLB/NFL, points for NHL/Premier League. `history.js` returns explicit `value`, `unit`, `games`, `max`, `rate` and `rank` fields for translated records. CSV also includes units beside the reference totals and translated paces.

Equivalent paces may be fractional after switching leagues; direct slider edits choose whole wins or points. Bounds are NBA 82 wins, NHL 168 points (84 games in 2026–27), MLB 162 wins, NFL 17 wins, Premier League 114 points (38 matches). NHL uses actual API points, checked against 2×wins + overtime/shootout losses. Premier League points are 3×wins + draws. Administrative deductions are excluded because this input describes on-field results, not disciplinary penalties. The app labels that distinction. Neither points scale changes game-score charts, which remain in goals.

Config v2 first retains its original same-league A-vs-B semantics; v3 retains its explicit comparison mode. Both migrate to v5: win-based NHL/Premier League source values are mapped from retained legacy win-percentile knots into equivalent points percentiles. Zero/perfect legacy records map to the bounds; other out-of-sample records cap at the empirical endpoints. This does not recover actual points from wins alone. A visible notice states the conversion and that the new NHL fit may change prior odds. The legacy `winRate` option becomes `recordRate` with its new denominator semantics. NBA/MLB/NFL source values stay unchanged. Version 4 preserves its records and settings when migrating to v5; a notice explains that the new MLB/NFL/Premier League fits can change prior odds. Abstract-rating v1 remains unsupported.

### Head-to-head (default)

Default inputs are 50 NBA wins for Team A and 10 NFL wins for Team B. Both play under one shared ruleset: NBA, one game, neutral venue and equal rest. Translate the source records into the selected sport through the chosen matching rule, then evaluate A against B. The headline shows exact model P(A wins) and 1 − P(A wins). Changing either record changes both odds. Equal rarity does not establish equal athletic ability across sports; this is a hypothetical comparison of relative standing, not players physically changing sports.

The left scenario supplies the primary matchup rules. The right scenario supplies the alternative rules and holds both source records fixed. Guided presets set a baseline on the left and an intervention on the right. Both scenarios internally report A versus B. The head-to-head result object names its scenario/rules and includes complementary exact probabilities, simulation counts/probabilities, reversed confidence-interval endpoints and the first 100 winners. B is always the complement of A in the same trials, never the right scenario’s focal-team probability. The series chart likewise shows A and B under the primary rules.

### Separate benchmark matchups (optional / legacy)

Comparison options retains benchmark mode, and existing configuration-v3 links preserve their explicit mode. In this mode A plays in its source league on the left and B in its source league on the right, each against the same opponent percentile. Default q=.5 is the middle of each league’s historical distribution, not necessarily a .500 record. Options are .25/.5/.75/.9. Changing B cannot change A’s result in this mode, and these independent probabilities need not sum to 100%.

Scenario `a` internally means the focal team in benchmark mode; scenario `b` means its opponent. The `subject` field identifies the user-facing A/B team and `headToHead` is null. The four playoff fits and Premier League pre-match fit remain historical associations; median-opponent and cross-sport applications are not independently validated forecasts.

For rate r = record / maximumAvailable, the rarity readout is the exact share of included historical records at or above r. Maximum available is games for wins, 2×games for NHL points, or 3×matches for Premier League points, using a 1e-10 equality tolerance. The latent proxy uses each unique observed rate's smoothed midrank:

```text
q = (count_below + 0.5 * count_equal + 0.5) / (sample_size + 1)
theta = log(q / (1 - q))
```

Linearly interpolate q between observed rates. Cap at the observed endpoints outside the sample: zero observed examples never means a theoretical zero probability. Tails are explicitly flagged in the UI. The headline empirical count is not the smoothed rank and is not the matchup win probability.

Rarity matching holds q exactly across sports and displays an inverse-interpolated equivalent record pace for each league. Small sample endpoints can require clipping the displayed equivalent; the shared q remains the proxy. Record-percentage matching holds the share of maximum available wins/points fixed and computes a different q from each league's history. Switching the slider’s reference league preserves fractional equivalent record pace and marks it ≈. Moving the slider selects whole wins or points. This avoids cumulative rounding drift between sports. Equal rarity is a comparison convention, not proof of equal underlying talent. Draws and overtime-loss points are observed in the snapshots. The NHL points distribution is not the win distribution multiplied by two; the Premier League points distribution is not the win distribution multiplied by three.

### Included historical cohorts

| League | Window | Included team-seasons | Filters |
| --- | --- | ---: | --- |
| NBA | 2015–16 to 2024–25 | 240 | Full 82-game records; excludes 2019–20 / 2020–21 |
| NHL | 2015–16 to 2024–25 | 250 | Full 82-game records, normalized to 84-game current pace |
| MLB | 38 | 4.503273 / 54.150 | 1/.70, 2/.20, 3/.075, 4/.025 | 4.503273 runs |
| NFL | 11 | 22.770301 / 59.620 | 3/.40, 7/.58, 8/.02 | 22.770301 points |
| Premier League | 2015–16 to 2024–25 | 200 | All 38-match records; 3×wins + draws before deductions |

See [data provenance and reproduction](HISTORY.md). The reference is a fixed ten-season window, not all-time league history or the latest completed season.

## Historical game baseline fits

NBA/NHL use the retained postseason games after their regular-season records: 834 NBA games and 870 NHL games. NBA features use win percentage; NHL uses standings points percentage. Shortened seasons use actual games. NBA play-ins and NHL 2020 preliminary/round-robin games are excluded; 2020 NBA/NHL bubble games are neutral.

MLB/NFL aggregate every completed regular-season game by season and stable team ID, then join that record to every postseason game. The predictor never includes postseason results. MLB retains the 2016 tied game in games played but not wins, and marks the documented 2020 Division Series onward as neutral. NFL uses literal wins/game, including actual 16-game records for BUF/CIN 2022. Source-marked neutral games and Super Bowls are neutral. The samples are 393 MLB and 120 NFL playoff games.

Premier League has no postseason. Its 2,795 eligible matches use earned points divided by three times games played **before that match date**, after both clubs have played at least ten matches. All fixtures on a date use the same pre-day snapshot. Current/future match results cannot enter their own features. Sixty-six erroneous July 2020 dates in the upstream JSON were corrected using pinned upstream text and official fixture evidence, with a per-game audit. The ten-match threshold was fixed before checking holdout performance. Applying a partial-season form relationship to a full-season-equivalent input remains a transport assumption.

```text
Expected home win credit = logistic(beta * (theta_home - theta_away) + h * home_indicator)
y = 1 for a home win, 0 for a loss, 0.5 for a draw
objective = summed binary cross entropy(y, p) + 0.5 * 4 * (beta^2 + h^2)
beta >= 0
```

All retained playoff games are decisive. Premier League's fractional draw target represents a hypothetical fair decider: `P(win) + 0.5 * P(draw)`. It does not estimate separate regulation win/draw/loss probabilities or actual shootout success. The simulator's displayed tie and scoring-margin distributions still come from its event model and have not been validated against historical margins.

The fixed ridge penalty of 4, logistic form, nonnegative slope and percentile translation are modeling choices. The app's neutral target is `logistic(beta * delta)`. A separate fitted home coefficient prevents confounding during fitting but is removed in neutral simulation. Home/rest controls remain hypothetical event-odds adjustments.

Numerically invert the baseline event model (25 bisection steps on edge [-8,8]) to reproduce the neutral target, then hold that edge fixed during counterfactuals. Historical mode now requires a fitted coefficient for every supported sport; there is no silent fallback to an assumed coefficient. Optional controlled-mechanics mode deliberately uses `0.12 * delta`. Fitted-game badges change to what-if badges when mechanics, home or rest change. Series odds remain calculated under independent-game assumptions. The interface flags strength gaps exceeding the maximum gap in the fit, as well as records outside the rarity reference.

### Temporal validation

Each model trains on the earliest seven seasons and tests on the final three. Training percentile knots use training seasons only. NBA/NHL train on 2016–2022 postseasons and test on 2023–2025; MLB/NFL train on 2015–2021 and test on 2022–2024; Premier League trains on 2015–16 through 2021–22 and tests on 2022–23 through 2024–25. No cutoff, penalty or threshold is tuned against the test outcomes. Final app coefficients refit on all ten seasons after that check.

Brier is the mean expected binary error. For a fractional draw target, use `(p-y)^2 + y*(1-y)`, not just squared error against 0.5; log loss uses fractional binary cross entropy. Thus a 50–50 forecast scores 0.25 even on draws. These are fair-decider metrics, not three-category soccer metrics. Calibration bins report observed **win credit**, not raw home-win rate. Feature rows and holdout calculations rebuild offline.

See [EVIDENCE.md](EVIDENCE.md) for all coefficients, sample sizes and exact validation scores. MLB performs worse than home-only and 50–50 on its holdout; it stays explicitly marked as weak evidence, not presented as an established predictive improvement. NFL's small improvement is based on 39 games. One split, playoff selection, within-series dependence and limited extreme records constrain every fit. No parameter confidence intervals or validated real-team forecast claim is made. NBA/NHL descriptive better-record rates remain in the source audit and [HISTORY.md](HISTORY.md); they are not imposed on every selected matchup.

## Event model

At each of `N` opportunities per team, an event occurs with probability `p_team`; conditional on an event, its score value `R` comes from a discrete distribution. Team score is the sum over opportunities.

```text
N = round(preset_N * opportunity_multiplier)
p_base = min(0.95, preset_p * scoring_multiplier)
edge = baseline_edge * sensitivity_multiplier + venue * home_edge + rest_edge + F
p_A = logistic(logit(p_base) + edge / 2)
p_B = logistic(logit(p_base) - edge / 2)
```

Venue is +1 when A is home and −1 when B is home. `rest_edge` always refers to A, and is a fixed hypothetical log-odds adjustment, not a number of days.

The game-day shock `F` equals `0.12 * noise_multiplier * Z`, where:

| Z | −2 | −1 | 0 | 1 | 2 |
| --- | --- | --- | --- | --- | --- |
| Probability | 1/16 | 4/16 | 6/16 | 4/16 | 1/16 |

This finite mixture has E[Z] = 0 and Var(Z) = 1. Conditional on form, events and team scores are independent; marginally, the common form shock induces dependence. A new independent shock is drawn conceptually each game. We integrate it exactly before sampling winners, which has the same distribution for independent games.

Noise defaults are common. History mode has league-specific game fits for all five sports; controlled-mechanics mode uses a common illustrative strength coefficient. All parameters can materially alter the ranking.

## Presets (per team)

| Sport | N | Base event probability | Conditional reward distribution | Neutral expected score before form |
| --- | ---: | ---: | --- | ---: |
| NBA | 100 | 110.259538 / 228 | 1/.06, 2/.60, 3/.34 | 110.259538 points |
| NHL | 31 | mean historical goals / 31 | 1/1.00 | about 2.96 goals |
| MLB | 38 | 4.503273 / 54.150 | 1/.70, 2/.20, 3/.075, 4/.025 | 4.503273 runs |
| NFL | 11 | 22.770301 / 59.620 | 3/.40, 7/.58, 8/.02 | 22.770301 points |
| Soccer | 12 | 1.415000 / 12.000 | 1/1.00 | 1.415000 goals |

The notation `value/weight` describes event reward values and probabilities. These are rounded stylized assumptions. NBA events abstract full scoring possessions, including free throws. MLB events do not reconstruct innings, base/out state, or plate-appearance dependence. NFL events abstract scoring drives. Premier League chances are not an xG feed; its record distribution and game-odds fit are empirical, but its chance mechanics remain simplified.

All five mean scores are weighted by actual team-games across ten regular seasons; NHL totals exclude the artificial shootout-winning goal. NBA/MLB/NFL means include overtime or extra innings where played. Baseline event probabilities reproduce those means before form noise. Opportunity counts, reward mixtures, form and home/rest scenario controls remain assumptions. The clean source snapshots and provenance are bundled in data/history; app history-data.js contains compact distributions and fit results.

## Independent counterfactuals

1. **Scoring rate:** multiply baseline event probability. At high rates, saturation reduces the difference that skill produces on a probability scale, so monotonic predictability is not guaranteed. Caps are visible in the UI.
2. **Opportunities:** multiply N, rounded to an integer; hold other mechanics fixed. Independent event noise shrinks relative to signal, but a common game-day shock remains.
3. **Skill sensitivity:** multiply the coefficient linking delta to event log-odds.
4. **Event volatility:** for every baseline reward `r`, replace it with `0`, `r`, or `2r` with probabilities `v/2`, `1-v`, and `v/2`. Mean reward remains r; its conditional second moment increases. At v > 0, an event may yield zero, so event frequency differs from positive-score frequency.
5. **Game-day form:** scale the shared shock; higher opportunity count cannot average away this component completely.

Uniformly multiplying every reward changes score units but leaves regulation winner and tie probabilities unchanged. A unit test enforces this distinction from more scoring opportunities.

## Exact game probabilities

For one opportunity the probability generating function is:

```text
Q(z) = (1-p) + p * sum_r w_r z^r
P_N(z) = Q(z)^N
```

The engine computes coefficients iteratively. For each form component, it combines the two team PMFs into the distribution of `score_A - score_B`, then averages with form weights. Advancement probability is `P(margin > 0) + 0.5 * P(margin = 0)`.

Mass below 1e-18 in the score DP and 1e-15 in the margin product is pruned for performance; final margins are renormalized. “Exact” means the deterministic distribution calculation under the finite model, subject to floating-point rounding and negligible tail pruning, rather than a sampled approximation. The central plotted range contains approximately 99.8% of score margins, rounded to symmetric integer bins. Full displayed histograms are theoretical, not a second simulation.

The score-preview section starts with four candidates: standard rules in Team A’s league, standard rules in Team B’s league, the starting matchup, and the experiment. All use the fixed source records. The standard league candidates use neutral venues, equal rest and baseline mechanics. Charts merge only when the sport, focal benchmark subject (if applicable), translated strengths, baseline mode, effective opportunity count, event probability, reward mixture, skill sensitivity, form noise, signed game-one home edge and rest edge match. A changed scoring rate or other game condition therefore retains a separate chart even within the same league. The result metadata retains every role represented by a merged chart. The UI renders each unique chart once: first at the starting result if applicable, otherwise at the experiment result, otherwise in the optional source-league replay disclosure. Other roles link to that existing chart. Different benchmark subjects stay separate.

The grouping excludes series length, trial count and random seed: these charts describe the exact game-one regulation scoring distribution. All supported series formats start with the same designated home team. A format-only change can affect series odds without changing this chart. Neutral home-seed changes have no effect. The shared grouping helper drives both pending UI cards and completed results, producing one to four charts. Each chart lists its representative game settings, scoring units and scale.

New experiments initially copy the starting rules. Changing those rules also updates the experiment while the two configurations match. Once the experiment is customized, further starting edits preserve it. Reset experiment copies the current starting rules without changing either source record. Existing shared configurations retain their explicit main and alternative rules.

## Format and context

Supported best-of lengths: 1, 3, 5, 7. A team wins after `(length+1)/2` wins; no further games are played after clinching.

Standardized host schedules for the designated home seed H and the other team V:

```text
1: H
3: H V H
5: H H V V H
7: H H V V H V H
```

These are explicit hypothetical comparison schedules, not a complete representation of each league's rules. At neutral venues the seed setting has no effect. Seeding only assigns hosting; rest is fixed through the series. No bracket/reseeding/travel/fatigue simulator is included.

All regulation ties are resolved with a fair decider. Soccer regulation draws are separately exposed, but no league-table points or real penalty/extra-time model is implied.

A dynamic program tracks reachable `(wins_A, wins_B)` states and absorbs probability when either side clinches. It also derives the series-length distribution and expected games. With constant game probability it agrees with the standard binomial tail.

## Monte Carlo and uncertainty

Trials sample game advancement using the exact per-game probabilities. Mulberry32 supplies reproducible uniform draws. The main matchup uses the supplied unsigned 32-bit seed; the alternative rules scenario uses `seed XOR 0x9e3779b9` (converted to unsigned by the RNG). Streams are reproducible pseudorandom streams, not cryptographic randomness. Trial counts are 1,000, 10,000, 50,000, or 100,000 per scenario.

Sampling stops at clinching. The engine retains wins, observed series lengths, mean games, first 100 trial outcomes, and 20 convergence checkpoints. All appear in JSON; the interface intentionally focuses on the most interpretable subset. The 95% Wilson interval quantifies sampling uncertainty conditional on this model. It excludes parameter uncertainty, data uncertainty, and misspecification.

## Ordered gap bridge

In benchmark mode, evaluate:

1. Team A against the common benchmark under the left scenario.
2. Team B translated into the left sport, against the same benchmark, with all left rules fixed.
3. Change to right league mapping/baseline/mechanics, retaining left series and context.
4. Change series length to the right setting.
5. Change home/rest to the right setting, yielding the actual right result.

The first contribution is the selected team record, so the app does not attribute a team-strength difference to scoring mechanics. In A-vs-B mode omit step2 and preserve both source records throughout; the bridge has four states instead of five.

Adjacent differences telescope to the total gap. They are **order-dependent model interventions**, not identified causal contributions, and do not isolate each individual sport knob. Interactions are attributed to whichever group is changed later. For an individual lever, compare the same sport on both sides and change only that control.

## Validation and limits

Automated invariants include normalization, event moments, neutral symmetry, context/team swap complementarity, reward-unit invariance, exact series agreement, stopping, seed determinism, and Monte Carlo agreement. Passing them verifies implementation consistency, not external validity.

Next validation should use rolling temporal splits, series-cluster uncertainty, opponent-adjusted strength, score/draw reliability, and alternative event models. Historical descriptive rates and the exploratory holdout check do not establish the realism of counterfactual mechanisms.
