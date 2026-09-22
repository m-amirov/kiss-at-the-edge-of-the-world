import assert from 'node:assert/strict';
import { season, initialState, canChoose, applyEffect, resolveEnding } from '../../src/season-data.js';

const incoming = new Set();
for (const [id, node] of Object.entries(season.nodes)) {
  if (node.next) incoming.add(node.next);
  for (const choice of node.choices || []) {
    assert.ok(season.nodes[choice.next], `${id} points to missing ${choice.next}`);
    incoming.add(choice.next);
  }
}
assert.deepEqual(Object.keys(season.nodes).filter(id => !incoming.has(id) && id !== 'ep1-intro' && !season.nodes[id].terminal), []);

assert.equal(season.nodes['ep1-intro'].location.startsWith('Кефлавик'), true);
assert.equal(season.nodes['ep1-intro'].lines[0].narration, true);
assert.deepEqual(season.nodes['ep1-choice'].choices.map(choice => choice.id), ['observe', 'participate', 'personal']);
assert.equal(season.nodes['ep1-choice'].lines.at(-1).narration, true);

const ep7 = season.nodes['ep7-pivot'];
assert.deepEqual(ep7.choices.filter(choice => canChoose(choice, { ...initialState(), flags: ['nick-plan-supported'] })).map(choice => choice.id), ['route-none']);
assert.ok(ep7.choices.some(choice => choice.id === 'route-nick' && canChoose(choice, { ...initialState(), flags: ['nick-plan-supported', 'nick-evening'] })));

const ericRouteChoices = season.nodes['ep8-eric'].choices.map(choice => choice.id);
assert.deepEqual(ericRouteChoices, ['eric-plan', 'eric-work', 'eric-quiet']);
for (const choice of season.nodes['ep8-eric'].choices) {
  const routeState = { ...initialState(), routeIntent: 'eric', flags: ['eric-plan-supported', 'eric-first-walk', 'route-eric'] };
  assert.equal(canChoose(choice, routeState), true, `Eric continuation is reachable: ${choice.id}`);
  assert.equal(season.nodes[choice.next].choices?.at(-1)?.next ?? season.nodes[choice.next].next, 'ep9-eric-conflict');
}
assert.equal(season.nodes['ep9-eric-conflict'].choices[0].next, 'ep10-eric-workshop');
assert.equal(season.nodes['ep10-eric-workshop'].choices.length, 3);
assert.equal(season.nodes['ep10-eric-evening'].choices[0].next, 'ep10-west');
assert.match(season.nodes['ep11-eric-date'].lines.map(line => line.text).join(' '), /ericRouteReflection/);

const debt = initialState();
applyEffect(debt, { repairDebt: 1 });
applyEffect(debt, { repairDebt: -1 });
assert.equal(debt.repairDebt, 0);

assert.equal(resolveEnding({ routeIntent: 'nick', commitment: true, boundaries: 2, repairDebt: 0, trust: { eric: 0, nick: 3, damir: 0 }, flags: ['concrete-plan', 'nick-conflict-repaired'] }), 'ending-nick');
assert.equal(resolveEnding({ routeIntent: 'nick', commitment: true, boundaries: 2, repairDebt: 1, trust: { eric: 0, nick: 3, damir: 0 }, flags: ['concrete-plan', 'nick-conflict-repaired'] }), 'ending-alice');

console.log('season-state: PASS');
