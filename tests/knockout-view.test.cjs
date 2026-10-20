const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function view() {
  const source = fs.readFileSync('frontend/js/eliminatorias.js','utf8').replace(/^import .*\n/,'');
  const fields = {
    '#knockout-size':{value:'8'}, '#knockout-common-date':{value:'2026-10-24'},
    '#knockout-common-venue':{value:'Cancha principal'}, '#knockout-common-time':{value:'14:00'},
    '#knockout-tie':{value:'PENALTIES'}, '#knockout-third':{checked:true}, '#knockout-notes':{value:''}
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
test('shared day and venue, only first match has a start time',()=>{
  const ctx=view(); vm.runInContext('savedPlan=seeded(8)',ctx);
  const p=ctx.readPlan(); assert.equal(p.pairs.length,4);
  p.pairs.forEach((r,i)=>{assert.equal(r.date,'2026-10-24');assert.equal(r.venue,'Cancha principal');assert.equal(r.time,i===0?'14:00':'');});
});
