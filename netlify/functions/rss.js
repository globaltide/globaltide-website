exports.handler = async function () {
  try {
    const url = "https://news.google.com/rss?hl=en";
    const res = await fetch(url);
    const xml = await res.text();

    // 간단 파싱 (정규식 기반)
    const items = [];
    const regex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const block = match[1];

      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [null, ""])[1];
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [null, ""])[1];
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [null, ""])[1];

      items.push({ title, link, pubDate });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.toString() }),
    };
  }
};
