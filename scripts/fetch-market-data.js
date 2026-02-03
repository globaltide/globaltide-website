// scripts/fetch-market-data.js
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FRED_API_KEY = process.env.FRED_API_KEY;
const BOK_API_KEY = process.env.BOK_API_KEY || 'SX5QXCIIZA4RILTF3CK2';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBokDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function fetchFredData(seriesId, startDate, endDate) {
  if (!FRED_API_KEY) {
    console.warn('WARNING: FRED_API_KEY not set, skipping ' + seriesId);
    return null;
  }
  const url = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + seriesId + '&api_key=' + FRED_API_KEY + '&file_type=json&observation_start=' + startDate + '&observation_end=' + endDate;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.observations && data.observations.length > 0) {
      const latest = data.observations[data.observations.length - 1];
      return latest.value !== '.' ? parseFloat(latest.value) : null;
    }
    return null;
  } catch (error) {
    console.error('ERROR fetching ' + seriesId + ':', error.message);
    return null;
  }
}

async function fetchKoreaYield(date) {
  try {
    const endDate = formatBokDate(date);
    const startDateObj = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = formatBokDate(startDateObj);
    const url = 'https://ecos.bok.or.kr/api/StatisticSearch/' + BOK_API_KEY + '/json/kr/1/10/817Y002/D/' + startDate + '/' + endDate + '/010210000';
    console.log('  [BOK API] ' + startDate + ' ~ ' + endDate);
    const response = await fetch(url);
    const data = await response.json();
    if (data?.StatisticSearch?.row && data.StatisticSearch.row.length > 0) {
      const latest = data.StatisticSearch.row[data.StatisticSearch.row.length - 1];
      const value = parseFloat(latest.DATA_VALUE);
      console.log('  [SUCCESS] Korea 10Y: ' + value + '% (date: ' + latest.TIME + ')');
      return value;
    }
    console.log('  [WARNING] No data from BOK API');
    return null;
  } catch (error) {
    console.error('  [ERROR] Korea 10Y fetch failed:', error.message);
    return null;
  }
}

async function fetchUSDKRW() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    if (data.rates && data.rates.KRW) {
      return data.rates.KRW;
    }
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return await fetchFredData('DEXKOUS', thirtyDaysAgo, today);
  } catch (error) {
    console.error('ERROR fetching USD/KRW:', error.message);
    return null;
  }
}

function needsUpdate(existing) {
  if (!existing) return true;
  return existing.usdkrw_spot === null || existing.us_10y === null || existing.us_1y === null || existing.sofr_30d === null || existing.kor_10y === null;
}

async function collectMarketData() {
  console.log('[START] Collecting market data...');
  const today = new Date();
  const todayStr = formatDate(today);
  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  
  console.log('[1/5] Fetching USD/KRW...');
  const usdkrw = await fetchUSDKRW();
  console.log('[2/5] Fetching US 10Y...');
  const us10y = await fetchFredData('DGS10', thirtyDaysAgo, todayStr);
  console.log('[3/5] Fetching US 1Y...');
  const us1y = await fetchFredData('DGS1', thirtyDaysAgo, todayStr);
  console.log('[4/5] Fetching SOFR 30d...');
  const sofr30d = await fetchFredData('SOFR30DAYAVG', thirtyDaysAgo, todayStr);
  console.log('[5/5] Fetching Korea 10Y...');
  const kor10y = await fetchKoreaYield(today);
  
  const marketData = {
    snapshot_date: todayStr,
    usdkrw_spot: usdkrw,
    us_10y: us10y,
    us_1y: us1y,
    sofr_30d: sofr30d,
    kor_10y: kor10y,
    source_type: 'auto_script'
  };
  
  console.log('[DATA]', marketData);
  console.log('[SAVE] Saving to Supabase...');
  
  const { data: existing } = await supabase
    .from('market_snapshots_fred_daily')
    .select('*')
    .eq('snapshot_date', todayStr)
    .single();
  
  if (existing && !needsUpdate(existing)) {
    console.log('[SKIP] Data already complete');
    return true;
  }
  
  if (existing) {
    console.log('[UPDATE] Updating existing data...');
    const { error: updateError } = await supabase
      .from('market_snapshots_fred_daily')
      .update(marketData)
      .eq('snapshot_date', todayStr);
    if (updateError) {
      console.error('[ERROR] Update failed:', updateError);
      return false;
    }
    console.log('[SUCCESS] Data updated!');
  } else {
    console.log('[INSERT] Inserting new data...');
    const { error: insertError } = await supabase
      .from('market_snapshots_fred_daily')
      .insert([marketData]);
    if (insertError) {
      console.error('[ERROR] Insert failed:', insertError);
      return false;
    }
    console.log('[SUCCESS] Data inserted!');
  }
  return true;
}

async function backfillData() {
  console.log('[BACKFILL] Starting backfill...');
  const startDate = new Date('2024-12-20');
  const today = new Date();
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    console.log('[DATE] ' + dateStr);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('  [SKIP] Weekend');
      skipped++;
      continue;
    }
    const threeDaysBefore = formatDate(new Date(d.getTime() - 3 * 24 * 60 * 60 * 1000));
    console.log('  [FETCH] Collecting data...');
    const usdkrw = await fetchUSDKRW();
    const us10y = await fetchFredData('DGS10', threeDaysBefore, dateStr);
    const us1y = await fetchFredData('DGS1', threeDaysBefore, dateStr);
    const sofr30d = await fetchFredData('SOFR30DAYAVG', threeDaysBefore, dateStr);
    const kor10y = await fetchKoreaYield(d);
    const marketData = {
      snapshot_date: dateStr,
      usdkrw_spot: usdkrw,
      us_10y: us10y,
      us_1y: us1y,
      sofr_30d: sofr30d,
      kor_10y: kor10y,
      source_type: 'backfill_script'
    };
    console.log('  [DATA] USD/KRW=' + usdkrw + ', US10Y=' + us10y + ', US1Y=' + us1y + ', SOFR=' + sofr30d + ', KOR10Y=' + kor10y);
    const { data: existing } = await supabase
      .from('market_snapshots_fred_daily')
      .select('*')
      .eq('snapshot_date', dateStr)
      .single();
    if (existing && !needsUpdate(existing)) {
      console.log('  [SKIP] Data already complete');
      skipped++;
      continue;
    }
    if (existing) {
      console.log('  [UPDATE] Updating...');
      const { error } = await supabase
        .from('market_snapshots_fred_daily')
        .update(marketData)
        .eq('snapshot_date', dateStr);
      if (error) {
        console.error('  [ERROR] Update failed:', error);
      } else {
        console.log('  [SUCCESS] Updated!');
        updated++;
      }
    } else {
      console.log('  [INSERT] Inserting...');
      const { error } = await supabase
        .from('market_snapshots_fred_daily')
        .insert([marketData]);
      if (error) {
        console.error('  [ERROR] Insert failed:', error);
      } else {
        console.log('  [SUCCESS] Inserted!');
        processed++;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('[SUMMARY]');
  console.log('  New inserts: ' + processed);
  console.log('  Updates: ' + updated);
  console.log('  Skipped: ' + skipped);
  console.log('[DONE] Backfill complete!');
}

const args = process.argv.slice(2);
const mode = args[0] || 'daily';

if (mode === 'backfill') {
  backfillData()
    .then(() => {
      console.log('[SUCCESS] Backfill completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('[ERROR] Backfill failed:', error);
      process.exit(1);
    });
} else {
  collectMarketData()
    .then(success => {
      if (success) {
        console.log('[SUCCESS] Data collection completed!');
        process.exit(0);
      } else {
        console.error('[ERROR] Data collection failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('[ERROR] Data collection error:', error);
      process.exit(1);
    });
}
