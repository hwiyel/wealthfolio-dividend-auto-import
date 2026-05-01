# Dividend Assistant - Ignore Feature Design (v3.0.1)

## Objective
Allow users to exclude specific dividend items from the scan results so they do not repeatedly show up as "missing" if the user intentionally does not want to import them.

## Technical Design

### 1. Storage (State Persistence)
- **Mechanism**: `localStorage`
- **Key**: `dividend-assistant-ignored-items`
- **Data Structure**: Array/Set of string keys.
- **Key Format**: `symbol|accountId|YYYY-MM-DD` (matching the existing deduplication key pattern used in the app).

### 2. Main UI Integration (`src/pages/Index.tsx` / `src/addon.tsx`)
- **Filtering**: After scanning, filter the detected missing dividends against the `localStorage` ignored list.
- **Action**: Add an "Ignore" button (e.g., EyeOff icon) to each row in the results table.
- **Action Handler**: Clicking "Ignore" adds the item's key to `localStorage` and immediately removes it from the current view.

### 3. Settings UI Integration (`src/pages/Settings.tsx`)
- **Management Section**: A new card titled "Ignored Dividends".
- **List**: Display all currently ignored items (showing Symbol, Date, and potentially Account ID if resolvable).
- **Restore Action**: A "Restore" button next to each item to remove it from the ignored list.

## Development Progress
Check `progress.md` for real-time task tracking.

---

# 배당금 도우미 - 제외 기능 설계 (v3.0.1)

## 목표
사용자가 스캔 결과에서 특정 배당금 항목을 제외(무시)하여, 의도적으로 가져오고 싶지 않은 항목이 "누락됨"으로 계속 표시되지 않도록 합니다.

## 기술 설계

### 1. 데이터 저장 (상태 유지)
- **방식**: `localStorage`
- **키 (Key)**: `dividend-assistant-ignored-items`
- **데이터 구조**: 문자열 키로 구성된 배열 혹은 Set
- **키 포맷**: `symbol|accountId|YYYY-MM-DD` (앱에서 사용하는 기존 중복 방지 키 패턴과 동일하게 사용)

### 2. 메인 UI 연동 (`src/pages/Index.tsx` / `src/addon.tsx`)
- **필터링**: 스캔 후 감지된 누락 배당금 목록을 `localStorage`의 제외 목록과 대조하여 화면에 그리기 전 필터링합니다.
- **액션**: 결과 테이블의 각 행에 "제외하기(Ignore)" 버튼(예: EyeOff 아이콘)을 추가합니다.
- **이벤트 핸들러**: "제외하기"를 클릭하면 해당 항목의 키가 `localStorage`에 추가되고, 현재 결과 화면에서 즉시 제거됩니다.

### 3. 설정 UI 연동 (`src/pages/Settings.tsx`)
- **관리 섹션**: "제외된 배당금(Ignored Dividends)"이라는 새로운 카드를 하단에 추가합니다.
- **목록**: 현재 제외된 모든 항목을 나열하여 보여줍니다 (심볼, 날짜, 계좌 이름 등 표시).
- **복구 액션**: 각 항목 옆에 "복구(Restore)" 버튼을 배치하여, 클릭 시 제외 목록에서 해당 키를 삭제하고 다시 스캔되도록 합니다.

## 개발 진행 상황
진행 상황 추적은 `progress.md` 파일을 확인하세요.