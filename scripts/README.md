# Market Data Collection Scripts

## 개요
이 디렉토리에는 시장 데이터를 자동으로 수집하는 스크립트가 포함되어 있습니다.

## 설정

### 1. 환경 변수 설정

다음 환경 변수를 설정해야 합니다:

```bash
# Supabase 설정
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_KEY="your-supabase-service-key"

# FRED API 키 (무료 등록: https://fred.stlouisfed.org/docs/api/api_key.html)
export FRED_API_KEY="your-fred-api-key"
```

### 2. GitHub Secrets 설정

GitHub 저장소에서 다음 Secrets를 설정하세요:

1. `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
2. 다음 Secrets 추가:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `FRED_API_KEY`

### 3. FRED API 키 발급

1. https://fred.stlouisfed.org/ 방문
2. 계정 생성/로그인
3. My Account → API Keys → Request API Key
4. 발급받은 키를 `FRED_API_KEY`로 설정

## 사용법

### 일일 데이터 수집 (오늘)

```bash
node scripts/fetch-market-data.js daily
```

또는 간단히:

```bash
node scripts/fetch-market-data.js
```

### 과거 데이터 채우기 (2024-12-20 ~ 현재)

```bash
node scripts/fetch-market-data.js backfill
```

## 자동화

### GitHub Actions (자동 실행)

GitHub Actions 워크플로우가 매일 한국 시간 오전 9시(UTC 0시)에 자동으로 실행됩니다.

수동으로 실행하려면:
1. GitHub 저장소 → `Actions` 탭
2. `Daily Market Data Collection` 워크플로우 선택
3. `Run workflow` 클릭

## 데이터 소스

- **USD/KRW**: exchangerate-api.com (무료) 또는 FRED DEXKOUS
- **US 10Y Treasury**: FRED DGS10
- **SOFR 30-day Average**: FRED SOFR30DAYAVG
- **Korea 10Y**: 수동 입력 필요 (한국은행 API 연동 필요)

## 문제 해결

### Korea 10Y 데이터가 null입니다

현재 Korea 10Y 데이터는 자동 수집되지 않습니다. 한국은행 API를 연동하거나 수동으로 입력해야 합니다.

한국은행 API 연동 방법:
1. https://ecos.bok.or.kr/ 에서 API 키 발급
2. 스크립트에 한국은행 API 호출 코드 추가

### FRED API 에러

- API 키가 올바른지 확인
- API 사용량 제한 확인 (하루 120 requests)
- 인터넷 연결 확인

### Supabase 연결 실패

- `SUPABASE_URL`과 `SUPABASE_SERVICE_KEY`가 올바른지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 테이블 `market_snapshots_fred_daily`가 존재하는지 확인

## 로컬 테스트

```bash
# 환경 변수를 .env 파일에 저장
cat > .env << EOF
SUPABASE_URL=your-url
SUPABASE_SERVICE_KEY=your-key
FRED_API_KEY=your-fred-key
EOF

# dotenv를 사용하여 실행
npm install dotenv
node -r dotenv/config scripts/fetch-market-data.js
```
