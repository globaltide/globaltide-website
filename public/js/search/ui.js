export function $(id){ return document.getElementById(id); }

export function escapeHTML(s){
  return (s ?? '').toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function normalizeText(s){
  return (s ?? '').toString().replace(/\s+/g,' ').trim().toLowerCase();
}

export function setVisible(el, visible){
  if (!el) return;
  el.style.display = visible ? '' : 'none';
}

export function setError(errEl, msg){
  if (!errEl) return;
  if (!msg){
    errEl.style.display = 'none';
    errEl.textContent = '';
    return;
  }
  errEl.style.display = 'block';
  errEl.textContent = msg;
}

export function formatDateKo(d){
  if (!d) return '';
  try{ return new Date(d).toLocaleDateString('ko-KR'); }catch(_){ return String(d); }
}
