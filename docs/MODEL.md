# Model specification · v8.0.0

## Evidence and scope

League-specific wins/points inputs use 2,849 team-seasons across five leagues. Baseline game probabilities in all five sports use historical outcome fits: all-team NBA/NHL/NFL regular-season lookbacks, a completed-season MLB model and a retrospective three-outcome Premier League model. MLB improves regular-season error but does not beat playoff baselines. Counterfactual scoring mechanisms remain assumptions. This is not a calibrated real-team forecast or a causal explanation of league differences.

## Plain-language walkthrough of the numbers

The app has no remote simulation backend or live odds feed. It bundles a fixed historical snapshot and performs calculations in a browser worker. Four stages connect an input to an answer:

1. **Record → normalized rate.** NBA/MLB/NFL use wins/games; NHL uses standings points/(2×games); Premier League uses earned points/(3×matches), before administrative deductions. Historical rows use actual games; the UI translates to 82 NBA / 84 NHL / 162 MLB / 17 NFL / 38 Premier League games.
2. **Record rate → historical rank → strength.** Compare the record with its league’s included team-seasons; smooth and interpolate its percentile, then apply a logit transform. Choosing rarity as a strength proxy is an assumption. It retains luck, schedule and era effects embedded in the record.
3. **Strength gap → one-game probability.** NBA/NHL/NFL use fitted regular-season lookbacks across all teams, excluding every head-to-head meeting from the records. MLB now uses the same other-opponent rarity-logit transform. Premier League uses season-end points excluding both head-to-head games and a three-outcome target. All five baseline mean scoring levels are measured; their event count and reward mixtures remain assumed. The baseline fitted edge is held fixed for counterfactuals.
4. **Game odds → format → simulated outcomes.** Exact score/series calculations provide the headline odds. Seeded sampling produces illustrative wins, losses and squares. It does not add new evidence.

**Worked example:** 50 NBA wins gives smoothed rank 0.745833 and internal strength 1.076512. Ten NFL wins gives rank 0.667449 and strength 0.696670. Under neutral NBA rules, the fitted coefficient is 0.341447. Applying logistic(beta × strength gap) gives about 53.24% for A and 46.76% for B. These are hypothetical cross-sport odds conditional on rarity matching, not a measured history of NBA teams playing NFL teams.

**Provenance:** the record counts and all five score means come from the bundled sources in [HISTORY.md](HISTORY.md). The fits use 11,979 NBA, 12,200 NHL, 22,762 MLB, 2,614 decisive NFL and 3,800 Premier League regular-season games. All coefficients and holdout results are in [EVIDENCE.md](EVIDENCE.md). The regularization penalty of 4, nonnegative slope restriction, percentile smoothing, 0.12 controlled-mechanics strength response, opportunity counts, reward mixtures, game-day shock distribution, home/rest adjustments, tie decider and independent-game assumption are design choices. No claim is made that all of these were measured.

**Default controls:** scoring/opportunity/skill/form multipliers are 1, added reward volatility and home/rest adjustments are 0. Trial count 10,000 and random seed 42 are convenience defaults. The base event-rate cap at 0.95 is a numerical/modeling guardrail. The 95% simulation interval is a standard Wilson binomial interval using z≈1.96; it is not a confidence interval for real-world accuracy. The sections below give the complete formulas, presets, schedules, validation and computational tolerances.

## Record inputs, rarity and latent strength

Config v9 stores independent `recordSportA`, `recordSportB`, `recordA`, `recordB`; a `comparison` mode; `opponentRank`; `matching` (`rarity` or `recordRate`); and `basis` (`history` or `mechanics`). Record values carry the selected sport’s unit: wins for NBA/MLB/NFL, points for NHL/Premier League. `history.js` returns explicit `value`, `unit`, `games`, `max`, `rate` and `rank` fields for translated records. CSV also includes units beside the reference totals and translated paces.

Equivalent paces may be fractional after switching leagues; direct slider edits choose whole wins or points. Bounds are NBA 82 wins, NHL 168 points (84 games in 2026–27), MLB 162 wins, NFL 17 wins, Premier League 114 points (38 matches). NHL uses actual API points, checked against 2×wins + overtime/shootout losses + legacy ties. The 2002–03 and 2003–04 reference seasons predate shootouts, so the sample mixes points-awarding eras. Premier League points are 3×wins + draws. Administrative deductions are excluded because this input describes on-field results, not disciplinary penalties. The app labels that distinction. Neither points scale changes game-score charts, which remain in goals.

Config v2 first retains its original same-league A-vs-B semantics; v3 retains its explicit comparison mode. Both migrate to v9: win-based NHL/Premier League source values are mapped from retained legacy win-percentile knots into equivalent points percentiles. Zero/perfect legacy records map to the bounds; other out-of-sample records cap at the empirical endpoints. This does not recover actual points from wins alone. A visible notice states the conversion and that the new NHL fit may change prior odds. The legacy `winRate` option becomes `recordRate` with its new denominator semantics. NBA/MLB/NFL source values stay unchanged. Versions 4/5 preserve records and settings when migrating to v9; a notice explains the revised MLB baseline and Premier League draw/strength semantics. Version 6 links preserve records/settings and disclose that expanding rarity to 20 eligible seasons can change percentiles and odds. All supported older versions also disclose the new NBA/NHL/NFL all-team lookbacks and their hindsight. Versions 7 and 8 preserve records/settings but can produce different odds; the visible notice explains the new completed-season MLB model. Abstract-rating v1 remains unsupported.

### Head-to-head (default)

Default inputs are NBA records at the 75th and 25th historical percentiles (approximately 50.1 and 32.3 wins). The opening comparison carries those percentiles across NBA, NHL and MLB, using standard scoring, neutral venues and equal rest. Its shared format is `left.series`; custom starting/experiment mechanics do not affect these standard-rule cards. The overview is hidden in legacy benchmark mode. Pending edits replace its odds with an update prompt. Both play under one shared ruleset: NBA, one game, neutral venue and equal rest. Translate the source records into the selected sport through the chosen matching rule, then evaluate A against B. The headline shows exact model P(A wins), P(B wins) and, for a single Premier League match, P(draw). Changing either record changes both odds. Equal rarity does not establish equal athletic ability across sports; this is a hypothetical comparison of relative standing, not players physically changing sports.

The left scenario supplies the primary matchup rules. The right scenario supplies the alternative rules and holds both source records fixed. Guided presets set a baseline on the left and an intervention on the right. Both scenarios internally report A versus B. The head-to-head result object names its scenario/rules and includes exact A/B/draw probabilities, simulation counts, intervals and the first 100 outcomes. Soccer match samples are A, B or D. Other formats retain complementary A/B trials. B is never the right scenario’s focal-team probability. The series chart likewise shows A and B under the primary rules.

### Separate benchmark matchups (optional / legacy)

Comparison options retains benchmark mode, and existing configuration-v3 links preserve their explicit mode. In this mode A plays in its source league on the left and B in its source league on the right, each against the same opponent percentile. Default q=.5 is the middle of each league’s historical distribution, not necessarily a .500 record. Options are .25/.5/.75/.9. Changing B cannot change A’s result in this mode, and these independent probabilities need not sum to 100%.

Scenario `a` internally means the focal team in benchmark mode; scenario `b` means its opponent. The `subject` field identifies the user-facing A/B team and `headToHead` is null. The historical fits remain associations; median-opponent and cross-sport applications are not independently validated forecasts.

For rate r = record / maximumAvailable, the rarity readout is the exact share of included historical records at or above r. Maximum available is games for wins, 2×games for NHL points, or 3×matches for Premier League points, using a 1e-10 equality tolerance. The latent proxy uses each unique observed rate's smoothed midrank:

```text
q = (count_below + 0.5 * count_equal + 0.5) / (sample_size + 1)
theta = log(q / (1 - q))
```

Linearly interpolate q between observed rates. Cap at the observed endpoints outside the sample: zero observed examples never means a theoretical zero probability. Tails are explicitly flagged in the UI. The headline empirical count is not the smoothed rank and is not the matchup win probability.

Rarity matching holds q exactly across sports and displays an inverse-interpolated equivalent record pace for each league. Small sample endpoints can require clipping the displayed equivalent; the shared q remains the proxy. Record-percentage matching holds the share of maximum available wins/points fixed and computes a different q from each league's history. Switching the slider’s reference league preserves fractional equivalent record pace and marks it ≈. Moving the slider selects whole wins or points. This avoids cumulative rounding drift between sports. Equal rarity is a comparison convention, not proof of equal underlying talent. Draws and overtime-loss points are observed in the snapshots. The NHL points distribution is not the win distribution multiplied by two; the Premier League points distribution is not the win distribution multiplied by three.

### Included historical cohorts

| League | 20 eligible seasons within | Team-seasons | Exclusions / treatment |
| --- | --- | ---: | --- |
| NBA | 2003–04 to 2025–26 | 599 | Excludes 2011–12 (lockout), 2019–20 and 2020–21 (COVID); Boston/Indiana’s 81-game 2012–13 records included and normalized by actual games. |
| NHL | 2002–03 to 2025–26 | 612 | Excludes 2004–05 and 2012–13 (lockouts), 2019–20 and 2020–21 (COVID). Includes pre-2005 ties; 82-game history normalized to 84-game pace. |
| MLB | 2006 to 2026 | 600 | Excludes 2020 (COVID); includes 2021. Completed 161–163-game records normalized by actual games. |
| NFL | 2005 to 2025 | 638 | Excludes 2020 (COVID); includes 2021. Full 16/17-game schedules normalized; incomplete BUF/CIN 2022 records omitted. |
| Premier League | 2004–05 to 2025–26 | 400 | Excludes 2019–20 and 2020–21 (COVID). Each team played 38 matches; earned points before deductions. |

The reference snapshot is October 7, 2026. `rarity-reference.json` stores every row and exact season list; `rarity-sources.json` stores retrieval hashes, completion evidence and exceptions. This expansion changes rarity and refits rank-based coefficients, but adds no game outcomes. Evaluation rank knots include only reference seasons at or before the training cutoff; the shipped current model uses all 20. COVID exclusions apply to rarity only. MLB’s primary v8 fit now uses rarity knots; the retained pregame research model uses a different transform and is not deployed.

See [data provenance and reproduction](HISTORY.md). The reference is a fixed snapshot of the latest 20 eligible completed regular seasons per league, with exclusions, rather than all-time league history.

## Historical game baseline fits

See [EVIDENCE.md](EVIDENCE.md) for cohorts, exact evaluation scores and source provenance. NBA/NHL/MLB/NFL use binary regularized logistic models fitted to regular-season games across all teams. For each pair, remove **every regular-season head-to-head meeting** from both final records; use wins/game for NBA/MLB/NFL and actual earned points/(2×games) for NHL. These other-opponent records include future results: this is a retrospective association, not a forecast. Removing the pair's own results reduces direct circularity but does not remove hindsight, schedule imbalance or dependence between observations. The app transports this relationship to the selected full-season caliber.

```text
strength = logit(historical_rank(other_opponent_record_rate))
p_home = logistic(beta * (strength_home - strength_away) + h * venue)
```

The fixed ridge penalty is 4; beta is nonnegative. Known neutral games have venue=0. NBA/NHL train through 2021–22 and evaluate 2022–23 through 2024–25; MLB/NFL train 2015–2021 and evaluates 2022–2024. Training ranks exclude later reference seasons. Final app coefficients refit on all ten regular-season outcome seasons and use the 20-season rarity scale.

One MLB tie and nine NFL ties stay in record denominators but are excluded from binary targets. The fitted probability is conditional on a decisive game. The app displays hypothetical winner-selection odds with fair deciders, not a real NFL tie model. NHL records preserve official per-game point credits, including the rare forfeited overtime-loss point; shootout decisions count as wins in the regular-season target.

Playoff outcomes never enter these primary fits. Later playoff games are a separate transfer check, with the pair's regular meetings also removed. A separate model trained on earlier playoffs is an exploratory comparison only; **no playoff coefficient adjustment is applied**. Series combine generic regular-season game odds under independence, not a directly fitted series model. NHL playoffs also have different overtime rules.

Evaluation separately reports matchups with at least one non-playoff team, both non-playoff teams and both playoff teams. NFL's both-missed subgroup and NFL/NHL's both-reached subgroups fail the home-only baseline. The app exposes these failures rather than claiming every team caliber is calibrated. Playoff membership means the retained main bracket; NHL 2020 qualifiers are excluded. The neutral target removes the separately fitted home term.

### MLB

The v8 completed-season fit uses 22,762 decisive regular-season games from 2015–2024, across all 300 team-seasons. `regular.py` removes every pair’s regular-season meeting from both final records and applies the rarity-logit formula above. One tie remains in records but is excluded as a binary target. Completed-season hindsight is intentional; the 20-prior-game threshold and twenty-game shrinkage are no longer primary model inputs.

Train 15,473 games in 2015–2021 and evaluate 7,289 in 2022–2024. Playoff transfer uses 124 later games, with the same direct-meeting exclusions and regular seasons completed before the targets (including completion dates of suspended games). Known neutral games use venue=0; missing neutral flags retain the designated-home assumption. Pitchers, lineups and rotations are absent.

The regular-season evaluation beats home-only, while playoff transfer and regular games between two eventual playoff teams fail their simple baselines. The separate pregame wins/run-based models remain reproducible research references in `mlb.py` and `mlb-model-comparison.json`. Their coefficients never enter the current browser baseline. Choosing a completed-season model answers the product’s lookback question; it does not claim better forecasting from hindsight.

### Premier League

For each of 3,800 matches, exclude **both** head-to-head fixtures from each club’s final season record. Use earned points / (3 × 36) from its other matches, ranked against completed-season points percentages. The displayed 38-match points caliber is a proxy for this other-36-match strength. Future matches are included: this is a **retrospective association**, not a pregame prediction. Removing direct head-to-head contributions reduces circularity but does not eliminate hindsight or shared-schedule dependence.

Use a symmetric Davidson three-outcome likelihood:

```text
eta = beta * (logit(rank_home) - logit(rank_away)) + h * venue
weights = [exp(eta/2), exp(drawLogWeight), exp(-eta/2)]
P(win), P(draw), P(loss) = weights / sum(weights)
objective = categorical negative log likelihood + 0.5 * 4 * (beta^2 + h^2)
beta >= 0; draw intercept unpenalized
```

Fit 2,660 matches through 2021–22, evaluate 1,140 in 2022–23 through 2024–25 with training-only rank knots, then refit all 3,800 for the app. These later-season results evaluate the hindsight relationship; they do not validate forecasting. Three-outcome Brier sums squared errors across the three outcomes (equal-thirds baseline 2/3), whereas other sports use binary Brier (50–50 baseline 1/4). Scores across these definitions must not be directly compared.

### Mapping fitted odds to mechanics

Invert the neutral event model with 25 bisection steps on [-8,8], targeting the fitted binary probability, or soccer win / (win + loss), conditional on a decisive match. For soccer, additionally multiply the negative/zero/positive margin categories by the ratios of fitted loss/draw/win masses to their baseline mechanistic masses, then normalize. Reweight score moments with the same factors. All three standard-rule soccer masses match the fit exactly. Conditional margin shapes remain unvalidated.

Hold the inverted edge and soccer category corrections fixed during counterfactual changes. They must not be recalibrated to restore the original odds after changing a rule. Modified scoring, form, home or rest is labeled a what-if. Optional controlled mode omits historical correction and uses 0.12 × rarity-logit gap. Fitted home terms are removed in neutral simulations; home/rest sliders remain hypothetical adjustments. Each team’s individual strength and the strength gap are checked against fitted support in the model’s own coordinate. Either can trigger an extrapolation warning. Being inside those ranges is a coverage check, not proof of calibration; subgroup failures remain visible.

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

A single Premier League match retains a draw as a third result after 90 minutes. Other sports and hypothetical best-of soccer series use a fair decider for model ties. The series chart explicitly includes a fair-decider one-game reference; it differs from a soccer match headline. This is not a real penalty or extra-time model.

A dynamic program tracks reachable `(wins_A, wins_B)` states and absorbs probability when either side clinches. It also derives the series-length distribution and expected games. With constant game probability it agrees with the standard binomial tail.

## Monte Carlo and uncertainty

Single-match soccer trials sample win/draw/loss directly. All other trials sample game advancement using exact per-game probabilities. Mulberry32 supplies reproducible uniform draws. The main matchup uses the supplied unsigned 32-bit seed; the alternative rules scenario uses `seed XOR 0x9e3779b9` (converted to unsigned by the RNG). Streams are reproducible pseudorandom streams, not cryptographic randomness. Trial counts are 1,000, 10,000, 50,000, or 100,000 per scenario.

Series sampling stops at clinching. Single soccer games count wins, draws and losses separately. The engine retains wins, observed series lengths, mean games, first 100 trial outcomes, and 20 convergence checkpoints. All appear in JSON; the interface intentionally focuses on the most interpretable subset. The 95% Wilson interval quantifies sampling uncertainty conditional on this model. It excludes parameter uncertainty, data uncertainty, and misspecification.

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

The release review adds five rolling temporal checks and season-bootstrap candidate comparisons. Next validation should add untouched newer outcomes, series-cluster uncertainty, opponent-adjusted strength, score/draw reliability, and alternative event models. Historical descriptive rates and the exploratory holdout check do not establish the realism of counterfactual mechanisms.

## Result contract in v8

`outcome: {win, draw, loss}` is the selected format’s headline result and drives exports, comparative tables and the bridge. `regulation` always describes game one before a decider. `single` and `probabilities` retain fair-decider advancement probabilities. `exact` and `curve` retain hypothetical decided-series calculations, including their one-game reference. `threeWay` identifies a single Premier League match. These fields have intentionally distinct meanings. The score chart deduplication remains based on game mechanics, not series length or just a league name.

## Observed history and the opening comparison

`observedBetterRecord` counts decisive regular-season games with unequal season-end record rates after removing all direct meetings. NBA is 7,610/11,691 (65.1%); NHL is 7,035/12,012 (58.6%); MLB is 12,640/22,106 (57.2%). NHL compares points percentage; NBA/MLB compare win percentage. The cohorts include different venue and record-gap mixes, so these fixed observed rates are separate from the interactive neutral, matched-percentile comparison.

`coreComparison(result)` reads the standard-rule league probabilities at `result.config.left.series` for NBA/NHL/MLB. The fit predicts approximately 67.9%/58.2%/56.5% for the 75th versus 25th percentile in one game; independent best-of-seven probabilities are 84.5%/67.4%/63.9%. Neither comparison measures the causal fraction due to scoring frequency. The NBA five-rolling-season weak-quarter warning is retained from the frozen release review; its raw game/reference hashes must match before the builder reuses it.
