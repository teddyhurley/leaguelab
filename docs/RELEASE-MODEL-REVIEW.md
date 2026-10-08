# Release model review

**Decision date / source snapshot:** October 7, 2026. **App evaluated:** v7.0.0. This is the frozen v7 candidate evaluation. Version 8 implements its core NBA/NHL/MLB recommendation; see the implementation note below.

## Recommendation

Release LeagueLab as an explanation of **why a better completed-season record is more reliable in NBA games than in NHL or MLB games**. Use league-specific, all-team regular-season lookback models for that comparison. Keep record rarity as the familiar common scale, retain the current NBA/NHL fits, and replace the primary MLB pregame model with a completed-season model before presenting the three as a comparable hero view.

This is the best release choice among the tested record-only families for this product question, not a claim to have found the best possible sports forecasting model. Keep playoffs as separate transfer checks and series length as an explicit hypothetical format experiment. A record’s historical rarity is not pure team skill.

| League | Recommended release model | Reason / boundary |
| --- | --- | --- |
| NBA | Retain regular-season rarity-logit lookback | Direct evidence across all teams; simple alternatives improve slightly but do not clear the predeclared 0.001 Brier promotion threshold. |
| NHL | Retain points-based regular-season rarity-logit lookback | Same comparison basis as NBA. Alternatives improve slightly, but below the threshold; playoff-team subgroup limitations remain. |
| MLB | Use a completed-season rarity-logit lookback for the main comparison | Matches the user’s completed-season question. Its record-logit/rate-gap alternatives are effectively tied; keep the common rarity convention. The existing pregame wins model can remain a separately labeled forecasting-oriented reference. This is a change of question, not a claim that hindsight improves forecasting. |
| NFL | Direct record-gap logistic is the strongest tested challenger; secondary release priority | Improves overall error in all five evaluation seasons and clears the promotion rule, including COVID sensitivity. Both-missed-playoff error rises slightly, and extreme-record/playoff-team weaknesses remain. Keep these limitations visible if promoted. |
| Premier League | Retain three-outcome Davidson lookback | Preserve draws and points. Direct-record alternatives have lower average error, but their season-bootstrap intervals cross zero and bottom-quartile comparisons worsen. |

## Does the history support the core story?

Yes, in these bundled regular-season cohorts. “Better record” here means a higher season rate **against other opponents**, after removing every meeting between the pair. NBA/MLB use win percentage; NHL uses standings-points percentage. Equal rates and tied game targets are excluded. These are observed frequencies, not model probabilities.

| League | Better-record wins / eligible games | Observed win rate | Excluding COVID seasons |
| --- | ---: | ---: | ---: |
| NBA | 7,610 / 11,691 | 65.1% | 65.2% |
| NHL | 7,035 / 12,012 | 58.6% | 58.9% |
| MLB | 12,640 / 22,106 | 57.2% | 57.2% |

NBA/NHL outcomes cover 2015–16 through 2024–25; MLB covers 2015–2024. COVID sensitivity excludes 2019–20 and 2020–21 for NBA/NHL, and 2020 for MLB. All of these are separate from the twenty-season record-rarity reference. Observed rates mix strength gaps, venues, schedules and team composition; the differences do not isolate scoring frequency.

The ordering also appears in every broad historical percentile-gap band:

| Difference in record percentile | NBA | NHL | MLB |
| --- | ---: | ---: | ---: |
| 0–25 percentile points | 57.2% | 53.3% | 53.3% |
| 25–50 | 66.3% | 60.3% | 57.5% |
| 50–75 | 76.5% | 62.8% | 62.1% |
| 75–100 | 85.8% | 69.4% | 64.6% |

These are coarse descriptive bands, not exact matched pairs or causal controls. Counts and season breakdowns are in `release-core-comparison.json`. The NBA ordering was evaluated from the data, not imposed as a fitting constraint.

## Same relative strengths, same format

Fit the same completed-season rarity-logit family separately in each league. Compare a 75th-percentile season with a 25th-percentile season, at a neutral venue. These are model estimates; the MLB column uses the completed-season candidate now shipped in v8.

| League | Approximate input records | One game | Hypothetical best of seven |
| --- | --- | ---: | ---: |
| NBA | 50.1 vs 32.3 wins | 67.9% | 84.5% |
| NHL | 104.3 vs 82.2 points | 58.2% | 67.4% |
| MLB | 89.9 vs 72.8 wins | 56.5% | 63.9% |

The seven-game column holds game probability fixed and assumes independent games. It measures the format’s mathematical amplification of the same edge, not actual playoff-series accuracy. Both teams’ record percentiles stay fixed when switching sports. This is the recommended first comparison for the product; a physical NBA-team-versus-NFL-team matchup is a secondary hypothetical use case.

## Evaluation design

Candidates were fixed before the run: existing rarity-logit, half-credit-smoothed record-logit, a linear record-percentage gap inside a logistic model, home-only, and chance. NBA/NHL/NFL also compare an earlier-playoff-trained model. MLB’s pregame comparison includes its existing twenty-game-shrunk wins model, rarity transform and a runs-based benchmark. Premier League uses the same candidate strength transforms inside its three-outcome family.

Use five expanding-window evaluations: train the first five outcome seasons, evaluate the sixth, then add that season to training and repeat. NBA/NHL/Premier League evaluate season ends 2021–2025; MLB/NFL evaluate 2020–2024. Training reference ranks cannot use records after the cutoff. A second run removes the chosen COVID seasons from both training and evaluation. The current twenty-season reference is cutoff-filtered, not a reconstruction of each historical date’s latest twenty seasons.

Primary comparison is the equal-season mean Brier score. Also inspect game-weighted error, log loss, every season, calibration bins, playoffs, low/high record quartiles and playoff participation. Whole seasons—not individual games—are resampled for the paired descriptive uncertainty interval. Five seasons give weak uncertainty estimates; the interval does not account for all cross-season dependence or repeated model selection.

The conservative promotion rule, set before running, requires at least 0.001 improvement in equal-season Brier, lower log loss, improvement in at least four of five seasons, and a paired season-bootstrap upper bound below zero. Subgroup or COVID failures can veto a switch. The threshold is an engineering choice, not a scientific significance test. Premier League’s three-outcome Brier has a different scale from binary Brier; do not rank leagues by those error values.

These seasons have already been examined during development. The results are exploratory, not untouched confirmation. Season-end record features deliberately use hindsight; temporal separation of fitting seasons does not turn them into pregame predictions. MLB pregame and completed-season results answer different questions and must not be ranked against each other as forecasting competitors.

This follows the rationale for [time-ordered validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-of-time-series-data). [Calibration guidance](https://scikit-learn.org/stable/modules/calibration.html) also explains why lower Brier error alone does not prove that every displayed probability is calibrated; the report retains reliability bins separately.

## Comparative results

Lower error is better. “Current” for the MLB completed-season row means the comparable rarity candidate; that candidate is not yet shipped.

| Evaluation question | Current / rarity Brier | Direct record-gap Brier | Home-only Brier | Direct gap improves in |
| --- | ---: | ---: | ---: | --- |
| NBA lookback | 0.218623 | 0.217779 | 0.247914 | 5/5 seasons |
| NHL lookback | 0.234675 | 0.233710 | 0.248516 | 5/5 seasons |
| MLB pregame | 0.242502 | 0.242897 | 0.248181 | 0/5 seasons |
| NFL lookback | 0.224555 | 0.222793 | 0.249532 | 5/5 seasons |
| Premier League lookback (three outcomes) | 0.582736 | 0.580006 | 0.647441 | 4/5 seasons |
| MLB completed-season question | 0.242016 | 0.241978 | 0.248928 | 2/5 seasons |

NBA/NHL direct-record alternatives beat rarity in all five seasons, but by less than 0.001 Brier. That is useful future simplification evidence, not a large enough benefit under this release rule to introduce another strength transform. NFL’s direct-gap improvement is larger and persists without COVID. Premier League’s average improvement is uncertain across seasons. MLB’s runs benchmark has slightly lower pregame error, but it needs actual runs that the wins slider does not supply and its improvement is not stable enough to justify hiding those extra inputs.

For the completed-season MLB question, the rarity candidate beats home-only across all five rolling tests and remains better when 2020 is excluded. Its fit uses 22,762 decisive regular-season outcomes; its five evaluation seasons contain 10,616 games. A switch would require changing the browser’s MLB transform, fit metadata, link migration and evidence labels together. Reusing the current pregame coefficient with final records would not implement this candidate correctly.

## Limitations that matter for release

- **Weak-team and elite-team estimates remain uneven.** The broader five-season NBA bottom-quartile-pair sample has only 305 games and the current fit narrowly fails home-only there. NHL playoff-team pairs and NFL extreme-record/playoff-team pairs also show weaknesses. The current three-season NFL both-missed failure remains relevant even though the five-season rolling aggregate beats home-only. Changing the evaluation window is not a reason to erase the earlier warning.
- **Playoffs are a distinct question.** The proposed MLB completed-season model still fails simple playoff baselines in this rolling transfer check. The runs-based pregame benchmark changes the result slightly in the expanded window, illustrating instability rather than a validated playoff advantage. Keep generic series odds explicitly hypothetical; do not infer a playoff adjustment from the preferred test result.
- **Scoring mechanisms are not identified by record/outcome fits.** These models establish a relationship between completed-season standing and game outcomes. They do not measure what share of the NBA/NHL/MLB gap is caused by event counts, scoring frequency, talent dispersion, goalie/pitcher variation or schedule composition. The existing scoring sliders and margin distributions remain mechanistic experiments.
- **Records are noisy.** Equal historical rarity does not establish equal true talent. Schedule strength, roster changes and differing record reliability across season lengths remain in the inputs. MLB pitchers and NHL goalie choices are absent.
- **Venue evidence has limits.** NBA/NHL neutral games were independently audited. MLB retains the existing assumption that the designated home club is home except documented neutral games; missing neutral flags are not independently resolved by this evaluation.

## Release gates

1. Make the hero compare the same strong-versus-weaker completed-season calibers under NBA, NHL and MLB rules, using neutral single games initially.
2. Move the primary MLB comparison to the evaluated completed-season model, with a new model/config version and visible migration notice. Preserve the existing pregame model only as a separately labeled alternative if needed.
3. Keep observed historical frequencies, standardized model estimates and rule-change experiments distinct. Series length is the next step, with independent-game assumptions beside it.
4. Preserve subgroup/playoff cautions and add the observed weak-quarter NBA limitation from this broader check. Do not describe counterfactual effects as measured causal shares.
5. Freeze the chosen release models before evaluating an untouched newer outcome season. Record rarity currently reaches newer years than the outcome training sample; that does not provide new game-level validation.

## Reproduce and inspect

From the repository root:

```sh
python3 scripts/history/evaluate_release.py
python3 scripts/history/evaluate_core.py
python3 -m unittest discover -s tests -p 'test_release_evaluation.py'
```

Both evaluators use Python’s standard library and bundled snapshots. `data/history/release-model-evaluation.json` includes all coefficients by fold, metrics, calibration bins, subgroup/playoff results, COVID sensitivity and SHA-256 input hashes. `data/history/release-core-comparison.json` contains observed counts, percentile-gap bands and comparable one-game/series estimates. Five evaluation-specific tests protect temporal splits, cutoff ranks, MLB exclusion invariance, scoring definitions and season-level paired comparisons. The evaluation JSON retains its v7 evaluated-app version and original input hashes so the candidate comparison remains auditable.

## Implemented in v8.0.0 / config v9

The release keeps NBA/NHL coefficients, deploys the completed-season MLB rarity model and leads with the common-caliber NBA/NHL/MLB comparison. All supported old links disclose the MLB change while preserving records and scenario settings. Observed better-record counts have a separate fixed-sample disclosure. Series stay independent-game experiments and the NBA weak-quarter warning stays visible. The NFL direct-gap candidate in this review remains a deferred secondary recommendation; NFL and Premier League production coefficients are unchanged. No publication or untouched-season confirmation is claimed.
