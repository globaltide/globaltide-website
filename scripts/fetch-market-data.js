// scripts/fetch-market-data.js
// 매일 시장 데이터를 수집하여 Supabase에 저장하는 스크립트

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Supabase 설정 (환경 변수에서 가져오기)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// FRED API 키 (환경 변수)
const FRED_API_KEY = process.env.FRED_API_KEY;

// 날짜 포맷 함수 (YYYY-MM-DD)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// FRED API에서 데이터 가져오기
async function fetchFredData(seriesId, startDate, endDate) {
  if (!FRED_API_KEY) {
    console.warn(`⚠️  FRED_API_KEY가 없어 ${seriesId} 데이터를 건너뜁니다.`);
    return null;
  }

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.observations && data.observations.length > 0) {
      // 가장 최근 데이터 반환
      const latest = data.observations[data.observations.length - 1];
      return latest.value !== '.' ? parseFloat(latest.value) : null;
    }
    return null;
  } catch (error) {
    console.error(`❌ ${seriesId} 데이터 가져오기 실패:`, error.message);
    return null;
  }
}

// USD/KRW 환율 가져오기
async function fetchUSDKRW() {
  try {
    // exchangerate-api.com의 무료 API 사용
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    
    if (data.rates && data.rates.KRW) {
      return data.rates.KRW;
    }
    
    // 대체: FRED의 DEXKOUS 사용
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return await fetchFredData('DEXKOUS', thirtyDaysAgo, today);
  } catch (error) {
    console.error('❌ USD/KRW 데이터 가져오기 실패:', error.message);
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
         existing.sofr_30d === null;
}

// 메인 데이터 수집 함수
async function collectMarketData() {
  console.log('🔄 시장 데이터 수집 시작...');
  
  const today = formatDate(new Date());
  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  
  // 1. USD/KRW
  console.log('📊 USD/KRW 데이터 수집 중...');
  const usdkrw = await fetchUSDKRW();
  
  // 2. US 10Y Treasury (DGS10)
  console.log('📊 US 10Y 데이터 수집 중...');
  const us10y = await fetchFredData('DGS10', thirtyDaysAgo, today);
  
  // 3. US 1Y Treasury (DGS1)
  console.log('📊 US 1Y 데이터 수집 중...');
  const us1y = await fetchFredData('DGS1', thirtyDaysAgo, today);
  
  // 4. SOFR 30-day Average (SOFR30DAYAVG)
  console.log('📊 SOFR 30d 데이터 수집 중...');
  const sofr30d = await fetchFredData('SOFR30DAYAVG', thirtyDaysAgo, today);
  
  // 5. Korea 10Y (임시로 null, 한국은행 API 연동 필요)
  console.log('⚠️  Korea 10Y 데이터는 수동 입력이 필요합니다.');
  const kor10y = null;
  
  // 데이터 객체 생성
  const marketData = {
    snapshot_date: today,
    usdkrw_spot: usdkrw,
    us_10y: us10y,
    us_1y: us1y,
    sofr_30d: sofr30d,
    kor_10y: kor10y,
    source_type: 'auto_script'
  };
  
  console.log('📦 수집된 데이터:', marketData);
  
  // Supabase에 저장
  console.log('💾 Supabase에 데이터 저장 중...');
  
  // 먼저 오늘 날짜의 데이터가 있는지 확인
  const { data: existing, error: checkError } = await supabase
    .from('market_snapshots_fred_daily')
    .select('*')
    .eq('snapshot_date', today)
    .single();
  
  if (existing && !needsUpdate(existing)) {
    console.log('✅ 데이터가 이미 완전합니다. 업데이트 불필요.');
    return true;
  }
  
  if (existing) {
    // 업데이트
    console.log('🔄 기존 데이터 업데이트 중...');
    const { error: updateError } = await supabase
      .from('market_snapshots_fred_daily')
      .update(marketData)
      .eq('snapshot_date', today);
    
    if (updateError) {
      console.error('❌ 데이터 업데이트 실패:', updateError);
      return false;
    }
    console.log('✅ 데이터 업데이트 완료!');
  } else {
    // 새로 삽입
    console.log('➕ 새 데이터 삽입 중...');
    const { error: insertError } = await supabase
      .from('market_snapshots_fred_daily')
      .insert([marketData]);
    
    if (insertError) {
      console.error('❌ 데이터 삽입 실패:', insertError);
      return false;
    }
    console.log('✅ 데이터 삽입 완료!');
  }
  
  return true;
}

// 과거 데이터 채우기 함수 (12월 20일 ~ 현재)
async function backfillData() {
  console.log('🔙 과거 데이터 채우기 시작...');
  
  const startDate = new Date('2024-12-20');
  const today = new Date();
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    console.log(`\n📅 ${dateStr} 데이터 처리 중...`);
    
    // 주말 건너뛰기
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('⏭️  주말이므로 건너뜁니다.');
      skipped++;
      continue;
    }
    
    // 각 날짜의 데이터 수집
    const threeDaysBefore = formatDate(new Date(d.getTime() - 3 * 24 * 60 * 60 * 1000));
    
    console.log('  📊 데이터 수집 중...');
    const usdkrw = await fetchUSDKRW();
    const us10y = await fetchFredData('DGS10', threeDaysBefore, dateStr);
    const us1y = await fetchFredData('DGS1', threeDaysBefore, dateStr);
    const sofr30d = await fetchFredData('SOFR30DAYAVG', threeDaysBefore, dateStr);
    
    // 데이터 객체 생성
    const marketData = {
      snapshot_date: dateStr,
      usdkrw_spot: usdkrw,
      us_10y: us10y,
      us_1y: us1y,
      sofr_30d: sofr30d,
      kor_10y: null,
      source_type: 'backfill_script'
    };
    
    console.log(`  📦 수집: USD/KRW=${usdkrw}, US10Y=${us10y}, US1Y=${us1y}, SOFR=${sofr30d}`);
    
    // 기존 데이터 확인
    const { data: existing } = await supabase
      .from('market_snapshots_fred_daily')
      .select('*')
      .eq('snapshot_date', dateStr)
      .single();
    
    if (existing && !needsUpdate(existing)) {
      console.log(`  ✅ ${dateStr} 데이터가 이미 완전합니다.`);
      skipped++;
      continue;
    }
    
    if (existing) {
      // 업데이트
      console.log(`  🔄 ${dateStr} 데이터 업데이트 중...`);
      const { error } = await supabase
        .from('market_snapshots_fred_daily')
        .update(marketData)
        .eq('snapshot_date', dateStr);
      
      if (error) {
        console.error(`  ❌ ${dateStr} 데이터 업데이트 실패:`, error);
      } else {
        console.log(`  ✅ ${dateStr} 데이터 업데이트 완료!`);
        updated++;
      }
    } else {
      // 데이터 삽입
      console.log(`  ➕ ${dateStr} 새 데이터 삽입 중...`);
      const { error } = await supabase
        .from('market_snapshots_fred_daily')
        .insert([marketData]);
      
      if (error) {
        console.error(`  ❌ ${dateStr} 데이터 삽입 실패:`, error);
      } else {
        console.log(`  ✅ ${dateStr} 데이터 삽입 완료!`);
        processed++;
      }
    }
    
    // API 레이트 리밋 방지를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 완료 요약:');
  console.log(`  ➕ 새로 삽입: ${processed}건`);
  console.log(`  🔄 업데이트: ${updated}건`);
  console.log(`  ⏭️  건너뜀: ${skipped}건`);
  console.log('\n✅ 과거 데이터 채우기 완료!');
}

// 스크립트 실행
const args = process.argv.slice(2);
const mode = args[0] || 'daily';

if (mode === 'backfill') {
  backfillData()
    .then(() => {
      console.log('\n🎉 과거 데이터 채우기 성공!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 과거 데이터 채우기 실패:', error);
      process.exit(1);
    });
} else {
  collectMarketData()
    .then(success => {
      if (success) {
        console.log('\n🎉 데이터 수집 성공!');
        process.exit(0);
      } else {
        console.error('\n❌ 데이터 수집 실패');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ 데이터 수집 중 오류:', error);
      process.exit(1);
    });
}
