// netlify/functions/stats.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Supabase env vars missing");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// user-agent 에서 대략적인 브라우저 이름 뽑기
function detectBrowser(ua = "") {
  if (!ua) return "Unknown";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  return "Other";
}

exports.handler = async () => {
  try {
    // 최근 30일만 집계 (원하면 기간 늘려도 됨)
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("page_views")
      .select("path, user_agent, anon_id, created_at")
      .gte("created_at", from);

    if (error) {
      console.error("Supabase select error:", error);
      return { statusCode: 500, body: "DB error" };
    }

    const byPath = {};
    const byBrowser = {};
    const byDay = {};

    for (const row of data || []) {
      const path = row.path || "/";
      const browser = detectBrowser(row.user_agent || "");
      const day = row.created_at ? row.created_at.slice(0, 10) : "Unknown";
      const anon = row.anon_id || null;

      // 페이지별
      if (!byPath[path]) {
        byPath[path] = { pageviews: 0, visitorsSet: new Set() };
      }
      byPath[path].pageviews += 1;
      if (anon) byPath[path].visitorsSet.add(anon);

      // 브라우저별
      if (!byBrowser[browser]) {
        byBrowser[browser] = { pageviews: 0, visitorsSet: new Set() };
      }
      byBrowser[browser].pageviews += 1;
      if (anon) byBrowser[browser].visitorsSet.add(anon);

      // 일자별
      if (!byDay[day]) {
        byDay[day] = { pageviews: 0, visitorsSet: new Set() };
      }
      byDay[day].pageviews += 1;
      if (anon) byDay[day].visitorsSet.add(anon);
    }

    // Set → 숫자로 정리
    const simplify = (obj) => {
      const out = {};
      for (const key of Object.keys(obj)) {
        out[key] = {
          pageviews: obj[key].pageviews,
          visitors: obj[key].visitorsSet.size
        };
      }
      return out;
    };

    const result = {
      by_path: simplify(byPath),
      by_browser: simplify(byBrowser),
      by_day: simplify(byDay)
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    };
  } catch (e) {
    console.error("stats.js handler error:", e);
    return { statusCode: 500, body: "Server error" };
  }
};
