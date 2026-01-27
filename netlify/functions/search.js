(() => {
  const SUPABASE_URL = 'https://toppqscjkkmmelpngzda.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4eEtjEs8RtBFFWnpdTwRfg_DkXpAa7g';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const postsEl = document.getElementById('posts');
  const statusEl = document.getElementById('status');
  const tabsEl = document.getElementById('tabs');

  const kwPanel = document.getElementById('kwPanel');
  const kwUserLine = document.getElementById('kwUserLine');
  const kwInput = document.getElementById('kwInput');
  const kwChips = document.getElementById('kwChips');
  const kwStatus = document.getElementById('kwStatus');
  const toastWrap = document.getElementById('toastWrap');

  let currentUser = null;
  let activeKeyword = 'Private Debt';
  let userKwFilter = null;

  // ✅ Private Debt 탭에서 “관련 기사만” 남기기 위한 동의어 세트
  const TAB_SYNONYMS = {
    'Private Debt': [
      'private debt',
      'private credit',
      'direct lending',
      'private lending',
      'middle market lending',
      'unitranche',
      'mezzanine',
      'senior secured',
      'loan fund',
      'credit fund',
      'private loan',
      'private loans',
      'private capital',
    ],
  };

  function escapeHTML(s){
    return (s ?? '')
      .toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function showToast(text){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastWrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, 1200);
  }

  function formatDateKo(d){
    if(!d) return '';
    try{ return new Date(d).toLocaleDateString('ko-KR'); }catch(e){ return ''; }
  }

  async function loadSession(){
    const { data } = await client.auth.getSession();
    currentUser = data?.session?.user ?? null;
  }

  // Login modal
  const loginModal = document.getElementById('loginModal');
  document.getElementById('closeLoginModal').addEventListener('click', () => {
    loginModal.style.display='none';
    document.body.style.overflow='';
  });
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal){
      loginModal.style.display='none';
      document.body.style.overflow='';
    }
  });

  function openLoginModal(){
    loginModal.style.display='flex';
    document.body.style.overflow='hidden';
    renderLoginState();
  }

  async function renderLoginState(){
    const box = document.getElementById('loginStateBox');
    await loadSession();
    box.textContent = currentUser ? `현재 로그인: ${currentUser.email || ''}` : '현재 로그아웃 상태입니다.';
  }

  async function doGoogleOAuth(){
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) alert('로그인 실패: ' + error.message);
  }
  document.getElementById('btnGoogleLogin').addEventListener('click', doGoogleOAuth);
  document.getElementById('btnGoogleSignup').addEventListener('click', doGoogleOAuth);

  function showKwPanel(show){ kwPanel.style.display = show ? 'block' : 'none'; }

  function setActiveChipUI(){
    [...kwChips.querySelectorAll('.kw-chip')].forEach(ch => {
      ch.classList.toggle('active', ch.getAttribute('data-kw') === userKwFilter);
    });
  }

  // ✅ 테이블명: user_search_keywords (너가 이전에 지정한 이름)
  async function loadMyKeywords(){
    kwStatus.textContent = '';
    kwChips.innerHTML = '<div class="muted" style="margin-top:0;">불러오는 중...</div>';
    if (!currentUser){ kwChips.innerHTML=''; kwStatus.textContent='로그인이 필요합니다.'; return; }

    const { data, error } = await client
      .from('user_search_keywords')
      .select('id, keyword, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending:false });

    if (error){ kwChips.innerHTML=''; kwStatus.textContent = error.message; return; }

    const rows = data || [];
    if (rows.length === 0){
      kwChips.innerHTML = '<div class="muted" style="margin-top:0;">저장된 키워드가 없습니다.</div>';
      return;
    }

    kwChips.innerHTML = rows.map(r => {
      const kw = (r.keyword || '').trim();
      return `
        <button class="kw-chip" data-kw="${escapeHTML(kw)}" type="button">
          <span>${escapeHTML(kw)}</span>
          <span class="kw-del" data-id="${escapeHTML(r.id)}" title="삭제">×</span>
        </button>
      `;
    }).join('');

    setActiveChipUI();
  }

  async function addKeyword(){
    const kw = (kwInput.value || '').trim();
    if (!kw){ kwStatus.textContent='키워드를 입력하세요.'; return; }
    if (!currentUser){ kwStatus.textContent='로그인이 필요합니다.'; return; }

    const { data: ex } = await client
      .from('user_search_keywords')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('keyword', kw)
      .limit(1);

    if (ex && ex.length){ kwStatus.textContent='이미 등록된 키워드입니다.'; return; }

    const { error } = await client
      .from('user_search_keywords')
      .insert([{ user_id: currentUser.id, keyword: kw }]);

    if (error){ kwStatus.textContent = error.message; return; }

    kwInput.value='';
    showToast('키워드가 추가되었습니다');
    await loadMyKeywords();
  }

  async function deleteKeyword(id){
    const { error } = await client
      .from('user_search_keywords')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error){ kwStatus.textContent = error.message; return; }

    if (userKwFilter){
      const stillExists = [...kwChips.querySelectorAll('.kw-del')].some(x => x.getAttribute('data-id') === id);
      if (!stillExists) userKwFilter = null;
    }

    showToast('키워드가 삭제되었습니다');
    await loadMyKeywords();
    await loadNews();
  }

  document.getElementById('kwAddBtn').addEventListener('click', addKeyword);
  kwInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') addKeyword(); });

  kwChips.addEventListener('click', async (e) => {
    const del = e.target.closest('.kw-del[data-id]');
    if (del){ e.stopPropagation(); await deleteKeyword(del.getAttribute('data-id')); return; }

    const chip = e.target.closest('.kw-chip');
    if (!chip) return;

    const kw = chip.getAttribute('data-kw');
    userKwFilter = (userKwFilter === kw) ? null : kw;
    setActiveChipUI();
    showToast(userKwFilter ? `키워드: ${userKwFilter}` : '키워드 해제');
    await loadNews();
  });

  document.getElementById('kwLogoutBtn').addEventListener('click', async () => {
    await client.auth.signOut();
    await loadSession();
    userKwFilter = null;
    showKwPanel(false);
    kwChips.innerHTML='';
    kwStatus.textContent='';
    kwUserLine.textContent='';
    showToast('로그아웃되었습니다');
    await loadNews();
  });

  document.getElementById('btnKeywordManage').addEventListener('click', async () => {
    await loadSession();
    if (!currentUser){ openLoginModal(); return; }

    const open = (kwPanel.style.display === 'block');
    showKwPanel(!open);

    if (!open){
      kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
      await loadMyKeywords();
    }
  });

  // 탭 클릭 → activeKeyword 변경 → 검색
  tabsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;

    [...tabsEl.querySelectorAll('.tab')].forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    activeKeyword = btn.dataset.kw || 'Private Debt';
    showToast(`탭: ${activeKeyword}`);
    await loadNews();
  });

  function buildQueryKeyword(){
    // 서버 쿼리는 그대로 보내되, 최종 노출은 클라이언트에서 관련어 필터링
    return userKwFilter ? `${activeKeyword} ${userKwFilter}`.trim() : activeKeyword;
  }

  function normalizeText(s){
    return (s ?? '').toString().replace(/\s+/g,' ').trim().toLowerCase();
  }

  function isRelevantForTab(tab, item){
    const syns = TAB_SYNONYMS[tab];
    if (!syns || syns.length === 0) return true;

    const hay = normalizeText([
      item?.title,
      item?.snippet,
      item?.body,
      item?.content,
      item?.description
    ].filter(Boolean).join(' '));

    // 탭 관련 동의어 중 하나라도 포함되면 OK
    return syns.some(k => hay.includes(k.toLowerCase()));
  }

  function isRelevantForUserKeyword(userKw, item){
    if (!userKw) return true;
    const k = normalizeText(userKw);
    const hay = normalizeText([
      item?.title,
      item?.snippet,
      item?.body,
      item?.content,
      item?.description
    ].filter(Boolean).join(' '));
    return hay.includes(k);
  }

  function renderPosts(items, keyword, meta){
    if (!items.length){
      postsEl.innerHTML = `
        <div class="muted">표시할 기사가 없습니다.</div>
        <div class="muted" style="margin-top:10px;">
          <span class="pill">검색어: ${escapeHTML(keyword)}</span>
          ${meta?.hint ? `<span class="pill warn">${escapeHTML(meta.hint)}</span>` : ''}
        </div>
      `;
      statusEl.textContent = `검색어: ${keyword}`;
      return;
    }

    postsEl.innerHTML = items.map(it => {
      const title = it.title || '';
      const link = it.url || it.link || '#';
      const source = it.source || it.publisher || '';
      const date = it.date || it.pubDate || it.published_at || '';
      const snip = (it.snippet || it.body || it.description || '').toString().replace(/\s+/g,' ').trim();

      return `
        <div class="post">
          <div class="h">
            <h3 class="t">
              <a href="${escapeHTML(link)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>
            </h3>
            <div class="d">${escapeHTML(formatDateKo(date) || date)}</div>
          </div>
          <div class="s">${escapeHTML(snip)}</div>
          <div class="muted" style="margin-top:8px;">
            ${source ? `<span class="pill">${escapeHTML(source)}</span>` : ``}
            <span class="pill">${escapeHTML(activeKeyword)}</span>
            ${userKwFilter ? `<span class="pill">${escapeHTML(userKwFilter)}</span>` : ``}
          </div>
        </div>
      `;
    }).join('');

    statusEl.textContent = `검색어: ${keyword}` + (meta?.note ? ` · ${meta.note}` : '');
  }

  async function loadNews(){
    postsEl.innerHTML = '<div class="muted">기사를 불러오는 중...</div>';
    statusEl.textContent = '';

    const keyword = buildQueryKeyword();

    try{
      // ✅ 기간 파라미터 없음
      const url = `/.netlify/functions/investor-news?keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok){
        const txt = await res.text().catch(()=> '');
        throw new Error(`Function error (${res.status}): ${txt.slice(0,200)}`);
      }

      const j = await res.json();
      const rawItems = Array.isArray(j?.items) ? j.items : [];

      // ✅ 1차: 탭(Private Debt) 관련성 필터
      const tabFiltered = rawItems.filter(it => isRelevantForTab(activeKeyword, it));

      // ✅ 2차: 내 키워드(선택된 chip) 본문 포함 필터
      const finalItems = tabFiltered.filter(it => isRelevantForUserKeyword(userKwFilter, it));

      // ✅ 결과가 0이면: 탭 필터만 유지하고, 내 키워드 필터는 힌트로 안내
      if (finalItems.length === 0 && rawItems.length > 0){
        if (userKwFilter){
          renderPosts(tabFiltered, keyword, { hint: '내 키워드가 기사 본문/제목에 포함된 결과가 없습니다' });
          return;
        }
      }

      // ✅ 탭 필터 결과도 0이면: 서버가 너무 엉뚱한걸 내려준 것. (그래도 “전부 0”보다 낫게) raw를 그대로 보여주되 경고 배지
      if (tabFiltered.length === 0 && rawItems.length > 0){
        renderPosts(rawItems, keyword, { hint: '서버 결과가 탭과 무관해 보여 전체를 표시합니다' });
        return;
      }

      renderPosts(finalItems, keyword, { note: `총 ${finalItems.length}개` });
    }catch(err){
      postsEl.innerHTML = '<div class="muted">기사를 불러오는 중 오류가 발생했습니다.</div>';
      statusEl.textContent = err.message || String(err);
    }
  }

  (async function init(){
    await loadSession();
    await loadNews();

    client.auth.onAuthStateChange(async () => {
      await loadSession();
      if (kwPanel.style.display === 'block' && currentUser){
        kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
        await loadMyKeywords();
      }
      if (!currentUser) showKwPanel(false);
    });
  })();
})();
