
exports.handler = async () => {
  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;

  async function countQuery(filter) {
    const res = await fetch(`${URL}/rest/v1/visits?select=id${filter}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "count=exact"
      }
    });

    const total = res.headers.get("content-range");
    // content-range: 0-9/123  → 뒤의 총 개수만 필요

    if (!total) return 0;
    return parseInt(total.split("/")[1], 10);
  }

  // 총 방문
  const total = await countQuery("");

  // 오늘 방문
  const today = await countQuery(`&ts=gte.${new Date().toISOString().slice(0,10)}T00:00:00`);

  // 최근 7일
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const last7 = await countQuery(`&ts=gte.${weekAgo}`);

  // 최근 50개
  const recentRes = await fetch(`${URL}/rest/v1/visits?select=*&order=ts.desc&limit=50`, {
    headers:{
      apikey: KEY,
      Authorization:`Bearer ${KEY}`
    }
  });
  const recent = await recentRes.json();

  return {
    statusCode: 200,
    body: JSON.stringify({ total, today, last7, recent })
  };
};
