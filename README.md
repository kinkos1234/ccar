# CCAR — Customer Account Review System

> VOC(고객의 소리) 수집부터 AI 전략 제언, 주간 보고 메일까지 — 수기 보고 프로세스를 끝까지 자동화한 사내 운영 플랫폼.
> **기획 → 설계 → 개발 → 운영 → 문서화 전 과정 1인 수행** (v1.0 → v2.5, 실운영).

![Node](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-Workflow%20Automation-EA4B71?logo=n8n&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-000000?logo=ollama&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-6%20languages-blue)

> ⚠️ 이 저장소는 **포트폴리오용 공개본**입니다. 실제 사내 운영 코드에서 회사 식별자·크리덴셜·내부 호스트를 전부 가상 값(`Comad`/`ccar.internal`)으로 치환했으며, 데이터는 모두 더미입니다.

---

## 무엇을 해결했나

| Before (수기 프로세스) | After (CCAR) |
|---|---|
| 지사별 VOC를 엑셀·메일로 개별 취합 | 6개 법인 VOC 통합 등록·조회 (법인별 권한 분기) |
| 주간 보고서를 담당자가 직접 작성 | n8n + Ollama가 이슈 요약·전략 제언 자동 생성 |
| 보고 메일 수동 발송 | n8n Schedule Trigger 기반 자동 발송 |
| 대응 지연을 감으로 파악 | Date Score(-5~+5)로 시간 관리 정량화, Risk Gantt 대시보드 |

## 아키텍처

```
┌──────────────┐   REST    ┌──────────────────┐         ┌──────────────────┐
│  Next.js 15  │ ────────► │  Express 5 API   │ ──────► │  PostgreSQL 16   │
│  (React 19,  │           │  (JWT + RBAC,    │ Prisma  │  (모델 10종)      │
│   i18n 6개국) │           │   API 28개)      │         └──────────────────┘
└──────────────┘           └───────┬──────────┘
                                   │ webhook / schedule
                           ┌───────▼──────────┐         ┌──────────────────┐
                           │  n8n Workflows   │ ──────► │  Ollama (로컬 LLM)│
                           │  (AI 분석·메일)   │         │  전략 제언 생성    │
                           └───────┬──────────┘         └──────────────────┘
                                   │ SMTP                ┌──────────────────┐
                                   └───────────────────► │  사내 메일서버     │
                                                         └──────────────────┘
        + Kafka 통합 이벤트 로깅(옵션) · ERP(DataMart) 사용자 동기화
```

**v2.4.3 아키텍처 전환이 핵심 결정** — OpenAI·SendGrid·node-cron 의존을 전부 걷어내고 n8n + Ollama(로컬 LLM) + 사내 메일서버로 이관. 외부 API 비용/보안 이슈를 제거하면서 AI 분석·스케줄링·메일 발송을 워크플로우 하나로 통합했습니다.

## 핵심 기능

- **VOC 라이프사이클** — 등록/조회/수정/삭제, 법인(6개) 권한 분기, N:M 고객·내부 담당자 관리
- **AI 분석** — 고객사별 이슈 요약, 상위 5개 이슈 추출, Evidence 기반 전략 제언 (n8n + Ollama)
- **주간 보고 자동화** — 비동기 보고서 생성 + 진행률 추적 + 메일 자동 발송
- **Date Score** — 접수~대응 시간을 -5~+5로 정량화, Event Type별 표시 분기
- **대시보드** — KPI 카드, Pie/Bar/Line 차트, Risk Gantt 스코어보드, 필터·정렬·페이지네이션
- **인증/권한** — JWT + 4단계 RBAC(ADMIN/MANAGER/STAFF/INACTIVE), ERP 사용자 동기화
- **글로벌** — 한국어·영어·중국어·베트남어·힌디어·스페인어(멕시코) 6개 언어

## 규모

| 항목 | 수치 |
|---|---|
| Backend API | 28 엔드포인트 |
| Frontend 라우트 | 21 페이지 |
| DB 모델 | 10 (Prisma) |
| 설계 문서 | 11종 ([`system_documents/`](system_documents/)) |
| 버전 | v1.0 → v2.5 (실운영 반복 릴리스) |

## 로컬 실행

```bash
# 1. DB
docker compose up -d

# 2. Backend (포트 4000)
cp .env.example .env
npm install
npx prisma migrate deploy   # 또는 npx prisma db push
npm run seed                # 더미 계정: admin / admin123
npm start

# 3. Frontend (포트 41000)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

→ http://localhost:41000 접속, `admin` / `admin123` 로그인.
(n8n·Ollama·Kafka는 옵션 — 없어도 코어 기능은 동작하며, AI 분석 메뉴만 비활성 상태가 됩니다.)

## 설계 문서

`system_documents/2026-02-11/` 에 개발 당시 작성한 설계 문서 11종을 그대로 (익명화하여) 수록했습니다:

Overview · Prompt 전략 · IA · DB 스키마 · API 명세 · AI 분석 룰 · 대시보드 스펙 · 테스트 시나리오 · User Flow · UI 스타일가이드 · 구현 현황 대조표

문서 ↔ 코드 대조표(10번 문서)까지 유지하며 개발한 것이 이 프로젝트의 작업 방식입니다.

## 기술 스택

**Backend** — Node.js, Express 5, Prisma 6, PostgreSQL 16, JWT(jsonwebtoken), bcrypt, KafkaJS
**Frontend** — Next.js 15(App Router), React 19, Tailwind CSS 4, next-intl, Chart.js
**Automation** — n8n(워크플로우·스케줄링), Ollama(로컬 LLM 추론)
**Ops** — pm2(ecosystem.config.js), Playwright(테스트 시나리오)

---

개발: **김정현** — 사내 1인 프로젝트 (기획·설계·풀스택 개발·운영)
