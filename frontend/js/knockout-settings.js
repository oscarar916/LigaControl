import { apiGetFresh, apiPost } from './api.js';
const championshipId=localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId=localStorage.getItem('ligaControlDisciplineId') || '';
const form=document.querySelector('#knockout-settings-form'),status=document.querySelector('#knockout-settings-status');
let plan;
async function load(){
  try {
    if(!disciplineId)throw Error('Selecciona un deporte para configurar sus eliminatorias.');
    plan=(await apiGetFresh('/api/knockouts',{championshipId,disciplineId})).data;
    if(!plan)throw Error('Prepara y guarda primero el borrador de cruces en Partidos → Eliminatorias.');
    form.elements.tieRule.value=plan.tieRule || 'PENALTIES';form.elements.thirdPlace.checked=Boolean(plan.thirdPlace);form.elements.notes.value=plan.notes || '';
  }catch(error){status.textContent=error.message;form.querySelector('button').disabled=true;}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Guardando…';
  try{plan=(await apiPost('/api/knockouts',{championshipId,disciplineId,revision:plan.revision,action:'settings',tieRule:form.elements.tieRule.value,thirdPlace:form.elements.thirdPlace.checked,notes:form.elements.notes.value})).data;status.textContent='Reglas de eliminatorias guardadas.';}
  catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
load();
