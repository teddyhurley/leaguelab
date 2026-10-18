# LeagueLab — Product Requirements Document

**Author:** Teddy Hurley  
**Date:** October 17, 2026  
**Product baseline:** Model v8.0.0; configuration schema v9; hosted portfolio demo  
**Status:** Requirements for the current product and its next validation cycle. Proposed success thresholds below are not measured results.

[Open LeagueLab](https://teddyhurley.github.io/leaguelab/) · [Source code](https://github.com/teddyhurley/leaguelab) · [Product decisions](PRODUCT.md) · [Architecture](ARCHITECTURE.md)

## 1. Problem, audience and job to be done

Sports fans ask why stronger teams appear more likely to advance in some sports than others. Discussions often mix scoring frequency, team strength and playoff length, making it difficult to understand what changes when only one condition changes. A statistic about historical winners cannot, by itself, explain those mechanisms.

LeagueLab must let a fan form a hypothesis, change a condition and inspect the resulting modeled difference. Familiar season records should make the starting point understandable without requiring a statistics background. The product must distinguish an educational experiment from a forecast about named teams.

The primary audience hypothesis is curious sports fans who follow at least one supported league and want to understand differences across sports. A secondary audience is a portfolio reviewer who needs to try the core experience immediately and inspect the product reasoning afterward. Independent audience interviews have not yet validated this framing; its basis is the originating question and project-owner feedback documented in [PRODUCT.md](PRODUCT.md).

**Job to be done:** “When someone says a sport is too random, help me test which mechanisms could explain it so I can make a more informed argument.”

## 2. Objectives and scope

The current release must support three outcomes: a first useful comparison without setup, a controlled experiment whose changed and unchanged conditions are clear, and a reproducible explanation that does not overstate the evidence. The opening comparison prioritizes NBA, NHL and MLB; the full lab also supports NFL and Premier League soccer.

Success means users can explain the modeled trade-off, not simply generate more trials. Product complexity should serve that learning task. A hosted link must be the primary entry point; downloading JSON or installing software must remain optional.

**Non-goals:** betting recommendations; calibrated forecasts for named teams; live standings or schedules; estimating the causal contribution of scoring to actual league outcomes; full playoff brackets, reseeding, injuries, pitching rotations or fatigue calendars; accounts, social feeds or cloud saves. Expanding to a predictive product would require a new scope and evaluation plan.

## 3. Core journeys

1. **First visit:** Open the demo, see the same team caliber compared across NBA, NHL and MLB, and switch the common format from one game to a series. Inspect one sport to understand its starting matchup.
2. **Test a hypothesis:** Carry the same teams into the experiment, change one condition such as hockey scoring or NBA series length, run it, and compare the odds and scoring-margin chart. Explain which conditions stayed fixed.
3. **Inspect the evidence:** Open the methodology, distinguish historical record rarity from inferred strength, and identify why the displayed interval does not measure real-world predictive uncertainty.
4. **Share and reproduce:** Copy an experiment link, open it in a fresh session, and recover the same validated settings and seed. Optionally download a completed result for further analysis.
5. **Recover from change:** Edit controls during or after a run, recognize that previous results do not represent those edits, then rerun or cancel without losing the chosen settings.

## 4. Functional requirements and acceptance criteria

P0 requirements protect the core experience and interpretation. P1 requirements support deeper exploration. “Implemented” refers to the source baseline; [VERIFICATION.md](VERIFICATION.md) records completed checks separately from outstanding browser and user validation.

| ID / priority | Requirement and acceptance criteria | Current status |
| --- | --- | --- |
| LL-01 · P0 | **Immediate access.** Opening the hosted URL loads an interactive default experiment without an account, API key, installation or file import. A blocked optional font must not prevent use. | Implemented; hosted demo available. |
| LL-02 · P0 | **Familiar inputs.** Each team has its own record league and bounded season-record input. NBA/MLB/NFL use wins; NHL/Premier League use points. Display the unit, season scale, reference window and historical rarity. Out-of-reference inputs must show extrapolation and capped strength. | Implemented. |
| LL-03 · P0 | **Comparable opening cards.** NBA/NHL/MLB cards must use the same selected team caliber, common format, neutral venue and standard scoring. Custom scenario changes must not silently alter those standard-rule cards. Label observed historical summaries separately. | Implemented. |
| LL-04 · P0 | **One contest, explicit outcomes.** Team A and B odds must describe the same hypothetical contest. Probabilities must normalize; a single soccer match must include draws. A series or fair-decider result must identify its different outcome rule. | Implemented; engine invariants covered by automated checks. |
| LL-05 · P0 | **Controlled experiment.** Preserve team inputs when changing scoring, opportunities, series format or context. Show the starting and experiment rules beside their results, with the difference expressed in percentage points. A guided experiment must remain editable. | Implemented. |
| LL-06 · P0 | **Readable explanation.** Assign charts to the correct scenario. Consolidate a game-one scoring chart only when effective game conditions match. An ordered explanation must reconcile the modeled change and disclose that its attribution depends on change order. | Implemented. |
| LL-07 · P0 | **Current results only.** Every run owns a validated configuration snapshot. Edits that require computation must mark prior results stale. New or canceled runs must prevent older worker responses from replacing current results; stale results cannot be exported as current. | Implemented. |
| LL-08 · P0 | **Exact and sampled results remain distinct.** Display exact model probabilities separately from seeded repeated outcomes, convergence and sampling intervals. The 100 outcome squares must represent actual sampled trials. Increasing trials must not be described as validating the model. | Implemented. |
| LL-09 · P0 | **Reproducible links.** A supported link must restore its settings and seed. Invalid or unsupported links must explain the error and leave a usable default. Supported migrations must disclose changed models; preserving settings must not promise identical odds across model versions. | Implemented. |
| LL-10 · P1 | **Portable analysis.** Completed JSON/CSV exports must identify the model, configuration, scenario roles, outcome rules and evidence limitations. Export must not be required for normal use or sharing. | Implemented. |
| LL-11 · P1 | **Five-sport exploration.** Optional league replays and benchmark mode must identify their comparison basis and stay distinct from the primary A-versus-B experiment. Switching scope must not relabel an earlier result incorrectly. | Implemented. |
| LL-12 · P0 | **Understandable limitations.** Show retrospective timing, extrapolation and relevant weak evaluation results beside affected outputs; provide equations and provenance through methodology links. User comprehension of these labels must be tested before broadening claims. | Disclosures implemented; comprehension study proposed. |

Behavioral contracts are defined in the [configuration module](../dist/src/presets.js), [interface](../dist/src/app.js), [probability engine](../dist/src/engine.js) and [sharing/export module](../dist/src/exports.js).

## 5. Data and model constraints

The record-rarity reference uses the latest 20 eligible completed regular seasons per league as of October 7, 2026. It is a fixed, versioned reference with documented exclusions and normalization, separate from the game-outcome fitting sample. The interface must preserve that distinction. Source snapshots, exact seasons and provenance belong in [HISTORY.md](HISTORY.md).

All five production fits use completed-season records against other opponents, excluding the target teams’ head-to-head meetings. They still use hindsight. Historical rarity is a disclosed strength proxy, not an estimate of pure ability. Series experiments assume simplified game relationships; pitchers, rotations and lineups are absent. Single-game soccer retains a draw outcome.

A numerical result is exact within the specified model, not an exact description of the sport. Monte Carlo intervals cover sampling error only. Rule changes and cross-sport translation remain modeled assumptions. Ordered explanations must not become claims about causal shares in real league differences.

Evaluation failures must remain visible and reproducible. MLB playoff transfer and several league subgroups do not beat all simple baselines. A release must not hide these failures or tune against held-out results and present that tuning as new validation. Proposed model changes require explicit timing, baseline comparisons and a versioned review; see [EVIDENCE.md](EVIDENCE.md), [MODEL.md](MODEL.md) and [RELEASE-MODEL-REVIEW.md](RELEASE-MODEL-REVIEW.md).

## 6. Nonfunctional and privacy requirements

- **Responsiveness:** Run heavy calculations in a browser worker with progress, cancellation and bounded inputs. The interface must remain usable through the supported 1,000–100,000 trial choices. Proposed acceptance: no page freeze during a 100,000-trial run on the agreed desktop and phone test devices; device timing remains to be recorded.
- **Accessibility:** Controls need visible labels and keyboard focus; probabilities need text equivalents; charts must distinguish scenarios beyond color. Status changes must be announced and reduced-motion preferences respected. Existing visual checks do not establish formal accessibility certification.
- **Reproducibility:** The same model, configuration and seed must reproduce the sampled result. The offline historical rebuild must agree with shipped evidence before model releases.
- **Privacy and portability:** No account, personal data, simulation API or installed analytics is required. Shared URL settings are visible to recipients and potentially the host. Optional font requests have their own network behavior. Relative assets must work under the GitHub Pages repository path. See [ARCHITECTURE.md](ARCHITECTURE.md).

## 7. Proposed success measures and validation

Run a moderated pilot with five sports fans, including people without statistics training. Record task completion and explanations manually; analytics are unnecessary for this first study. These are decision thresholds, not achieved results or population estimates.

| Measure | Proposed threshold | Product decision |
| --- | --- | --- |
| First experiment | At least 4/5 complete a counterfactual within two minutes without coaching. | Simplify the initial controls if users cannot start. |
| Mechanism comprehension | At least 4/5 distinguish a scoring change from a format change after five minutes. | Revise labels, guidance or chart placement before adding features. |
| Evidence comprehension | All five understand that displayed odds are modeled and that more trials do not validate assumptions. | Treat any forecast interpretation as a disclosure/design issue to resolve. |
| Reproduction | At least 4/5 reopen a link and identify the same settings and seed. | Fix sharing or version messages if continuity is unclear. |

Automated model invariants and deterministic checks establish implementation behavior; they do not substitute for this study. No adoption, retention or learning outcomes are claimed.

## 8. Release plan, roadmap and open questions

**Current:** Maintain the hosted portfolio demo and its direct README link. Before publishing code or model changes, run the existing source, JavaScript, Python and historical-reproduction checks; smoke-test the hosted default, one counterfactual, cancellation and a shared link on desktop and mobile.

**Next:** Complete the pilot and address its largest comprehension failures. Check keyboard/screen-reader use and document device-specific performance. Retain the focused NBA/NHL/MLB entry until evidence supports a more complex opening.

**Later, conditional on learning:** Improve model evaluation and uncertainty communication before adding sports or predictive claims. Consider stored or collaborative experiments only if repeated-use research demonstrates a need.

**Open questions:** Do fans understand percentile-equivalent caliber? Which control best communicates scoring versus format? Does the five-sport extension add useful learning or overwhelm the first session? Can users explain a weak validation result without dismissing the entire educational experiment? What motivates a second visit? Answers should change the next release’s scope, not be inferred from the existence of a working app.
