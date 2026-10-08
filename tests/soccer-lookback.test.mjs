import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY } from '../dist/src/history-data.js';
import { defaultConfig, scenario } from '../dist/src/presets.js';
import { evaluate, historicalSoccerOutcome, runExperiment, simulateMatch } from '../dist/src/engine.js';
import { configFromLink, exportCSV } from '../dist/src/exports.js';
const close = (a,b,t=1e-9) => assert.ok(Math.abs(a-b)<t, `${a} != ${b}`);
const c = {...defaultConfig(),recordSportA:'soccer',recordSportB:'soccer',recordA:80,recordB:50,trials:10000,left:scenario('soccer'),right:scenario('soccer')};

test('neutral soccer fits all three historical outcome masses and preserves symmetry', () => {
  for (const [a,b] of [[50,50],[80,40],[.1,99.9]]) {
    const r=evaluate(scenario('soccer'),a,b,'history'), target=historicalSoccerOutcome(a,b), swapped=evaluate(scenario('soccer'),b,a,'history');
    close(r.outcome.win+r.outcome.draw+r.outcome.loss,1);
    for (const key of ['win','draw','loss']) close(r.outcome[key],target[key]);
    close(r.outcome.win,swapped.outcome.loss);close(r.outcome.draw,swapped.outcome.draw);
    close(r.scoreA,swapped.scoreB,1e-6);
    close(r.single,r.outcome.win+r.outcome.draw/2);
  }
  const equal=evaluate(scenario('soccer'),50,50,'history');
  assert.ok(equal.outcome.win<.5);assert.ok(equal.draw>.2);
});
test('draws remain distinct in seeded trials and every count reconciles', () => {
  const r=runExperiment(c), h=r.headToHead;
  close(h.exact.a+h.exact.draw+h.exact.b,1);
  assert.equal(h.simulation.winsA+h.simulation.winsB+h.simulation.draws,c.trials);
  assert.ok(h.simulation.draws>0);assert.ok(h.simulation.winners.includes('D'));
  assert.deepEqual(r.left.simulation,simulateMatch(r.left.outcome,c.trials,c.seed));
  for (const [p,n] of [[h.exact.a,h.simulation.winsA],[h.exact.b,h.simulation.winsB],[h.exact.draw,h.simulation.draws]]) close(n/c.trials,p,5*Math.sqrt(p*(1-p)/c.trials));
  close(r.bridge[0],r.left.outcome.win);close(r.bridge.at(-1),r.right.outcome.win);
});
test('series explicitly resolve draws while soccer scoring counterfactuals change them', () => {
  const r=runExperiment({...c,right:{...scenario('soccer'),series:3}});
  assert.equal(r.left.threeWay,true);assert.equal(r.right.threeWay,false);
  close(r.right.outcome.draw,0);close(r.right.outcome.win+r.right.outcome.loss,1);
  close(r.right.outcome.win,r.right.exact.win);
  const base=evaluate(scenario('soccer'),75,50,'history');
  const changed=evaluate({...scenario('soccer'),scoring:2},75,50,'history');
  assert.ok(changed.draw<base.draw);assert.ok(changed.outcome.win>base.outcome.win);
  close(changed.outcome.win+changed.outcome.draw+changed.outcome.loss,1);
});
test('soccer exports and migrated links distinguish draws from losses', () => {
  const r=runExperiment(c), notices=[];
  const migrated=configFromLink('https://example.org/?experiment='+encodeURIComponent(btoa(JSON.stringify({...c,version:5}))), m=>notices.push(m));
  assert.equal(migrated.version,9);assert.match(notices[0],/draws/);
  const [keys,...values]=exportCSV(r).trim().split('\r\n').map(x=>x.split(','));
  for (const v of values) {
    assert.equal(v.length,keys.length);const row=Object.fromEntries(keys.map((k,i)=>[k,v[i]]));
    close(+row.exact_probability + +row.opponent_exact_probability + +row.exact_draw_probability,1);
    assert.equal(+row.focal_team_trial_wins + +row.opponent_trial_wins + +row.simulation_draws,c.trials);
    assert.equal(row.outcome_rule,'90_minutes_draw_allowed');
  }
  assert.equal(HISTORY.soccer.validation.trainingGames,2660);assert.equal(HISTORY.soccer.validation.model.games,1140);
});
