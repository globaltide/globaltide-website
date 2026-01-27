export default async (req, context) => {
  try {
    // 1) 기존에 이미 있는 함수들을 내부 호출해서 데이터 가져오기
    const base = new URL(req.url).origin;

    const [fxRes, ratesRes, korRes] = await Promise.all([
      fetch(`${base}/.netlify/functions/fx`).then(r => r.json()),
      fetch(`${base}/.netlify/functions/rates`).then(r => r.json()),
      fetch(`${base}/.netlify/functions/kor10`).then(r => r.json()),
    ]);

    // 2) 오늘 날짜(한국시간 기준으로 저장하고 싶으면 아래처럼 KST 기준)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const snapshotDate = kst.toISOString().slice(0, 10); // YYYY-MM-DD

    // 3) 필요한 값 매핑 (너의 함수 응답키에 맞춤)
    const payload = {
      snapshot_date: snapshotDate,
      usdkrw_spot: fxRes?.spotUSDKRW ?? null,
      us_10y: ratesRes?.us10 ?? null,
      sofr_30d: ratesRes?.sofr30d ?? null,
      us_1y: ratesRes?.us1 ?? null,
      kor_10y: korRes?.y10 ?? null,
      kor_1y: korRes?.y1 ?? null,
      // usdkrw_swap_1y는 DB에서 us1/kor1/basis로 계산해도 되지만
      // 일단 null로 두고 now.html에서 계산하거나,
      // 여기서 diff 계산해서 넣어도 됨(원하면 다음 단계에서 넣자)
      usdkrw_swap_1y: null,

      source_fx: "netlify:fx",
      source_rates: "netlify:rates",
      source_kor: "netlify:kor10",
      updated_at: new Date().toISOString()
    };

    // 4) Supabase REST로 upsert (Service Role 권장)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "Missing env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/market_snapshots?on_conflict=snapshot_date`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(payload)
    });

    const text = await upsertRes.text();
    if (!upsertRes.ok) {
      return new Response(JSON.stringify({ error: "upsert failed", status: upsertRes.status, body: text }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, snapshot_date: snapshotDate, payload }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
};
