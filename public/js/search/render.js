import { escapeHTML, formatDateKo } from "./ui.js";

export function renderPosts(postsEl, items){
  if (!items || items.length === 0){
    postsEl.innerHTML = `<div class="meta">검색 결과가 없습니다.</div>`;
    return;
  }

  postsEl.innerHTML = items.map(it => {
    const title = it.title || '';
    const link = it.url || '#';
    const source = it.source || '';
    const date = it.date || '';
    const snippet = (it.snippet || '').toString().replace(/\s+/g,' ').trim();

    return `
      <div class="post">
        <div class="h">
          <h3 class="t">
            <a href="${escapeHTML(link)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>
          </h3>
          <div class="d">${escapeHTML(formatDateKo(date) || date)}</div>
        </div>
        <div class="s">${escapeHTML(snippet)}</div>
        <div class="meta" style="margin-top:8px;">
          ${source ? `<span class="pill">${escapeHTML(source)}</span>` : ``}
        </div>
      </div>
    `;
  }).join('');
}

export function renderKeywordChips(kwChipsEl, keywords, activeKeyword){
  if (!keywords || keywords.length === 0){
    kwChipsEl.innerHTML = `<div class="meta">저장된 키워드가 없습니다.</div>`;
    return;
  }

  kwChipsEl.innerHTML = keywords.map(k => {
    const kw = (k.keyword || '').trim();
    const active = (activeKeyword === kw);
    return `
      <button class="kw-chip ${active ? 'active' : ''}" data-kw="${escapeHTML(kw)}" type="button">
        <span>${escapeHTML(kw)}</span>
        <span class="kw-del" data-id="${escapeHTML(k.id)}" title="삭제">×</span>
      </button>
    `;
  }).join('');
}
