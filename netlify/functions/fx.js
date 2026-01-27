// netlify/functions/fx.js

/* ---------------------------------------------------
   1) USD/KRW Spot — Yahoo Finance
--------------------------------------------------- */
async function fetchYahooUSDKRW() {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X";
    const res = await fetch(url);
    const j = await res.json();
    const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ?? null;
  } catch (e) {
    console.log("Yahoo USD/KRW fetch error:", e);
    return null;
  }
}

/* ---------------------------------------------------
   2) FRED 데이터 fetch
--------------------------------------------------- */
async function getFRED(series, apiKey, limit = 10) {
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?` +
      `series_id=${series}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;

    const r = await fetch(url);
    const j = await r.json();
    return j?.observations ?? null;
  } catch (e) {
    console.log("FRED fetch error:", e);
    return null;
  }
}

exports.handler = async function (event, context) {
  const FRED_KEY = process.env.FRED_API_KEY || null;

  /* ----------- USD/KRW Spot from Yahoo ---------- */
  const spot = await fetchYahooUSDKRW();

  /* ----------- 1Y Swap 계산 (금리차) ------------ */
  let swap1y = null;

  if (FRED_KEY) {
    // US 1Y: DGS1
    // KR 1Y: IRLTLT01KRM156N (IMF Korea 1Y proxy)
    const usObs = await getFRED("DGS1", FRED_KEY, 10);
    const krObs = await getFRED("IRLTLT01KRM156N", FRED_KEY, 10);

    let us1 = null;
    let kr1 = null;

    if (usObs) {
      for (const o of usObs) {
        if (o.value !== ".") {
          us1 = parseFloat(o.value);
          break;
        }
      }
    }

    if (krObs) {
      for (const o of krObs) {
        if (o.value !== ".") {
          kr1 = parseFloat(o.value);
          break;
        }
      }
    }

    if (us1 != null && kr1 != null) {
      swap1y = +(kr1 - us1).toFixed(2);
    }
  }

  /* ------------ Return -------------- */
  return {
    statusCode: 200,
    body: JSON.stringify({
      spotUSDKRW: spot,
      swap1y: swap1y
    })
  };
};
