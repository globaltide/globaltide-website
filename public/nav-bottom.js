// nav-bottom.js — GlobalTide bottom nav injector
(() => {
  const BOTTOM_NAV = {
    items: [
      { label: "Board", href: "/board",  match: ["/board", "/board.html"] },
      { label: "Now",   href: "/now",    match: ["/now", "/now.html"] },
      { label: "Search",href: "/search", match: ["/search", "/search.html"] },
    ],
  };

  function norm(p){
    if (!p) return "/";
    p = p.split("?")[0].split("#")[0];
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }
  function isActive(item, path){
    const p = norm(path);
    const m = (item.match || []).map(norm);
    return m.includes(p);
  }

  function ensureCSS(){
    if (document.getElementById("gt-botnav-style")) return;
    const s = document.createElement("style");
    s.id = "gt-botnav-style";
    s.textContent = `
      :root{ --gt-border:#e5e7eb; --gt-active:#111; }
      .gt-botnav{
        position:fixed; left:0; right:0; bottom:0;
        background:#fff;
        border-top:1px solid var(--gt-border);
        display:flex; gap:6px;
        padding:8px;
        justify-content:center;
        z-index:30;
      }
      .gt-botnav a{
        text-decoration:none;
        padding:8px 16px;
        border:1px solid var(--gt-border);
        border-radius:10px;
        background:#f9fafb;
        color:#111;
        font-size:14px;
        font-weight:800;
        white-space:nowrap;
      }
      .gt-botnav a.active{
        background:var(--gt-active);
        color:#fff;
        border-color:var(--gt-active);
      }
    `;
    document.head.appendChild(s);
  }

  function removeExistingBottom(){
    document.querySelectorAll(".tabbar, .gt-botnav").forEach(el => el.remove());
  }

  function buildBottom(path){
    const nav = document.createElement("div");
    nav.className = "gt-botnav";
    BOTTOM_NAV.items.forEach(item => {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (isActive(item, path)) a.classList.add("active");
      nav.appendChild(a);
    });
    return nav;
  }

  function mount(){
    ensureCSS();
    removeExistingBottom();
    document.body.appendChild(buildBottom(location.pathname));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once:true });
  } else {
    mount();
  }
})();
