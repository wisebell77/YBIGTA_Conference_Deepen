# `src/components` Module Notes

> **이 폴더는 무엇인가요?**
> 사용자가 실제로 보고 조작하는 그래프 UI입니다. React Flow 워크스페이스(`GraphWorkspace.tsx`)와 논문 노드(`PaperNode.tsx`)가 들어 있고, 그래프 시각화·엣지 편집·설정·챗봇·요약 번역·도움말 모달 등 모든 화면 상호작용이 여기서 일어납니다.
>
> **다른 폴더와의 관계**
> - 도메인 로직은 직접 구현하지 않습니다. 모든 데이터 변경은 [`src/app/api`](../app/api/README.md) 라우트로 `fetch` 요청을 보내 처리합니다.
> - 타입과 상수(`RELATION_LABELS`, 기본 설정 등)는 [`src/lib/types.ts`](../lib/README.md)에서 가져옵니다.
> - 이 폴더의 컴포넌트는 [`src/app/page.tsx`](../app/README.md)가 마운트합니다.

This folder contains the interactive graph UI. Components here should call API routes and render state, but should not duplicate domain merge or analysis logic from `src/lib`.

## `GraphWorkspace.tsx`

Main client component.

Responsibilities:

- load graph data;
- upload PDFs;
- connect Google Drive;
- log out from the local Google Drive session;
- render React Flow;
- convert `GraphData` into React Flow nodes/edges;
- filter by relation type;
- resize side panels;
- toggle square/circle node mode;
- show edge hover explanations;
- show the Korean help modal from the bottom-right `도움말` button;
- open the graph chatbot from the bottom-right `챗봇` button and apply chatbot-proposed edge actions after user approval;
- translate a selected paper's English summary to Korean with the `번역` button;
- edit existing edges;
- delete edges;
- delete paper nodes from graph memory without deleting source PDFs;
- create user-defined edges;
- create user-defined edges by dragging between React Flow handles;
- configure relation edge colors from the left sidebar;
- hide/show edge label pills from the settings panel;
- configure automatic edge generation from the settings detail modal;
- refresh existing generated edges from the current edge generation settings;
- toggle node free-move mode and persist node positions;
- accept/reject suggestions;
- warn before uploading a likely duplicate PDF.

Important pieces:

- `PaperRelationEdge`
- `edgeTypes`
- `toReactFlowEdges`
- `confidenceStyle`
- `createEdgeByDrag`
- `relationColors`
- `saveUiSettings`
- `saveNodePosition`
- `refreshGeneratedEdges`
- `flowNodes` / `onNodesChange`
- `resetNodePositions`
- `relationLineStyles`
- `findPotentialDuplicate`
- `AnalysisSettingsModal`
- `HelpModal`
- `ChatModal`
- `sendChatMessage`
- `applyChatAction`
- `deleteSelectedPaper`
- `deleteSelectedEdge`

## Dense Graph Label Strategy

Edge labels are useful in small graphs but become noisy in dense graphs.

Current mitigation:

- labels are rendered with `EdgeLabelRenderer` in the DOM layer;
- edge paths are custom quadratic curves rather than straight lines;
- parallel and nearby edges get different curve offsets;
- label position is offset away from the curved edge using a perpendicular normal;
- labels can be hidden globally from Settings;
- relation color and line style remain visible even when labels are hidden.

## Settings UX

The left sidebar stores two categories of persistent settings:

- visual settings in `uiSettings`;
- automatic edge generation settings in `analysisSettings`.

Both are saved through:

```text
PATCH /api/projects/:projectId/graph
```

`analysisSettings` is applied automatically during future upload analysis. Changing it should not mutate existing graph data unless the user explicitly clicks Refresh Edges, which recomputes generated edges while preserving user-controlled edges.

## Help UX

The bottom-right `도움말` button opens a centered modal with Korean explanations for the app's major features. The same modal can be opened with the `#help` URL hash.

Keep the copy user-facing and avoid leaking internal provider details or secrets.

## Chatbot UX

The bottom-right `챗봇` button opens `ChatModal`, a graph-aware assistant.

- `sendChatMessage` posts the conversation to `POST /api/projects/:projectId/chat`, which calls `src/lib/chat.ts`.
- The assistant answers in Korean and may return proposed edge actions (`update_edge` / `create_edge`).
- Proposed actions are not applied automatically. The modal shows an Apply button, and `applyChatAction` calls the normal edge API routes only after the user approves. The chatbot never mutates `graph.json` on its own.
- Failed responses are converted to a friendly Korean message via `friendlyChatErrorMessage` instead of leaking raw provider errors.

## Summary Translation UX

The selected paper panel has a `번역` button.

- It calls `POST /api/projects/:projectId/papers/:fileId/translate-summary`, which stores `summaryKo` / `shortSummaryKo` in `graph.json`.
- Already-translated papers are tracked in `translatedPaperIds`, so re-opening a translated paper shows the cached Korean summary without another LLM call.

## `PaperNode.tsx`

Custom paper node.

Important: React Flow custom nodes need handles for edges to render correctly.

Current handles:

- target handle on the left;
- source handle on the right.

Do not remove those handles unless the edge rendering strategy is replaced.

## Deletion UX

Deleting an edge or paper uses a browser confirmation dialog before calling the API.

Paper deletion removes the node, connected edges, related suggestions, and saved node position from `graph.json`. The original PDF remains in local storage or Google Drive.
