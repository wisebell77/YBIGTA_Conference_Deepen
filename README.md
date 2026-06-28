# YBIGTA Conference Deepen — Paper Graph Memory

연구 논문 PDF를 업로드하면 **논문과 논문 사이의 관계를 점진적으로 쌓아 올리는 그래프 메모리** 시스템입니다. 새 논문을 올릴 때마다 전체 그래프를 다시 만드는 것이 아니라, 기존 그래프를 기억한 채로 새 논문만 분석해서 관계(edge)를 덧붙입니다. 사용자가 직접 만들거나 수정한 관계는 LLM이 절대 덮어쓰지 않습니다.

Next.js 기반 웹 앱이며, 그래프는 React Flow로 화면에 그려집니다.

## 배포된 데모

🔗 **<https://ybigta-conference-deepen.vercel.app/>**

> ⚠️ 이 링크는 발표/공유용 임시 배포입니다. 무료 인프라(Vercel) 위에서 돌아가고 API 키 사용량·비용 사정에 따라 **예고 없이 내려갈 수 있습니다.** 링크가 동작하지 않으면 아래 "로컬에서 실행하기"를 참고해 직접 띄워 주세요.

## 작동 방식 한눈에 보기

```text
새 PDF 업로드
-> PDF에서 본문 텍스트 추출 (로컬 파서 또는 Upstage Document Parse)
-> LLM이 논문 메타데이터 + 요약 생성
-> 기존 그래프 메모리와 비교해 후보 논문 선별
-> LLM이 논문 간 관계(edge) 추출
-> 사용자가 만든/수정한 관계는 보존한 채 graph.json에 병합
```

핵심 규칙은 단순합니다.

- **노드(node)는 항상 하나의 논문**입니다.
- **엣지(edge)는 항상 논문과 논문 사이의 관계**입니다.
- 새 업로드는 그래프를 통째로 다시 만들지 않고 **점진적으로** 갱신합니다.
- 사용자가 만들거나 수정한(`userEdited`) 엣지는 **LLM이 덮어쓰지 않습니다.** 충돌이 생기면 "관계 제안(edge suggestion)"으로만 남고, 적용 여부는 사용자가 결정합니다.
- 논문을 삭제해도 원본 PDF 파일은 보존되고, 해당 논문의 그래프 기록과 연결된 엣지만 지워집니다.

## 주요 기능

- **그래프 시각화 & 편집** — React Flow로 논문 관계망을 보여주고, 관계 색상/선 스타일/라벨 표시를 설정할 수 있습니다.
- **관계 직접 편집** — 엣지를 드래그로 새로 만들거나, 기존 엣지를 수정·삭제할 수 있습니다.
- **자동 관계 생성 설정** — 후보 점수 가중치, 신뢰도 임계값, 커스텀 프롬프트 등을 조정하고, "Refresh Edges"로 기존 자동 엣지를 현재 정책으로 다시 계산할 수 있습니다(사용자 편집 엣지는 보존).
- **그래프 챗봇** — 우측 하단 `챗봇` 버튼으로, 현재 그래프 맥락(논문 요약·관계·근거)을 읽고 한국어로 답하는 어시스턴트를 띄울 수 있습니다. 그래프를 직접 바꾸지는 않고, 관계 수정/생성을 *제안*하면 사용자가 Apply로 승인해야 반영됩니다.
- **요약 한국어 번역** — 영어로 생성된 논문 요약을 `번역` 버튼으로 한국어로 변환해 저장합니다.
- **도움말 모달** — 우측 하단 `도움말` 버튼(또는 URL에 `#help`)으로 주요 기능 설명을 봅니다.
- **저장소 선택** — 로컬 파일시스템 또는 Google Drive에 그래프와 PDF를 저장할 수 있습니다.

## 로컬에서 실행하기

### 1. 의존성 설치

```bash
npm ci
```

### 2. 환경변수(.env) 설정

저장소 루트에 `.env` 파일을 만들고 키를 채웁니다. `.env.example`이 모든 항목에 대한 설명이 달린 템플릿이니 복사해서 시작하세요.

```bash
cp .env.example .env
```

> ❗ `.env`에는 실제 API 키가 들어가므로 **절대 git에 커밋하지 마세요.** (`.gitignore`에 이미 포함되어 있습니다.) 공개 템플릿은 항상 `.env.example`만 사용합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 <http://localhost:3000> 을 엽니다.

### (선택) 데모 데이터 시드

비어 있는 그래프 대신 예시 논문 그래프를 보고 싶다면:

```bash
npm run seed:local
```

> 이 스크립트는 저장소 **바깥**의 `../data_papers/` 폴더에 있는 데모 PDF들을 복사합니다. 해당 폴더가 없으면 에러가 나므로, **데모 PDF가 있는 경우에만** 실행하세요. 없어도 앱은 빈 그래프 상태로 정상 동작합니다.

## .env 채우는 법 (어떤 키가 필요한가)

이 앱은 세 종류의 외부 서비스를 쓰며, 각각 **하나의 옵션만 골라서** 키를 채우면 됩니다.

### (1) LLM 제공자 — 논문 요약·관계 추출·챗봇에 사용 (필수)

`LLM_PROVIDER`로 아래 셋 중 하나를 고르고, 해당 키만 채우면 됩니다.

**Gemini (기본값, Google AI Studio에서 키 발급)**

```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=여기에_키
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

**Upstage Solar**

```env
LLM_PROVIDER=upstage
LLM_MODEL=solar-pro3
UPSTAGE_API_KEY=여기에_키
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
```

**OpenAI 호환**

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
OPENAI_API_KEY=여기에_키
OPENAI_BASE_URL=https://api.openai.com/v1
```

### (2) PDF 텍스트 추출 — 업로드한 PDF에서 본문을 뽑는 방식 (필수, LLM과 별개로 선택)

```env
# local  : 서버 안에서 pdf-parse 사용 (추가 키 불필요)
# upstage: Upstage Document Parse 사용 (스캔/표/복잡한 레이아웃 PDF에 권장, UPSTAGE_API_KEY 필요)
PDF_TEXT_PROVIDER=upstage
PDF_TEXT_FALLBACK_TO_LOCAL=true
```

`upstage`를 쓰면 위 (1)의 `UPSTAGE_API_KEY`가 그대로 재사용됩니다. 키 없이 가볍게 돌리려면 `PDF_TEXT_PROVIDER=local`로 두세요.

### (3) 저장소 — 그래프와 PDF를 어디에 저장할지 (필수)

**로컬 모드 (기본값, 추가 키 불필요)**

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
```

**Google Drive 모드 (Google Cloud Console에서 OAuth 클라이언트 발급)**

```env
STORAGE_BACKEND=google_drive
GOOGLE_CLIENT_ID=여기에_클라이언트_ID
GOOGLE_CLIENT_SECRET=여기에_시크릿
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_AUTH_FILE=./local_data/tokens/google-auth.json
```

여러 사람이 함께 쓰는 배포(예: Vercel)에서는 OAuth 토큰/세션을 Postgres에 저장해야 합니다. 이때 `DATABASE_URL`(과 필요 시 `DATABASE_SSL=true`)을 추가합니다. 자세한 내용은 [GOOGLE_DRIVE_STORAGE.md](./GOOGLE_DRIVE_STORAGE.md) 참고.

> 처음 가볍게 둘러볼 때는 **LLM 키 하나(Gemini 추천) + `PDF_TEXT_PROVIDER=local` + `STORAGE_BACKEND=local`** 조합이면 충분합니다.

그래프 데이터는 `graph.json` 한 파일에 모입니다. 논문 노드, 논문 간 엣지, 관계 제안, UI 설정, 자동 엣지 생성 설정이 모두 여기에 저장됩니다.

## npm 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 오래된 `.next` 출력 정리 후 개발 서버 실행 |
| `npm run build` | 오래된 `.next` 정리 후 프로덕션 빌드 |
| `npm run start` | 빌드된 프로덕션 서버 실행 |
| `npm run typecheck` | Next.js 라우트 타입 생성 + TypeScript 검사 |
| `npm run lint` | ESLint 실행 |
| `npm run seed:local` | 데모 PDF/그래프를 `local_data`에 시드 (위 주의사항 참고) |

## 폴더 구조

```text
src/app/                  Next.js App Router 진입점과 라우트 핸들러
src/app/api/              그래프·논문·엣지·챗봇·OAuth API 라우트
src/components/           React Flow 워크스페이스와 논문 노드 UI
src/lib/                  도메인 로직 (저장소, PDF, LLM, 병합, 챗봇 등)
src/lib/google-drive/     Google OAuth와 Drive 저장소 어댑터
scripts/                  로컬 유지보수 및 데모 시드 스크립트
docs/                     인수인계/아키텍처 문서
```

폴더별 상세 설명은 각 폴더의 README를 참고하세요.

- [src/app/README.md](./src/app/README.md)
- [src/app/api/README.md](./src/app/api/README.md)
- [src/components/README.md](./src/components/README.md)
- [src/lib/README.md](./src/lib/README.md)
- [src/lib/google-drive/README.md](./src/lib/google-drive/README.md)
- [scripts/README.md](./scripts/README.md)

## 추가 문서

더 깊은 설계 문서는 `docs/`에 있습니다.

- [docs/README.md](./docs/README.md) — 문서 인덱스(읽는 순서 안내)
- [docs/HANDOFF.md](./docs/HANDOFF.md) — 현재 상태, 셋업, 알려진 이슈
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 전체 시스템 흐름
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) — `graph.json` 데이터 모델
- [docs/STORAGE_AND_ENV.md](./docs/STORAGE_AND_ENV.md) — 저장소와 환경변수
- [docs/UI_GRAPH.md](./docs/UI_GRAPH.md) — React Flow UI 구현
- [docs/API.md](./docs/API.md) — API 라우트 명세
- [src/lib/EDGE_GENERATION.md](./src/lib/EDGE_GENERATION.md) — 자동 엣지 생성 로직

## 자주 겪는 문제

### `Cannot find module './611.js'`

대개 오래된 `.next` 빌드 캐시 때문입니다.

```bash
npm run clean
npm run dev
```

`dev`와 `build`는 실행 전에 자동으로 `clean`을 먼저 돌립니다.

### `Cannot find module 'pg'`

의존성이 `package-lock.json`과 어긋난 경우입니다.

```bash
npm ci
```

### React Flow에서 엣지가 안 보임

[src/components/PaperNode.tsx](./src/components/PaperNode.tsx)를 확인하세요. React Flow 커스텀 노드는 엣지를 붙일 `Handle` 컴포넌트가 반드시 있어야 합니다.
