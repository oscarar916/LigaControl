const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const tables = { configuration: [], teams: Array.from({length:8},(_,i)=>({id:`t${i}`,campeonato_id:'c',disciplina_id:'d',estado:'ACTIVE'})), matches: [{campeonato_id:'c',disciplina_id:'d',fase:'GROUP',estado:'FINISHED',observaciones:'{"roundLocked":true}'}] };
  let serial = 0;
  const ctx = { SHEETS: { CONFIGURATION:'configuration',TEAMS:'teams',MATCHES:'matches' }, LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})}, listSheetRecords:(name)=>tables[name],validateUuid:(s)=>!!s,validationError:(s)=>new Error(s),sanitizeText:(s)=>String(s),generateUuid:()=>String(++serial),nowIso:()=> '2026-10-20T12:00:00Z',appendSheetRecord:(table,r)=>tables[table].push(r),updateSheetRecord:(table,id,fields)=>Object.assign(tables[table].find(r=>r.id===id),fields) };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('backend/KnockoutService.gs','utf8'),ctx);
  const plan = {status:'DRAFT',pairs:[0,1,2,3].map(i=>({homeId:`t${i}`,awayId:`t${7-i}`})),semifinals:[[0,3],[1,2]],tieRule:'PENALTIES'};
  const save = (body) => ctx.KnockoutService.post({body:{championshipId:'c',disciplineId:'d',...body}});
  return {ctx,tables,plan,save};
}
test('draft persists separately and rejects duplicate teams or semifinal sources',()=>{
  const {plan,save,tables}=setup(); const saved=save({plan}); assert.equal(saved.status,'DRAFT'); assert.equal(tables.matches.length,1);
  const invalid=JSON.parse(JSON.stringify(plan)); invalid.pairs[1].homeId='t0';
  assert.throws(()=>save({plan:invalid,revision:saved.revision}),/8 equipos/);
  invalid.pairs=plan.pairs; invalid.semifinals=[[0,1],[1,2]];
  assert.throws(()=>save({plan:invalid,revision:saved.revision}),/siguiente ronda/);
});
for (const size of [4,16]) test(`${size} qualifiers advance through all rounds and third place`,()=>{
  const {ctx,tables,save}=setup();
  tables.teams=Array.from({length:size},(_,i)=>({id:`t${i}`,campeonato_id:'c',disciplina_id:'d',estado:'ACTIVE'}));
  const plan={size,status:'CONFIRMED',pairs:Array.from({length:size/2},(_,i)=>({homeId:`t${i}`,awayId:`t${size-1-i}`})),tieRule:'PENALTIES',thirdPlace:true};
  plan.sources=ctx.knockoutSources(plan);
  let saved=save({plan});
  for(let i=0;i<size-1;i++) {
    const ids=ctx.knockoutParticipants(saved,i); assert(ids.every(Boolean));
    saved=save({revision:saved.revision,action:'result',matchIndex:i,result:{homeScore:2,awayScore:0}});
    assert.equal(saved.results[i].winnerId,ids[0]);
  }
  const bronze=ctx.knockoutParticipants(saved,size-1); assert.equal(new Set(bronze).size,2);
  saved=save({revision:saved.revision,action:'result',matchIndex:size-1,result:{homeScore:1,awayScore:0}});
  assert.equal(Object.keys(saved.results).length,size);
  assert.equal(tables.matches.length,1);
});
test('cannot repeat a source in a sixteen-team bracket',()=>{
  const {ctx,tables,save}=setup();
  tables.teams=Array.from({length:16},(_,i)=>({id:`t${i}`,campeonato_id:'c',disciplina_id:'d',estado:'ACTIVE'}));
  const plan={size:16,status:'DRAFT',pairs:Array.from({length:8},(_,i)=>({homeId:`t${i}`,awayId:`t${15-i}`}))};
  plan.sources=ctx.knockoutSources(plan); plan.sources[9]=[0,3];
  assert.throws(()=>save({plan}),/siguiente ronda/);
});
test('confirmation requires closed group rounds, tie rule and current revision',()=>{
  const {plan,save,tables}=setup(); const saved=save({plan}); plan.status='CONFIRMED';
  assert.throws(()=>save({plan}),/Otro usuario/);
  tables.matches[0].observaciones='{}'; assert.throws(()=>save({plan,revision:saved.revision}),/Cierra/);
  tables.matches[0].observaciones='{"roundLocked":true}'; plan.tieRule=''; assert.throws(()=>save({plan,revision:saved.revision}),/empates/);
});
test('winners advance, tied score requires explanation, downstream results protect winners',()=>{
  const {ctx,plan,save}=setup(); plan.status='CONFIRMED'; let saved=save({plan});
  const result=(index,home,away,winner,notes='')=>{ saved=save({revision:saved.revision,action:'result',matchIndex:index,result:{homeScore:home,awayScore:away,winnerId:winner,notes}}); };
  assert.throws(()=>result(4,1,0,'t0'),/ronda anterior/);
  assert.throws(()=>result(0,1,1,'t0'),/Explica/);
  result(0,1,1,'t0','Penales 4–3'); result(3,2,0,'t3');
  assert.equal(ctx.knockoutParticipants(saved,4).join(','),'t0,t3');
  result(4,3,0,'t0'); assert.throws(()=>result(0,0,1,'t7'),/ronda siguiente/);
  assert.throws(()=>save({plan,revision:saved.revision}),/confirmadas/);
});
