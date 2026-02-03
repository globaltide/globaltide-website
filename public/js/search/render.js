// js/search/render.js

function escapeHTML(s) {
  return (s ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateKo(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ko-KR');
  } catch (e) {
    return '';
  }
}

export function renderPosts(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="meta">검색 결과가 없습니다.</div>';
    return;
  }

  container.innerHTML = items.map(it => {
    const title = it.title || '';
    const titleKo = it.titleKo || '';
    const link = it.url || it.link || '#';
    const source = it.source || '';
    const date = it.date || '';
    const body = (it.body || '').trim();
    const bodyKo = (it.bodyKo || '').trim();

    return `
      <div class="post">
        <div class="h">
          <h3 class="t">
            <a href="${escapeHTML(link)}" 
               target="_blank" 
               rel="noopener"
               style="font-size:13px;color:#0066cc;text-decoration:none;">
              ${escapeHTML(title)}
            </a>
          </h3>
          <div class="d">${escapeHTML(formatDateKo(date) || date)}</div>
        </div>
        
        ${titleKo && titleKo !== title ? `
          <div style="font-size:14px;color:#333;margin:6px 0 8px 0;line-height:1.5;font-weight:500;">
            ${escapeHTML(titleKo)}
          </div>
        ` : ''}
        
        ${bodyKo ? `
          <div class="s" style="margin-top:8px;color:#555;line-height:1.6;">
            ${escapeHTML(bodyKo)}
          </div>
        ` : (body ? `
          <div class="s" style="margin-top:8px;color:#888;line-height:1.6;">
            ${escapeHTML(body.substring(0, 200))}
          </div>
        ` : '')}
        
        <div class="muted" style="margin-top:12px;">
          ${source ? `<span class="pill">${escapeHTML(source)}</span>` : ''}
          ${it.regionLabel ? `<span class="pill">${escapeHTML(it.regionLabel)}</span>` : ''}
          ${it.typeLabel ? `<span class="pill">${escapeHTML(it.typeLabel)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

export function renderKeywordChips(container, keywords, activeKeyword) {
  if (!keywords || keywords.length === 0) {
    container.innerHTML = '<div class="meta">저장된 키워드가 없습니다.</div>';
    return;
  }

  container.innerHTML = keywords.map(kw => {
    const isActive = kw.keyword === activeKeyword;
    return `
      <div class="kw-chip ${isActive ? 'active' : ''}" data-kw="${escapeHTML(kw.keyword)}">
        <span>${escapeHTML(kw.keyword)}</span>
        <span class="kw-del" data-id="${escapeHTML(kw.id)}">×</span>
      </div>
    `;
  }).join('');
}
