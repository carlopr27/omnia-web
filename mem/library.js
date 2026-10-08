'use strict';
const $ = id => document.getElementById(id);
let memories = [], loadGeneration = 0;
function selectOptions(id,values,label) {
  const selected = $(id).value; $(id).replaceChildren();
  const all = document.createElement('option'); all.value='';all.textContent=label;$(id).append(all);
  for (const value of [...new Set(values)].sort((a,b)=>a.localeCompare(b,'es'))) { const option=document.createElement('option');option.value=value;option.textContent=value;$(id).append(option); }
  $(id).value = values.includes(selected) ? selected : '';
}
function renderLibrary() {
  $('library').replaceChildren();
  const matches=memories.filter(m=>(!$('sectionFilter').value || m.section===$('sectionFilter').value) && (!$('personFilter').value || (m.participant_name || 'Sin nombre')===$('personFilter').value));
  $('libraryNotice').textContent = matches.length ? `${matches.length} recuerdo${matches.length===1?'':'s'}.` : 'Todavía no hay recuerdos con esta selección. Puedes grabar uno nuevo.';
  const groups=new Map(); for(const m of matches){const section=m.section || 'Otros recuerdos';if(!groups.has(section))groups.set(section,[]);groups.get(section).push(m);}
  for(const [name,items] of [...groups].sort(([a],[b])=>a.localeCompare(b,'es'))) {
    const group=document.createElement('div');const heading=document.createElement('h2');heading.textContent=name;group.append(heading);
    for(const m of items){
      const card=document.createElement('section'),title=document.createElement('h3'),person=document.createElement('p'),question=document.createElement('p'),date=document.createElement('small'),link=document.createElement('a');
      title.textContent=m.title || m.question || 'Recuerdo';person.textContent=m.participant_name || 'Sin nombre';question.textContent=m.question;
      const created=new Date(m.created_at);date.textContent=Number.isNaN(created.getTime())?'':created.toLocaleString('es-MX');
      const target=new URL('memory.html',location.href);target.hash=new URLSearchParams({id:m.memory_id}).toString();link.href=target.href;link.textContent='Abrir recuerdo';link.className='buttonLink';
      card.append(title,person,question,date,document.createElement('br'),link);group.append(card);
    }
    $('library').append(group);
  }
}
async function loadMemories() {
  const generation=++loadGeneration;$('reloadMemories').disabled=true;$('libraryNotice').textContent='Cargando recuerdos…';
  try { const result=await window.MEMORA_API('listMemories');if(generation!==loadGeneration)return;memories=result;selectOptions('sectionFilter',memories.map(m=>m.section || 'Otros recuerdos'),'Todas las secciones');selectOptions('personFilter',memories.map(m=>m.participant_name || 'Sin nombre'),'Todas las personas');renderLibrary(); }
  catch(e){if(generation!==loadGeneration)return;$('libraryNotice').textContent=e.message;}
  finally {if(generation===loadGeneration)$('reloadMemories').disabled=false;}
}
$('sectionFilter').onchange=$('personFilter').onchange=renderLibrary;
$('reloadMemories').onclick=loadMemories;
loadMemories();
