const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup() {
  const fields={};
  const field=(key)=>fields[key]||=( {value:'',innerHTML:'',hidden:false,dataset:{},classList:{toggle:()=>{}},setAttribute:()=>{},addEventListener:()=>{}} );
  const tabs=['matches','knockout','standings'].map(view=>({...field('tab-'+view),dataset:{resultsView:view}}));
  const ctx={document:{querySelector:field,querySelectorAll:()=>tabs},localStorage:{getItem:()=>''},location:{search:'?phase=knockout'},URLSearchParams,Date};
  vm.createContext(ctx);
  const source=fs.readFileSync('frontend/js/resultados.js','utf8').replace(/^import .*$/gm,'');
  vm.runInContext(source.slice(0,source.indexOf('function renderStandings')),ctx);
  vm.runInContext(`teams=[{id:'a',name:'KO A'},{id:'b',name:'KO B'},{id:'c',name:'Grupo C'},{id:'d',name:'Grupo D'}];matches=[{id:'group',homeId:'c',awayId:'d',phase:'GROUP',round:11,order:1,roundLocked:true,date:'2026-10-17',homeScore:1,awayScore:0},{id:'ko',homeId:'a',awayId:'b',phase:'KNOCKOUT',round:12,roundLabel:'Cuartos de final',order:1,date:'2026-11-21',homeScore:'',awayScore:''}];`,ctx);
  return {ctx,field,fields};
}
test('knockout link selects a dedicated tab and excludes group fixtures',()=>{
  const {ctx,field}=setup();ctx.renderResultNavigation();ctx.renderMatches();
  assert.equal(field('#matches-view').hidden,false);assert.equal(field('#knockout-acta-entry').hidden,false);
  assert(field('#result-round').innerHTML.includes('Cuartos de final'));assert(!field('#result-round').innerHTML.includes('Fecha 11'));
  assert.equal(field('#result-round').value,'12');assert(field('#result-match-list').innerHTML.includes('data-match-id="ko"'));assert(!field('#result-match-list').innerHTML.includes('data-match-id="group"'));
  vm.runInContext("activeResultsView='matches'",ctx);ctx.renderResultNavigation();ctx.renderMatches();
  assert.equal(field('#knockout-acta-entry').hidden,true);assert(field('#result-round').innerHTML.includes('Fecha 11'));assert(!field('#result-round').innerHTML.includes('Cuartos'));
  assert(field('#result-match-list').innerHTML.includes('data-match-id="group"'));assert(!field('#result-match-list').innerHTML.includes('data-match-id="ko"'));
});
test('penalty score is rendered in the actual result card below the main score',()=>{
  const {ctx,field}=setup();
  vm.runInContext("Object.assign(matches.find(m=>m.id==='ko'),{homeScore:2,awayScore:2,winnerId:'b',knockoutTieNotes:'Penales: 1–2'})",ctx);
  ctx.renderResultNavigation();ctx.renderMatches();
  const html=field('#result-match-list').innerHTML;
  assert.match(html,/class="result-knockout-decision"/);
  assert.match(html,/\(1 - 2\)/);
  assert.match(html,/Clasificó KO B/);
});
test('confirmed knockout matches are initialized once when the tab is opened',async()=>{
  const {ctx}=setup();let calls=0;
  vm.runInContext("matches=matches.filter(isGroupMatch);backendActasSupported=true;knockoutPlan={status:'CONFIRMED'}",ctx);
  ctx.apiPost=async(path,body)=>{calls++;assert.equal(path,'/api/knockouts');assert.equal(body.action,'syncMatches');};
  ctx.load=async()=>vm.runInContext("matches.push({id:'new',phase:'KNOCKOUT'})",ctx);
  await ctx.ensureKnockoutMatches();await ctx.ensureKnockoutMatches();assert.equal(calls,1);
});
test('failed initialization stays in knockout view and displays the error',async()=>{
  const {ctx,field}=setup();
  vm.runInContext("matches=matches.filter(isGroupMatch);backendActasSupported=true;knockoutPlan={status:'CONFIRMED'}",ctx);
  ctx.apiPost=async()=>{throw Error('Clave de administración pendiente');};
  await ctx.ensureKnockoutMatches();
  assert(field('#knockout-acta-hint').textContent.includes('Clave de administración pendiente'));
  assert(field('#result-match-list').innerHTML.includes('todavía no están habilitados'));
  assert.equal(vm.runInContext('activeResultsView',ctx),'knockout');
});
