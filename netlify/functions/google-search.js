// netlify/functions/google-search.js
export async function handler(event) {
  try {
    const q = (event.queryStringParameters?.q || "").trim();
    if (!q) {
      return json(400, { error: "Missing q" });
    }

    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX;

    if (!apiKey || !cx) {
      return json(500, {
        error: "Missing env vars: GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX",
      });
    }

    // 원하는 옵션들: num(최대 10), hl, gl 등 필요하면 추가
    const url =
      "https://www.googleapis.com/customsearch/v1" +
      `?key=${encodeURIComponent(apiKey)}` +
      `&cx=${encodeURIComponent(cx)}` +
      `&q=${encodeURIComponent(q)}` +
      `&num=10`;

    const r = await fetch(url);
    const text = await r.text();

    if (!r.ok) {
      // 구글이 주는 에러 JSON을 그대로 반환
      return json(r.status, { error: "Google API error", detail: safeJson(text) || text });
    }

    const data = safeJson(text) || {};
    return json(200, data);
  } catch (e) {
    return json(500, { error: e?.message || "Unknown error" });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
