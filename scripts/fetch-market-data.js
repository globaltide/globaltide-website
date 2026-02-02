// scripts/fetch-market-data.js
// 매일 시장 데이터를 수집하여 Supabase에 저장하는 스크립트

import { createClient } from ‘@supabase/supabase-js’;
import fetch from ‘node-fetch’;

// Supabase 설정 (환경 변수에서 가져오기)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
console.error(‘ERROR: SUPABASE_URL or SUPABASE_KEY not set’);
process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// FRED API 키 (환경 변수)
const FRED_API_KEY = process.env.FRED_API_KEY;

// 한국은행 API 키 (환경 변수)
const BOK_API_KEY = process.env.BOK_API_KEY || ‘SX5QXCIIZA4RILTF3CK2’;

// 날짜 포맷 함수 (YYYY-MM-DD)
function formatDate(date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, ‘0’);
const day = String(date.getDate()).padStart(2, ‘0’);
return `${year}-${month}-${day}`;
}

// 한국은행 날짜 포맷 (YYYYMMDD)
function formatBokDate(date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, ‘0’);
const day = String(date.getDate()).padStart(2, ‘0’);
return `${year}${month}${day}`;
}

// FRED API에서 데이터 가져오기
async function fetchFredData(seriesId, startDate, endDate) {
if (!FRED_API_KEY) {
console.warn(`WARNING: FRED_API_KEY not set, skipping ${seriesId}`);
return null;
}

const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}`;

try {
const response = await fetch(url);
const data = await response.json();

```
if (data.observations && data.observations.length > 0) {
  // 가장 최근 데이터 반환
  const latest = data.observations[data.observations.length - 1];
  return latest.value !== '.' ? parseFloat(latest.value) : null;
}
return null;
```

} catch (error) {
console.error(`ERROR fetching ${seriesId}:`, error.message);
return null;
}
}

// 한국은행 API에서 국고채 수익률 가져오기
async function fetchKoreaYield(date) {
try {
const endDate = formatBokDate(date);
// 7일 전부터 조회 (주말/공휴일 대비)
const startDateObj = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
const startDate = formatBokDate(startDateObj);

```
const url = `https://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/10/817Y002/D/${startDate}/${endDate}/010210000`;

console.log(`  [BOK API] ${startDate} ~ ${endDate}`);

const response = await fetch(url);
const data = await response.json();

if (data?.StatisticSearch?.row && data.StatisticSearch.row.length > 0) {
  // 가장 최근 데이터
  const latest = data.StatisticSearch.row[data.StatisticSearch.row.length - 1];
  const value = parseFloat(latest.DATA_VALUE);
  console.log(`  [SUCCESS] Korea 10Y: ${value}% (date: ${latest.TIME})`);
  return value;
}

console.log('  [WARNING] No data from BOK API');
return null;
```

} catch (error) {
console.error(’  [ERROR] Korea 10Y fetch failed:’, error.message);
return null;
}
}

// USD/KRW 환율 가져오기
async function fetchUSDKRW() {
try {
// exchangerate-api.com의 무료 API 사용
const response = await fetch(‘https://api.exchangerate-api.com/v4/latest/USD’);
const data = await response.json();

```
if (data.rates && data.rates.KRW) {
  return data.rates.KRW;
}

// 대체: FRED의 DEXKOUS 사용
const today = formatDate(new Date());
const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
return await fetchFredData('DEXKOUS', thirtyDaysAgo, today);
```

} catch (error) {
console.error(‘ERROR fetching USD/KRW:’, error.message);
return null;
}
}

// 데이터가 비어있는지 확인하는 함수
function needsUpdate(existing) {
if (!existing) return true;

// 주요 필드 중 하나라도 null이면 업데이트 필요
return existing.usdkrw_spot === null ||
existing.us_10y === null ||
existing.us_1y === null ||
existing.sofr_30d === null ||
existing.kor_10y === null;
}

// 메인 데이터 수집 함수
async function collectMarketData() {
console.log(’[START] Collecting market data…’);

const today = new Date();
const todayStr = formatDate(today);
const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

// 1. USD/KRW
console.log(’[1/5] Fetching USD/KRW…’);
const usdkrw = await fetchUSDKRW();

// 2. US 10Y Treasury (DGS10)
console.log(’[2/5] Fetching US 10Y…’);
const us10y = await fetchFredData(‘DGS10’, thirtyDaysAgo, todayStr);

// 3. US 1Y Treasury (DGS1)
console.log(’[3/5] Fetching US 1Y…’);
const us1y = await fetchFredData(‘DGS1’, thirtyDaysAgo, todayStr);

// 4. SOFR 30-day Average (SOFR30DAYAVG)
console.log(’[4/5] Fetching SOFR 30d…’);
const sofr30d = await fetchFredData(‘SOFR30DAYAVG’, thirtyDaysAgo, todayStr);

// 5. Korea 10Y (한국은행 API)
console.log(’[5/5] Fetching Korea 10Y…’);
const kor10y = await fetchKoreaYield(today);

// 데이터 객체 생성
const marketData = {
snapshot_date: todayStr,
usdkrw_spot: usdkrw,
us_10y: us10y,
us_1y: us1y,
sofr_30d: sofr30d,
kor_10y: kor10y,
source_type: ‘auto_script’
};

console.log(’[DATA]’, marketData);

// Supabase에 저장
console.log(’[SAVE] Saving to Supabase…’);

// 먼저 오늘 날짜의 데이터가 있는지 확인
const { data: existing, error: checkError } = await supabase
.from(‘market_snapshots_fred_daily’)
.select(’*’)
.eq(‘snapshot_date’, todayStr)
.single();

if (existing && !needsUpdate(existing)) {
console.log(’[SKIP] Data already complete’);
return true;
}

if (existing) {
// 업데이트
console.log(’[UPDATE] Updating existing data…’);
const { error: updateError } = await supabase
.from(‘market_snapshots_fred_daily’)
.update(marketData)
.eq(‘snapshot_date’, todayStr);

```
if (updateError) {
  console.error('[ERROR] Update failed:', updateError);
  return false;
}
console.log('[SUCCESS] Data updated!');
```

} else {
// 새로 삽입
console.log(’[INSERT] Inserting new data…’);
const { error: insertError } = await supabase
.from(‘market_snapshots_fred_daily’)
.insert([marketData]);

```
if (insertError) {
  console.error('[ERROR] Insert failed:', insertError);
  return false;
}
console.log('[SUCCESS] Data inserted!');
```

}

return true;
}

// 과거 데이터 채우기 함수 (12월 20일 ~ 현재)
async function backfillData() {
console.log(’[BACKFILL] Starting backfill…’);

const startDate = new Date(‘2024-12-20’);
const today = new Date();

let processed = 0;
let updated = 0;
let skipped = 0;

for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
const dateStr = formatDate(d);
console.log(`\n[DATE] ${dateStr}`);

```
// 주말 건너뛰기
const dayOfWeek = d.getDay();
if (dayOfWeek === 0 || dayOfWeek === 6) {
  console.log('  [SKIP] Weekend');
  skipped++;
  continue;
}

// 각 날짜의 데이터 수집
const threeDaysBefore = formatDate(new Date(d.getTime() - 3 * 24 * 60 * 60 * 1000));

console.log('  [FETCH] Collecting data...');
const usdkrw = await fetchUSDKRW();
const us10y = await fetchFredData('DGS10', threeDaysBefore, dateStr);
const us1y = await fetchFredData('DGS1', threeDaysBefore, dateStr);
const sofr30d = await fetchFredData('SOFR30DAYAVG', threeDaysBefore, dateStr);
const kor10y = await fetchKoreaYield(d);

// 데이터 객체 생성
const marketData = {
  snapshot_date: dateStr,
  usdkrw_spot: usdkrw,
  us_10y: us10y,
  us_1y: us1y,
  sofr_30d: sofr30d,
  kor_10y: kor10y,
  source_type: 'backfill_script'
};

console.log(`  [DATA] USD/KRW=${usdkrw}, US10Y=${us10y}, US1Y=${us1y}, SOFR=${sofr30d}, KOR10Y=${kor10y}`);

// 기존 데이터 확인
const { data: existing } = await supabase
  .from('market_snapshots_fred_daily')
  .select('*')
  .eq('snapshot_date', dateStr)
  .single();

if (existing && !needsUpdate(existing)) {
  console.log(`  [SKIP] Data already complete`);
  skipped++;
  continue;
}

if (existing) {
  // 업데이트
  console.log(`  [UPDATE] Updating...`);
  const { error } = await supabase
    .from('market_snapshots_fred_daily')
    .update(marketData)
    .eq('snapshot_date', dateStr);
  
  if (error) {
    console.error(`  [ERROR] Update failed:`, error);
  } else {
    console.log(`  [SUCCESS] Updated!`);
    updated++;
  }
} else {
  // 데이터 삽입
  console.log(`  [INSERT] Inserting...`);
  const { error } = await supabase
    .from('market_snapshots_fred_daily')
    .insert([marketData]);
  
  if (error) {
    console.error(`  [ERROR] Insert failed:`, error);
  } else {
    console.log(`  [SUCCESS] Inserted!`);
    processed++;
  }
}

// API 레이트 리밋 방지를 위한 대기
await new Promise(resolve => setTimeout(resolve, 1000));
```

}

console.log(’\n[SUMMARY]’);
console.log(`  New inserts: ${processed}`);
console.log(`  Updates: ${updated}`);
console.log(`  Skipped: ${skipped}`);
console.log(’\n[DONE] Backfill complete!’);
}

// 스크립트 실행
const args = process.argv.slice(2);
const mode = args[0] || ‘daily’;

if (mode === ‘backfill’) {
backfillData()
.then(() => {
console.log(’\n[SUCCESS] Backfill completed successfully!’);
process.exit(0);
})
.catch(error => {
console.error(’\n[ERROR] Backfill failed:’, error);
process.exit(1);
});
} else {
collectMarketData()
.then(success => {
if (success) {
console.log(’\n[SUCCESS] Data collection completed!’);
process.exit(0);
} else {
console.error(’\n[ERROR] Data collection failed’);
process.exit(1);
}
})
.catch(error => {
console.error(’\n[ERROR] Data collection error:’, error);
process.exit(1);
});
}