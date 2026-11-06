const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('frontend/js/discipline-policy.js','utf8').replaceAll('export function','function'),ctx);
const championshipId='90e9c234-f9a3-4689-82d9-1aff3779cbfb', disciplineId='65063c89-76bd-49ec-b29a-b2b14717e1c3';
const events=[{id:'e',matchId:'m'}];
const group={id:'m',championshipId,disciplineId,phase:'GROUP',roundLocked:true,status:'FINISHED'};
test('group suspensions do not carry after all group rounds close, debt and history remain',()=>{
  for(const type of ['YELLOW_CARD','DOUBLE_YELLOW','RED_CARD','EXPULSION']) {
    const sanction=Object.freeze({id:'s',championshipId,eventId:'e',suspensionMatches:1,amount:10,type});
    const payment=Object.freeze({sanctionId:'s',status:'PENDING',amount:10});
    assert.equal(ctx.groupSuspensionDoesNotCarry(sanction,events,[group]),true);
    assert(ctx.resetSuspensionLabel(sanction).includes('Historial de grupos: 1 fecha'));
    assert.equal(sanction.suspensionMatches,1); assert.equal(sanction.amount,10);
    assert.equal(payment.status,'PENDING'); assert.equal(payment.amount,10);
  }
});
test('incomplete or reopened groups retain sporting suspensions',()=>{
  const s={eventId:'e'};
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,events,[group,{...group,id:'other',roundLocked:false}]),false);
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,events,[{...group,roundLocked:false}]),false);
});
test('knockout sanctions, other championships and other disciplines are not reset',()=>{
  const s={eventId:'e'};
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,events,[{...group,phase:'QUARTERFINAL'}]),false);
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,events,[{...group,championshipId:'other'}]),false);
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,events,[{...group,disciplineId:'other'}]),false);
  assert.equal(ctx.groupSuspensionDoesNotCarry(s,[],[group]),false);
});
