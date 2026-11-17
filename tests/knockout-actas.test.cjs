const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(legacy=false) {
  const clone=(x)=>JSON.parse(JSON.stringify(x)); let counter=0;
  const plan={size:8,status:'CONFIRMED',pairs:Array.from({length:4},(_,i)=>({homeId:`t${i}`,awayId:`t${7-i}`,date:'2026-11-21',venue:'Cancha',time:i===0?'14:00':''})),sources:{4:[0,3],5:[1,2],6:[4,5]},tieRule:'PENALTIES',results:legacy?{0:{homeScore:2,awayScore:1,winnerId:'t0',notes:''}}:{}};
  const tables={matches:[{id:'group',campeonato_id:'c',disciplina_id:'d',fase:'GROUP',jornada:11,marcador_local:2,marcador_visitante:1,cerrado:true,estado:'FINISHED',observaciones:'{"roundLocked":true}'}],configuration:[{id:'plan',campeonato_id:'c',disciplina_id:'d',clave:'KNOCKOUT_PLAN',valor:JSON.stringify(plan),estado:'ACTIVE'}],events:[],minutes:[],players:Array.from({length:8},(_,i)=>({id:`p${i}`,equipo_id:`t${i}`,estado:'ACTIVE'})),sanctions:[],payments:[]};
  const ctx={SHEETS:{MATCHES:'matches',CONFIGURATION:'configuration',EVENTS:'events',MINUTES:'minutes',PLAYERS:'players',SANCTIONS:'sanctions',PAYMENTS:'payments'},listSheetRecords:(name)=>clone(tables[name]||[]),appendSheetRecord:(name,r)=>tables[name].push(clone(r)),updateSheetRecord:(name,id,changes)=>{const target=tables[name].find(r=>r.id===id);assert(target);Object.assign(target,clone(changes));return clone(target);},sanitizeText:(s)=>String(s??''),validateUuid:(s)=>Boolean(s),validationError:(s)=>new Error(s),appError:(code,s)=>new Error(s),nowIso:()=>new Date().toISOString(),generateUuid:()=>`id-${++counter}`,LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},createSanctionForEvent:()=>{},deactivateSanctionForEvent:()=>{}};
  vm.createContext(ctx); for(const file of ['MatchService.gs','KnockoutService.gs','MinuteService.gs','EventService.gs'])vm.runInContext(fs.readFileSync('backend/'+file,'utf8'),ctx);
  const sync=()=>ctx.KnockoutService.post({body:{championshipId:'c',disciplineId:'d',action:'syncMatches'}});
  return {ctx,tables,sync,put:(body)=>ctx.MatchService.put({body})};
}
test('idempotent migration creates real acta matches without inventing player events',()=>{
  const {sync,tables}=setup();const before=JSON.stringify(tables.matches[0]);
  const first=sync();assert.equal(first.createdIds.length,4);assert.equal(sync().createdIds.length,0);
  assert.equal(tables.matches.length,5);assert.equal(tables.events.length,0);assert.equal(tables.minutes.length,0);
  assert.equal(JSON.stringify(tables.matches[0]),before);assert(first.items.every(m=>m.phase==='KNOCKOUT'&&m.round===12));
});
test('existing scores are preserved without creating fictional scorers',()=>{
  const {sync,tables}=setup(true);const result=sync();const first=result.items.find(m=>m.knockoutIndex===0);
  assert.equal(first.homeScore,2);assert.equal(first.awayScore,1);assert.equal(first.winnerId,'t0');assert.equal(tables.events.length,0);
});
test('acta players and goals save normally; closing a round advances winners and creates semifinals',()=>{
  const {ctx,sync,put,tables}=setup();const opening=sync().items;
  for(const m of opening){
    ctx.EventService.post({body:{matchId:m.id,teamId:m.homeId,playerId:`p${m.homeId.slice(1)}`,type:'GOAL'}});
    ctx.MinuteService.post({body:{matchId:m.id,homeLineup:[{playerId:`p${m.homeId.slice(1)}`,role:'TITULAR',slot:1}],awayLineup:[],observations:'Acta'}});
    put({id:m.id,homeScore:1,awayScore:0,closed:false});
  }
  put({id:opening[0].id,lockRound:true});
  const all=sync().items;assert.equal(all.length,6);
  const semifinal=all.find(m=>m.knockoutIndex===4);assert.equal(semifinal.homeId,'t0');assert.equal(semifinal.awayId,'t3');
  assert.equal(tables.events.length,4);assert.equal(tables.minutes.length,4);
  const p=ctx.KnockoutService.get({params:{championshipId:'c',disciplineId:'d'}});assert.equal(p.results[0].winnerId,'t0');
  ctx.EventService.post({body:{matchId:semifinal.id,teamId:semifinal.homeId,playerId:'p0',type:'GOAL'}});
  assert.throws(()=>put({id:opening[0].id,unlockRound:true}),/siguiente ronda/);
});
test('a draw requires a winner and explanation, and closure preserves that winner',()=>{
  const {sync,put}=setup();const opening=sync().items;
  assert.throws(()=>put({id:opening[0].id,homeScore:0,awayScore:0,closed:false}),/desempate/);
  for(const m of opening)put({id:m.id,homeScore:0,awayScore:0,knockoutWinnerId:m.awayId,knockoutTieNotes:'Penales 3–4',closed:false});
  put({id:opening[0].id,lockRound:true});
  const all=sync().items;assert.equal(all.find(m=>m.knockoutIndex===0).winnerId,'t7');
  assert.equal(all.find(m=>m.knockoutIndex===4).homeId,'t7');
});
test('knockout cards do not accumulate with group cards and existing payments remain untouched',()=>{
  const {ctx,tables,sync}=setup();const first=sync().items[0];
  ctx.getSanctionSettings=()=>({YELLOW_CARD_COST:10,YELLOW_CARDS_FOR_SUSPENSION:2,YELLOW_SUSPENSION_MATCHES:1,RED_CARD_COST:20,RED_SUSPENSION_MATCHES:2,RED_CARDS_FOR_EXPULSION:2});
  ctx.createPendingPayment=(s)=>tables.payments.push({id:'payment-'+s.id,sancion_id:s.id,monto:s.monto,estado:'PENDING'});
  vm.runInContext(fs.readFileSync('backend/SanctionService.gs','utf8'),ctx);
  tables.events.push({id:'group-card',partido_id:'group',jugador_id:'p0',equipo_id:'t0',tipo:'YELLOW_CARD',estado:'ACTIVE',created_at:'2026-10-01'});
  tables.payments.push({id:'old',monto:10,estado:'PAID'});
  ctx.EventService.post({body:{matchId:first.id,teamId:'t0',playerId:'p0',type:'YELLOW_CARD'}});
  assert.equal(tables.sanctions.length,1);assert.equal(tables.sanctions[0].fechas_suspension,0);assert.equal(tables.sanctions[0].monto,10);
  assert.equal(tables.payments[0].estado,'PAID');assert.equal(tables.payments[1].estado,'PENDING');
});
