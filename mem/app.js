'use strict';
const $ = id => document.getElementById(id);
const cfg = window.REMENTO_CONFIG;
let questions = [], qi = 0, recorder, stream, chunks = [], blob, objectURL;
let started = 0, duration = 0, clock, deadline, polling, pollGeneration = 0, current;
const MAX = Math.min(180, Number(cfg.MAX_RECORDING_SECONDS) || 180);
const labels = {VIDEO_SAVED:'VIDEO_SAVED · Video guardado. Preparando transcripción…',TRANSCRIBING:'TRANSCRIBING · Transcribiendo tu respuesta…',READY:'READY · Tu transcripción está lista.',ERROR:'ERROR · No se pudo transcribir.'};

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
function resetRecording() {
  stopTracks(); if (objectURL) URL.revokeObjectURL(objectURL); objectURL = null; blob = null;
  $('preview').srcObject = null; $('preview').removeAttribute('src'); $('preview').hidden = true;
  $('save').hidden = $('retake').hidden = $('stop').hidden = true; $('record').hidden = false;
  $('record').disabled = $('another').disabled = !questions.length; $('timer').textContent = '00:00 / 03:00';
}
$('another').onclick = () => { qi = (qi + 1) % questions.length; selectQuestion(); };
$('record').onclick = async () => {
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
    recorder.start(1000); started = performance.now(); $('record').hidden = true; $('stop').hidden = false;
    clock = setInterval(() => { const s = Math.min(MAX,Math.floor((performance.now()-started)/1000)); $('timer').textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')} / 03:00`; if (s >= MAX) stopRecording(); },250);
    deadline = setTimeout(stopRecording,MAX*1000); notice('Grabando…');
  } catch (e) { stopTracks(); resetRecording(); notice(e.message); }
};
$('stop').onclick = stopRecording;
$('retake').onclick = () => { current = null; resetRecording(); notice('Puedes grabar otra vez.'); };
async function base64(video) {
  const bytes = new Uint8Array(await video.arrayBuffer()); let binary = '';
  for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
  const encoded = btoa(binary); if (atob(encoded).length !== video.size) throw new Error('No se pudo validar el video.'); return encoded;
}
function remember() { try { localStorage.setItem('memora02a',JSON.stringify(current)); } catch (_) { notice('El navegador no permite recordar esta sesión al cerrar la página.'); } }
function render(memory) {
  $('memory').hidden = false; $('memoryQuestion').textContent = memory.question;
  $('status').textContent = labels[memory.status] + (memory.error ? ' '+memory.error:'');
  if ($('driveVideo').dataset.file !== memory.drive_file_id) { $('driveVideo').src = `https://drive.google.com/file/d/${encodeURIComponent(memory.drive_file_id)}/preview`; $('driveVideo').dataset.file = memory.drive_file_id; }
  $('driveLink').href = `https://drive.google.com/file/d/${encodeURIComponent(memory.drive_file_id)}/view`;
  $('transcript').textContent = memory.status === 'READY' ? (memory.transcript || 'No se detectó habla en el video.') : 'Esperando la transcripción…';
  $('retry').hidden = memory.status !== 'ERROR';
}
function beginPolling() {
  clearTimeout(polling); const generation = ++pollGeneration; let failures = 0;
  const tick = async () => {
    try {
      const memory = await api('getMemory',current);
      if (generation !== pollGeneration) return;
      failures = 0; render(memory); $('refresh').hidden = true;
      if (memory.status === 'READY' || memory.status === 'ERROR') return;
    } catch (e) {
      if (generation !== pollGeneration) return;
      failures++; $('status').textContent = 'No se pudo consultar el estado. Tu video guardado se conserva. '+e.message;
      $('refresh').hidden = false; if (failures >= 3) return;
    }
    polling = setTimeout(tick,5000);
  }; tick();
}
$('save').onclick = async () => {
  $('save').disabled = $('retake').disabled = true;
  try {
    if (!current) { current = {memory_id:crypto.randomUUID(),token:crypto.randomUUID()}; remember(); }
    notice('Guardando el video en Drive…');
    const memory = await api('saveVideo',{...current,question_id:questions[qi].id,mime_type:blob.type,byte_length:blob.size,duration_seconds:duration,base64:await base64(blob)},240000);
    render(memory); $('save').hidden = $('retake').hidden = true; notice('Video guardado. La transcripción se solicita automáticamente.'); beginPolling();
  } catch (e) { notice(e.message); $('refresh').hidden = false; $('memory').hidden = false; }
  finally { $('save').disabled = $('retake').disabled = false; }
};
$('refresh').onclick = beginPolling;
$('retry').onclick = async () => { $('retry').disabled = true; try { render(await api('retry',current,180000)); beginPolling(); } catch(e) { $('status').textContent = e.message; } finally { $('retry').disabled = false; } };
$('newMemory').onclick = () => { ++pollGeneration; clearTimeout(polling); current = null; try { localStorage.removeItem('memora02a'); } catch (_) {} $('memory').hidden = true; resetRecording(); notice(''); };
window.addEventListener('pagehide',stopTracks);
(async () => {
  try {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cfg.API_URL)) throw new Error('Configura la URL /exec de Apps Script en config.js.');
    questions = await api('questions'); if (!questions.length) throw new Error('Activa al menos una pregunta en Sheets.');
    selectQuestion(); resetRecording();
    try { current = JSON.parse(localStorage.getItem('memora02a')); } catch (_) { current = null; }
    if (current) beginPolling();
  } catch(e) { notice(e.message); }
})();
