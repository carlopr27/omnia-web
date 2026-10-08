'use strict';
const library = document.getElementById('library');
window.MEMORA_STORE.migrateLegacy();
const items = window.MEMORA_STORE.read();
document.getElementById('emptyLibrary').hidden = items.length > 0;
for (const item of items) {
  const card = document.createElement('section');
  const title = document.createElement('h2'); title.textContent = item.title || item.question || 'Recuerdo guardado';
  const question = document.createElement('p'); question.textContent = item.question || 'Abre el recuerdo para ver su pregunta y contenido.';
  const date = document.createElement('small'); const created = new Date(item.created_at || item.saved_at);
  date.textContent = Number.isNaN(created.getTime()) ? '' : created.toLocaleString('es-MX');
  const link = document.createElement('a'); link.href = window.MEMORA_STORE.url(item); link.textContent = 'Abrir recuerdo'; link.className = 'buttonLink';
  card.append(title,question,date,document.createElement('br'),link); library.append(card);
}
document.getElementById('importMemory').onsubmit = event => {
  event.preventDefault();
  const item = window.MEMORA_STORE.fromURL(document.getElementById('memoryURL').value);
  if (!item) { document.getElementById('importNotice').textContent = 'Pega el enlace completo, incluido lo que aparece después de #.'; return; }
  window.MEMORA_STORE.add(item); location.href = window.MEMORA_STORE.url(item);
};
