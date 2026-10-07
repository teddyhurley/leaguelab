import { SPORTS, SERIES, defaultConfig, scenario, validateConfig, updateStartingRules } from './presets.js';
import { HISTORY } from './history-data.js';
import { recordContext, comparisonMatchup, changeRecordSport } from './history.js';
import { effectiveMechanics, scorePreviewGroups } from './engine.js';
import { experimentLink, configFromLink, exportJSON, exportCSV } from './exports.js';

const $ = id => document.getElementById(id);
const pct = p => `${(100 * p).toFixed(1)}%`;
let config = defaultConfig(), result = null, worker = null, runId = 0, dirty = false, busy = false, leagueFormat = 'single';
let toastTimer;
try {
  config = configFromLink(location.href, message => { $('migration-note').textContent = message; $('migration-note').hidden = false; }) || config;
} catch (error) { showError(`Could not load the shared experiment. ${error.message} The default lab is ready to use.`); }

function icon(sport) {
  const shapes = {
    nba: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5c8 2 8 11 0 13m13-13c-8 2-8 11 0 13"/>',
    nhl: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 5 18 5 18 0V9m-17 7v2c4 4 12 4 16 0v-2"/>',
    mlb: '<circle cx="12" cy="12" r="9"/><path d="M6 5c6 4 6 10 0 14M18 5c-6 4-6 10 0 14M7 7l3-1m-1 5 3-1m-3 5 3 1m3-9-3-1m1 5-3-1m3 5-3 1"/>',
    nfl: '<path d="M3 21C0 7 7 0 21 3c3 14-4 21-18 18Z"/><path d="m8 16 8-8M9 12l3 3m0-6 3 3M4 14l6 6M14 4l6 6"/>',
    soccer: '<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4Zm0 0V3m5 8 4-2m-6 8 3 3M9 17l-3 3m1-9L3 9"/>'
  };
  return `<svg class="sport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[sport]}</svg>`;
}
function showError(message) { $('error-banner').textContent = message; $('error-banner').hidden = false; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
function fillRange(input) { input.style.setProperty('--fill', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`); }
function setDirty() {
  dirty = true;
  $('run-caption').textContent = 'New hypothesis? Run it and see.';
  $('run-status').textContent = 'Unsimulated changes';
  updateExportState();
}
function updateExportState() {
  ['export-json', 'export-csv'].forEach(id => { $(id).disabled = !result || dirty || busy; });
  updateRerunReminder();
  renderJourney();
  marginCharts();
}
function updateRerunReminder() {
  const visible = Boolean(result && (dirty || busy));
  $('stale-banner').hidden = !visible;
  document.body.classList.toggle('has-update-bar', visible);
  $('rerun-button').disabled = busy;
  $('experiment-run').disabled = busy;
  $('experiment-run').textContent = busy ? 'Updating experiment…' : 'Run this experiment ↗';
  $('rerun-button').innerHTML = busy ? 'Updating…' : 'Update results <span aria-hidden="true">↻</span>';
  $('stale-title').textContent = busy ? (dirty ? 'More settings changed during this run.' : 'Updating your results…') : 'Your results are out of date.';
  $('stale-message').textContent = busy ? (dirty ? 'Run again when this finishes to include your latest changes.' : 'The previous results stay visible until the new run finishes.') : 'You changed the settings. Run again to update every chart.';
}
function recordNumber(value) { return Math.abs(value - Math.round(value)) < .01 ? String(Math.round(value)) : `≈${value.toFixed(1)}`; }
function recordPhrase(c, team) { const sport = c['recordSport' + team]; return `${recordNumber(c['record' + team])}-${HISTORY[sport].recordUnit === 'points' ? 'point' : 'win'} ${SPORTS[sport].name}`; }
function recordPace(m) { return `${recordNumber(m.value)} ${m.unit} / ${m.games} ${m.sport === 'soccer' ? 'matches' : 'games'}`; }
function matchupLabel(m, subject = 'A') { return `Equivalent records under these rules: ${subject} ${recordPace(m.a)} · ${m.b.benchmark ? 'benchmark' : 'B'} ${recordPace(m.b)}`; }
function subjectFor(side, c = config) { return c.comparison === 'benchmark' && side === 'right' ? 'B' : 'A'; }
function previewMatchup(side) { return comparisonMatchup(config, config[side].sport, subjectFor(side)); }
function opponentName(rank) { return ({ .25: 'below-average', .5: 'typical', .75: 'strong', .9: 'elite' })[rank]; }
function rarityText(c) {
  const share = c.atLeast ? `${(100 * c.tail).toFixed(1)}% of sample` : 'No examples in sample';
  return `<b>${c.atLeast} of ${c.sampleSize}</b> team-seasons at this pace or better<span>${share}${c.outside ? ' · Beyond observed range; model strength capped.' : ''}</span>`;
}
function syncShared() {
  $('matching').value = config.matching; $('model-basis').value = config.basis;
  $('matchup-rules').hidden = config.comparison !== 'matchup';
  $('matchup-sport').value = config.left.sport; $('matchup-series').value = config.left.series;
  $('comparison-mode').value = config.comparison; $('opponent-rank').value = config.opponentRank;
  $('opponent-controls').hidden = config.comparison !== 'benchmark'; $('matching-controls').hidden = config.comparison !== 'matchup';
  for (const team of ['a', 'b']) {
    const letter = team.toUpperCase(), sport = config['recordSport' + letter], h = HISTORY[sport];
    const id = `strength-${team}`, value = config['record' + letter], c = recordContext(sport, value / h.maxRecord);
    $(`record-sport-${team}`).value = sport;
    $(`season-note-${team}`).textContent = sport === 'nhl' ? '84-game current pace · History normalized from 82 games' : `${h.window} historical reference`;
    $(id).min = 0; $(id).max = h.maxRecord; $(id).step = 'any'; $(id).value = value;
    $(id).setAttribute('aria-label', `Season ${h.recordUnit} for Team ${letter}`);
    $(id).setAttribute('aria-valuetext', `${recordNumber(value)} ${h.recordUnit} in ${h.seasonGames} ${sport === 'soccer' ? 'matches' : 'games'}, ${SPORTS[sport].name}`);
    $(`${id}-value`).innerHTML = `${recordNumber(value)}<small> ${h.recordUnit}</small>`;
    $(`${id}-record`).textContent = `${recordPace(c)} · ${(100 * c.rate).toFixed(1)}% ${h.recordUnit === 'points' ? 'of available points' : 'win rate'}`;
    $(`${id}-rule`).textContent = sport === 'nhl' ? 'Standings points: 2 per win + 1 per overtime or shootout loss.' : sport === 'soccer' ? 'Season points: 3 per win + 1 per draw, before points deductions.' : '';
    $(`${id}-rule`).hidden = h.recordUnit !== 'points';
    $(`${id}-min`).textContent = `0 ${h.recordUnit}`;
    $(`${id}-max`).textContent = `${h.maxRecord} ${h.recordUnit}`; $(`${id}-rarity`).innerHTML = rarityText(c); fillRange($(id));
  }
  $('matching-note').innerHTML = config.comparison === 'benchmark'
    ? `Each team plays a <b>${opponentName(config.opponentRank)} opponent in its own league</b> (${Math.round(config.opponentRank * 100)}th historical percentile). Two independent matchups at the same opponent caliber. <a href="#methodology">How this comparison works ↗</a>`
    : `Translate both teams’ records by <b>${config.matching === 'rarity' ? 'historical rarity' : 'record percentage'}</b>, then play <b>A directly against B</b> under the rules you select. The two win chances total 100%. <a href="#methodology">How this comparison works ↗</a>`;
  $('trials').value = config.trials; $('seed').value = config.seed;
  for (const side of ['left', 'right']) if ($(`${side}-matchup`)) $(`${side}-matchup`).textContent = matchupLabel(previewMatchup(side), subjectFor(side));
}
function formatLabel(s) { return s.series === 1 ? 'one game' : `best of ${s.series}`; }
function carryover(c, includeExperiment = false) {
  return `<div class="carried-team team-a"><span>TEAM A · RECORD REFERENCE</span><b>${recordPhrase(c, 'A')}</b></div><div class="carried-team team-b"><span>TEAM B · RECORD REFERENCE</span><b>${recordPhrase(c, 'B')}</b></div><div class="carried-rules"><span>STARTING RULES</span><b>${SPORTS[c.left.sport].name} · ${formatLabel(c.left)}</b>${includeExperiment ? `<small>→ Experiment: ${SPORTS[c.right.sport].name} · ${formatLabel(c.right)}</small>` : ''}</div><a href="#choose-teams">Edit starting matchup ↑</a>`;
}
function renderJourney() {
  const benchmark = config.comparison === 'benchmark';
  $('experiment-context').innerHTML = carryover(config);
  $('rule-explainer').textContent = config.comparison === 'matchup' ? `${SPORTS[config.recordSportA].name} and ${SPORTS[config.recordSportB].name} supply the season records. Both teams play ${SPORTS[config.left.sport].sport.toLowerCase()} here, under ${SPORTS[config.left.sport].name} rules.` : 'Each team plays its own league benchmark.';
  $('result-context').innerHTML = result ? carryover(result.config, true) + (dirty || busy ? '<p class="carryover-status">Showing the last completed run. Update results to include your latest settings.</p>' : '') : '<p>Choose your teams and run the starting matchup above.</p>';
  $('experiment-context').classList.toggle('benchmark-context', benchmark);
  const summary = $('starting-summary');
  if (summary) summary.innerHTML = `<p class="starting-rule-title">${SPORTS[config.left.sport].name} · ${formatLabel(config.left)}</p><p class="small muted">${recordPhrase(config, 'A')} A vs ${recordPhrase(config, 'B')} B</p><p class="starting-conditions">${config.left.scoring.toFixed(1)}× scoring · ${config.left.opportunities.toFixed(1)}× opportunities</p><a href="#choose-teams">Edit sport, series or teams in step 01 ↑</a>`;
  if ($('experiment-delta')) $('experiment-delta').textContent = benchmark ? 'Team B faces its own league benchmark.' : Object.keys(config.left).every(key => config.left[key] === config.right[key]) ? 'Matches your starting rules. Change one condition to begin.' : describeChanges(config.left, config.right, ['sport', 'scoring', 'opportunities', 'sensitivity', 'volatility', 'noise', 'series', 'home', 'host', 'rest']);
}
function changeTeamLeague(team, sport) {
  config = changeRecordSport(config, team, sport);
  if (config.comparison === 'benchmark') {
    const side = team === 'A' ? 'left' : 'right';
    const next = { ...scenario(sport), series: config[side].series };
    if (side === 'left') config = updateStartingRules(config, next);
    else config.right = next;
  }
  renderEditors(); syncShared(); setDirty();
}
function renderHistory() {
  $('history-benchmarks').innerHTML = Object.entries(HISTORY).map(([sport, h]) => `<article class="history-card" style="--accent:${SPORTS[sport].color}"><div class="sport-label">${icon(sport)}<h3>${SPORTS[sport].name}</h3></div><div class="history-metrics"><p><b>${h.fit.games.toLocaleString()}</b><span>Games in the fit</span></p></div><p>${h.fit.scope} · ${h.fit.window}</p><p class="small muted">${h.fit.featureTiming}</p><a href="${h.url}" target="_blank" rel="noopener noreferrer">${h.publisher} ↗</a></article>`).join('');
  $('history-validation').innerHTML = `<h3>Did it predict later games?</h3><p>Train on the first seven seasons; test on the final three without refitting. The historical rank scale also uses training seasons only. Brier score measures probability error: lower is better, and a 50–50 prediction scores 0.250.</p><div class="validation-grid">${Object.entries(HISTORY).map(([sport, h]) => { const v = h.validation, weak = v.model.brier >= v.homeOnly.brier; return `<div class="${weak ? 'validation-weak' : ''}"><h4>${SPORTS[sport].name} · ${v.model.games} held-out games</h4><p>Train: ${v.training}<br>Test: ${v.test}</p><p>Model: <b>${v.model.brier.toFixed(4)}</b><br>Home-only baseline: <b>${v.homeOnly.brier.toFixed(4)}</b></p><p><b>${weak ? 'Did not beat the baseline.' : 'Lower error on this holdout.'}</b> ${sport === 'mlb' ? 'The record-strength fit also lost to 50–50. Historical data does not establish useful predictive improvement here.' : sport === 'nfl' ? 'Only 39 test games; the small improvement is uncertain.' : sport === 'nhl' ? 'The improvement is small.' : ''}</p></div>`; }).join('')}</div><p>Premier League draws count as half a win: validation scores the expected outcome of a fair decider, not actual penalty shootouts or a three-way win/draw/loss forecast. Its pre-match form relationship is applied to the season-pace slider, another modeling assumption. The shipped coefficients are refit on all ten seasons after this test. No holdout was used to tune settings. Series dependence, new seasons and extreme matchups limit generalization.</p>`;
}
function renderNumberGuide() {
  $('number-presets').innerHTML = `<div class="table-scroll"><table class="method-table"><caption>Historical mean scoring anchors the event model; opportunity counts and reward mixes remain assumptions</caption><thead><tr><th>Sport</th><th>Opportunities</th><th>Scoring-event chance</th><th>Reward when an event occurs</th><th>Mean score</th></tr></thead><tbody>${Object.entries(SPORTS).map(([id, s]) => {
    const mean = s.n * s.p * s.rewards.reduce((sum, [r, p]) => sum + r * p, 0);
    return `<tr><td>${s.name}</td><td>${s.n} ${s.opportunity} · assumed</td><td>${pct(s.p)} · derived from mean</td><td>${s.rewards.map(([r, p]) => `${r} ${r === 1 ? s.unit.slice(0, -1) : s.unit}: ${Number((100 * p).toFixed(2))}%`).join('<br>')}</td><td>${mean.toFixed(2)} ${s.unit}<br>Historical mean</td></tr>`;
  }).join('')}</tbody></table></div>`;
  $('number-fits').innerHTML = `<div class="table-scroll"><table class="method-table"><caption>Five historical game models; a separate home term is removed for neutral simulation</caption><thead><tr><th>League / outcomes</th><th>Games fitted</th><th>Strength coefficient</th><th>Home coefficient</th><th>Regularization</th></tr></thead><tbody>${Object.entries(HISTORY).map(([id, h]) => { const f = h.fit; return `<tr><td>${SPORTS[id].name}<br>${f.scope}</td><td>${f.games}</td><td>${f.slope.toFixed(4)}</td><td>${f.homeLogOdds.toFixed(4)}</td><td>${f.ridgePenalty} · chosen</td></tr>`; }).join('')}</tbody></table></div><p>These coefficients are learned from historical outcomes. The logistic model, regularization of 4 and nonnegative strength coefficient are modeling choices. The fitted home term separates venue from record strength; the app’s home/rest sliders remain hypothetical adjustments. For Premier League, the target gives half-win credit to draws. See the held-out checks below before interpreting a fitted coefficient as useful predictive evidence.</p>`;
}
function renderEvidence() {
  for (const [side, id] of [['left', 'starting-evidence'], ['right', 'experiment-evidence']]) {
    const r = result[side], s = result.config[side], e = r.evidence;
    const base = `${SPORTS[s.sport].name} · ${e.fitGames.toLocaleString()} historical ${s.sport === 'soccer' ? 'league matches' : 'playoff games'}`;
    $(id).classList.toggle('evidence-weak', e.weakValidation && e.kind !== 'controlled');
    $(id).innerHTML = `<b>${e.kind === 'historical' ? 'Game odds fitted to history' : e.kind === 'counterfactual' ? 'What-if built from a historical baseline' : 'Controlled mechanics · assumed skill response'}</b><p>${e.kind === 'controlled' ? 'This optional mode uses a shared assumed coefficient instead of the fitted game odds.' : `${base}. ${e.counterfactual ? 'The effect of changing these conditions is modeled, not measured.' : e.seriesDerived ? 'Series odds are calculated from those game odds; independent games are assumed.' : 'Neutral venue; season records supply the strength proxy.'}`}${s.sport === 'soccer' ? ' Soccer draws use a hypothetical fair decider.' : ''}</p>${e.weakValidation && e.kind !== 'controlled' ? '<p class="evidence-caution"><b>MLB evidence is weak:</b> this fit did not beat the simple baseline on later games.</p>' : ''}${e.outsideFit && e.kind !== 'controlled' ? '<p class="evidence-caution">This strength gap exceeds the matchups used to fit the model.</p>' : ''}<a href="#methodology">Sources & accuracy checks ↗</a>`;
  }
}
const controlSpecs = {
  scoring: { label: 'Scoring rate', min: .5, max: 3, step: .1, unit: '×', help: 'Multiply the baseline event probability.' },
  opportunities: { label: 'Opportunities', min: .5, max: 2, step: .1, unit: '×', help: 'More chances, same conversion mechanics.' },
  sensitivity: { label: 'Skill sensitivity', min: .25, max: 2, step: .05, unit: '×', help: 'How strongly ability changes event odds.' },
  volatility: { label: 'Event volatility', min: 0, max: 1, step: .05, unit: '%', help: 'Add reward variance; hold mean value fixed.' },
  noise: { label: 'Game-day form', min: 0, max: 2, step: .1, unit: '×', help: 'A shared performance shock within a game.' },
  home: { label: 'Home advantage', min: 0, max: .3, step: .01, unit: '', help: 'Log-odds edge for the home team. 0 = neutral.' },
  rest: { label: 'Focal team rest edge', min: -.2, max: .2, step: .01, unit: '', help: 'Edge for the team shown on this card, every game.' }
};
function controlValue(key, value) { const spec = controlSpecs[key]; return spec.unit === '%' ? `${Math.round(value * 100)}%` : spec.unit === '×' ? `${value.toFixed(2).replace(/0$/, '')}×` : value.toFixed(2); }
function rangeControl(side, key) {
  const s = controlSpecs[key], value = config[side][key], id = `${side}-${key}`;
  return `<div class="editor-control"><div class="control-title"><label for="${id}">${s.label}</label><output id="${id}-value" for="${id}">${controlValue(key, value)}</output></div><input id="${id}" data-side="${side}" data-key="${key}" type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${value}" aria-describedby="${id}-help"><p id="${id}-help">${s.help}</p></div>`;
}
function renderEditors() {
  $('scenario-editors').innerHTML = ['left', 'right'].map((side, i) => {
    const s = config[side], sport = SPORTS[s.sport], starting = i === 0 && config.comparison === 'matchup';
    return `<article class="scenario-editor${starting ? ' starting-editor' : ''}" style="--accent:${sport.color}"><div class="editor-heading"><h3>${icon(s.sport)}<span>${config.comparison === 'benchmark' ? 'Team ' + (i ? 'B' : 'A') : (i ? 'Your experiment' : 'Your starting point')}</span><span class="scenario-label">${i ? 'STEP 02' : 'FROM STEP 01'}</span></h3>${starting ? '' : `<div class="experiment-sport-control"><label class="field-label" for="${side}-sport">${i ? 'Experiment sport' : 'Sport for Team A'}</label><select id="${side}-sport" data-side="${side}" data-key="sport">${Object.entries(SPORTS).map(([id, x]) => `<option value="${id}" ${id === s.sport ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div>`}</div>
      ${starting ? '<div id="starting-summary"></div><details class="starting-advanced"><summary>Advanced starting conditions</summary>' : (i ? `<p id="experiment-delta" class="experiment-delta"></p>${config.comparison === 'matchup' ? '<button class="text-button" data-copy-start>Reset experiment to starting rules ↺</button>' : ''}` : '')}
      <p class="editor-matchup" id="${side}-matchup">${matchupLabel(previewMatchup(side), subjectFor(side))}</p><div class="editor-section-label">SPORT / WHAT HAPPENS IN A GAME</div><div class="editor-fields">${rangeControl(side, 'scoring')}${rangeControl(side, 'opportunities')}</div>
      <details class="advanced-controls"><summary>Advanced sport mechanics</summary><div class="editor-fields">${rangeControl(side, 'sensitivity')}${rangeControl(side, 'volatility')}${rangeControl(side, 'noise')}</div></details>
      <div class="format-controls"><div class="editor-section-label">FORMAT / HOW A WINNER IS CHOSEN</div>${starting ? '' : `<div class="format-row"><label id="${side}-series-label">Series length</label><div class="segmented" role="group" aria-labelledby="${side}-series-label">${SERIES.map(n => `<button data-side="${side}" data-series="${n}" aria-pressed="${s.series === n}" class="${s.series === n ? 'selected' : ''}">${n === 1 ? '1 game' : 'Bo' + n}</button>`).join('')}</div></div>`}
      <p class="context-summary" id="${side}-context"></p><details class="advanced-controls"><summary>Home, seeding & rest</summary><div class="editor-fields context-fields">${rangeControl(side, 'home')}${rangeControl(side, 'rest')}<div><label class="field-label" for="${side}-host">Home seed (extra home game)</label><select id="${side}-host" data-side="${side}" data-key="host"><option value="a" ${s.host === 'a' ? 'selected' : ''}>Selected team</option><option value="b" ${s.host === 'b' ? 'selected' : ''}>Opponent</option></select></div></div></details></div><p class="effective-note" id="${side}-effective"></p>${starting ? '</details>' : ''}</article>`;
  }).join('');
  document.querySelectorAll('#scenario-editors input[type=range]').forEach(fillRange);
  updateEffective('left'); updateEffective('right'); renderJourney();
}
function updateEffective(side) {
  const s = config[side], m = effectiveMechanics(s), sport = SPORTS[s.sport];
  const meanReward = m.rewards.reduce((sum, [value, weight]) => sum + value * weight, 0);
  $(`${side}-effective`).textContent = `${m.n} ${sport.opportunity} per team · ${(m.p * 100).toFixed(1)}% baseline event rate · ${(m.n * m.p * meanReward).toFixed(1)} expected ${sport.unit} per team at equal strength, before form noise.${m.capped ? ' Rate capped at 95%.' : ''}`;
  $(`${side}-context`).textContent = `${s.home ? `${s.host === 'a' ? 'Selected team' : 'Opponent'} has the home seed · ${s.home.toFixed(2)} home edge` : 'Neutral venues'} · ${s.rest ? `${s.rest > 0 ? '+' : ''}${s.rest.toFixed(2)} rest edge for selected team` : 'Equal rest'} · Fair tie decider`;
}

function card(side, r, s) {
  const sport = SPORTS[s.sport], sim = r.simulation;
  return `<article class="result-card ${s.sport}" style="--accent:${sport.color}"><div class="result-top"><div class="sport-label">${icon(s.sport)}<h3>${sport.name}<small class="card-team">Team ${r.subject}</small></h3></div><span class="format-tag">${s.series === 1 ? 'Single game' : 'Best of ' + s.series}</span></div><p class="card-matchup">${matchupLabel(r.matchup, r.subject)}<span>${r.baseline}${r.matchup.a.referenceOutside || r.matchup.b.referenceOutside || r.matchup.a.outside || r.matchup.b.outside ? ' · Record beyond sample; strength capped' : ''}</span></p><div class="result-percent">${(sim.p * 100).toFixed(1)}<small>%</small></div><p class="result-label">Team ${r.subject} ${s.series === 1 ? 'advances after a decider if tied' : 'wins the series'}</p><div class="outcome-grid" role="img" aria-label="First 100 simulated outcomes: ${sim.samples.filter(Boolean).length} selected-team wins and ${sim.samples.filter(x => !x).length} losses">${sim.samples.map(won => `<span class="outcome-dot${won ? '' : ' loss'}"></span>`).join('')}</div><p class="grid-caption"><i></i>Team ${r.subject} wins<i class="outline"></i>Opponent wins <span>· First 100 runs</span></p><div class="result-stats"><p>Game-one advancement<b>${pct(r.single)}</b></p><p>${s.series === 1 ? 'Game' : 'Series'} loss rate<b>${pct(1 - sim.p)}</b></p></div><p class="result-ci">95% simulation interval <b>${pct(sim.interval[0])}–${pct(sim.interval[1])}</b><br>Exact model: ${pct(r.exact.win)} · Mean games: ${r.exact.expectedGames.toFixed(2)}<br>Model ties in game one: ${pct(r.draw)}</p></article>`;
}
function ordinal(n) { return `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`; }
function sourceRecord(c, team) {
  const sport = c['recordSport' + team];
  return `${recordNumber(c['record' + team])} ${HISTORY[sport].recordUnit} / ${HISTORY[sport].seasonGames} ${sport === 'soccer' ? 'matches' : 'games'}`;
}
function pairedPercent(p) { const a = Math.round(p * 1000); return { a: (a / 10).toFixed(1), b: ((1000 - a) / 10).toFixed(1) }; }
function duelCard() {
  const c = result.config, r = result.left, odds = result.headToHead, s = c.left;
  const format = s.series === 1 ? 'One game' : 'Best of ' + s.series, display = pairedPercent(odds.exact.a);
  const teamCard = team => {
    const key = team.toLowerCase(), sport = c['recordSport' + team], m = r.matchup[key];
    return `<section class="duel-team team-${key}"><div class="duel-team-title">${icon(sport)}<h3>Team ${team}<small>${SPORTS[sport].name} record</small></h3></div><p class="duel-record">${sourceRecord(c, team)}</p><div class="duel-percent" data-team="${team}">${display[key]}<small>%</small></div><p class="duel-win">chance to beat Team ${team === 'A' ? 'B' : 'A'}</p><p class="duel-loss">${display[key === 'a' ? 'b' : 'a']}% chance to lose</p><p class="duel-translation">${ordinal(Math.round(m.strength))} strength percentile${sport !== s.sport ? `<br>${recordPace(m)} under ${SPORTS[s.sport].name} rules` : ''}</p></section>`;
  };
  return `<article class="duel-card"><div class="duel-context"><span>${SPORTS[s.sport].name} rules · ${format}</span><span>EXACT MODEL ODDS</span></div><div class="duel-teams">${teamCard('A')}<span class="duel-vs" aria-hidden="true">VS</span>${teamCard('B')}</div><div class="duel-bar" role="img" aria-label="Team A ${pct(odds.exact.a)}, Team B ${pct(odds.exact.b)}"><span style="width:${100 * odds.exact.a}%"></span></div><div class="duel-simulation"><div><p class="eyebrow">${odds.simulation.trials.toLocaleString()} SIMULATED MATCHUPS</p><p class="simulation-counts"><b class="team-a">A won ${odds.simulation.winsA.toLocaleString()}</b><span> / </span><b class="team-b">B won ${odds.simulation.winsB.toLocaleString()}</b></p><p class="small muted">One matchup per square · first 100 runs</p></div><div class="duel-grid" role="img" aria-label="First 100 matchups: ${odds.simulation.winners.filter(x => x === 'A').length} Team A wins, ${odds.simulation.winners.filter(x => x === 'B').length} Team B wins">${odds.simulation.winners.map(winner => `<span class="winner-${winner.toLowerCase()}"></span>`).join('')}</div></div><details class="duel-details"><summary>Simulation detail & assumptions</summary><p>${SPORTS[s.sport].name} baseline: ${r.baseline}. ${s.home ? 'Home advantage enabled' : 'Neutral venues'} · ${s.rest ? 'Rest adjustment enabled' : 'Equal rest'}.</p><p>Simulated wins: A ${pct(odds.simulation.pA)} / B ${pct(odds.simulation.pB)}. 95% simulation intervals: A ${odds.simulation.intervalA.map(pct).join('–')}; B ${odds.simulation.intervalB.map(pct).join('–')}. These measure sampling error only.</p><p>Model ties in game one: ${pct(r.draw)}. A fair decider always chooses a winner. Mean games played: ${r.exact.expectedGames.toFixed(2)}.</p>${r.matchup.a.referenceOutside || r.matchup.b.referenceOutside || r.matchup.a.outside || r.matchup.b.outside ? '<p>At least one record is beyond the historical sample. Its modeled strength is capped.</p>' : ''}</details></article>`;
}
function renderCards() {
  const c = result.config, direct = c.comparison === 'matchup';
  $('comparison-cards').classList.toggle('head-to-head', direct);
  $('comparison-heading').textContent = direct ? `A vs B under ${SPORTS[c.left.sport].name} rules` : 'Two separate benchmark matchups';
  $('series-note').textContent = direct ? `${recordPair(c)}. Both play under your starting ${SPORTS[c.left.sport].name} rules. Only series length changes in this chart.` : 'Chance each team beats its separate benchmark opponent.';
  $('series-summary').textContent = `Explore series length under ${SPORTS[c.left.sport].name} rules`;
  $('starting-result-caption').textContent = direct ? `${recordPair(c)}. Both play ${SPORTS[c.left.sport].sport.toLowerCase()} · ${formatLabel(c.left)}.` : 'Each selected record faces its own league benchmark.';
  $('experiment-result-heading').textContent = direct ? `The same A vs B under ${SPORTS[c.right.sport].name} rules` : `Team B under ${SPORTS[c.right.sport].name} rules`;
  $('experiment-result-caption').textContent = direct ? `${recordPair(c)}. Use the experiment settings from step 02 · ${formatLabel(c.right)}.` : 'Team B faces its own benchmark with the step 02 settings.';
  $('experiment-output-note').innerHTML = `<p>${describeChanges(c.left, c.right, ['sport', 'scoring', 'opportunities', 'sensitivity', 'volatility', 'noise', 'series', 'home', 'host', 'rest'])}</p><a href="#understand">See why the odds changed ↓</a>`;
  $('alternate-result').hidden = false;
  if (direct) {
    $('comparison-cards').innerHTML = duelCard();
    const gap = result.left.exact.win - .5, favorite = gap >= 0 ? 'A' : 'B', alternative = pairedPercent(result.right.exact.win);
    $('insight-strip').innerHTML = `<span aria-hidden="true">↗</span><p><b>${Math.abs(gap) < .0005 ? 'An evenly matched contest.' : `Team ${favorite} is favored under ${SPORTS[c.left.sport].name} rules.`}</b> ${c.recordSportA !== c.recordSportB ? 'Cross-sport records are translated into relative strengths; these are hypothetical odds.' : 'The selected records set relative strength; these are hypothetical odds.'}</p>`;
    $('alternate-result').innerHTML = `<div class="experiment-odds-pair"><div><span>Starting · ${SPORTS[c.left.sport].name}</span><b>${pct(result.left.exact.win)}</b><small>Team A wins · ${formatLabel(c.left)}</small><small>Team B wins: ${pct(1 - result.left.exact.win)}</small></div><span class="odds-arrow" aria-hidden="true">→</span><div><span>Experiment · ${SPORTS[c.right.sport].name}</span><b>${alternative.a}%</b><small>Team A wins · ${formatLabel(c.right)}</small><small>Team B wins: ${alternative.b}%</small></div></div>`;
    return;
  }
  $('comparison-cards').innerHTML = card('left', result.left, c.left) + card('right', result.right, c.right);
  $('alternate-result').innerHTML = `<p>Team B beats its benchmark: <b>${pct(result.right.exact.win)}</b> · ${formatLabel(c.right)}</p>`;
  $('insight-strip').innerHTML = `<span aria-hidden="true">↗</span><p>Each team faces a ${opponentName(c.opponentRank)} opponent in its own sport. These are separate matchups. Choose “Head to head” in Comparison options for A vs B.</p>`;
}
function seriesChart() {
  if (result.config.comparison === 'matchup') return duelSeriesChart();
  const width = 780, height = 174, x = i => 47 + i * 227, y = p => 136 - (p - .35) / .65 * 118;
  const lines = [.4, .6, .8, 1].map(p => `<line x1="47" x2="742" y1="${y(p)}" y2="${y(p)}" stroke="#dce1d3" stroke-dasharray="3 4"/><text x="32" y="${y(p) + 3}" text-anchor="end" fill="#78836f" font-size="9">${Math.round(p * 100)}%</text>`).join('');
  // Extend the domain for configurations with a strong disadvantage to Team A.
  const min = Math.min(...result.left.curve.map(c => c.win), ...result.right.curve.map(c => c.win));
  const yMin = min < .35 ? 0 : .35, mapY = p => 136 - (p - yMin) / (1 - yMin) * 118;
  const axes = yMin === .35 ? lines : [0, .25, .5, .75, 1].map(p => `<line x1="47" x2="742" y1="${mapY(p)}" y2="${mapY(p)}" stroke="#dce1d3" stroke-dasharray="3 4"/><text x="32" y="${mapY(p) + 3}" text-anchor="end" fill="#78836f" font-size="9">${Math.round(p * 100)}%</text>`).join('');
  const paths = ['left', 'right'].map((side, sideIndex) => {
    const color = SPORTS[result.config[side].sport].color, points = result[side].curve.map((c, i) => `${x(i)},${mapY(c.win)}`).join(' ');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" ${sideIndex ? 'stroke-dasharray="6 4"' : ''}/>${result[side].curve.map((c, i) => `<circle cx="${x(i)}" cy="${mapY(c.win)}" r="4" fill="${color}" stroke="#f5f3ec" stroke-width="2"><title>${side} ${SPORTS[result.config[side].sport].name}: best of ${c.series}, ${pct(c.win)}</title></circle>`).join('')}<text x="755" y="${mapY(result[side].curve[3].win) + (sideIndex ? 12 : -7)}" text-anchor="end" fill="${color}" font-size="10" font-weight="600">${pct(result[side].curve[3].win)}</text>`;
  }).join('');
  const desc = ['left', 'right'].map(side => `${SPORTS[result.config[side].sport].name} ${side}: ${result[side].curve.map(c => `best of ${c.series}: ${pct(c.win)}`).join(', ')}`).join('. ');
  $('series-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="series-title series-description"><title id="series-title">Effect of series length on advancement</title><desc id="series-description">${desc}</desc>${axes}${paths}${SERIES.map((n, i) => `<text x="${x(i)}" y="165" text-anchor="middle" fill="#68745f" font-size="10">${n === 1 ? 'Single game' : 'Best of ' + n}</text>`).join('')}</svg><div class="chart-legend">${['left', 'right'].map(side => `<span><i class="legend-dot" style="--color:${SPORTS[result.config[side].sport].color}"></i>${SPORTS[result.config[side].sport].name} · ${side} ${side === 'right' ? '(dashed)' : '(solid)'}</span>`).join('')}</div>`;
}
function duelSeriesChart() {
  const x = i => 47 + i * 227, y = p => 136 - p * 118;
  const axes = [0, .25, .5, .75, 1].map(p => `<line x1="47" x2="742" y1="${y(p)}" y2="${y(p)}" stroke="#dce1d3" stroke-dasharray="3 4"/><text x="32" y="${y(p) + 3}" text-anchor="end" fill="#78836f" font-size="9">${Math.round(p * 100)}%</text>`).join('');
  const paths = ['A', 'B'].map(team => {
    const color = team === 'A' ? '#c8542c' : '#397c92', curve = result.left.curve.map(c => ({ ...c, win: team === 'A' ? c.win : 1 - c.win }));
    return `<polyline points="${curve.map((c, i) => `${x(i)},${y(c.win)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${team === 'B' ? 'stroke-dasharray="6 4"' : ''}/>${curve.map((c, i) => `<circle cx="${x(i)}" cy="${y(c.win)}" r="4" fill="${color}"><title>Team ${team}, best of ${c.series}: ${pct(c.win)}</title></circle>`).join('')}`;
  }).join('');
  $('series-chart').innerHTML = `<svg viewBox="0 0 780 174" role="img" aria-label="Team A and Team B win probabilities by series length under ${SPORTS[result.config.left.sport].name} rules"><desc>${result.left.curve.map(c => `Best of ${c.series}: A ${pct(c.win)}, B ${pct(1 - c.win)}`).join('. ')}</desc>${axes}${paths}${SERIES.map((n, i) => `<text x="${x(i)}" y="165" text-anchor="middle" fill="#68745f" font-size="10">${n === 1 ? 'Single game' : 'Best of ' + n}</text>`).join('')}</svg><div class="chart-legend"><span><i class="legend-dot" style="--color:#c8542c"></i>Team A wins (solid)</span><span><i class="legend-dot" style="--color:#397c92"></i>Team B wins (dashed)</span></div>`;
}
function describeChanges(a, b, keys) {
  const names = { sport: 'Sport', scoring: 'Scoring rate', opportunities: 'Opportunities', sensitivity: 'Skill sensitivity', volatility: 'Event volatility', noise: 'Game-day form', series: 'Format', home: 'Home edge', host: 'Home seed', rest: 'Rest edge' };
  const value = (key, v) => key === 'sport' ? SPORTS[v].name : key === 'series' ? (v === 1 ? 'one game' : 'best of ' + v) : key === 'host' ? `Team ${v.toUpperCase()}` : controlValue(key, v);
  const changes = keys.filter(key => a[key] !== b[key]).map(key => `${names[key]}: ${value(key, a[key])} → ${value(key, b[key])}`);
  return changes.length ? changes.join(' · ') : 'These settings are the same in both scenarios.';
}
function bridgeChart() {
  const c = result.config, benchmark = c.comparison === 'benchmark', start = result.bridge[0], end = result.bridge.at(-1);
  const ticks = p => Math.round(p * 10000), odds = p => `${(ticks(p) / 100).toFixed(2)}%`;
  // Use displayed hundredths for the arithmetic so the explanation reconciles.
  const delta = (ticks(end) - ticks(start)) / 100;
  const action = delta === 0 ? 'leaves the chance unchanged at this precision' : `${delta > 0 ? 'raises' : 'lowers'} the chance by ${Math.abs(delta).toFixed(2)} percentage points`;
  $('bridge-heading').textContent = benchmark ? 'Why do these win chances differ?' : 'Why did Team A’s chance change?';
  $('bridge-intro').textContent = benchmark ? 'These are separate benchmark matchups. First change the selected team, then the rules. Each row shows that selected team’s win chance.' : 'Keep A and B fixed. Each row shows Team A’s win chance after one group of settings changes; the next row builds on it.';
  const steps = [
    ...(benchmark ? [{ title: 'Change the selected team', detail: `Team A (${sourceRecord(c, 'A')}, ${SPORTS[c.recordSportA].name}) → Team B (${sourceRecord(c, 'B')}, ${SPORTS[c.recordSportB].name}). Keep the main rules and opponent caliber.` }] : []),
    { title: 'Change the sport & scoring', detail: describeChanges(c.left, c.right, ['sport', 'scoring', 'opportunities', 'sensitivity', 'volatility', 'noise']) + (c.left.sport !== c.right.sport ? ' This also changes the league baseline and record translation.' : '') },
    { title: 'Change the series length', detail: describeChanges(c.left, c.right, ['series']) },
    { title: 'Change home advantage & rest', detail: describeChanges(c.left, c.right, ['home', 'host', 'rest']) }
  ];
  $('bridge-chart').innerHTML = `<div class="bridge-summary"><div><span>Starting rules · step 01</span><b>${odds(start)}</b></div><span class="bridge-arrow" aria-hidden="true">→</span><div><span>Experiment · step 02</span><b>${odds(end)}</b></div></div><p class="bridge-takeaway">Your experiment <b>${action}</b>${benchmark ? '.' : ' for Team A.'}</p><ol class="explanation-steps">${steps.map((step, i) => {
    const before = result.bridge[i], after = result.bridge[i + 1], change = (ticks(after) - ticks(before)) / 100;
    const changeText = change === 0 ? 'No change at the precision shown' : `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(2)} percentage points`;
    return `<li><div class="explanation-step-top"><b>${step.title}</b><span>${odds(before)} → ${odds(after)}</span></div><p>${step.detail}</p><span class="step-change${change === 0 ? ' unchanged' : ''}">${changeText}</span></li>`;
  }).join('')}</ol><div class="experiment-score-note"><b>Experiment score · ${SPORTS[c.right.sport].name}</b><p>Model average: ${result.right.scoreA.toFixed(1)}–${result.right.scoreB.toFixed(1)} ${SPORTS[c.right.sport].unit} in game one, before a tie decider.</p><a href="#change-conditions">Adjust the experiment ↑</a></div>`;
}
function recordPair(c) { return `A: ${recordPhrase(c, 'A')} record vs B: ${recordPhrase(c, 'B')} record`; }
function scoreStage(r) { return r.roles.includes('matchup') ? 'starting' : r.roles.includes('experiment') ? 'experiment' : 'league'; }
function scoreDestination(r) { return scoreStage(r) === 'league' ? 'source-league-scores' : `${scoreStage(r)}-score`; }
function scorePreviewTitle(r) {
  return `${SPORTS[r.sport].name} rules · ${SPORTS[r.sport].unit}`;
}
function scorePreviewConditions(r) {
  const s = r.rules;
  return `${s.scoring.toFixed(1)}× scoring · ${s.opportunities.toFixed(1)}× opportunities · ${s.home ? `Home edge: ${s.home.toFixed(2)} for ${s.host === 'a' ? 'Team ' + r.subject : 'opponent'}` : 'Neutral venue'} · ${s.rest ? `Rest edge: ${s.rest > 0 ? '+' : ''}${s.rest.toFixed(2)}` : 'Equal rest'}${s.sensitivity !== 1 ? ` · Skill sensitivity: ${controlValue('sensitivity', s.sensitivity)}` : ''}${s.volatility ? ` · Event volatility: ${controlValue('volatility', s.volatility)}` : ''}${s.noise !== 1 ? ` · Game-day form: ${controlValue('noise', s.noise)}` : ''}`;
}
function scoreChart(r, c) {
  const direct = c.comparison === 'matchup';
    const { bins, radius } = r.distribution, sport = SPORTS[r.sport], max = Math.max(...bins.map(b => b.probability));
    const rulesLabel = scorePreviewConditions(r);
    const binSize = r.distribution.width;
    const w = 440, h = 110, plot = 400, barW = plot / bins.length, focal = direct ? 'A' : r.subject, other = direct ? 'B' : 'opponent';
    return `<div class="margin-chart${r.roles.includes('matchup') ? ' chosen-matchup-chart' : ''}${r.roles.includes('experiment') && !r.roles.includes('matchup') ? ' experiment-score-chart' : ''}" data-sport="${r.sport}" data-roles="${r.roles.join(',')}" data-unit="${sport.unit}"><div class="margin-chart-label"><b>${icon(r.sport)}${scorePreviewTitle(r)}</b><span>Model average score ${r.scoreA.toFixed(1)}–${r.scoreB.toFixed(1)} ${sport.unit}</span></div><p class="score-matchup-context">${c.comparison === 'matchup' ? `${recordPair(c)}. Both play ${sport.sport.toLowerCase()} here.` : `Team ${r.subject} (${recordPhrase(c, r.subject)} record) vs its benchmark.`}</p><p class="score-preview-settings">${rulesLabel}</p><p class="margin-units"><b>${sport.sport} · ${sport.unit}</b><br>${direct ? 'A’s score minus B’s score' : `Team ${focal}’s score minus opponent’s score`} · ${sport.unit}</p><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${sport.name} regulation scoring margin. Negative values favor ${other}; positive values favor Team ${focal}."><text x="20" y="10" font-size="9" fill="#78836f">${binSize === 1 ? 'Chance of this margin' : `Chance of this ${binSize}-${sport.unit === 'goals' ? 'goal' : sport.unit === 'runs' ? 'run' : 'point'} band`}</text><text x="420" y="10" text-anchor="end" font-size="9" fill="#78836f">Tallest bar: ${pct(max)}</text>${bins.map((b, i) => `<rect x="${20 + i * barW}" y="${79 - b.probability / max * 52}" width="${Math.max(1, barW - 2)}" height="${b.probability / max * 52}" rx="1" fill="${b.x < 0 ? '#397c92' : b.x > 0 ? '#c8542c' : '#849875'}"><title>Margin ${binSize === 1 ? b.x : `${b.x - (binSize - 1) / 2} to ${b.x + (binSize - 1) / 2}`} ${sport.unit}: ${pct(b.probability)} probability</title></rect>`).join('')}<line x1="220" y1="22" x2="220" y2="82" stroke="#808e73" stroke-dasharray="2 3"/><line x1="20" y1="81" x2="420" y2="81" stroke="#bbc7ad"/><text x="20" y="103" font-size="10" fill="#397c92">−${radius} · ${direct ? 'B' : 'Opponent'} ahead</text><text x="220" y="103" text-anchor="middle" font-size="10" fill="#79876d">0 · tied</text><text x="420" y="103" text-anchor="end" font-size="10" fill="#c8542c">${focal} ahead · +${radius}</text></svg><p class="margin-readout">${binSize > 1 ? `Each bar groups ${binSize} adjacent margins; the center bar includes close wins and ties.<br>` : ''}Team ${focal} leads after regulation: <b>${pct(r.single - r.draw / 2)}</b> · Tied: <b>${pct(r.draw)}</b> · ${direct ? 'Team B' : 'Opponent'} leads: <b>${pct(1 - r.single - r.draw / 2)}</b></p></div>`;

}
function marginCharts() {
  const pending = !result || dirty || busy, c = pending ? config : result.config;
  const groups = pending ? scorePreviewGroups(c) : result.scorePreviews;
  const starting = groups.find(r => r.roles.includes('matchup'));
  const experiment = groups.find(r => r.roles.includes('experiment'));
  const pendingCard = r => `<div class="score-preview-pending" data-sport="${r.sport}" data-roles="${r.roles.join(',')}"><b>${scorePreviewTitle(r)}</b><p>${busy ? 'Calculating this scoring margin…' : 'Settings changed. Update results to see this scoring margin.'}</p></div>`;
  const render = r => pending ? pendingCard(r) : scoreChart(r, c);
  $('starting-margin-heading').textContent = `How close could the ${SPORTS[c.left.sport].name} game be?`;
  $('starting-margin-note').textContent = c.comparison === 'matchup' ? `Your starting A vs B matchup, using ${SPORTS[c.left.sport].name} rules. This chart shows the margin in ${SPORTS[c.left.sport].unit} for one game.` : 'Team A against its league benchmark, using the starting settings.';
  $('starting-margin-chart').innerHTML = render(starting);
  $('experiment-margin-heading').textContent = `How close could the experiment game be?`;
  $('experiment-margin-note').textContent = `${SPORTS[c.right.sport].name} rules · ${c.right.scoring.toFixed(1)}× scoring · ${c.right.opportunities.toFixed(1)}× opportunities. Modeled scores for one game, before a tie decider.`;
  $('experiment-margin-chart').innerHTML = scoreStage(experiment) === 'starting'
    ? `<div class="shared-score-note"><b>Same game conditions. Same scoring margin.</b><p>The experiment shares the starting ${SPORTS[experiment.sport].name} score chart. Series length can change the chance of winning the series without changing one game’s margin.</p><a href="#starting-score">View the shared ${SPORTS[experiment.sport].name} chart ↑</a></div>` : render(experiment);
  const sourceGroups = groups.filter(r => r.roles.some(role => role === 'teamA' || role === 'teamB'));
  const sourceNames = [...new Set([c.recordSportA, c.recordSportB])].map(id => SPORTS[id].name).join(' & ');
  $('source-score-summary').textContent = c.comparison === 'matchup' ? `Scoring margins if both teams played under ${sourceNames} rules` : 'Scoring margins for the separate benchmark matchups';
  $('source-score-note').textContent = c.comparison === 'matchup' ? `${recordPair(c)}. These optional replays use the same team strengths under each record league’s standard rules. Your chosen starting game uses ${SPORTS[c.left.sport].name} rules in step 01.` : 'Standard-rule scoring margins for the two own-league benchmark matchups.';
  $('source-score-links').innerHTML = sourceGroups.filter(r => scoreStage(r) !== 'league').map(r => `<p class="shared-source-link">${SPORTS[r.sport].name} uses the same game conditions as ${scoreStage(r) === 'starting' ? 'your starting matchup' : 'your experiment'}. <a href="#${scoreDestination(r)}">View its existing score chart ↑</a></p>`).join('');
  $('league-margin-charts').innerHTML = sourceGroups.filter(r => scoreStage(r) === 'league').map(render).join('');
}

function outcomeComparison() {
  const c = result.config, direct = c.comparison === 'matchup';
  $('outcome-comparison-note').textContent = direct ? recordPair(c) + '. These are the two completed scenarios above.' : 'Starting column: Team A vs its benchmark. Experiment column: Team B vs its benchmark.';
  const heading = side => `<b>${side === 'left' ? 'Starting · step 01' : 'Experiment · step 02'}</b><span>${SPORTS[c[side].sport].name} · ${formatLabel(c[side])}</span><small>${c[side].scoring.toFixed(1)}× scoring · ${c[side].opportunities.toFixed(1)}× opportunities</small>`;
  const rows = [
    [direct ? 'Team A wins' : 'Selected team wins', side => pct(result[side].exact.win)],
    [direct ? 'Team B wins' : 'Opponent wins', side => pct(1 - result[side].exact.win)],
    [direct ? 'Average score · A–B' : 'Average score · selected–opponent', side => `${result[side].scoreA.toFixed(1)}–${result[side].scoreB.toFixed(1)} ${SPORTS[c[side].sport].unit}`],
    ['Model ties · game one', side => pct(result[side].draw)],
    ['Average games played', side => result[side].exact.expectedGames.toFixed(2)]
  ];
  $('outcome-comparison').innerHTML = `<table class="outcome-table"><caption class="sr-only">Starting and experiment outcomes for the selected team records</caption><thead><tr><th scope="col">Result</th><th scope="col">${heading('left')}</th><th scope="col">${heading('right')}</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value('left')}</td><td>${value('right')}</td></tr>`).join('')}</tbody></table><div class="outcome-chart-links"><a href="#starting-score">Starting score chart ↑</a><a href="#experiment-score">Experiment score chart ↑</a></div>`;
}
function leagueTable() {
  if (!result) return;
  const c = result.config, direct = c.comparison === 'matchup';
  $('league-comparison-note').textContent = direct ? `${recordPair(c)}. Replay this same matchup under five standard rule sets.` : 'Replay Team A against its benchmark under five standard rule sets.';
  $('league-scope').innerHTML = `<span>EVERY ROW BELOW</span><b>${direct ? 'The same A vs B' : 'Team A vs its benchmark'} · ${leagueFormat === 'single' ? 'one game' : 'best of 7'} · neutral venues · equal rest</b><p>Each row changes the sport. Your starting game is ${SPORTS[c.left.sport].name}; your experiment is ${SPORTS[c.right.sport].name}. Their custom settings belong to steps 01 and 02.</p>`;
  const sorted = [...result.leagues].sort((a, b) => b[leagueFormat] - a[leagueFormat]);
  $('league-table').innerHTML = `<div class="league-head"><span>REPLAY UNDER</span><span>TEAM A WINS · 50% REFERENCE</span><span>WIN CHANCE</span><span>GAME-ONE TIES</span></div>${sorted.map(r => { const s = SPORTS[r.sport]; return `<div class="league-row" style="--accent:${s.color}"><div class="sport-label">${icon(r.sport)}<div><h3>${s.name} rules</h3><span>${s.sport} · standard scoring<br>${r.baseline}</span></div></div><div class="league-bar" aria-hidden="true"><span style="width:${r[leagueFormat] * 100}%"></span></div><span class="league-prob">${pct(r[leagueFormat])}</span><span class="league-draw">${pct(r.draw)}</span></div>`; }).join('')}`;
}
function renderResults() { renderEvidence(); $('league-comparison-note').textContent = result.config.comparison === 'benchmark' ? 'Team A translated into each league. Same opponent caliber, neutral venues and equal rest.' : 'A vs B translated into each league. Neutral venues and equal rest.'; $('model-badge').textContent = result.left.evidence.kind === 'historical' ? 'HISTORICAL GAME MODEL' : result.left.evidence.kind === 'counterfactual' ? 'RULE-CHANGE MODEL' : 'CONTROLLED MECHANICS'; renderCards(); seriesChart(); bridgeChart(); outcomeComparison(); marginCharts(); leagueTable(); }

function setBusy(value) {
  busy = value; $('run-button').disabled = value; $('cancel-button').hidden = !value; $('progress-track').hidden = !value;
  document.querySelector('.results-panel').setAttribute('aria-busy', String(value));
  $('run-button').firstElementChild.textContent = value ? 'Running experiment…' : 'Run simulation';
  updateExportState();
}
function stopWorker() { worker?.terminate(); worker = null; }
function run() {
  let snapshot;
  try { snapshot = validateConfig(config); } catch (error) { showError(error.message); return; }
  stopWorker(); const id = ++runId, started = performance.now();
  dirty = false; $('error-banner').hidden = true; $('progress-fill').style.width = '3%'; setBusy(true);
  $('run-status').textContent = 'Calculating game mechanics'; $('run-caption').textContent = 'Running locally in your browser…';
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.id !== runId) return;
      if (data.type === 'progress') { $('progress-fill').style.width = `${data.progress * 100}%`; $('run-status').textContent = data.message; }
      if (data.type === 'error') fail(data.message);
      if (data.type === 'result') {
        result = data.result; renderResults(); setBusy(false); stopWorker();
        try { dirty = JSON.stringify(validateConfig(config)) !== JSON.stringify(snapshot); } catch { dirty = true; }
        updateExportState();
        $('run-status').textContent = dirty ? 'Unsimulated changes' : `${snapshot.trials.toLocaleString()} trials / scenario · seed ${snapshot.seed}`;
        $('run-caption').textContent = dirty ? 'Settings changed during the run. Run again to update.' : `Complete in ${((performance.now() - started) / 1000).toFixed(1)}s · All computation stays here.`;
      }
    };
    worker.onerror = () => fail('The background worker could not start. Serve the app over HTTP and reload, or try another modern browser.');
    worker.postMessage({ id, config: snapshot });
  } catch { fail('Your browser could not create the simulation worker. Please use a current browser over HTTP or HTTPS.'); }
}
function fail(message) { stopWorker(); setBusy(false); dirty = true; updateExportState(); showError(message); $('run-status').textContent = 'Simulation failed'; $('run-caption').textContent = 'Your settings are preserved. Please try again.'; }

function editRecord(id, value) {
  const team = id === 'strength-a' ? 'A' : 'B';
  config['record' + team] = Math.max(0, Math.min(HISTORY[config['recordSport' + team]].maxRecord, Math.round(value)));
  syncShared(); setDirty();
}
['strength-a', 'strength-b'].forEach(id => {
  $(id).addEventListener('input', event => editRecord(id, Number(event.target.value)));
  $(id).addEventListener('keydown', event => {
    const team = id === 'strength-a' ? 'A' : 'B', current = config['record' + team];
    const values = { ArrowRight: Math.floor(current + 1e-9) + 1, ArrowUp: Math.floor(current + 1e-9) + 1,
      ArrowLeft: Math.ceil(current - 1e-9) - 1, ArrowDown: Math.ceil(current - 1e-9) - 1,
      Home: 0, End: HISTORY[config['recordSport' + team]].maxRecord };
    if (!Object.hasOwn(values, event.key)) return;
    event.preventDefault(); editRecord(id, values[event.key]);
  });
});
for (const team of ['a', 'b']) $(`record-sport-${team}`).addEventListener('change', event => { changeTeamLeague(team.toUpperCase(), event.target.value); run(); });
$('comparison-mode').addEventListener('change', event => {
  config.comparison = event.target.value;
  if (config.comparison === 'benchmark') config.matching = 'rarity';
  if (config.comparison === 'benchmark') for (const [side, team] of [['left', 'A'], ['right', 'B']]) {
    if (config[side].sport !== config['recordSport' + team]) config[side] = { ...scenario(config['recordSport' + team]), series: config[side].series };
  }
  renderEditors(); syncShared(); setDirty();
});
$('opponent-rank').addEventListener('change', event => { config.opponentRank = Number(event.target.value); syncShared(); setDirty(); });
$('matching').addEventListener('change', event => { config.matching = event.target.value; syncShared(); setDirty(); });
$('model-basis').addEventListener('change', event => { config.basis = event.target.value; syncShared(); setDirty(); });
$('trials').addEventListener('change', event => { config.trials = Number(event.target.value); setDirty(); });
$('seed').addEventListener('input', event => { config.seed = event.target.value === '' ? NaN : Number(event.target.value); setDirty(); });
$('run-button').addEventListener('click', run);
$('rerun-button').addEventListener('click', run);
$('experiment-run').addEventListener('click', run);
$('cancel-button').addEventListener('click', () => { ++runId; stopWorker(); setBusy(false); setDirty(); $('run-status').textContent = 'Run cancelled'; toast('Run cancelled. Your settings are preserved.'); });
$('scenario-editors').addEventListener('input', event => {
  const { side, key } = event.target.dataset;
  if (!side || event.target.type !== 'range') return;
  if (side === 'left') {
    config = updateStartingRules(config, { ...config.left, [key]: Number(event.target.value) });
    const paired = $(`right-${key}`);
    if (paired) { paired.value = config.right[key]; $('right-' + key + '-value').textContent = controlValue(key, config.right[key]); fillRange(paired); updateEffective('right'); }
  } else config[side][key] = Number(event.target.value); $(`${side}-${key}-value`).textContent = controlValue(key, config[side][key]); fillRange(event.target); updateEffective(side); setDirty();
});
$('scenario-editors').addEventListener('change', event => {
  const { side, key } = event.target.dataset;
  if (key === 'sport') { changeScenarioSport(side, event.target.value); $(`${side}-sport`).focus(); }
  if (key === 'host') {
    if (side === 'left') {
      config = updateStartingRules(config, { ...config.left, host: event.target.value });
      $('right-host').value = config.right.host; updateEffective('right');
    } else config.right.host = event.target.value;
    updateEffective(side); setDirty();
  }
});
$('scenario-editors').addEventListener('click', event => {
  if (event.target.closest('[data-copy-start]')) { config.right = { ...config.left }; renderEditors(); syncShared(); run(); return; }
  const button = event.target.closest('[data-series]');
  if (!button) return;
  config[button.dataset.side].series = Number(button.dataset.series);
  button.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  syncShared(); setDirty();
});
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const preset = button.dataset.preset; config.comparison = 'matchup';
  if (preset === 'hockey') { config.left = scenario('nhl'); config.right = { ...scenario('nhl'), scoring: 3 }; }
  if (preset === 'basketball') { config.left = scenario('nba'); config.right = { ...scenario('nba'), series: 1 }; }
  if (preset === 'opportunities') { config.left = scenario('soccer'); config.right = { ...scenario('soccer'), opportunities: 2 }; }
  syncShared(); renderEditors(); run(); document.querySelector('.results-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
function changeScenarioSport(side, sport) {
  if (config.comparison === 'benchmark') changeTeamLeague(side === 'left' ? 'A' : 'B', sport);
  else {
    // Change only the sport layer; preserve the chosen competition format.
    const next = { ...scenario(sport), series: config[side].series };
    if (side === 'left') config = updateStartingRules(config, next);
    else config.right = next;
    renderEditors(); syncShared();
  }
  setDirty(); run();
}
$('matchup-sport').addEventListener('change', event => changeScenarioSport('left', event.target.value));
$('matchup-series').addEventListener('change', event => {
  config = updateStartingRules(config, { ...config.left, series: Number(event.target.value) }); renderEditors(); syncShared(); setDirty();
});
$('reset-button').addEventListener('click', () => { config = defaultConfig(); syncShared(); renderEditors(); run(); toast('50 NBA wins vs 10 NFL wins, head to head under NBA rules.'); });
$('league-format').addEventListener('click', event => { const button = event.target.closest('button'); if (!button) return; leagueFormat = button.dataset.format; $('league-format').querySelectorAll('button').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); leagueTable(); });

$('share-button').addEventListener('click', async () => {
  try {
    const url = experimentLink(config, location.href);
    try { await Promise.race([navigator.clipboard.writeText(url), new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard unavailable')), 1500))]); toast('Experiment link copied. Same settings, same seed.'); }
    catch {
      const dialog = document.createElement('dialog'); dialog.innerHTML = '<form method="dialog"><h3>Copy your experiment link</h3><p class="small muted">Select and copy the link below.</p><input aria-label="Experiment link" readonly style="width:100%;margin:18px 0;padding:10px"><button class="secondary-button">Done</button></form>';
      dialog.style.cssText = 'width:min(560px,90vw);padding:25px;border:1px solid #a5b696;background:#f5f3ec;color:#26362f;border-radius:4px';
      dialog.querySelector('input').value = url; document.body.append(dialog); dialog.showModal(); dialog.querySelector('input').select(); dialog.addEventListener('close', () => dialog.remove());
    }
  } catch (error) { showError(error.message); }
});
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-json').addEventListener('click', () => {
  if (!result || dirty || busy) return;
  download(`leaguelab-seed-${result.config.seed}.json`, exportJSON(result), 'application/json'); toast('Experiment JSON download started.');
});
$('export-csv').addEventListener('click', () => {
  if (!result || dirty || busy) return;
  download(`leaguelab-seed-${result.config.seed}.csv`, exportCSV(result), 'text/csv;charset=utf-8'); toast('Experiment CSV download started.');
});
function navigate() {
  const hash = location.hash.slice(1), page = ['methodology', 'case-study'].includes(hash) ? hash : 'simulator';
  document.querySelectorAll('main>.page').forEach(el => { el.hidden = el.id !== page; });
  document.querySelectorAll('.nav-link').forEach(link => { const selected = link.hash === '#' + page; link.classList.toggle('active', selected); if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.title = `${page === 'methodology' ? 'The model' : page === 'case-study' ? 'Behind the build' : 'The anatomy of an upset'} — LeagueLab`;
  if (page !== 'simulator') window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', navigate);
syncShared(); renderEditors(); renderHistory(); renderNumberGuide(); navigate(); updateExportState();
$('comparison-cards').innerHTML = '<div class="result-card loading-card loading-pulse">Calculating Team A vs Team B…</div>';
setTimeout(run, 30);
