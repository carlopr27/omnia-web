'use strict';
const $ = id => document.getElementById(id);
const cfg = window.REMENTO_CONFIG;
const pageMode = document.body.dataset?.page || 'record';
let questions = [], qi = 0, recorder, stream, chunks = [], blob, objectURL;
let started = 0, duration = 0, clock, deadline, polling, pollGeneration = 0, current, draft;
const MAX = Math.min(180, Number(cfg.MAX_RECORDING_SECONDS) || 180);
const labels = {VIDEO_SAVED:'Video guardado. Preparando la transcripción…',TRANSCRIBING:'Video guardado. Transcribiendo tu respuesta…',READY:'Tu transcripción está lista.',ERROR:'Tu video está guardado, pero no se pudo transcribir.'};
const storyLabels = {PENDING:'Preparando tu historia…',GENERATING:'Editando tu historia…',READY:'Tu historia está lista.',ERROR:'La transcripción está lista; no se pudo crear la historia.',SKIPPED:'No se pudo crear una historia porque no se detectó habla.',NOT_REQUESTED:'Puedes crear una historia con esta transcripción.'};

// A form + iframe bridge avoids depending on cross-origin fetch/CORS in Apps Script.
function api(action, data = {}, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe'); frame.hidden = true; frame.name = 'bridge_' + requestId;
    const form = document.createElement('form'); form.hidden = true; form.method = 'POST'; form.action = cfg.API_URL; form.target = frame.name;
    const field = document.createElement('textarea'); field.name = 'payload';
    field.value = JSON.stringify({action, requestId, origin: location.origin, ...data}); form.append(field);
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); frame.remove(); form.remove(); };
    const receive = event => {
      if (!/^https:\/\/(?:script|[a-z0-9-]+-script)\.googleusercontent\.com$/.test(event.origin) && event.origin !== 'https://script.google.com') return;
      const msg = event.data; if (!msg || msg.bridge !== 'memora-02a' || msg.requestId !== requestId) return;
      if (msg.version !== '0.2B.2') { cleanup(); reject(new Error('La página y el servidor tienen versiones distintas. Actualiza Code.gs y publica una nueva versión de Apps Script antes de grabar.')); return; }
      cleanup(); msg.ok ? resolve(msg.data) : reject(new Error(msg.error || 'Error del servidor.'));
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('No llegó la respuesta. Puedes consultar de nuevo o reintentar; se conservará el mismo identificador.')); }, timeout);
    window.addEventListener('message', receive); document.body.append(frame, form); form.submit();
  });
}
function notice(text) { $('notice').textContent = text; }
function selectQuestion() { $('question').textContent = questions[qi].question; }
function stopTracks() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
function stopRecording() { if (recorder && recorder.state === 'recording') recorder.stop(); }
function forgetCurrent() { current = null; try { localStorage.removeItem('memora02a'); } catch (_) {} }
function clearMemoryView() {
  $('memory').hidden = true; $('driveVideo').removeAttribute('src'); delete $('driveVideo').dataset.file;
  $('driveLink').removeAttribute('href'); $('memoryQuestion').textContent = $('transcript').textContent = $('storyText').textContent = $('status').textContent = $('storyNotice').textContent = '';
  $('storyTitle').textContent = 'Tu historia editada'; $('refresh').hidden = true;
  $('openMemory').hidden = $('copyMemory').hidden = true; $('linkNotice').textContent = '';
}
function beginNewCapture() {
  ++pollGeneration; clearTimeout(polling); forgetCurrent(); draft = null; clearMemoryView(); resetRecording();
}
function resetRecording() {
  stopTracks(); if (objectURL) URL.revokeObjectURL(objectURL); objectURL = null; blob = null;
  $('preview').srcObject = null; $('preview').removeAttribute('src'); $('preview').hidden = true;
  $('save').hidden = $('retake').hidden = $('stop').hidden = true; $('record').hidden = false;
  $('record').disabled = $('another').disabled = !questions.length; $('timer').textContent = '00:00 / 03:00';
  $('recordingPanel').hidden = false;
}
$('another').onclick = () => { qi = (qi + 1) % questions.length; selectQuestion(); };
$('record').onclick = async () => {
  // A restored memory is a viewer, never the identity of a new recording.
  beginNewCapture();
  $('record').disabled = true; $('another').disabled = true;
  try {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Este navegador no permite grabar video. Abre el sitio HTTPS en Chrome o Safari actualizado.');
    stream = await navigator.mediaDevices.getUserMedia({audio:true,video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:24,max:24}}});
    const mime = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(stream, {...(mime ? {mimeType:mime}:{}),videoBitsPerSecond:400000,audioBitsPerSecond:48000});
    chunks = []; $('preview').hidden = false; $('preview').controls = false; $('preview').muted = true; $('preview').srcObject = stream;
    await $('preview').play(); recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(clock); clearTimeout(deadline); duration = Math.min(MAX, (performance.now()-started)/1000);
      stopTracks(); blob = new Blob(chunks,{type:recorder.mimeType || mime});
      $('preview').srcObject = null; objectURL = URL.createObjectURL(blob); $('preview').src = objectURL;
      $('preview').muted = false; $('preview').controls = true;
      $('stop').hidden = true; $('save').hidden = $('retake').hidden = false; $('save').disabled = !blob.size;
      notice(blob.size ? 'Revisa el video y el audio antes de guardarlo.' : 'La grabación está vacía. Vuelve a grabar.');
    };
    recorder.onerror = () => { notice('Falló la grabación. Vuelve a intentarlo.'); stopRecording(); stopTracks(); };
    recorder.start(1000); started = performance.now();
    draft = {memory_id:crypto.randomUUID(),token:crypto.randomUUID(),question_id:questions[qi].id};
    $('record').hidden = true; $('stop').hidden = false;
    clock = setInterval(() => { const s = Math.min(MAX,Math.floor((performance.now()-started)/1000)); $('timer').textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')} / 03:00`; if (s >= MAX) stopRecording(); },250);
    deadline = setTimeout(stopRecording,MAX*1000); notice('Grabando…');
  } catch (e) { stopTracks(); resetRecording(); notice(e.message); }
};
$('stop').onclick = stopRecording;
$('retake').onclick = () => { beginNewCapture(); notice('Puedes grabar otra vez.'); };
async function base64(video) {
  const bytes = new Uint8Array(await video.arrayBuffer()); let binary = '';
  for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
  const encoded = btoa(binary); if (atob(encoded).length !== video.size) throw new Error('No se pudo validar el video.'); return encoded;
}
function remember() { try { localStorage.setItem('memora02a',JSON.stringify(current)); } catch (_) { notice('El navegador no permite recordar esta sesión al cerrar la página.'); } }
function render(memory) {
  $('recordingPanel').hidden = true;
  $('memory').hidden = false; $('memoryQuestion').textContent = memory.question;
  $('status').textContent = labels[memory.status] + (memory.error ? ' '+memory.error:'');
  if ($('driveVideo').dataset.file !== memory.drive_file_id) { $('driveVideo').src = `https://drive.google.com/file/d/${encodeURIComponent(memory.drive_file_id)}/preview`; $('driveVideo').dataset.file = memory.drive_file_id; }
  $('driveLink').href = `https://drive.google.com/file/d/${encodeURIComponent(memory.drive_file_id)}/view`;
  $('transcript').textContent = memory.status === 'READY' ? (memory.transcript || 'No se detectó habla en el video.') : 'Esperando la transcripción…';
  $('retry').hidden = memory.status !== 'ERROR';
  const stage = memory.story_status || 'NOT_REQUESTED';
  if (memory.status === 'READY') $('status').textContent = storyLabels[stage] || labels.READY;
  $('storyTitle').textContent = stage === 'READY' ? memory.story_title : 'Tu historia editada';
  $('storyText').textContent = stage === 'READY' ? memory.story_text : (memory.status === 'READY' ? storyLabels[stage] || 'Esperando la historia…' : 'La historia aparecerá después de la transcripción.');
  $('storyNotice').textContent = memory.story_error || '';
  $('storyCredit').hidden = stage !== 'READY';
  $('createStory').hidden = memory.status !== 'READY' || stage !== 'NOT_REQUESTED';
  $('retryStory').hidden = memory.status !== 'READY' || stage !== 'ERROR';
  $('stepSave').textContent = '1. Video guardado';
  $('stepTranscript').textContent = memory.status === 'READY' ? '2. Transcripción original lista' : memory.status === 'ERROR' ? '2. Transcripción: necesita un reintento' : '2. Transcribiendo tu respuesta…';
  $('stepStory').textContent = stage === 'READY' ? '3. Historia editada lista' : stage === 'GENERATING' ? '3. Preparando tu historia editada…' : stage === 'ERROR' ? '3. Historia: necesita un reintento' : stage === 'SKIPPED' ? '3. Sin habla para crear la historia' : '3. Historia editada pendiente';
  if (memory.error && memory.status === 'READY') $('status').textContent += ' '+memory.error;
  if (current && window.MEMORA_STORE) {
    const saved = window.MEMORA_STORE.add({...current,question:memory.question,title:memory.story_title || '',status:memory.status,story_status:stage,created_at:memory.created_at || ''});
    $('openMemory').href = window.MEMORA_STORE.url(current); $('openMemory').hidden = false;
    $('copyMemory').hidden = false;
    $('linkNotice').textContent = saved ? '' : 'Guarda el enlace de este recuerdo: este navegador no permite conservar la lista.';
  }
}
function beginPolling() {
  if (!current) return;
  clearTimeout(polling); const generation = ++pollGeneration, requested = current; let failures = 0;
  const tick = async () => {
    try {
      const memory = await api('getMemory',requested,180000);
      if (generation !== pollGeneration) return;
      failures = 0; render(memory); $('refresh').hidden = true;
      if (memory.status === 'ERROR' || (memory.status === 'READY' && ['READY','ERROR','SKIPPED','NOT_REQUESTED'].includes(memory.story_status || 'NOT_REQUESTED'))) return;
    } catch (e) {
      if (generation !== pollGeneration) return;
      failures++; $('status').textContent = 'No se pudo consultar el estado. Tu video guardado se conserva. '+e.message;
      $('refresh').hidden = false; if (failures >= 3) return;
    }
    polling = setTimeout(tick,5000);
  }; tick();
}
$('save').onclick = async () => {
  if ($('save').disabled || !draft || !blob) return;
  const savingDraft = draft, savingBlob = blob, savingDuration = duration;
  $('save').disabled = $('retake').disabled = true;
  current = {memory_id:savingDraft.memory_id,token:savingDraft.token}; remember();
  try {
    notice('Guardando tu video…');
    const memory = await api('saveVideo',{...savingDraft,mime_type:savingBlob.type,byte_length:savingBlob.size,duration_seconds:savingDuration,base64:await base64(savingBlob)},240000);
    if (draft !== savingDraft) return;
    render(memory); draft = null; $('save').hidden = $('retake').hidden = true; notice(''); beginPolling();
  } catch (e) {
    if (draft !== savingDraft) return;
    notice(e.message+' Puedes pulsar Guardar video otra vez para recuperar esta misma grabación.');
    $('refresh').hidden = false;
  }
  finally { if (draft === savingDraft || !draft) $('save').disabled = $('retake').disabled = false; }
};
$('refresh').onclick = beginPolling;
$('retry').onclick = async () => { $('retry').disabled = true; try { render(await api('retry',current,180000)); beginPolling(); } catch(e) { $('status').textContent = e.message; } finally { $('retry').disabled = false; } };
async function requestStory(action) {
  $('createStory').disabled = $('retryStory').disabled = true;
  ++pollGeneration; clearTimeout(polling);
  const requested = current;
  try { const result = await api(action,requested,180000); if (current !== requested) return; render(result); beginPolling(); }
  catch(e) { if (current !== requested) return; $('storyNotice').textContent = e.message; $('refresh').hidden = false; }
  finally { $('createStory').disabled = $('retryStory').disabled = false; }
}
$('createStory').onclick = () => requestStory('generateStory');
$('retryStory').onclick = () => requestStory('retryStory');
$('newMemory').onclick = () => { if (pageMode === 'memory') { location.href = 'index.html'; return; } beginNewCapture(); notice('Puedes responder la misma pregunta con un video nuevo.'); };
$('copyMemory').onclick = async () => {
  const url = window.MEMORA_STORE.url(current);
  try { await navigator.clipboard.writeText(url); $('linkNotice').textContent = 'Enlace copiado. Quien tenga este enlace podrá abrir el texto; el video mantiene sus permisos de Drive.'; }
  catch (_) { $('linkNotice').textContent = 'Copia el enlace con Abrir página del recuerdo → Copiar dirección del enlace.'; }
};
window.addEventListener('pagehide',stopTracks);
(async () => {
  try {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cfg.API_URL)) throw new Error('Configura la URL /exec de Apps Script en config.js.');
    window.MEMORA_STORE.migrateLegacy();
    if (pageMode === 'memory') {
      $('recordingPanel').hidden = true;
      current = window.MEMORA_STORE.fromURL(location.href);
      if (!current) throw new Error('Este enlace está incompleto. Abre un recuerdo desde Recuerdos o usa su enlace completo.');
      $('memory').hidden = false; $('status').textContent = 'Cargando tu recuerdo…'; beginPolling(); return;
    }
    questions = await api('questions'); if (!questions.length) throw new Error('Activa al menos una pregunta en Sheets.');
    selectQuestion(); resetRecording();
    // Entry is ALWAYS a fresh recorder. Old capabilities live in the library, never auto-open.
    current = null;
  } catch(e) { $('pageNotice').textContent = e.message; notice(e.message); }
})();
