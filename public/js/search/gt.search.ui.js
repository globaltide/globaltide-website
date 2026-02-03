// public/js/search/gt.search.ui.js

function $(id){ return document.getElementById(id); }

export function escapeHTML(s){
  return (s ?? "")
    .toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

export function formatDateKo(d){
  if(!d) return "";
  try{
    return new Date(d).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" });
  }catch(_){
    return String(d);
  }
}

export function setLoading(){
  const postsEl = $("posts");
  const statusEl = $("status");
  const errbox = $("errbox");
  if (errbox){ errbox.style.display="none"; errbox.textContent=""; }
  if (statusEl) statusEl.textContent = "";
  if (postsEl) postsEl.innerHTML = `<div class="muted">기사를 불러오는 중...</div>`;
}

export function setStatus(text){
  const statusEl = $("status");
  if (statusEl) statusEl.textContent = text || "";
}

export function showError(userMessage, technicalMessage){
  const postsEl = $("posts");
  const errbox = $("errbox");

  if (postsEl) postsEl.innerHTML = `<div class="muted">${escapeHTML(userMessage || "오류가 발생했습니다.")}</div>`;

  if (errbox){
    errbox.style.display = "block";
    errbox.textContent = technicalMessage || "";
  }
}

export function renderItems(items, metaText){
  const postsEl = $("posts");
  const errbox = $("errbox");
  if (errbox){ errbox.style.display="none"; errbox.textContent=""; }
  if (!postsEl) return;

  if (!items || items.length === 0){
    postsEl.innerHTML = `<div class="muted">표시할 기사가 없습니다.</div>`;
    setStatus(metaText || "");
    return;
  }

  postsEl.innerHTML = items.map(it => {
    const title = it.title || "";
    const link = it.url || "#";
    const source = it.source || "";
    const date = it.date || "";
    // ✅ 한글 요약이 있으면 그걸 우선 사용
    const snip = (it.snippetKo || it.snippet || "").toString().trim();

    return `
      <div class="post">
        <div class="h">
          <h3 class="t">
            <a href="${escapeHTML(link)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>
          </h3>
          <div class="d">${escapeHTML(formatDateKo(date) || date)}</div>
        </div>
        ${snip ? `<div class="s">${escapeHTML(snip)}</div>` : ``}
        <div class="muted" style="margin-top:8px;">
          ${source ? `<span class="pill">${escapeHTML(source)}</span>` : ``}
        </div>
      </div>
    `;
  }).join("");

  setStatus(metaText || "");
}
