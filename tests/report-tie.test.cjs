const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('match report separates penalties and names the winning team', () => {
  const source = fs.readFileSync('frontend/js/reportes.js', 'utf8');
  const context = { teamName: id => id === 'b' ? 'RIS B' : 'RIS A', esc: s => String(s) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function reportTieDecision('), source.indexOf('function renderMatchesByRound(')), context);
  const match = { phase: 'KNOCKOUT', homeScore: 2, awayScore: 2, winnerId: 'b', knockoutTieNotes: 'Penales: 3–4' };
  assert.match(context.reportTieDecision(match), /RIS B ganó por penales/);
  assert.match(context.reportTieDecision(match), /Penales: 3–4/);
  assert.equal(context.reportTieDecision({ ...match, homeScore: 3 }), '');
  assert.equal(context.reportTieDecision({ ...match, winnerId: '' }), '');
  assert.match(context.reportTieDecision({ ...match, knockoutTieNotes: '' }), /ganó el desempate/);
});
