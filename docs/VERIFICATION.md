# Release verification

**Release:** model v8.0.0 / configuration v9 · **Reviewed:** October 7, 2026

This is a local release candidate. The table records what was exercised, not a claim of universal browser support or predictive accuracy.

## Automated checks

| Check | Evidence |
| --- | --- |
| `npm test` | 69 JavaScript tests: probability normalization and symmetry, exact/Monte Carlo agreement, series behavior, deterministic seeds, bounded configurations, head-to-head complements, historical mapping, points and legacy links, exports, chart consolidation and HTTP serving |
| `npm run check` | JavaScript syntax, required entry assets and release documents, unique HTML IDs and unfinished HTML placeholders |
| `npm run check:history` | Offline regeneration of all five record scales, all five coefficients, pregame/lookback features, subgroup and playoff checks and temporal validation from bundled snapshots; integer counts/structure exact, floating-point tolerance 1e-10 relative with an absolute floor of 1e-10 |
| Python model tests | 20 checks: five release-evaluation invariants, MLB completed-season ties/completion timing, date-frozen MLB records, suspended-game timing, feature/audit reproducibility, every NBA/NHL/MLB/NFL head-to-head exclusion, NFL ties, actual NHL point credits, missing-neutral rejection, both soccer head-to-head exclusions and categorical fit recovery |
| `npm run standalone` | Portable HTML generation validates the main and worker scripts |

Local execution uses Node.js 24.19.0 and Python 3. The verification scripts were invoked through their underlying Node entrypoints because this environment bundles Node without npm. GitHub workflows are configured for Node.js 22 and an Ubuntu runner with Python 3. A configured workflow is not evidence of a completed GitHub Actions run.

## Interface checks completed

Checked in the Codex in-app browser at desktop 1280px and mobile 390px:

- Independent Team A/B sport selectors; wins for NBA/MLB/NFL and points for NHL/Premier League; bounds and whole-record keyboard changes.
- A 100-point NHL record against a 70-point Premier League record; rarity and record-percentage translation; separate benchmark mode.
- Legacy win-based NHL/Premier League links convert to points and show a migration notice.
- NBA/MLB source records with NHL matchup rules; starting and experiment odds/margins remain associated with their own settings.
- Changed scoring in the same sport retains a distinct chart. Equal game conditions consolidate, including format-only changes to series length.
- Dirty-result placeholders, floating rerun reminder and export availability reflect current settings.
- Desktop and mobile layouts show no horizontal overflow in the tested states. No browser console errors were observed.
- The generated standalone app was exercised over local HTTP with its embedded worker.

Export serialization and link reproduction are covered by automated tests. The in-app browser initiated exports, but its automation did not report a saved download file. Native CSV/JSON file saving still needs verification in the target browsers.

## Remaining before a public demo launch

- Exercise the main flow and native downloads in current Safari and Chrome; those browsers were not available in the current test environment.
- Complete a keyboard-only and screen-reader pass. Native labels, live status and visible focus are implemented, but no comprehensive assistive-technology audit is claimed.
- Run the proposed comprehension pilot in [PRODUCT.md](PRODUCT.md).
- Once a GitHub repository exists, confirm its Actions run and any chosen hosting configuration.

The app has no analytics, accounts or public-launch results. [MODEL.md](MODEL.md) documents model limitations; interface checks do not establish real-world forecast quality.

## MLB and Premier League revision

The v5 suite verifies 3,800 Premier League lookback rows, independently reconstructs 36-match records, and changes both excluded fixtures to prove they cannot change their own strength features. The categorical model reproduces all three neutral outcome masses; swapping teams reverses wins/losses, and draws stay symmetric. Seeded match counts and exports include draws; hypothetical series retain fair deciders. Prior saved links migrate with a visible notice.

MLB checks cover 19,651 eligible regular games, frozen same-day records, the real suspended Yankees/Royals May–September 2019 fixture, postseason outcome exclusion and the browser strength transform. The offline rebuild reproduces the challenger comparison as well as all five fits and serialized features. Floating-point comparisons allow negligible cross-platform libm differences.

Browser checks for v5 at 1280px and 390px: an 80-point vs 50-point Premier League matchup shows 56.9% / 23.5% draw / 19.6%, with three simulated outcome counts totaling 10,000; the mobile card does not overflow. A best-of-three explicitly uses fair deciders. MLB shows its 19,651-game regular-season scope and failed playoff transfer beside results. Changing soccer scoring produces a distinct chart and counterfactual badge while the baseline remains unchanged. The model page shows separate three-outcome and binary metrics, plus the exploratory MLB limitation. No console errors were observed in these states. Safari/Chrome and native download saving remain unverified.

For v5, all 55 JavaScript and 9 Python tests passed. Source checks and a full offline rebuild pass. The preview-server check requires permission to listen on loopback; it passed once local network permission was granted. These are implementation checks, not a claim of real-team forecasting accuracy.

The v5 standalone file also passed a browser check with its embedded worker. Its default NBA odds were 54.1% / 45.9%. Mixed NBA/Premier League benchmark mode shows a three-way soccer card and explicitly labels the series chart’s one-game decider reference.


## v6: latest 20 eligible regular seasons

The v6.0.0 release passed all 60 JavaScript and 9 Python checks, including independent counts and midranks across its 2,847 records, exact season membership, 2021 MLB/NFL retention, full-season exceptions, legacy NHL ties, training-cutoff isolation and schema-v6 link migration. Offline rebuild reproduces the refitted coefficients, validation and challenger comparisons. Source/HTML checks pass.

The v6 layout was browser-tested with 20 eligible seasons beside each selector and a coverage table on the model page. Current generated counts are NBA 599, NHL 612, MLB 600, NFL 638, Premier League 400. Expanded exact-year lists include 2021 MLB/NFL. The default 50-win NBA vs 10-win NFL matchup now produces 52.8% / 47.2%. MLB/Premier League selector changes update counts and complete simulations. At 390px the tested simulator has no horizontal page overflow. No browser console errors were observed. These checks verify implementation and presentation, not improved predictive accuracy.

The final v6 standalone HTML was also exercised over local HTTP: its embedded worker completes, the expanded counts render, and no console errors appear. Both desktop and 390px model-page layouts were checked without horizontal page overflow.


## v6.0.1: isolated NBA cancellation

Included the 2012–13 Celtics (41–40) and Pacers (49–32), preserving their actual 81-game denominators. Regression checks verify that these are the only 81-game NBA rows, all 30 clubs appear in 2012–13, and each record maps to its correct fractional 82-game pace rather than treating the cancellation as a loss. The cohort contains 599 NBA rows and 2,849 total rows. The NBA fit and cutoff-limited validation are rebuilt; COVID and lockout exclusions are unchanged. Model version advances to 6.0.1; configuration schema remains v7. This data-only correction uses automated checks and an offline rebuild; the browser layout is unchanged from the earlier UI verification.

For v6.0.1, all 59 data/model/UI-logic tests passed, as did source checks and the complete offline evidence rebuild. The remaining HTTP preview test could not run: this turn’s sandbox rejects opening a localhost listener (`listen EPERM`). No server behavior or page layout changed, and the earlier v6.0.0 HTTP/browser checks remain recorded above. The packaged source regenerates both delivered standalone files byte-for-byte.


## v7: all-team regular-season lookbacks

All **63 JavaScript tests and 14 Python tests pass**, including the HTTP preview test. Source/HTML checks and the complete offline historical rebuild pass. New checks independently reconstruct every NBA/NHL/NFL full and other-opponent record, verify explicit NHL point credits and NFL tie treatment, reject unknown neutral status, and prove that changing all pairwise head-to-head outcomes cannot change those matchups’ strength features. Support warnings check each individual team as well as the gap. Version-7 links migrate to schema 8 with an explicit model-change/hindsight notice; exports include support and retrospective flags.

The browser completed a 20-win versus 30-win NBA matchup at **36.8% / 63.2%**, showing the 11,979-game all-team scope and hindsight beside the odds. NFL 4-win versus 6-win inputs show the 2,614-game fit, tie treatment and failed non-playoff subgroup. NHL 65-point versus 80-point inputs under best-of-seven show 12,200 games, independent-series assumptions and no playoff adjustment. The method page exposes regular-season, non-playoff and separate playoff evaluations, including all subgroup failures.

Desktop 1280px and mobile 390px were checked. Expanded subgroup tables fit all four columns at 390px without horizontal scrolling; tested simulator and model pages have no horizontal page overflow. No console errors appeared. The generated standalone file was tested over local HTTP: its embedded worker completes and the default matchup shows **53.2% / 46.8%**. The original file-URL tab cannot be automated under the browser’s file-access policy; reload that file manually. Earlier Safari/Chrome, native-download and assistive-technology gaps still apply.

The source archive contains the new game snapshots, audits, fitting modules and tests. Rebuilding its extracted source reproduces both delivered standalone files byte-for-byte. No publication or public deployment is part of this revision.


## Release model evaluation (app coefficients unchanged)

The [release review](RELEASE-MODEL-REVIEW.md) compares record-only candidates with five expanding-season evaluations, COVID sensitivity, calibration bins, subgroup and playoff transfer checks. Its separate core comparison reports observed stronger-record wins and standardized NBA/NHL/MLB matchups. All 19 Python tests pass, including five new evaluation tests for temporal separation, reference cutoffs, MLB head-to-head exclusion, scoring definitions and season-level paired uncertainty. The v7.0.0 app and both standalone HTML copies remain unchanged by this evaluation. New JSON evaluation snapshots and scripts are included in the refreshed source archive.

## v8 release implementation · October 7, 2026

Completed the NBA/NHL/MLB recommendation: shared-caliber overview, observed-history disclosure, MLB completed-season other-opponent fit and config-v9 migration. The NFL challenger remains deferred. All **69 JavaScript tests and 20 Python tests pass**. Source validation and the offline historical rebuild pass. The new tests protect uniform overview formats, neutral standard-rule scope despite custom scenario settings, team reversal/equality, observed counts, old-link preservation and MLB head-to-head exclusion/tie/completion-date handling.

Browser checks at 1280×900 and 390×844 confirmed 67.9%/58.2%/56.5% one-game cards and 84.5%/67.4%/63.9% best-of-seven cards. All three use the same format. Inspecting MLB shows its 22,762-game lookback and weak playoff evidence. A 1.1× MLB scoring experiment retains a separate chart and does not change standard-rule comparison odds. Stale core cards hide old probabilities. Reversing the favored record identifies Team B correctly. The fixed observed counts display 65.1%/58.6%/57.2% separately.

The portable HTML was exercised over local HTTP with its embedded worker and a config-v8 link (50 NBA wins versus 10 NFL wins, NHL starting rules, modified MLB experiment). Records/settings remained intact; the new MLB/hindsight notice appeared. The model page displays the 7,289-game MLB check and the separate 305-game NBA weak-quarter limitation. No horizontal overflow or console errors appeared in these tested states. The updated desktop proof is `docs/preview.png`.

Both output HTML files are byte-identical. The source archive includes the current working-tree source, audits, frozen evaluation and documentation. Its standalone output is regenerated after extraction and compared byte-for-byte with the delivered demo. Local only: no GitHub push or hosting deployment occurred. The earlier browser/platform and independent-user-study gaps remain open.
