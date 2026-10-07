# LeagueLab

**The better team doesn't always win. Explore why.**

An interactive sports-variance simulator built by Teddy Hurley. Choose two teams by their season records, translate those records into a shared strength scale, then change the sport or format and see how the odds move.

Compare NBA, NHL, MLB, NFL and Premier League soccer. Explore questions such as **“What if hockey had more scoring?”** and **“What if the NBA were single elimination?”** through exact probabilities, seeded simulation and scoring-margin charts.

![LeagueLab showing independent NBA and NFL season records and hypothetical head-to-head odds](docs/preview.jpg)

**Status:** working local prototype, prepared for GitHub. No public launch or completed independent usability study is claimed. Historical records ground all five input scales; NBA/NHL have exploratory playoff fits. Cross-sport matchups and rule changes are explanatory experiments, not forecasts of real teams.

## Run locally

Requires **Node.js 22+**. No package installation, account, database or API key is needed.

```sh
npm run dev
```

Open **http://127.0.0.1:4173**. To use another port, run `PORT=8080 npm run dev`.

For a portable, single-file demo:

```sh
npm run standalone
```

Open the generated `LeagueLab.html` in your browser. It embeds the interface, probability engine and worker. Optional fonts fall back to system fonts offline. Shareable links require an HTTP/HTTPS-hosted copy. The generated HTML is ignored by Git; canonical source lives in `dist/`.

## Two-minute walkthrough

1. **Choose your teams.** Start with a 50-win NBA Team A against a 10-win NFL Team B. Each record has its own league and scale. NHL and Premier League use points, matching how fans read standings.
2. **Choose their common rules.** Both teams play a hypothetical matchup under the selected sport. A and B odds describe the same contest and sum to 100%. The starting scoring-margin chart sits beside that result.
3. **Change the conditions.** Keep those teams and build an experiment from the starting matchup. Try more hockey scoring or a shorter NBA series through **Try a guided experiment**.
4. **Understand the difference.** Compare the starting and experiment results, then inspect the ordered changes behind the modeled gap. Each result identifies its rules and format. Identical game conditions share a scoring chart; modified rules retain their own chart.
5. Optionally replay the same strengths under five standard sports, inspect **The model**, or export a completed run as JSON/CSV. A floating reminder flags edits that require a rerun.

The displayed win odds and analytical charts come from exact calculations. Simulation separately shows repeated outcomes, convergence and sampling intervals. The 100 outcome squares are the first 100 actual sampled trials. More trials reduce simulation noise; they do not validate the assumptions.

## How it works

```mermaid
flowchart LR
  Records[Sport-specific season records] --> Strength[Historical rarity and latent strength]
  Strength --> Engine[Pure probability engine]
  Rules[Sport mechanics and series format] --> Engine
  Engine --> Exact[Exact score and series probabilities]
  Engine --> Trials[Seeded Monte Carlo]
  Exact --> Results[Odds, margins and controlled comparisons]
  Trials --> Results
  Worker[Browser Web Worker] --- Engine
```

| Layer | Responsibility |
| --- | --- |
| `history.js`, `history-data.js` | Historical record distributions, rarity and translated record paces |
| `presets.js` | Versioned configuration, sport assumptions and input bounds |
| `engine.js` | Score distributions, exact series odds, seeded trials and controlled comparisons |
| `worker.js` | Background computation and progress reporting |
| `app.js`, `exports.js` | Interface state, charts, sharing and reproducible exports |
| `data/history/`, `scripts/history/build.py` | Source snapshots, provenance, fitting and temporal validation |

The engine has no DOM or network dependencies. Dynamic programming computes score distributions once; simulations sample their game probabilities. A worker keeps the interface responsive. Each run owns a validated configuration snapshot, and edited or canceled runs cannot silently overwrite a newer result. See [architecture decisions](docs/ARCHITECTURE.md).

## Evidence and boundaries

The fixed reference includes **1,278 team-seasons** from 2015–16 through 2024–25, or 2015–2024 for MLB/NFL. NBA uses the SportsDataverse ESPN collection; NHL/MLB use official APIs; NFL uses nflverse; Premier League uses OpenFootball. [Historical evidence and provenance](docs/HISTORY.md) documents exact sources, exclusions and normalization.

- **Familiar inputs:** NBA 0–82 wins, NHL 0–168 points over the current 84-game schedule, MLB 0–162 wins, NFL 0–17 wins, Premier League 0–114 earned points. Premier League points exclude administrative deductions. Historical NHL records are normalized from 82-game seasons.
- **Disclosed translation:** historical rarity supplies a latent strength proxy. It is not true ability or a next-game probability. Records beyond the reference range are flagged and capped for modeling.
- **Limited fitting:** NBA/NHL baseline odds use regularized playoff fits with a 2016–2022 training / 2023–2025 holdout check. The other sports and counterfactual scoring mechanisms remain illustrative.
- **Simplified competition:** ties use a fair decider; soccer regulation draws are also reported. The model does not recreate athletes changing sports, detailed tactics or full playoff brackets.
- **Model uncertainty:** the ordered explanation depends on the order of changes. It is not a measured causal decomposition of real league differences. Sampling intervals cover Monte Carlo error only.

The in-app methodology explains the starting numbers. [MODEL.md](docs/MODEL.md) gives the equations, coefficients and limitations. Model v3 uses configuration schema v4. Older win-based NHL/Premier League links migrate to points by historical rarity with a visible notice; old NHL odds are not guaranteed to stay unchanged.

## Verify and reproduce

```sh
npm test
npm run check
npm run check:history
```

The historical check additionally requires **Python 3**. It rebuilds the five record distributions and NBA/NHL fits in a temporary directory, compares them with the shipped evidence, and leaves source files unchanged. No network is required.

To intentionally regenerate the evidence after reviewing source changes:

```sh
python3 scripts/history/build.py
```

GitHub Actions is configured to run tests, source checks and historical reproduction on pushes and pull requests. [Verification status](docs/VERIFICATION.md) separates completed checks from remaining browser and usability work.

## Hosting

`dist/` is ready for a static host; `npm run build` validates it without bundling. Serve this directory over HTTP/HTTPS rather than opening its `index.html` directly. Relative asset paths support repository subpaths.

A **manually triggered** GitHub Pages workflow is included. After adding the project to your chosen repository, select GitHub Actions as the Pages source and run **Deploy to GitHub Pages** when you want to publish. Pushing code alone does not trigger that deployment workflow. Hosting remains optional; the current demo stays local.

The app has no accounts or installed analytics and does not send simulation inputs to an API. Google Fonts is optional. Shared links contain the full experiment in the URL, which a hosting service can receive. Local hosting bindings, environment files and generated copies are excluded from Git.

## Product case study

Read [PRODUCT.md](docs/PRODUCT.md) for the original problem, scope decisions, feedback that shaped the interface, proposed pilot and launch plan. The main portfolio decisions are separating sport from format, grounding familiar records in historical rarity, communicating uncertainty, and keeping computation local without compromising reproducibility.

## License

Software: [MIT](LICENSE). Upstream historical data retain their own provenance and terms; the software license does not relicense those sources. Original sport illustrations use no league or team logos. League names are descriptive; LeagueLab is an independent project.
