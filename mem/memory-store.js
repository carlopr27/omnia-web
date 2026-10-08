'use strict';
// The browser keeps only capabilities and summaries. The source data stays in Sheets/Drive.
window.MEMORA_STORE = (() => {
  const key = 'memora-library-v1';
  const valid = item => item && /^[a-f0-9-]{36}$/i.test(item.memory_id || '') && /^[a-f0-9-]{36}$/i.test(item.token || '');
  function read() { try { const items = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(items) ? items.filter(valid) : []; } catch (_) { return []; } }
  function add(item) {
    if (!valid(item)) return false;
    const items = read(), existing = items.find(x => x.memory_id === item.memory_id);
    const merged = {...existing,...item,saved_at:existing?.saved_at || item.saved_at || new Date().toISOString()};
    const result = [merged,...items.filter(x => x.memory_id !== item.memory_id)];
    try { localStorage.setItem(key,JSON.stringify(result)); return true; } catch (_) { return false; }
  }
  function migrateLegacy() { try { const old = JSON.parse(localStorage.getItem('memora02a')); if (valid(old)) add(old); } catch (_) {} }
  function url(item) {
    if (!valid(item)) return '';
    const target = new URL('memory.html',location.href); target.hash = new URLSearchParams({id:item.memory_id,token:item.token}).toString(); return target.href;
  }
  function fromURL(value) { try { const params = new URLSearchParams(new URL(value,location.href).hash.slice(1)); const item = {memory_id:params.get('id'),token:params.get('token')}; return valid(item) ? item : null; } catch (_) { return null; } }
  return {read,add,migrateLegacy,url,fromURL};
})();
