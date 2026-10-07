# Architecture decisions

## 1. Static ES modules and a worker

The app is interaction heavy but has no server-owned data. Native modules keep the project install-free, easy to inspect, and portable to GitHub Pages. The application deliberately has a small surface: structured state, pure engine, worker adapter, rendering and semantic HTML/CSS.

A module worker isolates score-distribution calculations from the main thread. UI messages are `{id, config}`; responses are `{id, type: 'progress'|'result'|'error', ...}`. Each run owns a snapshot. Cancellation terminates the worker. New runs terminate prior workers and increment the request ID. Configuration is validated at both the interface and engine boundaries.

Tradeoff: DOM templates need careful validation and rendering boundaries. Configuration uses fixed enums and bounded numbers; arbitrary user text is not interpolated. Methodology is static trusted content. A component framework becomes useful if the application grows beyond these panels, but adds little value to v1's core workload.

## 2. Probability model before rendering

The pure engine has no DOM, network, clocks or storage. It accepts a validated configuration and returns serializable results. It can be moved into a server worker or imported by a calibration tool without copying interface logic.

Opportunity PMFs are computed with a dynamic program. Pairwise PMFs yield margin distributions, integrated over five game-day states. Series probabilities use absorbing states; Monte Carlo samples those exact game probabilities with a seeded RNG. The finite-mixture choice avoids hidden numerical integration approximations.

Bounds on sport IDs, opportunity multipliers, event volatility, series lengths, trials and shared-link length limit accidental excessive computation. The distribution cache contains at most 24 entries inside a run. Terminating the worker also releases it.

## 3. Reproducible state and export contract

`presets.js` owns the versioned input schema. URL links encode the validated configuration as base64 JSON in the `experiment` query parameter. Unknown versions fail visibly and fall back to the default lab. Results do not silently become attached to edited controls.

JSON contains model version, complete configuration, per-game probabilities, exact series results, sample totals, Wilson intervals, first 100 outcomes, convergence checkpoints, histograms, all-sport comparisons and the ordered bridge. CSV contains two scenario rows with all adjustable parameters and key results. The right RNG stream is derived from the master seed as documented in MODEL.md.

The app has no accounts or durable server state. URL query data are visible to the hosting service and anyone receiving the link; they contain only simulation settings. No secrets or personal data are needed.

## 4. Accessible visualization

Controls use native range/select/button elements with associated labels. SVG charts have titles/descriptions and distinguish scenarios with solid/dashed lines in addition to color. Probability values remain textual. Outcome grids have descriptive accessible names. Status and error messages use live regions. Keyboard focus is visible, and motion respects reduced-motion preferences.

Visual checks cover a desktop viewport and a 390px mobile viewport. This is not a formal WCAG certification or a complete assistive-technology audit.

## 5. Deployment and CI

`dist/` is the deployable app and contains its own source. Relative assets and fragment navigation support repository subpaths. A static HTTP server is provided only for local development and uses loopback by default. There are no runtime npm dependencies or install step.

GitHub Actions is configured to run model/server tests, source checks and an offline historical rebuild comparison. The rebuild runs in a temporary directory and leaves canonical files unchanged. A separate manually triggered Pages workflow runs the same checks before uploading `dist/`. Owner-specific local hosting metadata in `.openai/` is ignored by Git and excluded from the portable distribution.

Google Fonts is an optional presentation dependency. Fallback fonts preserve functionality if it is unavailable. A future offline edition can self-host appropriately licensed font files.

## 6. Scaling the next version

`scripts/history/build.py` now converts audited snapshots into a versioned browser evidence module. `history.js` owns empirical rank mapping. The engine inverts all five fitted neutral odds into a baseline scoring edge, then holds that edge fixed for counterfactuals. A separate bounded 40-entry cache stores those inversions. Config v5 stores independent record leagues and generic record values with sport-specific wins/points units, comparison mode, opponent benchmark, matching rule and baseline mode. Config v2 retains A-vs-B semantics; v2/v3 win-based NHL/Premier League records migrate through legacy empirical rarity to the points scale, with a visible migration notice. NHL uses a refitted points-based model, so old odds may change. Version 4 links preserve all records/settings and show a notice about the new MLB/NFL/Premier League fits; v1 remains rejected. `comparisonMatchup` resolves both source records into the selected rules in the default matchup mode, or a focal team and own-league benchmark in optional benchmark mode. The left scenario is the primary head-to-head; the right is the alternate rules experiment. `headToHeadOutcome` derives complementary A/B probabilities, counts and intervals from the same left-side trials. Exports identify each scenario’s role explicitly. There are still no calibrated real-team labels. Further work should validate rolling temporal splits and cluster uncertainty before broadening predictive claims.

A server API is justified only for heavy calibration, private datasets, collaboration or stored experiments. It should accept the same configuration schema, assign versioned jobs, enforce workload limits, return progress, and persist the exact model version used. Do not add a backend simply to relay a calculation the browser handles well.

## Evidence ingestion and audit

`scripts/history/empirical.py` builds pre-playoff MLB/NFL records and pre-date Premier League records from bundled clean outcomes. `feature-audit.json` exposes every predictor and its through-date. EPL date corrections and exact source hashes are retained. Historical mode requires all five fits. Result metadata carries the evidence type, fitted sample, scope, holdout weakness and extrapolation flag through JSON/CSV. Source validation distinguishes a historical baseline from modified-mechanics scenarios. See [EVIDENCE.md](EVIDENCE.md) for the validation result, including MLB’s failed comparison.
