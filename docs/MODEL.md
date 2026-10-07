# Model specification · v3.0.0

## Evidence and scope

League-specific wins/points inputs use 1,278 team-seasons across five leagues. NBA and NHL baseline game probabilities use exploratory regularized postseason fits. Counterfactual scoring mechanisms remain assumptions; MLB/NFL/Premier League game probabilities are illustrative. This is not a calibrated real-team forecast or a causal explanation of league differences.

## Plain-language walkthrough of the numbers

The app has no remote simulation backend or live odds feed. It bundles a fixed historical snapshot and performs calculations in a browser worker. Four stages connect an input to an answer:

1. **Record → normalized rate.** NBA/MLB/NFL use wins/games; NHL uses standings points/(2×games); Premier League uses earned points/(3×matches), before administrative deductions. Historical rows use actual games; the UI translates to 82 NBA / 84 NHL / 162 MLB / 17 NFL / 38 Premier League games.
2. **Record rate → historical rank → strength.** Compare the record with its league’s included team-seasons; smooth and interpolate its percentile, then apply a logit transform. Choosing rarity as a strength proxy is an assumption. It retains luck, schedule and era effects embedded in the record.
3. **Strength gap → one-game probability.** NBA/NHL use fitted playoff-outcome relationships. Other sports use chosen event-model constants. Baseline NBA/NHL mean scoring is measured; their event count and reward mixtures remain assumed. The baseline fitted edge is held fixed for counterfactuals.
4. **Game odds → format → simulated outcomes.** Exact score/series calculations provide the headline odds. Seeded sampling produces illustrative wins, losses and squares. It does not add new evidence.

**Worked example:** 50 NBA wins gives smoothed rank 0.773859 and internal strength 1.230231. Ten NFL wins gives rank 0.673981 and strength 0.726247. Under neutral NBA rules, the fitted coefficient is 0.328775. Apply logistic(0.328775 × (1.230231 − 0.726247)) to get about 54.13% for A, and 45.87% for B. These are hypothetical cross-sport odds conditional on rarity matching, not a measured history of NBA teams playing NFL teams.

**Provenance:** the record counts and NBA/NHL score means come from the bundled sources in [HISTORY.md](HISTORY.md). The fit uses 834 NBA games and 870 NHL games; its slopes are 0.328775 and 0.079859. Separate home coefficients are 0.394797 and 0.097185. The regularization penalty of 4, nonnegative slope restriction, percentile smoothing, 0.12 controlled-mechanics strength response, opportunity counts, reward mixtures, game-day shock distribution, home/rest adjustments, tie decider and independent-game assumption are design choices. No claim is made that all of these were measured.

**Default controls:** scoring/opportunity/skill/form multipliers are 1, added reward volatility and home/rest adjustments are 0. Trial count 10,000 and random seed 42 are convenience defaults. The base event-rate cap at 0.95 is a numerical/modeling guardrail. The 95% simulation interval is a standard Wilson binomial interval using z≈1.96; it is not a confidence interval for real-world accuracy. The sections below give the complete formulas, presets, schedules, validation and computational tolerances.

## Record inputs, rarity and latent strength

Config v4 stores independent `recordSportA`, `recordSportB`, `recordA`, `recordB`; a `comparison` mode; `opponentRank`; `matching` (`rarity` or `recordRate`); and `basis` (`history` or `mechanics`). Record values carry the selected sport’s unit: wins for NBA/MLB/NFL, points for NHL/Premier League. `history.js` returns explicit `value`, `unit`, `games`, `max`, `rate` and `rank` fields for translated records. CSV also includes units beside the reference totals and translated paces.

Equivalent paces may be fractional after switching leagues; direct slider edits choose whole wins or points. Bounds are NBA 82 wins, NHL 168 points (84 games in 2026–27), MLB 162 wins, NFL 17 wins, Premier League 114 points (38 matches). NHL uses actual API points, checked against 2×wins + overtime/shootout losses. Premier League points are 3×wins + draws. Administrative deductions are excluded because this input describes on-field results, not disciplinary penalties. The app labels that distinction. Neither points scale changes game-score charts, which remain in goals.

Config v2 first retains its original same-league A-vs-B semantics; v3 retains its explicit comparison mode. Both migrate to v4: win-based NHL/Premier League source values are mapped from retained legacy win-percentile knots into equivalent points percentiles. Zero/perfect legacy records map to the bounds; other out-of-sample records cap at the empirical endpoints. This does not recover actual points from wins alone. A visible notice states the conversion and that the new NHL fit may change prior odds. The legacy `winRate` option becomes `recordRate` with its new denominator semantics. NBA/MLB/NFL source values stay unchanged. Abstract-rating v1 remains unsupported.

### Head-to-head (default)

Default inputs are 50 NBA wins for Team A and 10 NFL wins for Team B. Both play under one shared ruleset: NBA, one game, neutral venue and equal rest. Translate the source records into the selected sport through the chosen matching rule, then evaluate A against B. The headline shows exact model P(A wins) and 1 − P(A wins). Changing either record changes both odds. Equal rarity does not establish equal athletic ability across sports; this is a hypothetical comparison of relative standing, not players physically changing sports.

The left scenario supplies the primary matchup rules. The right scenario supplies the alternative rules and holds both source records fixed. Guided presets set a baseline on the left and an intervention on the right. Both scenarios internally report A versus B. The head-to-head result object names its scenario/rules and includes complementary exact probabilities, simulation counts/probabilities, reversed confidence-interval endpoints and the first 100 winners. B is always the complement of A in the same trials, never the right scenario’s focal-team probability. The series chart likewise shows A and B under the primary rules.

### Separate benchmark matchups (optional / legacy)

Comparison options retains benchmark mode, and existing configuration-v3 links preserve their explicit mode. In this mode A plays in its source league on the left and B in its source league on the right, each against the same opponent percentile. Default q=.5 is the middle of each league’s historical distribution, not necessarily a .500 record. Options are .25/.5/.75/.9. Changing B cannot change A’s result in this mode, and these independent probabilities need not sum to 100%.

Scenario `a` internally means the focal team in benchmark mode; scenario `b` means its opponent. The `subject` field identifies the user-facing A/B team and `headToHead` is null. NBA/NHL fits remain exploratory postseason associations; median-opponent and cross-sport applications are not independently validated forecasts.

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
| MLB | 2015–2024 | 270 | Excludes 2020; actual 161–163 games normalize cancellations/tiebreakers |
| NFL | 2015–2024 | 318 | Full 16/17-game schedules; excludes incomplete BUF/CIN 2022 |
| Premier League | 2015–16 to 2024–25 | 200 | All 38-match records; 3×wins + draws before deductions |

See [data provenance and reproduction](HISTORY.md). The reference is a fixed ten-season window, not all-time league history or the latest completed season.

## Exploratory playoff baseline fit

NBA/NHL postseason game outcomes are subsequent to the regular-season records used as features. NBA features use wins percentage; NHL features use standings points percentage, joined by season and team ID to each playoff game. Shortened regular seasons use their actual games played. Include every game in the 150 best-of-seven series per league (834 NBA, 870 NHL), including equal-record matchups. Exclude NBA play-ins, NHL 2020 qualifiers and round robin. All 2020 bubble games have home indicator zero, overriding inaccurate upstream neutral flags.

```text
P(home win) = logistic(beta * (theta_home - theta_away) + h * home_indicator)
objective = summed game negative log likelihood + 0.5 * 4 * (beta^2 + h^2)
beta >= 0
```

The fixed ridge penalty 4 is an explicit regularization choice, not a hyperparameter optimized on the holdout. A two-variable Newton solver reproduces the fit using only Python's standard library. Production coefficients are NBA beta 0.328775 / h 0.394797; NHL beta 0.079859 / h 0.097185. Games receive equal weight; longer series contribute more observations. We make no independent-game confidence claim about these coefficients.

The neutral simulator target is logistic(beta * delta). Numerically invert the baseline event model (25 bisection steps on edge [-8,8]) to find the event edge yielding this probability. Hold that edge fixed across scoring/opportunity/variance counterfactuals. Apply the user sensitivity multiplier to it. The fitted h adjusts beta during fitting but is removed for the default neutral simulation; home/rest sliders remain hypothetical event-odds controls. For sports without a fit and in controlled-mechanics mode, baseline edge is 0.12 * delta, an explicitly illustrative common coefficient.

### Temporal validation

Fit only on 2016–2022 playoffs and construct the rank distribution only from their eligible regular seasons. Evaluate on 2023–2025 playoffs without updating either. Final app coefficients are then refit on all ten postseasons; these are distinct from the held-out training coefficients stored in the validation artifact.

| League | Train/test games | Holdout Brier | Home-only Brier | Holdout log loss | Home-only log loss |
| --- | --- | ---: | ---: | ---: | ---: |
| NBA | 584 / 250 | .231355 | .243581 | .654955 | .680295 |
| NHL | 608 / 262 | .248505 | .250034 | .690184 | .693216 |

A constant 50–50 model scores Brier .25 / log loss .693147. NHL improvement is small. One temporal split, season changes, series dependence, and limited extreme-record matchups constrain this evidence. No coefficient intervals, series-cluster bootstrap, schedule adjustment or real-team forecasting claim is made.

Displayed descriptive better-record rates exclude equal NBA win percentages and equal NHL points percentages: NBA 486/778 games and 101/141 series; NHL 443/852 games and 84/147 series. These aggregate different matchups and contexts, so they are benchmarks, not targets to impose on every selected matchup. The older NHL win-percentage summary remains in the source audit (442/833 games, 84/143 series), demonstrating sensitivity to the definition of better.

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

Noise defaults are common. History mode has league-specific baseline fits for NBA/NHL; controlled-mechanics mode uses a common illustrative strength coefficient. All parameters can materially alter the ranking.

## Presets (per team)

| Sport | N | Base event probability | Conditional reward distribution | Neutral expected score before form |
| --- | ---: | ---: | --- | ---: |
| NBA | 100 | 110.259538 / 228 | 1/.06, 2/.60, 3/.34 | 110.259538 points |
| NHL | 31 | mean historical goals / 31 | 1/1.00 | about 2.96 goals |
| MLB | 38 | 0.082 | 1/.70, 2/.20, 3/.075, 4/.025 | 4.4403 runs |
| NFL | 11 | 0.40 | 3/.40, 7/.58, 8/.02 | 23.848 points |
| Soccer | 12 | 0.12 | 1/1.00 | 1.44 goals |

The notation `value/weight` describes event reward values and probabilities. These are rounded stylized assumptions. NBA events abstract full scoring possessions, including free throws. MLB events do not reconstruct innings, base/out state, or plate-appearance dependence. NFL events abstract scoring drives. Premier League chances are not an xG feed; only its record distribution is empirical.

NBA/NHL mean scores are weighted by actual team-games across all ten regular seasons; NHL totals exclude the artificial shootout-winning goal. Their baseline event probabilities reproduce those means before form noise. Opportunity counts, reward mixtures, form and home/rest scenario controls remain assumptions. The clean source snapshots and provenance are bundled in data/history; app history-data.js contains compact distributions and fit results.

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
