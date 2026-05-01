# Wealthfolio Dividend Assistant Addon

This project is a [Wealthfolio](https://wealthfolio.app) addon that automatically detects and imports missing dividend entries based on a user's stock holdings and transaction history.

## Project Overview

- **Core Functionality**: Scans portfolio activities (BUY/SELL) to determine holdings on ex-dividend dates, fetches dividend data from Yahoo Finance, and identifies missing DIVIDEND entries.
- **Technologies**:
    - **Frontend**: React 19, TypeScript, Vite
    - **UI**: @wealthfolio/ui (Tailwind-based components)
    - **Data Fetching**: @tanstack/react-query
    - **Addon SDK**: @wealthfolio/addon-sdk (v3.2.0)
- **Architecture**:
    - `manifest.json`: Defines addon metadata, entry points, and required permissions.
    - `src/addon.tsx`: Main entry point, handles UI integration and sidebar registration.
    - `src/dividendLogic.ts`: Contains the business logic for calculating holdings and identifying missing dividends.

## Building and Running

The project uses `pnpm` as its package manager.

| Task | Command | Description |
| :--- | :--- | :--- |
| **Install** | `pnpm install` | Install all dependencies. |
| **Build** | `pnpm build` | Build the project for production into the `dist/` directory. |
| **Dev (Watch)**| `pnpm dev` | Build and watch for changes. |
| **Dev Server** | `pnpm dev:server`| Starts the `wealthfolio` development server. |
| **Bundle** | `pnpm bundle` | Cleans, builds, and packages the addon into a ZIP file in `dist/`. |
| **Lint** | `pnpm lint` | Runs TypeScript type checking (`tsc --noEmit`). |

## Development Conventions

- **Addon Entry Point**: The `enable(ctx: AddonContext)` function in `src/addon.tsx` is the primary entry point. It registers sidebar items and routes.
- **Permissions**: All required API permissions must be declared in `manifest.json`. Currently uses `accounts`, `activities`, `market`, and `ui` (sidebar/router) permissions.
- **Dividend Logic**:
    - Uses a "lot ledger" approach to calculate share holdings on a specific date.
    - Ex-dividend eligibility requires holding shares *before* the ex-date.
    - Supports Korean stocks by appending `.KS` suffix and using `KRW` currency.
- **UI Standards**:
    - Uses `@wealthfolio/ui` components for consistency with the main app.
    - Uses Lucide icons via `lucide-react`.
    - Implements responsive design with Tailwind CSS.
- **Data Integrity**:
    - Uses `ctx.api.activities.checkImport` and `ctx.api.activities.import` for safe activity creation.
    - Deduplicates dividends using a `symbol|accountId|date` key.

## Key Files

- `manifest.json`: Addon configuration and permissions.
- `src/addon.tsx`: UI and integration logic.
- `src/dividendLogic.ts`: Holding calculations and missing dividend detection.
- `vite.config.ts`: Build configuration using `@vitejs/plugin-react`.

---

## 한국어 (Korean)

# Wealthfolio 배당금 도우미 애드온

이 프로젝트는 사용자의 주식 보유 현황과 거래 내역을 바탕으로 누락된 배당금 항목을 자동으로 감지하고 추가(Import)해 주는 [Wealthfolio](https://wealthfolio.app) 애드온입니다.

## 프로젝트 개요

- **핵심 기능**: 포트폴리오 활동(매수/매도)을 스캔하여 배당락일 기준 보유 주식수를 계산하고, Yahoo Finance에서 배당 데이터를 가져와 기록되지 않은 '배당금(DIVIDEND)' 활동을 식별합니다.
- **기술 스택**:
    - **프론트엔드**: React 19, TypeScript, Vite
    - **UI**: @wealthfolio/ui (Tailwind CSS 기반 컴포넌트)
    - **데이터 페칭**: @tanstack/react-query
    - **Addon SDK**: @wealthfolio/addon-sdk (v3.2.0)
- **아키텍처**:
    - `manifest.json`: 애드온 메타데이터, 진입점, 요구 권한 정의.
    - `src/addon.tsx`: 메인 진입점. UI 연동 및 사이드바 등록 처리.
    - `src/dividendLogic.ts`: 보유 수량 계산 및 누락된 배당금 식별을 위한 비즈니스 로직.

## 빌드 및 실행

이 프로젝트는 패키지 매니저로 `pnpm`을 사용합니다.

| 작업 (Task) | 명령어 (Command) | 설명 (Description) |
| :--- | :--- | :--- |
| **설치 (Install)** | `pnpm install` | 모든 의존성 패키지를 설치합니다. |
| **빌드 (Build)** | `pnpm build` | 프로덕션 환경을 위해 `dist/` 폴더에 프로젝트를 빌드합니다. |
| **개발 (Watch)**| `pnpm dev` | 코드를 빌드하고 변경 사항을 감시(watch)합니다. |
| **서버 (Dev Server)** | `pnpm dev:server`| `wealthfolio` 자체 개발 서버를 시작합니다. |
| **번들링 (Bundle)** | `pnpm bundle` | 기존 빌드를 정리하고 새로 빌드한 뒤, `dist/` 폴더에 애드온 ZIP 파일을 패키징합니다. |
| **린트 (Lint)** | `pnpm lint` | TypeScript 타입 체크를 수행합니다 (`tsc --noEmit`). |

## 개발 규칙 및 규약

- **애드온 진입점**: `src/addon.tsx` 파일 내의 `enable(ctx: AddonContext)` 함수가 가장 먼저 실행됩니다. 여기서 사이드바 메뉴와 라우트를 등록합니다.
- **권한 (Permissions)**: 필요한 모든 API 권한은 `manifest.json`에 선언되어야 합니다. 현재 `accounts`, `activities`, `market`, `ui` 권한을 사용 중입니다.
- **배당 로직**:
    - 특정 날짜의 주식 보유량을 정확히 계산하기 위해 "Lot Ledger(거래 원장)" 방식을 사용합니다.
    - 배당금을 받을 권리는 배당락일(ex-date) **이전**에 주식을 보유하고 있어야 발생합니다.
    - 종목 코드에 `.KS` 접미사를 추가하고 `KRW` 통화를 사용하여 한국 주식을 특별 지원합니다.
- **UI 표준**:
    - 메인 앱과의 일관성을 위해 `@wealthfolio/ui` 컴포넌트 라이브러리를 사용합니다.
    - 아이콘은 `lucide-react`를 통해 제공받습니다.
    - Tailwind CSS를 사용하여 반응형 디자인을 구현합니다.
- **데이터 무결성**:
    - 안전한 활동 데이터 추가를 위해 `ctx.api.activities.checkImport` 호출 후 `ctx.api.activities.import`를 호출하는 2단계 검증 방식을 사용합니다.
    - `symbol|accountId|date` 조합 키를 사용하여 배당금 기록이 중복되지 않도록 방지합니다.

## 주요 파일

- `manifest.json`: 애드온 설정 및 권한 명세
- `src/addon.tsx`: UI 및 전체적인 통합 로직
- `src/dividendLogic.ts`: 보유량 계산 및 누락 배당금 감지 로직
- `vite.config.ts`: `@vitejs/plugin-react`를 사용하는 Vite 빌드 설정 파일