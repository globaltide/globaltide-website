// netlify/functions/gnews.js
exports.handler = async function (event) {
  try {
    const q = (event.queryStringParameters && event.queryStringParameters.q || "").trim();
    if (!q) return json(400, { error: "missing q" });

    const hl = ((event.queryStringParameters && event.queryStringParameters.hl) || "ko").trim();
    const gl = ((event.queryStringParameters && event.queryStringParameters.gl) || "KR").trim();
    const ceid = ((event.queryStringParameters && event.queryStringParameters.ceid) || "KR:ko").trim();

    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
      `&hl=${encodeURIComponent(hl)}` +
      `&gl=${encodeURIComponent(gl)}` +
      `&ceid=${encodeURIComponent(ceid)}`;

    const r = await fetch(rssUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (GlobalTide RSS Fetcher)",
        "accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
      },
    });

    const xml = await r.text();

    if (!r.ok) {
      return json(r.status, {
        error: "google rss fetch failed",
        status: r.status,
        detail: xml.slice(0, 500),
      });
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "text/xml; charset=utf-8",
        "cache-control": "no-store",
      },
      body: xml,
    };
  } catch (e) {
    return json(500, { error: (e && e.message) ? e.message : "unknown error" });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
