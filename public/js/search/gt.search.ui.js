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
    postsE
