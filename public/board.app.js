const SUPABASE_URL = 'https://toppqscjkkmmelpngzda.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eEtjEs8RtBFFWnpdTwRfg_DkXpAa7g';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const postsEl = document.getElementById('posts');
const statusEl = document.getElementById('status');

const kwPanel = document.getElementById('kwPanel');
const kwUserLine = document.getElementById('kwUserLine');
const kwInput = document.getElementById('kwInput');
const kwChips = document.getElementById('kwChips');
const kwStatus = document.getElementById('kwStatus');

const toastWrap = document.getElementById('toastWrap');

let currentTab = 'all';
let currentUser = null;
let activeKeywordFilter = null;

// ===== Utility Functions =====
function escapeHTML(s){
  return (s ?? '')
    .toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function toTextFromHtml(html){
  try{
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    return (doc.body && doc.body.textContent ? doc.body.textContent : '').trim();
  }catch(e){
    return (html || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  }
}

function makeSnippet(content){
  const raw = (content || '');
  const isHtml = raw.startsWith('__HTML__');
  const body = isHtml ? raw.replace(/^__HTML__\s*/,'') : raw;
  const text = isHtml ? toTextFromHtml(body) : body.trim();
  const oneLine = text.replace(/\s+/g,' ').trim();
  if (!oneLine) return '';
  return oneLine.length > 180 ? oneLine.slice(0, 180) + '…' : oneLine;
}

function formatDateKo(d){
  if(!d) return '';
  try{ return new Date(d).toLocaleDateString('ko-KR'); }
  catch(e){ return ''; }
}

function showErrorHint(err){
  const msg = (err && err.message) ? err.message : String(err || '');
  const low = msg.toLowerCase();
  if (low.includes('permission') || low.includes('row level security') || low.includes('rls') || low.includes('jwt') || low.includes('401') || low.includes('403')) {
    return '권한 문제로 읽기가 막혀있습니다. Supabase에서 해당 테이블 SELECT 정책(RLS)을 확인하세요.';
  }
  return msg;
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
  }, 1800);
}

// ===== Session & Posts =====
async function loadSession(){
  const { data } = await client.auth.getSession();
  currentUser = data?.session?.user ?? null;
}

async function loadPosts(){
  postsEl.innerHTML = '<div class="muted">글을 불러오는 중...</div>';
  statusEl.textContent = '';

  let q = client
    .from('board_posts')
    .select('id,title,keyword,author_name,created_at,content,view_count')
    .order('created_at', { ascending:false })
    .limit(50);

  if (currentTab === 'private_credit'){
    q = q.ilike('keyword', '%private credit%');
  }

  if (activeKeywordFilter){
    const k = activeKeywordFilter.replace(/,/g,'');
    q = q.or(`title.ilike.%${k}%,content.ilike.%${k}%,keyword.ilike.%${k}%`);
  }

  const { data, error } = await q;

  if (error){
    console.error(error);
    postsEl.innerHTML = '<div class="muted">글을 불러오는 중 오류가 발생했습니다.</div>';
    statusEl.textContent = showErrorHint(error);
    return;
  }

  if (!data || data.length === 0){
    postsEl.innerHTML = '<div class="muted">표시할 글이 없습니다.</div>';
    return;
  }

  postsEl.innerHTML = data.map(p => {
    const kw = p.keyword ? p.keyword : '기타';
    const title = p.title || '';
    const date = formatDateKo(p.created_at);
    const snip = makeSnippet(p.content || '');
    const author = p.author_name ? p.author_name : '관리자';

    return `
      <div class="post">
        <div class="h">
          <h3 class="t">
            <a href="post.html?id=${encodeURIComponent(p.id)}">${escapeHTML('[' + kw + '] ' + title)}</a>
          </h3>
          <div class="d">${escapeHTML(date)}</div>
        </div>
        <div class="s">${escapeHTML(snip)}</div>
        <div class="muted" style="margin-top:8px;">
          <span class="pill">${escapeHTML(author)}</span>
        </div>
      </div>
    `;
  }).join('');

  if (activeKeywordFilter){
    showToast(`키워드 검색: ${activeKeywordFilter}`);
  }
}

// ===== Tab Navigation =====
document.getElementById('tabs').addEventListener('click', async (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  currentTab = btn.dataset.tab;
  await loadPosts();
});

// ===== Write Button =====
document.getElementById('btnWrite').addEventListener('click', async () => {
  await loadSession();
  
  if (!currentUser) {
    showToast('로그인이 필요합니다');
    openLoginModal();
    return;
  }
  
  window.location.href = 'write.html';
});

// ===== Login Modal =====
const loginModal = document.getElementById('loginModal');
const closeLoginModalBtn = document.getElementById('closeLoginModal');

function openLoginModal(){
  loginModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderLoginState();
}

function closeLoginModal(){
  loginModal.style.display = 'none';
  document.body.style.overflow = '';
}

closeLoginModalBtn.addEventListener('click', closeLoginModal);
loginModal.addEventListener('click', (e) => { 
  if (e.target === loginModal) closeLoginModal(); 
});

async function renderLoginState(){
  const box = document.getElementById('loginStateBox');
  await loadSession();
  if (currentUser){
    box.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
  } else {
    box.textContent = '현재 로그아웃 상태입니다.';
  }
}

async function doGoogleOAuth(){
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/board' }
  });
  if (error){
    console.error(error);
    alert('로그인 실패: ' + error.message);
  }
}

document.getElementById('btnGoogleLogin').addEventListener('click', doGoogleOAuth);
document.getElementById('btnGoogleSignup').addEventListener('click', doGoogleOAuth);

// ===== Keyword Management =====
function showKwPanel(show){
  kwPanel.style.display = show ? 'block' : 'none';
}

function setActiveChipUI(){
  [...kwChips.querySelectorAll('.kw-chip')].forEach(ch => {
    const kw = ch.getAttribute('data-kw');
    if (!kw) return;
    ch.classList.toggle('active', kw === activeKeywordFilter);
  });
}

async function loadMyKeywords(){
  kwStatus.textContent = '';
  kwChips.innerHTML = '<div class="muted" style="margin-top:0;">불러오는 중...</div>';

  if (!currentUser){
    kwChips.innerHTML = '';
    kwStatus.textContent = '로그인이 필요합니다.';
    return;
  }

  const { data, error } = await client
    .from('user_keywords')
    .select('id, keyword, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending:false });

  if (error){
    console.error(error);
    kwChips.innerHTML = '';
    kwStatus.textContent = showErrorHint(error);
    return;
  }

  const rows = data || [];

  if (rows.length === 0){
    kwChips.innerHTML = `<div class="muted" style="margin-top:0;">저장된 키워드가 없습니다.</div>`;
    return;
  }

  kwChips.innerHTML = rows.map(r => {
    const kw = (r.keyword || '').trim();
    return `
      <button class="kw-chip" data-kw="${escapeHTML(kw)}" type="button" title="클릭하면 검색">
        <span>${escapeHTML(kw)}</span>
        <span class="kw-del" data-id="${escapeHTML(r.id)}" title="삭제">×</span>
      </button>
    `;
  }).join('');

  setActiveChipUI();
}

async function addKeyword(){
  kwStatus.textContent = '';
  const kw = (kwInput.value || '').trim();
  if (!kw){
    kwStatus.textContent = '키워드를 입력하세요.';
    return;
  }
  if (!currentUser){
    kwStatus.textContent = '로그인이 필요합니다.';
    return;
  }

  const { data: existing, error: e1 } = await client
    .from('user_keywords')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('keyword', kw)
    .limit(1);

  if (e1){
    console.error(e1);
    kwStatus.textContent = showErrorHint(e1);
    return;
  }
  if (existing && existing.length > 0){
    kwStatus.textContent = '이미 등록된 키워드입니다.';
    return;
  }

  const { error } = await client
    .from('user_keywords')
    .insert([{ user_id: currentUser.id, keyword: kw }]);

  if (error){
    console.error(error);
    kwStatus.textContent = showErrorHint(error);
    return;
  }

  kwInput.value = '';
  showToast('키워드가 추가되었습니다');
  await loadMyKeywords();
}

async function deleteKeyword(rowId){
  kwStatus.textContent = '';
  if (!currentUser){
    kwStatus.textContent = '로그인이 필요합니다.';
    return;
  }

  const { error } = await client
    .from('user_keywords')
    .delete()
    .eq('id', rowId)
    .eq('user_id', currentUser.id);

  if (error){
    console.error(error);
    kwStatus.textContent = showErrorHint(error);
    return;
  }

  showToast('키워드가 삭제되었습니다');
  await loadMyKeywords();
}

document.getElementById('kwAddBtn').addEventListener('click', addKeyword);
kwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addKeyword();
});

kwChips.addEventListener('click', async (e) => {
  const del = e.target.closest('.kw-del[data-id]');
  if (del){
    e.stopPropagation();
    const id = del.getAttribute('data-id');
    await deleteKeyword(id);
    return;
  }

  const chip = e.target.closest('.kw-chip');
  if (!chip) return;

  const kw = chip.getAttribute('data-kw');

  if (activeKeywordFilter === kw){
    activeKeywordFilter = null;
    showToast('키워드 검색 해제');
  } else {
    activeKeywordFilter = kw;
  }

  setActiveChipUI();
  await loadPosts();
});

document.getElementById('kwLogoutBtn').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error){
    alert('로그아웃 실패: ' + error.message);
    return;
  }

  await loadSession();
  activeKeywordFilter = null;
  showKwPanel(false);
  kwChips.innerHTML = '';
  kwStatus.textContent = '';
  kwUserLine.textContent = '';
  setTimeout(() => showToast('로그아웃되었습니다'), 50);

  await loadPosts();
});

document.getElementById('btnKeywordManage').addEventListener('click', async () => {
  await loadSession();

  if (!currentUser){
    openLoginModal();
    return;
  }

  const isOpen = (kwPanel.style.display === 'block');
  showKwPanel(!isOpen);

  if (!isOpen){
    kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
    await loadMyKeywords();
    showToast('키워드 관리 열림');
  } else {
    showToast('키워드 관리 닫힘');
  }
});

// ===== Init =====
(async function init(){
  await loadSession();
  await loadPosts();

  client.auth.onAuthStateChange(async () => {
    await loadSession();
    if (kwPanel.style.display === 'block' && currentUser){
      kwUserLine.innerHTML = '현재 로그인: <b>' + escapeHTML(currentUser.email || '') + '</b>';
      await loadMyKeywords();
    }
    if (!currentUser){
      showKwPanel(false);
    }
  });
})();
