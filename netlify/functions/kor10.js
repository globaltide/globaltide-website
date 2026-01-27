export default async () => {
  const KEY = "SX5QXCIIZA4RILTF3CK2";

  // 오늘 날짜
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const end = `${y}${m}${d}`;

  // 1년 전
  const past = new Date();
  past.setFullYear(past.getFullYear() - 1);
  const py = past.getFullYear();
  const pm = String(past.getMonth() + 1).padStart(2, "0");
  const pd = String(past.getDate()).padStart(2, "0");
  const start = `${py}${pm}${pd}`;

  const makeUrl = (itemCode) =>
    `https://ecos.bok.or.kr/api/StatisticSearch/${KEY}/json/kr/1/365/817Y002/D/${start}/${end}/${itemCode}`;

  const urls = {
    y1: makeUrl("010190000"),     // ✔ 국고채 1년물 (정확한 코드)
    y10: makeUrl("010210000")     // ✔ 국고채 10년물
  };

  try {
    const r1 = await fetch(urls.y1);
    const j1 = await r1.json();
    const rows1 = j1?.StatisticSearch?.row || [];
    const row1 = rows1.at(-1) || null;

    const r10 = await fetch(urls.y10);
    const j10 = await r10.json();
    const rows10 = j10?.StatisticSearch?.row || [];
    const row10 = rows10.at(-1) || null;

    const payload = {
      y1: row1 ? Number(row1.DATA_VALUE) : null,
      y10: row10 ? Number(row10.DATA_VALUE) : null,
    };

    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Internal error",
        detail: e.toString(),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};
