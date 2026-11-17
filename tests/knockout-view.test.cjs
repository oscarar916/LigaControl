const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function view() {
  const source = fs.readFileSync('frontend/js/eliminatorias.js','utf8').replace(/^import .*\n/,'');
  const fields = {
    '#knockout-size':{value:'8'}, '#knockout-common-date':{value:'2026-10-24'},
    '#knockout-common-venue':{value:'Cancha principal'}, '#knockout-common-time':{value:'14:00'},
    '#knockout-tie':{value:'PENALTIES'}, '#knockout-third':{checked:true}, '#knockout-notes':{value:''},
    '#knockout-bracket':{classList:{add:()=>{}},innerHTML:''}, '#bracket-label':{}, '#bracket-context':{}, '#bracket-notes':{},
    '#knockout-results':{}, '#knockout-result-tabs':{}, '#knockout-result-forms':{addEventListener:()=>{}}
  };
  const ctx={localStorage:{getItem:()=>''},document:{querySelector:(key)=>fields[key]}};
  vm.createContext(ctx);
  vm.runInContext(source.slice(0,source.indexOf("$('#knockout-form').addEventListener")),ctx);
  vm.runInContext("ranked = Array.from({length:16},(_,i)=>({team:{id:'t'+i,name:'Equipo '+i,status:'ACTIVE'}}));",ctx);
  return ctx;
}
for(const size of [4,8,16]) test(`automatic ${size}-team draw and connected layout`,()=>{
  const ctx=view();
  const plan=vm.runInContext(`seeded(${size})`,ctx);
  assert.equal(plan.pairs.length,size/2);
  plan.pairs.forEach((p,i)=>{ assert.equal(p.homeId,`t${i}`); assert.equal(p.awayId,`t${size-1-i}`); });
  const layout=ctx.bracketLayout({...plan,thirdPlace:true});
  assert.equal(layout.nodes.length,size);
  assert.equal(new Set(layout.nodes.map(n=>n.index)).size,size);
  assert.equal(layout.edges.length,size-2);
  for(const n of layout.nodes) { assert(n.x>=0 && n.x+layout.cardWidth<=layout.width); assert(n.y>=0 && n.y+78<=layout.height); }
});
test('result cards distinguish pending, saved ties and waiting matches',()=>{
  const ctx=view(); vm.runInContext('teams=ranked.map(r=>r.team)',ctx);
  const plan=vm.runInContext('seeded(8)',ctx);
  const pending=ctx.resultCard(plan,0);
  assert(pending.includes('Equipo 0')); assert(pending.includes('Equipo 7'));
  assert(!pending.includes('resultados.html?phase=knockout')); assert(!pending.includes('<input'));
  const waiting=ctx.resultCard(plan,4); assert(waiting.includes('En espera')); assert(!waiting.includes('<input'));
  plan.results={0:{homeScore:2,awayScore:2,winnerId:'t7',notes:'Penales 3–4'}};
  plan.matchIds={0:'match-0'};
  const saved=ctx.resultCard(plan,0); assert(saved.includes('Guardado')); assert(!saved.includes('Abrir acta')); assert(!saved.includes('matchId=')); assert(saved.includes('(3 – 4)')); assert(!saved.includes('<form'));
});
test('result rounds show progress and keep only one panel visible',()=>{
  const ctx=view(); vm.runInContext('confirmed=true; teams=ranked.map(r=>r.team)',ctx);
  ctx.renderResults(vm.runInContext('seeded(8)',ctx));
  const tabs=ctx.document.querySelector('#knockout-result-tabs').innerHTML;
  const panels=ctx.document.querySelector('#knockout-result-forms').innerHTML;
  assert(tabs.includes('0/4')); assert(tabs.includes('0/2'));
  assert(panels.includes('data-result-panel="0" >')); assert(panels.includes('data-result-panel="4" hidden'));
  assert(panels.includes('data-round-schedule="4"'));
  assert(!panels.includes('knockout-result-card'));
});
test('preview renders both connected and narrow-screen layouts without dropping teams',()=>{
  const ctx=view(); vm.runInContext('teams=ranked.map(r=>r.team); savedPlan=seeded(8)',ctx); ctx.updatePreview();
  const html=ctx.document.querySelector('#knockout-bracket').innerHTML;
  assert(html.includes('knockout-tree-compact')); assert(html.includes('<path'));
  for(let i=0;i<8;i++) assert(html.includes(`Equipo ${i}`));
  assert.equal((html.match(/<article /g)||[]).length,16);
});
test('shared day and venue, only first match has a start time',()=>{
  const ctx=view(); vm.runInContext('savedPlan=seeded(8)',ctx);
  const p=ctx.readPlan(); assert.equal(p.pairs.length,4);
  p.pairs.forEach((r,i)=>{assert.equal(r.date,'2026-10-24');assert.equal(r.venue,'Cancha principal');assert.equal(r.time,i===0?'14:00':'');});
});
test('moving a match preserves its bracket path and survives draft reload',()=>{
  const ctx=view(); const original=vm.runInContext('seeded(8)',ctx);
  original.pairs=original.pairs.map((p,i)=>({...p,date:'2026-10-24',venue:'Cancha',time:i===0?'14:00':''}));
  const moved=ctx.moveOpeningMatch(original,0,1);
  assert.equal(moved.pairs[0].homeId,'t1'); assert.equal(moved.pairs[1].homeId,'t0');
  assert.equal(moved.pairs[0].time,'14:00'); assert.equal(moved.pairs[1].time,'');
  const reload=ctx.orderedSeededPlan(JSON.parse(JSON.stringify(moved)),original);
  assert.equal(reload.pairs[0].homeId,'t1'); assert.equal(reload.pairs[1].homeId,'t0');
  for(const semi of [4,5]) {
    const before=original.sources[semi].map(i=>original.pairs[i].homeId).join(',');
    const after=reload.sources[semi].map(i=>reload.pairs[i].homeId).join(',');
    assert.equal(after,before);
  }
});
