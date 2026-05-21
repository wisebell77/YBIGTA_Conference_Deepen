# YBIGTA Conference Deepen

PDF 논문을 업로드하면 새 논문을 분석하고, 기존 `graph.json`의 논문 메모리와 비교해 paper node와 paper-to-paper edge를 incremental merge하는 웹 앱입니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Flow
- `pdf-parse`
- Local JSON/PDF storage

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경변수

`.env.example`을 참고해 `.env.local`을 만들 수 있습니다.

```bash
OPENAI_API_KEY=
LLM_MODEL=gpt-4.1-mini
MAX_UPLOAD_MB=20
```

`OPENAI_API_KEY`가 있으면 OpenAI Chat Completions API로 metadata/summary와 relation을 추출합니다. 키가 없으면 로컬 개발 확인용 fallback 분석을 사용하므로 업로드, 저장, graph merge 흐름은 테스트할 수 있습니다.

## 로컬 저장 구조

```text
data/
  projects/
    demo-project/
      papers/
        file_*.pdf
      cache/
        graph.json
        graph.json.bak
```

`data/`는 git에 포함하지 않습니다.

## 주요 API

- `GET /api/projects/:projectId/graph`
- `POST /api/projects/:projectId/papers/upload`
- `GET /api/projects/:projectId/papers/:fileId`
- `PATCH /api/projects/:projectId/edges/:edgeId`
- `POST /api/projects/:projectId/edge-suggestions/:suggestionId/accept`
- `POST /api/projects/:projectId/edge-suggestions/:suggestionId/reject`

## 구현 정책

- Node는 오직 논문입니다.
- Edge는 논문 사이 관계입니다.
- 새 PDF 업로드 시 전체 graph를 재생성하지 않고 새 논문과 후보 논문만 비교합니다.
- 기존 edge는 보존합니다.
- `userEdited=true` edge는 LLM 결과로 덮어쓰지 않습니다.
- 기존 edge와 충돌하는 LLM 판단은 `edgeSuggestions`에만 저장합니다.
- edge 수정 시 `userEdited=true`, `relationSource=user_edited`로 저장합니다.
- LLM relation 결과는 새 논문과 후보 논문 사이의 edge만 허용하며, 후보끼리의 edge나 존재하지 않는 node id는 버립니다.
- `semanticEdgeLimitPerPaper`로 새 논문당 자동 edge 수를 제한합니다.
- Relation filter는 graph canvas와 paper list에 실제로 적용됩니다.
- UI는 흑백/무채색 중심으로 구성했습니다.

## 주요 폴더

```text
src/app/api/                 Route Handlers
src/components/              React Flow UI
src/lib/types.ts             GraphData 타입과 relation/style 상수
src/lib/storage.ts           StorageAdapter, LocalStorageAdapter
src/lib/pdf.ts               PDF 텍스트 추출
src/lib/llm.ts               LLM JSON 호출과 fallback
src/lib/graph-validation.ts  LLM relation 결과 검증/정규화
src/lib/candidates.ts        후보 논문 lexical scoring
src/lib/merge.ts             incremental merge, edge/suggestion 처리
src/lib/analyze.ts           PDF 분석 파이프라인
```
