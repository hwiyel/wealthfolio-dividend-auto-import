# Wealthfolio Dividend Auto-Import

A Wealthfolio addon that automatically detects and imports missing dividend entries based on your stock holdings.

## Features

- **Automatic Dividend Detection**: Scans your holdings and identifies missing dividend entries
- **Yahoo Finance Integration**: Fetches dividend data from Yahoo Finance API
- **Multi-Currency Support**: Handles both USD and KRW currencies (for Korean stocks)
- **Smart Filtering & Ignore**: Search and filter dividends by symbol or account name. You can also permanently **ignore** specific dividends so they don't repeatedly show up in scan results (can be restored later in Settings).
- **Modern UI**: Built with @wealthfolio/ui components for a consistent look and feel
- **Bulk Import**: Import multiple dividend entries at once with a single click

## Installation

1. Build the addon:
```bash
pnpm install
pnpm build
```

2. Package the addon:
```bash
pnpm bundle
```

3. Install the `.wealthfolio-addon` file in Wealthfolio

## Usage

1. Open the Dividend Assistant from the sidebar
2. Select an account and date range to scan
3. Click "Scan" to detect missing dividends
4. Review the results and select which dividends to import. If there is a dividend you do not want to see again, click the **Ignore (EyeOff)** icon.
5. Click "Log" to import the selected dividends to your portfolio
6. *Optional*: Manage or restore ignored dividends from the **Settings** page.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev:server

# Build for production
pnpm build

# Package addon
pnpm bundle
```

## Technical Details

- Uses Wealthfolio Addon SDK
- Integrates with Yahoo Finance API for dividend data
- Uses `checkImport` and `import` APIs for safe activity creation
- Supports Korean stocks with `.KS` suffix and KRW currency
- Uses `localStorage` to persist excluded (ignored) dividend items across sessions

## License

MIT

---

## 한국어 (Korean)

# Wealthfolio 배당금 자동 가져오기

보유 주식을 기반으로 누락된 배당금 항목을 자동으로 감지하고 가져오는 Wealthfolio 애드온입니다.

## 기능

- **자동 배당금 감지**: 보유 주식을 스캔하여 누락된 배당금 항목 식별
- **Yahoo Finance 통합**: Yahoo Finance API에서 배당금 데이터 가져오기
- **다중 통화 지원**: USD 및 KRW 통화 지원 (한국 주식용)
- **스마트 필터링 및 제외 기능**: 심볼 또는 계정 이름으로 배당금을 검색하고 필터링할 수 있습니다. 스캔 결과에서 원치 않는 배당금 항목을 영구적으로 **숨김(제외)** 처리할 수 있습니다 (설정에서 언제든 복구 가능).
- **현대적 UI**: @wealthfolio/ui 컴포넌트로 일관된 모양과 느낌 제공
- **대량 가져오기**: 한 번의 클릭으로 여러 배당금 항목 가져오기

## 설치

1. 애드온 빌드:
```bash
pnpm install
pnpm build
```

2. 애드온 패키징:
```bash
pnpm bundle
```

3. Wealthfolio에 `.wealthfolio-addon` 파일 설치

## 사용법

1. 사이드바에서 배당금 도우미 열기
2. 스캔할 계정과 날짜 범위 선택
3. 누락된 배당금을 감지하려면 "스캔" 클릭
4. 결과를 검토하고 가져올 배당금 선택. 더 이상 스캔 결과에 표시하고 싶지 않은 항목이 있다면 **제외하기(눈 감기)** 아이콘을 클릭합니다.
5. 선택한 배당금을 포트폴리오로 가져오려면 "기록" 클릭
6. *선택사항*: 제외 처리한 배당금을 다시 복구하려면 **설정(Settings)** 페이지의 '제외된 배당금' 섹션을 이용하세요.

## 개발

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev:server

# 프로덕션 빌드
pnpm build

# 애드온 패키징
pnpm bundle
```

## 기술적 세부사항

- Wealthfolio Addon SDK 사용
- 배당금 데이터를 위해 Yahoo Finance API 통합
- 안전한 활동 생성을 위해 `checkImport` 및 `import` API 사용
- `.KS` 접미사와 KRW 통화로 한국 주식 지원
- 사용자가 제외한 배당금 목록을 유지하기 위해 `localStorage` 활용

## 라이선스

MIT
