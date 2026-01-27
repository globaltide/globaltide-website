// netlify/functions/rates.js
const ECOS_KEY = "SX5QXCIIZA4RILTF3CK2";

// 한국 10년물 (기존 함수 그대로 유지)
async function getKor10() {
  try {
    const t = new Date();
    const end = t.toISOString().slice(0, 10).replace(/-/g, "");
    const start = (t.getFullYear() - 1) + "0101";

    const url =
      `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_KEY}` +
      `/json/kr/1/50/817Y002/D/${start}/${end}/010210000`; // ✔ 국고 10년물 코드 정확히 수정

    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.StatisticSearch?.row;

    if (!rows) return null;

    for (let i = rows.length - 1; i >= 0; i--) {
      const v = parseFloat(rows[i].DATA_VALUE);
      if (!isNaN(v)) return v;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// FRED fetch generic
async function getFRED(series, key) {
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${series}&api_key=${key}&file_type=json&sort_order=desc&limit=10`;
    const r = await fetch(url);
    const j = await r.json();
    return j?.observations ?? null;
  } catch (e) {
    return null;
  }
}

exports.handler = async () => {
  const KEY = process.env.FRED_API_KEY || null;

  if (!KEY) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        us1: null,
        us10: null,
        kor10: null,
        sofr30d: null
      })
    };
  }

  /* ---------------- US 10년물 ---------------- */
  let us10 = null;
  const us10Obs = await getFRED("DGS10", KEY);
  if (us10Obs) {
    for (const o of us10Obs) {
      if (o.value !== ".") {
        us10 = parseFloat(o.value);
        break;
      }
    }
  }

  /* ---------------- US 1년물(NEW) ---------------- */
  let us1 = null;
  const us1Obs = await getFRED("DGS1", KEY);
  if (us1Obs) {
    for (const o of us1Obs) {
      if (o.value !== ".") {
        us1 = parseFloat(o.value);
        break;
      }
    }
  }

  /* ---------------- SOFR ---------------- */
  let sofr30d = null;
  const sofrObs = await getFRED("SOFR30DAYAVG", KEY);
  if (sofrObs) {
    for (const o of sofrObs) {
      if (o.value !== ".") {
        sofr30d = parseFloat(o.value);
        break;
      }
    }
  }

  /* ---------------- Korea 10Y ---------------- */
  const kor10 = await getKor10();

  return {
    statusCode: 200,
    body: JSON.stringify({
      us1,
      us10,
      kor10,
      sofr30d
    })
  };
};
