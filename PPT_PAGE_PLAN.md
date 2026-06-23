# Deepen Paper Graph Memory 페이지별 내용 구성안

> 이 문서는 PPT의 디자인, 제목, 레이아웃, 시각화 방식이 아니라 각 페이지에 들어가야 할 핵심 내용만 정리한 자료입니다.  
> 다른 모델이나 작성자가 이 문서만 보고도 프로젝트 내용을 이해하고 발표 자료의 본문을 구성할 수 있도록, 페이지별로 보고서식 내용을 담았습니다.

## 전체 설명 기준

Deepen은 연구자가 업로드한 논문 PDF를 단순히 요약하는 데서 끝내지 않고, 논문들이 서로 어떤 관계를 갖는지 누적 그래프로 저장하는 Paper Graph Memory 앱이다. 사용자는 PDF를 업로드하고, 시스템은 PDF 텍스트를 추출한 뒤 LLM으로 논문 메타데이터와 요약을 만든다. 이후 기존 그래프에 저장된 논문들과 새 논문을 비교해 관련 후보 논문을 고르고, 후보 논문과 새 논문 사이의 관계를 LLM으로 추출한다. 추출된 관계는 검증과 병합 과정을 거쳐 `graph.json`에 저장되며, 사용자는 React Flow 기반 화면에서 노드와 엣지를 직접 탐색하고 수정할 수 있다.

이 프로젝트를 설명할 때 가장 중요한 관점은 “AI 논문 요약기”가 아니라 “증분적으로 누적되는 논문 관계 그래프 메모리”라는 점이다. 논문 하나를 읽고 끝나는 도구가 아니라, 사용자가 읽어온 논문들의 관계를 계속 쌓고, 수정하고, 다음 분석에 다시 활용하는 시스템으로 설명해야 한다.

## 1페이지에 들어갈 내용

첫 페이지에서는 Deepen이 무엇을 하는 프로젝트인지 가장 짧고 명확하게 소개한다. Deepen은 논문 PDF를 업로드하면 논문 정보를 추출하고, 기존에 읽은 논문들과의 의미적 관계를 찾아, 이를 그래프 형태로 저장하고 보여주는 앱이다. 핵심 표현은 Paper Graph Memory이며, 한국어로는 “논문 관계 그래프 메모리” 또는 “연구 그래프 메모리”로 설명할 수 있다.

이 페이지에는 프로젝트의 한 줄 정의가 들어가야 한다. 예를 들어 “Deepen은 읽은 논문을 요약에서 끝내지 않고, 누적되는 연구 맥락 그래프로 저장하는 도구”라는 내용이 적합하다. 또한 이 프로젝트가 YBIGTA Conference Deepen에서 진행된 연구/개발 프로젝트라는 배경도 포함한다.

강조해야 할 점은 Deepen이 단순한 PDF 관리 도구도 아니고, 단순 요약 챗봇도 아니라는 것이다. 사용자가 읽은 논문들이 시간이 지나도 관계를 잃지 않도록, 논문과 논문 사이의 연결을 장기적으로 저장하는 데 목적이 있다.

## 2페이지에 들어갈 내용

이 페이지에서는 문제 상황을 설명한다. 연구자는 논문을 읽을수록 PDF 파일, 메모, 브라우저 탭, 요약 문서가 늘어나지만, 논문 사이의 관계는 자연스럽게 보존되지 않는다. 폴더에는 파일명만 남고, 어떤 논문이 어떤 연구를 확장했는지, 어떤 논문이 방법론적으로 연결되는지, 어떤 논문을 먼저 읽어야 하는지는 별도로 다시 정리해야 한다.

기존의 논문 요약 도구는 논문 하나를 이해하는 데 도움을 주지만, 사용자가 이미 읽은 논문들과 새 논문이 어떻게 이어지는지는 자동으로 누적해 주지 않는다. 또한 논문 추천 시스템이나 검색 시스템은 새 논문을 찾는 데는 유용하지만, 개인이 읽어온 자료들 사이의 장기적인 연구 맥락을 보존하는 데는 한계가 있다.

따라서 Deepen이 해결하려는 문제는 “논문을 요약하는 것”이 아니라 “논문 간 관계를 계속 잃어버리는 것”이다. 사용자가 논문을 많이 읽을수록 더 중요한 것은 개별 요약보다 논문 사이의 구조화된 관계이다.

## 3페이지에 들어갈 내용

이 페이지에서는 Deepen의 제품적 방향을 설명한다. Deepen은 사용자가 새 논문을 업로드했을 때 그 논문을 독립된 요약 카드로만 저장하지 않는다. 대신 기존 그래프 메모리를 읽고, 새 논문이 기존 논문 중 어떤 것과 관련 있는지 후보를 고른 다음, 논문 간 관계를 생성해 그래프에 병합한다.

Deepen의 핵심 제품 원칙은 세 가지로 정리할 수 있다. 첫째, PDF를 업로드하면 원본 파일과 분석 결과를 함께 저장한다. 둘째, 새 논문과 기존 논문 사이의 관계를 자동으로 추출한다. 셋째, 사용자가 수정한 관계를 모델 출력보다 우선하여 보존한다.

이 페이지에서는 Deepen의 목적이 “더 좋은 한 번의 답변”을 만드는 것이 아니라, 사용자의 연구 맥락이 시간이 지나도 유지되도록 하는 것임을 설명해야 한다. 그래서 이 앱은 챗봇이라기보다 연구자가 직접 운영할 수 있는 그래프 메모리 작업 공간에 가깝다.

## 4페이지에 들어갈 내용

이 페이지에서는 기존 도구들과의 차이를 설명한다. Google Scholar나 Semantic Scholar는 논문 검색과 citation 탐색에 강하지만, 사용자가 개인적으로 읽은 논문들의 관계를 그래프로 누적하는 기능은 중심 기능이 아니다. Zotero나 Mendeley는 PDF와 참고문헌 관리에 강하지만, 논문 간 의미적 관계를 자동으로 생성하고 사용자가 수정한 관계를 장기적으로 보존하는 기능은 제한적이다.

ChatGPT나 NotebookLM과 같은 문서 이해 도구는 PDF 요약이나 질의응답에 유용하지만, 여러 논문을 누적된 paper-to-paper graph로 관리하고, 엣지 수정 내역과 사용자 판단을 보존하는 구조는 별도의 설계가 필요하다.

Deepen은 이 사이의 빈 공간을 겨냥한다. 개인 PDF 컬렉션을 대상으로, 논문 하나의 요약이 아니라 논문과 논문 사이의 관계를 저장한다. 따라서 Deepen의 포지션은 “문서 단위 이해 보조”보다는 “논문 관계 단위의 누적 연구 메모리”라고 설명하는 것이 적절하다.

## 5페이지에 들어갈 내용

이 페이지에서는 사용자의 전체 흐름을 설명한다. 사용자는 먼저 연구 PDF를 업로드한다. 시스템은 PDF에서 텍스트를 추출하고, LLM을 사용해 제목, 저자, 연도, 초록, 요약, 짧은 요약, 키워드, 검색용 텍스트를 만든다. 그 다음 기존 그래프에 저장되어 있던 논문들과 비교해 관련 후보 논문을 선정한다.

후보 논문이 정해지면 시스템은 새 논문과 후보 논문 사이에 어떤 관계가 있는지 LLM으로 판단한다. 관계는 `extends`, `prerequisite`, `uses_method`, `background`, `compares_with` 같은 relation type으로 표현된다. 생성된 관계는 confidence와 evidence를 포함하고, 검증을 거친 뒤 그래프에 자동으로 들어가거나 suggestion으로 보류된다.

사용자는 이후 그래프 화면에서 자동 생성된 관계를 확인하고, 잘못된 관계를 수정하거나 삭제할 수 있다. 누락된 관계가 있다면 사용자가 직접 엣지를 만들 수도 있다. 이렇게 수정된 그래프는 `graph.json`에 저장되고 다음 업로드 때 다시 기존 맥락으로 사용된다.

## 6페이지에 들어갈 내용

이 페이지에서는 현재 데모 데이터의 구체적인 상태를 설명한다. 로컬 데모 프로젝트인 `demo-project`에는 11개의 논문 노드와 15개의 논문 관계 엣지가 들어 있다. 확인 시점 기준 pending suggestion은 0개였고, 관계 유형은 9종이 사용되었다. 이 중 2개의 엣지는 사용자가 직접 만든 custom edge이다.

데모 논문들은 LLM과 RAG 연구 흐름을 보여주기에 적합한 논문들로 구성되어 있다. 예시로 Dense Passage Retrieval, Retrieval-Augmented Generation, GPT-3, FLAN, Chain-of-Thought Prompting, InstructGPT, ReAct, LLaMA, QLoRA, Gemini, Knowledge Distillation 논문이 포함되어 있다.

이 데모는 단순히 논문 목록을 보여주는 것이 아니라, 각 논문이 어떤 연구 흐름 속에서 연결되는지 보여준다. 예를 들어 RAG는 DPR 계열 dense retrieval을 활용하는 관계로 설명될 수 있고, ReAct는 Chain-of-Thought의 reasoning trace를 외부 action과 결합하는 후속 흐름으로 설명될 수 있다. QLoRA는 LLaMA와 같은 foundation model을 효율적으로 finetuning하는 적용 관계로 볼 수 있다.

## 7페이지에 들어갈 내용

이 페이지에서는 시스템 구조를 설명한다. Deepen은 크게 브라우저 UI, Next.js API route, 도메인 로직, 저장소 어댑터, 외부 PDF/LLM provider로 나눌 수 있다. 브라우저 UI는 사용자가 PDF를 업로드하고 그래프를 보고 수정하는 영역이며, React Flow를 사용해 논문 노드와 관계 엣지를 렌더링한다.

Next.js API route는 브라우저와 서버 로직 사이의 경계 역할을 한다. 그래프 읽기와 설정 저장, PDF 업로드와 분석, PDF 조회, 논문 삭제, 엣지 생성/수정/삭제, suggestion accept/reject, Google OAuth 처리를 담당한다.

도메인 로직은 `src/lib`에 모여 있다. 이 영역에는 타입 정의, 저장소 선택, PDF 텍스트 추출, LLM 호출, 후보 논문 선택, 관계 출력 검증, 그래프 병합, generated edge refresh 로직이 들어 있다. 저장소는 `StorageAdapter` 인터페이스 뒤로 숨겨져 있어, 로컬 파일 시스템과 Google Drive 저장소를 같은 방식으로 다룰 수 있다.

## 8페이지에 들어갈 내용

이 페이지에서는 업로드 분석 파이프라인을 자세히 설명한다. 업로드 분석의 중심 함수는 `analyzeUploadedPaper`와 `analyzeStoredPaper`이며, 전체 흐름은 PDF 저장, PDF 텍스트 추출, 메타데이터/요약 추출, 기존 그래프 읽기, 후보 논문 선택, 관계 추출, 결과 hydrate, 그래프 병합, 저장 순서로 진행된다.

가장 중요한 점은 새 PDF가 들어올 때마다 전체 그래프를 처음부터 다시 만들지 않는다는 것이다. 시스템은 기존 `graph.json`을 읽고, 새 논문을 하나의 `PaperNode`로 만든 다음, 기존 노드 중 관련성이 높은 후보만 선택한다. 이후 후보 논문과 새 논문 사이의 관계만 LLM으로 추출한다.

이 방식은 비용과 노이즈를 줄인다. 모든 논문 쌍을 LLM에 보내지 않고 후보를 줄여서 비교하기 때문에 분석 범위가 작아진다. 또한 사용자가 이미 수정해 둔 기존 그래프 메모리를 보존하면서 새 정보만 추가할 수 있다.

## 9페이지에 들어갈 내용

이 페이지에서는 데이터 모델을 설명한다. Deepen의 핵심 저장 파일은 `graph.json`이며, 이 파일에는 `GraphData`가 저장된다. `GraphData`는 version, projectId, updatedAt, nodes, edges, edgeSuggestions, analysisSettings, uiSettings로 구성된다.

`PaperNode`는 논문 하나를 의미한다. 주요 필드는 id, type, title, authors, year, abstract, summary, shortSummary, keywords, embeddingText, localFileId, driveFileId, webViewLink, originalFilename, createdAt, updatedAt이다. MVP에서는 노드가 항상 논문만 의미하며, concept, method, dataset 같은 별도 노드는 만들지 않는다.

`PaperEdge`는 논문과 논문 사이의 관계를 의미한다. 주요 필드는 id, source, target, directed, directionMeaning, relationType, label, shortDescription, longDescription, relationSource, confidence, evidence, llmGenerated, userEdited, locked, createdAt, updatedAt이다. 엣지는 항상 paper-to-paper relationship이며, 사용자가 직접 만든 관계와 LLM이 생성한 관계를 구분해 저장한다.

## 10페이지에 들어갈 내용

이 페이지에서는 후보 논문 선택과 관계 추출 방식을 설명한다. Deepen은 새 논문과 기존 모든 논문 쌍을 비교하지 않는다. 먼저 기존 논문 각각에 대해 lexical similarity score를 계산하고, 점수가 높은 후보만 LLM 관계 추출 대상으로 보낸다.

후보 점수는 제목 overlap, 키워드 overlap, 요약 overlap을 가중합해 계산한다. 실제 코드 기준 기본 가중치는 제목 0.2, 키워드 0.5, 요약 0.3이다. 기본 후보 수는 8개이고, 새 논문 하나당 생성 가능한 semantic edge limit은 5개이다. 기본 설정에서는 lexical score가 0인 후보도 fallback 후보로 포함할 수 있다.

LLM은 후보 논문과 새 논문 사이의 관계를 JSON으로 반환해야 한다. 반환 항목에는 source, target, directed 여부, directionMeaning, relationType, 한국어 label, shortDescription, longDescription, relationSource, confidence, evidence가 포함된다. relationType enum은 영어로 유지하고, label과 설명은 한국어로 생성하도록 설계되어 있다.

## 11페이지에 들어갈 내용

이 페이지에서는 LLM 결과 검증 과정을 설명한다. LLM 출력은 그대로 그래프에 들어가지 않는다. 먼저 `graph-validation.ts`에서 출력의 형식과 내용을 정규화하고 검증한다. 지원하지 않는 relation type은 unknown으로 처리되거나 걸러지고, 존재하지 않는 paper id를 참조하는 edge는 제거된다.

검증 과정에서는 self-edge도 허용하지 않는다. source와 target이 같은 관계는 잘못된 출력으로 본다. 또한 새 논문 업로드 분석에서는 관계가 반드시 새 논문과 후보 논문 사이에 있어야 한다. 후보 논문들끼리의 새로운 관계를 LLM이 임의로 만들면 검증에서 제외된다.

evidence도 검증 대상이다. evidence에 포함된 paperId가 새 논문이나 후보 논문의 id가 아니라면 제외된다. evidence text는 지나치게 길어지지 않도록 제한된다. 이 검증 단계는 LLM이 형식에 맞지 않는 JSON이나 허용되지 않는 관계를 만들어도 graph memory가 오염되지 않도록 막는 역할을 한다.

## 12페이지에 들어갈 내용

이 페이지에서는 그래프 병합 정책을 설명한다. Deepen의 가장 중요한 구현 포인트는 LLM이 만든 관계를 기존 그래프에 무조건 덮어쓰지 않는다는 것이다. 병합 로직은 `merge.ts`에 있으며, 기존 노드와 기존 엣지를 보존하는 것을 기본 원칙으로 한다.

새 edge가 들어왔을 때, 이미 같은 source, target, relationType을 가진 edge가 있으면 duplicate로 보고 추가하지 않는다. 같은 논문 pair인데 relationType이 다르면 기존 edge를 덮어쓰지 않고 suggestion으로 보류한다. 특히 기존 edge가 `userEdited=true`이면 LLM 결과는 절대 그 edge를 overwrite하지 못한다.

confidence threshold도 병합에 사용된다. 코드 기준 `minConfidenceForSuggestion`은 0.45이고, `minConfidenceForAutoEdge`는 0.68이다. confidence가 0.45보다 낮으면 버리고, 0.45 이상 0.68 미만이면 suggestion으로 저장하며, 0.68 이상이면 자동 edge로 추가한다. 이 구조는 자동화와 사용자 통제를 함께 유지하기 위한 안전장치이다.

## 13페이지에 들어갈 내용

이 페이지에서는 사용자가 그래프를 어떻게 다루는지 설명한다. Deepen의 화면은 결과를 보여주는 정적 화면이 아니라, 사용자가 관계를 검토하고 수정하는 작업 공간이다. 메인 UI는 `GraphWorkspace.tsx`에 구현되어 있으며, 상단바, 왼쪽 사이드바, 중앙 그래프 캔버스, 오른쪽 상세 패널로 구성된다.

왼쪽 사이드바에서는 논문 검색, 논문 목록, 관계 유형 필터, 관계별 색상 선택, 선 스타일 선택, 설정, pending suggestion 확인이 가능하다. 중앙 캔버스에서는 React Flow를 통해 paper node와 relation edge가 표시된다. 엣지에 hover하면 관계 설명, confidence, relationSource를 확인할 수 있고, 엣지를 클릭하면 오른쪽 상세 패널에서 더 자세한 정보를 볼 수 있다.

오른쪽 상세 패널에서는 선택한 논문의 요약, 키워드, 원본 PDF 링크, 연결된 엣지를 확인할 수 있다. 엣지를 선택하면 relationType, label, 설명, confidence, evidence를 볼 수 있고, relationType과 설명을 편집하거나 엣지를 삭제할 수 있다.

## 14페이지에 들어갈 내용

이 페이지에서는 사용자 통제 기능과 UI 설정 기능을 설명한다. 사용자는 자동 생성된 엣지를 그대로 받아들이지 않아도 된다. 엣지를 편집하면 `userEdited=true`로 저장되고, relationSource는 `user_edited`가 된다. 이렇게 저장된 엣지는 이후 LLM refresh나 새 분석 과정에서 보호된다.

사용자는 직접 엣지를 만들 수도 있다. 왼쪽 사이드바의 사용자 정의 edge 생성 기능을 사용하거나, 그래프 캔버스에서 한 노드의 handle을 다른 노드로 드래그해 custom edge를 만들 수 있다. 드래그로 생성된 edge는 기본적으로 사용자 정의 관계로 저장되고, 이후 오른쪽 패널에서 relation type과 설명을 수정할 수 있다.

그래프가 복잡해질 때를 대비한 시각 설정도 있다. 관계 유형별 필터링, 엣지 색상 변경, 선 스타일 변경, 엣지 라벨 표시/숨김, 사각/원형 노드 모드, 자유 이동 모드, 노드 위치 저장, 노드 위치 리셋이 가능하다. 이러한 UI 설정은 단순 브라우저 상태가 아니라 `graph.json`의 `uiSettings`에 저장된다.

## 15페이지에 들어갈 내용

이 페이지에서는 저장소와 배포 구조를 설명한다. Deepen은 저장소를 `StorageAdapter` 인터페이스로 추상화한다. 이 인터페이스는 readGraph, writeGraph, savePdf, readPdf를 제공하며, 로컬 저장소와 Google Drive 저장소가 같은 방식으로 동작하도록 만든다.

로컬 모드에서는 `local_data/projects/:projectId` 아래에 데이터가 저장된다. PDF 파일은 `papers` 폴더에 저장되고, 그래프 데이터는 `cache/graph.json`에 저장된다. `writeGraph`를 실행할 때 기존 graph.json이 있으면 `graph.json.bak` 백업을 만든다. 이는 로컬 실험 중 그래프 데이터가 갑자기 손상되는 상황을 줄이기 위한 장치이다.

Google Drive 모드에서는 Drive 안에 `Deepen/projects/:projectId/papers`와 `Deepen/projects/:projectId/cache/graph.json` 구조를 만든다. Google OAuth를 통해 사용자를 인증하고, 세션은 로컬 파일 또는 Postgres에 저장할 수 있다. 큰 PDF 업로드를 위해 Drive resumable upload session을 만들고, 브라우저는 PDF를 4MB 이하 chunk로 나눠 서버 proxy route에 보낸다. 서버는 chunk를 Google Drive로 전달하고, 업로드가 끝나면 Drive file id로 분석을 실행한다.

## 16페이지에 들어갈 내용

이 페이지에서는 API 기능을 요약한다. 그래프 관련 API는 `GET /api/projects/:projectId/graph`로 그래프를 읽고, `PATCH /api/projects/:projectId/graph`로 UI 설정과 분석 설정을 저장한다. 이 설정에는 엣지 색상, 선 스타일, 노드 모양, 엣지 라벨 표시 여부, 자유 이동 모드, 노드 위치, 후보 선택 가중치, confidence threshold, custom prompt가 포함된다.

논문 관련 API는 PDF 업로드와 분석, PDF 조회, 논문 노드 삭제를 담당한다. 로컬 업로드는 `POST /api/projects/:projectId/papers/upload`를 사용하고, Google Drive 모드는 drive upload session 생성, chunk upload, analyze-drive-file 경로를 사용한다. PDF 조회는 `GET /api/projects/:projectId/papers/:fileId`로 이루어진다.

엣지 관련 API는 사용자 edge 생성, edge 수정, edge 삭제, generated edge refresh를 담당한다. suggestion API는 LLM이 바로 반영하지 못한 관계 후보를 accept 또는 reject하는 기능을 제공한다. Google OAuth API는 Drive 연결 시작, callback 처리, 연결 상태 확인, 로그아웃을 담당한다.

## 17페이지에 들어갈 내용

이 페이지에서는 edge generation settings와 Refresh Edges 기능을 설명한다. Deepen은 자동 edge 생성 정책을 프로젝트별 `analysisSettings`로 저장한다. 이 설정에는 후보 논문 수, 새 논문당 최대 자동 edge 수, 제목/키워드/요약 후보 점수 가중치, 최소 후보 점수, zero-score 후보 포함 여부, 자동 edge confidence threshold, suggestion threshold, custom edge prompt가 포함된다.

이 설정을 변경한다고 해서 기존 그래프가 즉시 바뀌지는 않는다. 설정은 기본적으로 이후 업로드되는 논문에 적용된다. 기존 generated edge를 현재 설정으로 다시 계산하려면 사용자가 명시적으로 Refresh Edges 버튼을 눌러야 한다.

Refresh Edges는 현재 그래프를 읽고, user-created 또는 user-edited edge를 보존한 뒤, generated edge와 기존 suggestion을 제거하고, 논문들을 createdAt 순서대로 다시 처리한다. 각 논문은 자신보다 먼저 처리된 논문들 중 후보를 골라 LLM 관계 추출을 수행한다. 이후 기존 merge policy를 그대로 사용해 새 generated edge와 suggestion을 만든다.

## 18페이지에 들어갈 내용

이 페이지에서는 현재 구현 완료 상태를 정리한다. 현재 프로젝트는 PDF 업로드, PDF 텍스트 추출, LLM 기반 메타데이터/요약 생성, 후보 논문 선택, LLM 관계 추출, 관계 출력 검증, 증분 그래프 병합, 로컬 JSON/PDF 저장, Google Drive 저장소 어댑터, Google OAuth 경로, chunked Drive upload, React Flow 그래프 UI를 포함한다.

사용자 인터랙션 측면에서는 논문 목록, 관계 필터, 엣지 hover 설명, 오른쪽 상세 패널, 엣지 편집, 엣지 삭제, 사용자 정의 엣지 생성, 드래그 기반 엣지 생성, 논문 노드 삭제, suggestion accept/reject, 노드 모양 변경, 엣지 라벨 숨김, 엣지 색상/선 스타일 변경, 자유 이동 모드, 노드 위치 저장, 노드 위치 리셋, 도움말 모달이 구현되어 있다.

데모 데이터 기준으로는 LLM/RAG 계열 논문 그래프가 구성되어 있으며, 실제 PDF 파일과 graph.json이 로컬 저장소에 존재한다. 따라서 이 프로젝트는 단순 기획이 아니라, 업로드-분석-그래프-편집-저장까지 이어지는 working MVP 상태로 설명할 수 있다.

## 19페이지에 들어갈 내용

이 페이지에서는 현재 한계점을 설명한다. 첫 번째 한계는 후보 논문 선택이 lexical overlap 중심이라는 점이다. 제목, 키워드, 요약에 공통 토큰이 잘 드러나는 경우에는 효과적이지만, 동의어, 간접 관련성, 표현 방식이 다른 유사 연구를 찾는 데는 embedding retrieval보다 약할 수 있다.

두 번째 한계는 relation extraction 품질이 PDF parsing 품질과 LLM 안정성에 의존한다는 점이다. PDF 텍스트가 잘못 추출되거나 OCR 품질이 낮으면, LLM이 잘못된 요약이나 관계를 만들 수 있다. 이를 줄이기 위해 Upstage Document Parse와 local fallback이 있지만, 모든 PDF에 대해 완전한 품질을 보장하는 것은 아니다.

세 번째 한계는 semantic relation graph의 평가가 어렵다는 점이다. citation graph처럼 명확한 정답 관계가 있는 것이 아니라, “방법론적으로 연결된다”, “배경 지식이다”, “개념적으로 관련 있다” 같은 관계는 평가 기준이 주관적일 수 있다. 따라서 향후에는 relation quality benchmark나 사용자 평가 기준이 필요하다.

## 20페이지에 들어갈 내용

마지막 페이지에서는 향후 확장 방향을 정리한다. 첫 번째 확장 방향은 embedding 기반 후보 검색이다. 현재 lexical overlap을 사용하는 후보 선택 로직을 embedding retrieval로 확장하면, 표현이 다르지만 의미적으로 가까운 논문도 더 잘 찾을 수 있다.

두 번째 확장 방향은 citation parsing과 semantic relation을 결합하는 것이다. 현재 Deepen은 citation graph라기보다 semantic relation graph에 가깝다. 향후 PDF에서 citation context를 더 잘 추출하고, citation 기반 근거와 LLM 기반 의미 관계를 함께 사용하면 relation evidence의 신뢰도를 높일 수 있다.

세 번째 확장 방향은 개인화 추천과 연구 copilot 기능이다. 그래프 메모리가 충분히 쌓이면, 사용자가 다음에 읽을 논문을 추천하거나, “이 논문을 이해하려면 무엇을 먼저 읽어야 하는가?”, “왜 이 두 논문이 연결되었는가?”, “내 연구 주제에서 빠진 배경 논문은 무엇인가?” 같은 질문에 답할 수 있다.

추가적으로 batch import, 팀 단위 collaborative graph editing, 프로젝트 템플릿, 권한 관리, versioned graph history, 대규모 그래프 레이아웃 최적화도 향후 과제로 정리할 수 있다. 최종적으로 Deepen의 방향은 논문 파일 관리 도구를 넘어, 사용자의 연구 흐름을 기억하고 안내하는 research copilot으로 확장되는 것이다.
