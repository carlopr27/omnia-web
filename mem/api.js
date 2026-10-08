'use strict';
// A form + iframe bridge avoids depending on cross-origin fetch/CORS in Apps Script.
window.MEMORA_API = function api(action, data = {}, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe'); frame.hidden = true; frame.name = 'bridge_' + requestId;
    const form = document.createElement('form'); form.hidden = true; form.method = 'POST'; form.action = window.REMENTO_CONFIG.API_URL; form.target = frame.name;
    const field = document.createElement('textarea'); field.name = 'payload';
    field.value = JSON.stringify({action, requestId, origin: location.origin, ...data}); form.append(field);
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); frame.remove(); form.remove(); };
    const receive = event => {
      if (!/^https:\/\/(?:script|[a-z0-9-]+-script)\.googleusercontent\.com$/.test(event.origin) && event.origin !== 'https://script.google.com') return;
      const msg = event.data; if (!msg || msg.bridge !== 'memora-02a' || msg.requestId !== requestId) return;
      if (msg.version !== '0.2B.3') { cleanup(); reject(new Error('La página y el servidor tienen versiones distintas. Actualiza Code.gs y publica una nueva versión de Apps Script antes de grabar.')); return; }
      cleanup(); msg.ok ? resolve(msg.data) : reject(new Error(msg.error || 'Error del servidor.'));
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('No llegó la respuesta. Puedes consultar de nuevo o reintentar; se conservará el mismo identificador.')); }, timeout);
    window.addEventListener('message', receive); document.body.append(frame, form); form.submit();
  });
}
