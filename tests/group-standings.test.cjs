const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['resultados.js','reportes.js','publico.js'])test(`${file} excludes knockout games from group standings`,()=>{
  let src=fs.readFileSync('frontend/js/'+file,'utf8').replace(/^\uFEFF/,'').replace(/^import .*$/gm,'');
  const end=src.indexOf(file==='publico.js'?'function publicMatchOrder':'function renderStandings');
  assert(end>0);
  const element={addEventListener:()=>{}};
  const ctx={document:{querySelector:()=>element},localStorage:{getItem:()=>''},location:{search:''},URLSearchParams,Date};
  vm.createContext(ctx);vm.runInContext(src.slice(0,end),ctx);
  vm.runInContext(`teams=[{id:'a',name:'A'},{id:'b',name:'B'}];matches=[{id:'g',phase:'GROUP',homeId:'a',awayId:'b',homeScore:1,awayScore:0,closed:true,round:1},{id:'k',phase:'KNOCKOUT',homeId:'b',awayId:'a',homeScore:99,awayScore:0,closed:true,round:12}];`,ctx);
  const table=ctx.standings(),home=table.find(r=>r.team.id==='a'),away=table.find(r=>r.team.id==='b');
  assert.equal(home.pts,3);assert.equal(home.pj,1);assert.equal(home.gf,1);assert.equal(away.pts,0);assert.equal(away.gf,0);
});
