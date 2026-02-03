// public/js/search/gt.search.keywords.js

function $(id){ return document.getElementById(id); }

function escapeHTML(s){
  return (s ?? "")
    .toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export function showKwPanel(show){
  const kwPanel = $("kwPanel");
  if (kwPanel) kwPanel.style.display = show ? "block" : "none";
}

export async function loadMyKeywords(client, user){
  const kwChips = $("kwChips");
  const kwStatus = $("kwStatus");

  if (kwStatus) kwStatus.textContent = "";
  if (!kwChips) return [];

  if (!user){
    kwChips.innerHTML = "";
    if (kwStatus) kwStatus.textContent = "로그인이 필요합니다.";
    return [];
  }

  kwChips.innerHTML = `<div class="muted" style="margin-top:0;">불러오는 중...</div>`;

  const { data, error } = await client
    .from("user_search_keywords")
    .select("id, keyword, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error){
    kwChips.innerHTML = "";
    if (kwStatus) kwStatus.textContent = error.message;
    return [];
  }

  const rows = data || [];
  if (rows.length === 0){
    kwChips.innerHTML = `<div class="muted" style="margin-top:0;">저장된 키워드가 없습니다.</div>`;
    return [];
  }

  kwChips.innerHTML = rows.map(r => {
    const kw = (r.keyword || "").trim();
    return `
      <button class="kw-chip" data-kw="${escapeHTML(kw)}" type="button">
        <span>${escapeHTML(kw)}</span>
        <span class="kw-del" data-id="${escapeHTML(r.id)}" title="삭제">×</span>
      </button>
    `;
  }).join("");

  return rows;
}

export async function addKeyword(client, user, keyword){
  const kwStatus = $("kwStatus");
  if (!user){
    if (kwStatus) kwStatus.textContent = "로그인이 필요합니다.";
    return false;
  }

  const kw = (keyword || "").trim();
  if (!kw){
    if (kwStatus) kwStatus.textContent = "키워드를 입력하세요.";
    return false;
  }

  // 중복 체크
  const { data: ex } = await client
    .from("user_search_keywords")
    .select("id")
    .eq("user_id", user.id)
    .eq("keyword", kw)
    .limit(1);

  if (ex && ex.length){
    if (kwStatus) kwStatus.textContent = "이미 등록된 키워드입니다.";
    return false;
  }

  const { error } = await client
    .from("user_search_keywords")
    .insert([{ user_id: user.id, keyword: kw }]);

  if (error){
    if (kwStatus) kwStatus.textContent = error.message;
    return false;
  }

  if (kwStatus) kwStatus.textContent = "";
  return true;
}

export async function deleteKeyword(client, user, id){
  const kwStatus = $("kwStatus");
  if (!user){
    if (kwStatus) kwStatus.textContent = "로그인이 필요합니다.";
    return false;
  }

  const { error } = await client
    .from("user_search_keywords")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error){
    if (kwStatus) kwStatus.textContent = error.message;
    return false;
  }

  if (kwStatus) kwStatus.textContent = "";
  return true;
}

/**
 * Attach events:
 * - clicking chip sets qInput and triggers search
 * - clicking x deletes
 */
export function bindKeywordUIHandlers({
  client,
  getUser,
  onKeywordClicked,
  onDeleted,
}){
  const kwChips = $("kwChips");
  if (!kwChips) return;

  kwChips.addEventListener("click", async (e) => {
    const user = getUser();

    const del = e.target.closest(".kw-del[data-id]");
    if (del){
      e.stopPropagation();
      const ok = await deleteKeyword(client, user, del.getAttribute("data-id"));
      if (ok && onDeleted) onDeleted();
      return;
    }

    const chip = e.target.closest(".kw-chip[data-kw]");
    if (!chip) return;

    const kw = chip.getAttribute("data-kw") || "";
    if (onKeywordClicked) onKeywordClicked(kw);
  });
}
