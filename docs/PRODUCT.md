# LeagueLab — product case study

**Author:** Teddy Hurley · **Release:** v8.0 · **Stage:** local prototype prepared for GitHub

## Problem and audience

Sports fans debate whether playoffs reward the strongest team or produce too many upsets. They often mix together scoring frequency, the spread of team abilities and series length. LeagueLab gives a curious fan a way to hold some of those factors fixed and explore the others.

**Job to be done:** “When someone says a sport is too random, help me test which mechanisms could explain it, so I can make a more informed argument.”

The project began with an NBA–NHL question: why does a better regular-season record translate into playoff success more reliably in basketball than hockey? That remains the motivating example. The opening state now compares 75th- versus 25th-percentile team caliber across NBA, NHL and MLB, using the same format and neutral venues. Each team retains an independent league/record input. An observed-history disclosure supports the question, separately from the selected matchup’s fitted odds.

This problem framing comes from the originating discussion and direct project-owner feedback. No independent discovery interviews or market-demand validation have been completed.

## The product

The flow follows one continuous experiment:

1. Choose Team A and Team B using familiar season records. Compare the same caliber across NBA, NHL and MLB at the same format, then inspect one matchup.
2. Carry those teams into a second scenario and change scoring mechanics, context or series length.
3. Compare the starting and experiment odds, scoring margins and ordered explanation.
4. Optionally replay the same strengths under five standard sports, inspect the methodology, or share/export the experiment.

NBA, MLB and NFL use wins. NHL and Premier League use points. League-specific historical rarity translates the records into a latent strength proxy; the interface shows how common each record was in the fixed sample. This allows comparison without claiming that 70 wins means the same thing in every sport.

## Scope decisions

| Decision | Reason and consequence |
| --- | --- |
| Five sports, with a fixed historical reference | Offers useful contrast while keeping data provenance reproducible; the app is not a live standings service |
| Separate sport mechanics from series format | Lets users test scoring changes without silently changing the number of games needed to advance |
| Hypothetical head-to-head by default | Gives A/B percentages a familiar meaning; both come from the same contest |
| Exact calculation plus Monte Carlo | Stable probabilities make comparisons clear; repeated trials make variance tangible and testable |
| Browser worker instead of a simulation API | Handles the workload without accounts, keys or ongoing server operations |
| Explicit model limitations | Makes an educational experiment defensible without presenting it as a betting or real-team prediction tool |

Deferred: named teams, live ingestion, full playoff brackets, reseeding, fatigue schedules, accounts and cloud saves. Those features add cost and model complexity before comprehension of the core experience has been tested.

## Feedback that changed the design

These were iterations with the project owner, not results from a recruited usability study.

| Observed confusion or request | Product response |
| --- | --- |
| Abstract strength values were difficult to relate to real teams | Replaced them with season records, sport-specific bounds and historical rarity; later changed hockey and Premier League to points |
| Independent “versus a typical opponent” results looked like a head-to-head | Made a single hypothetical A-versus-B contest the default, with complementary probabilities and common rules |
| The two source leagues and selected matchup rules made lower charts ambiguous | Attached odds and margin charts to the starting and experiment stages; moved standard-league replays into an explicitly optional section |
| Modified rules could be hidden by grouping charts only by sport name | Consolidated only equal effective game conditions; changed scoring keeps its own chart, while a series-only change can share a game-one chart |
| A rerun warning could scroll out of view | Added a floating update reminder and prevented stale exports |

Source-league changes rerun automatically. The shared comparison format also reruns automatically. Other simulation-setting edits mark results as stale and require an update. A run retains its own configuration snapshot so the interface cannot silently label old results with new controls.

## Technical and analytical judgment

**Validate the claimed improvement.** Replacing illustrative game baselines required collecting actual outcomes and making feature timing explicit. All five production models deliberately answer a retrospective question with season-end records, excluding all direct head-to-head meetings. The soccer source contained 66 misdated fixtures that needed correction. MLB’s playoff transfer result was worse than simple baselines; the product exposes that failure alongside its probabilities. This is a measured limitation, not a reason to tune against the test set.

**Records are evidence, not ability.** Season records include schedule strength, injuries and randomness. Historical rarity provides a disclosed proxy, not an estimate of pure skill. The interface supports comparing rarity or record percentage and flags extrapolation beyond the sample.

**Fitting is deliberately limited.** All five leagues now learn from regular-season games and use separate-season checks. NBA/NHL/NFL include all teams instead of extending a playoff-only relationship to teams that never qualified. All five use hindsight, which is explicitly labeled. Playoff results are separate transfer checks; no playoff adjustment is applied. The event model translates baseline odds into controllable scoring conditions. MLB fails playoff baselines; NFL games between two non-playoff teams and NFL/NHL/MLB games between two playoff teams also fail their subgroup baseline. The broader NBA bottom-quarter-pair check also narrowly fails home-only. Those limitations stay visible. Counterfactual event mechanisms, cross-sport translation and independent series games remain assumptions. A small holdout improvement is not broad predictive validation.

**The explanatory bridge is order dependent.** Changing opportunities, event mechanics and format can interact. The bridge reconciles the modeled change in a stated order; it does not assign measured causal shares to real-world differences.

**Precision and validity are separate.** More trials narrow simulation error, but they cannot repair an incorrect model. Exact probabilities provide a reference for testing the sampler and keep the distinction visible.

## Verification and current outcome

The deliverable is a working static app with a pure probability engine, background worker, deterministic sharing, exports, source snapshots and a reproducible historical build. Automated checks cover model invariants, sampling agreement, point-based records, legacy links, chart consolidation and local asset serving. Desktop and mobile interactions have been checked in the Codex in-app browser. See [VERIFICATION.md](VERIFICATION.md) for the scope and remaining gaps.

There are no measured adoption, retention or learning results yet. The output so far is an inspectable product and an evidence-based account of its design decisions.

## Proposed usability pilot

Recruit five sports fans across basketball, hockey and another sport, including people without statistics training. Observe each participant completing these tasks:

- Explain what each season record and the common rules selector controls.
- Predict the effect of easier hockey scoring, run it and explain the result.
- Change NBA series length and identify what stayed fixed.
- Explain whether more simulation trials make the assumptions more realistic.
- Reproduce a shared experiment in a second session.

Primary proposed threshold: four of five participants can distinguish a sport-mechanics change from a format change after five minutes. Supporting signals: first completed counterfactual within two minutes, correct interpretation of the strength translation, and successful reproduction of a link. Any interpretation as calibrated real-team odds is a comprehension issue to address. These are proposed criteria, not achieved metrics; manual observation is sufficient for the first pilot.

## Launch and post-launch plan

1. Finish the source release checks and keep the local demo available.
2. Add the source to the owner's chosen GitHub repository; publish a hosted demo only when requested.
3. Complete remaining browser/download checks and run the pilot.
4. Fix comprehension failures before adding features.
5. Extend validation with rolling temporal splits, clustered uncertainty, opponent adjustment and scoring-distribution checks before expanding predictive claims.

The portfolio narrative should connect the original question to scope, implementation, direct feedback and the next falsifiable learning goal. It should not turn planned research or a prepared release into a claim of launch success.

## Model revision: match the question to the evidence

Fans understand completed seasons. Premier League uses points caliber and retrospective comparisons, with draws as a visible third result. MLB retains wins as its input, expands learning to regular-season games and tests playoffs separately. A slightly better run-based benchmark is documented without pretending wins reveal run totals or pitchers. The product shows evidence boundaries beside results. Revised temporal comparisons remain exploratory and require independent future-season confirmation.


**Make coverage understandable.** Record rarity now uses the latest 20 eligible completed regular seasons in each league, with COVID and lockout exclusions backfilled. The 2021 MLB/NFL seasons are retained. Each slider names its window, and the model page lists counts, exact seasons and exceptions. The separate ten-season outcome evidence remains explicit; a larger rarity sample is not evidence of improved prediction.

**Keep the original question central.** A release review compared record-only models using five expanding-season evaluations and COVID sensitivity. The final choice retains NBA/NHL, changes MLB to a completed-season other-opponent rarity model, and moves their comparable probabilities into the opening experience. This is a consistent explanatory question, not a claim that retrospective inputs improve future-game forecasting. A separate NFL direct-record challenger is documented but deferred from this core release. The historical ordering supports the problem framing; experiments illustrate possible mechanisms without claiming causal shares.
