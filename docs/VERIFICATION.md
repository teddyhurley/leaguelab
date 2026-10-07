# Release verification

**Release:** model v4.0.0 / configuration v5 · **Reviewed:** October 7, 2026

This is a local release candidate. The table records what was exercised, not a claim of universal browser support or predictive accuracy.

## Automated checks

| Check | Evidence |
| --- | --- |
| `npm test` | 51 tests: probability normalization and symmetry, exact/Monte Carlo agreement, series behavior, deterministic seeds, bounded configurations, head-to-head complements, historical mapping, points and legacy links, exports, chart consolidation and HTTP serving |
| `npm run check` | JavaScript syntax, required entry assets and release documents, unique HTML IDs and unfinished HTML placeholders |
| `npm run check:history` | Offline regeneration of all five record scales, all five coefficients and pregame features and temporal validation from bundled snapshots; integer counts/structure exact, floating-point tolerance 1e-10 relative with an absolute floor of 1e-10 |
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

## Historical outcome extension

Five added tests check outcome cohorts/splits, reconstruction of all MLB/NFL pre-playoff records, independent Premier League pre-date record samples, evidence labels for modified rules and weak validation, and v4-link/export compatibility. Fitted neutral-odds agreement now covers all five sports. The historical rebuild gate also verifies every serialized feature row. Data audits include EPL rescheduled-date corrections and actual NFL incomplete-season denominators. These checks verify data flow and implementation; the held-out MLB model still underperforms its baselines, as documented in [EVIDENCE.md](EVIDENCE.md).

The v4 standalone release was also checked in the in-app browser: all five evidence cards and held-out results render, MLB’s weak-validation notice appears beside its odds, NFL/Premier League use their fitted sample counts, scoring edits change the experiment badge without relabeling the starting scenario, and the default NBA 54.1% / NFL-record B 45.9% matchup is unchanged. At 390px, both methodology and the MLB matchup show no document overflow. No console errors were observed. Safari/Chrome and native download saving remain unverified.
