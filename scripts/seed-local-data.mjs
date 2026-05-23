import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectId = "demo-project";
const now = new Date().toISOString();
const root = process.cwd();
const sourceDir = path.resolve(root, "..", "data_papers");
const localRoot = path.resolve(root, "local_data");
const projectRoot = path.join(localRoot, "projects", projectId);
const papersDir = path.join(projectRoot, "papers");
const cacheDir = path.join(projectRoot, "cache");

const papers = [
  {
    file: "2004.04906v3.pdf",
    id: "paper_2004_04906v3",
    fileId: "file_2004_04906v3",
    title: "Dense Passage Retrieval for Open-Domain Question Answering",
    authors: ["Vladimir Karpukhin", "Barlas Oguz", "Sewon Min", "Patrick Lewis", "Ledell Wu", "Sergey Edunov", "Danqi Chen", "Wen-tau Yih"],
    year: 2020,
    summary:
      "This paper proposes Dense Passage Retrieval (DPR), a dual-encoder retrieval method for open-domain question answering. It replaces sparse lexical retrieval with learned dense representations. DPR became a core retrieval component for later retrieval-augmented generation systems.",
    shortSummary: "DPR introduces dense neural retrieval for open-domain QA.",
    keywords: ["dense retrieval", "open-domain QA", "dual encoder", "passage retrieval", "retriever"]
  },
  {
    file: "2005.11401v4.pdf",
    id: "paper_2005_11401v4",
    fileId: "file_2005_11401v4",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus", "Fabio Petroni", "Vladimir Karpukhin", "Naman Goyal", "Heinrich Kuttler", "Mike Lewis", "Wen-tau Yih", "Tim Rocktaschel", "Sebastian Riedel", "Douwe Kiela"],
    year: 2020,
    summary:
      "This paper introduces Retrieval-Augmented Generation (RAG), combining a neural retriever with a sequence generator. It uses retrieved passages as external memory for knowledge-intensive tasks. RAG is a foundational bridge between dense retrieval and generative language models.",
    shortSummary: "RAG combines retrieval with generation for knowledge-intensive NLP.",
    keywords: ["retrieval augmented generation", "dense retrieval", "external memory", "question answering", "generation"]
  },
  {
    file: "2005.14165v4.pdf",
    id: "paper_2005_14165v4",
    fileId: "file_2005_14165v4",
    title: "Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah", "Jared Kaplan", "Prafulla Dhariwal", "Arvind Neelakantan", "Pranav Shyam", "Girish Sastry", "Amanda Askell", "Sandhini Agarwal", "Ariel Herbert-Voss", "Gretchen Krueger", "Tom Henighan", "Rewon Child", "Aditya Ramesh", "Daniel M. Ziegler", "Jeffrey Wu", "Clemens Winter", "Christopher Hesse", "Mark Chen", "Eric Sigler", "Mateusz Litwin", "Scott Gray", "Benjamin Chess", "Jack Clark", "Christopher Berner", "Sam McCandlish", "Alec Radford", "Ilya Sutskever", "Dario Amodei"],
    year: 2020,
    summary:
      "This paper presents GPT-3 and shows that scaling language models enables strong few-shot and zero-shot behavior. It established prompting as a central interface for large language models. Many later instruction-following and reasoning papers build on this foundation.",
    shortSummary: "GPT-3 shows strong few-shot learning through scale and prompting.",
    keywords: ["large language model", "few-shot learning", "prompting", "GPT-3", "scaling"]
  },
  {
    file: "2107.13586v1.pdf",
    id: "paper_2107_13586v1",
    fileId: "file_2107_13586v1",
    title: "Finetuned Language Models Are Zero-Shot Learners",
    authors: ["Jason Wei", "Maarten Bosma", "Vincent Y. Zhao", "Kelvin Guu", "Adams Wei Yu", "Brian Lester", "Nan Du", "Andrew M. Dai", "Quoc V. Le"],
    year: 2021,
    summary:
      "This paper introduces instruction tuning through FLAN, showing that finetuning on many tasks improves zero-shot generalization. It reframes prompting as instruction following. It is an important predecessor to later alignment and instruction-following systems.",
    shortSummary: "FLAN demonstrates broad instruction tuning for zero-shot generalization.",
    keywords: ["instruction tuning", "zero-shot learning", "FLAN", "language model", "generalization"]
  },
  {
    file: "2201.11903v6.pdf",
    id: "paper_2201_11903v6",
    fileId: "file_2201_11903v6",
    title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
    authors: ["Jason Wei", "Xuezhi Wang", "Dale Schuurmans", "Maarten Bosma", "Brian Ichter", "Fei Xia", "Ed H. Chi", "Quoc V. Le", "Denny Zhou"],
    year: 2022,
    summary:
      "This paper shows that chain-of-thought prompting can elicit intermediate reasoning steps in large language models. It improves performance on arithmetic, commonsense, and symbolic reasoning tasks. The work became a core method for reasoning-oriented prompting.",
    shortSummary: "Chain-of-thought prompting improves reasoning by eliciting intermediate steps.",
    keywords: ["chain-of-thought", "reasoning", "prompting", "large language model", "few-shot"]
  },
  {
    file: "2203.02155v1.pdf",
    id: "paper_2203_02155v1",
    fileId: "file_2203_02155v1",
    title: "Training Language Models to Follow Instructions with Human Feedback",
    authors: ["Long Ouyang", "Jeff Wu", "Xu Jiang", "Diogo Almeida", "Carroll Wainwright", "Pamela Mishkin", "Chong Zhang", "Sandhini Agarwal", "Katarina Slama", "Alex Ray", "John Schulman", "Jacob Hilton", "Fraser Kelton", "Luke Miller", "Maddie Simens", "Amanda Askell", "Peter Welinder", "Paul Christiano", "Jan Leike", "Ryan Lowe"],
    year: 2022,
    summary:
      "This paper introduces InstructGPT, using supervised finetuning and reinforcement learning from human feedback to align language models with user instructions. It shows that smaller aligned models can be preferred over larger base models. The work is central to modern assistant-style LLMs.",
    shortSummary: "InstructGPT uses human feedback to improve instruction following.",
    keywords: ["instruction following", "RLHF", "alignment", "human feedback", "language model"]
  },
  {
    file: "2210.03629v3.pdf",
    id: "paper_2210_03629v3",
    fileId: "file_2210_03629v3",
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu", "Nan Du", "Izhak Shafran", "Karthik Narasimhan", "Yuan Cao"],
    year: 2022,
    summary:
      "ReAct combines reasoning traces with actions such as search or environment interaction. It connects chain-of-thought style reasoning with tool use. The paper is a key predecessor of agentic LLM workflows.",
    shortSummary: "ReAct combines reasoning traces with external actions and tools.",
    keywords: ["ReAct", "reasoning", "acting", "tool use", "agents", "prompting"]
  },
  {
    file: "2302.13971v1.pdf",
    id: "paper_2302_13971v1",
    fileId: "file_2302_13971v1",
    title: "LLaMA: Open and Efficient Foundation Language Models",
    authors: ["Hugo Touvron", "Thibaut Lavril", "Gautier Izacard", "Xavier Martinet", "Marie-Anne Lachaux", "Timothee Lacroix", "Baptiste Roziere", "Naman Goyal", "Eric Hambro", "Faisal Azhar", "Aurelien Rodriguez", "Armand Joulin", "Edouard Grave", "Guillaume Lample"],
    year: 2023,
    summary:
      "LLaMA introduces a family of efficient foundation language models trained on public data. It emphasizes strong performance at smaller parameter scales. The model family became an important base for finetuning and open LLM research.",
    shortSummary: "LLaMA provides efficient open foundation language models.",
    keywords: ["LLaMA", "foundation model", "language model", "open model", "pretraining"]
  },
  {
    file: "2305.14314v1.pdf",
    id: "paper_2305_14314v1",
    fileId: "file_2305_14314v1",
    title: "QLoRA: Efficient Finetuning of Quantized LLMs",
    authors: ["Tim Dettmers", "Artidoro Pagnoni", "Ari Holtzman", "Luke Zettlemoyer"],
    year: 2023,
    summary:
      "QLoRA enables efficient finetuning of quantized large language models using low-rank adapters. It reduces memory requirements while preserving strong downstream performance. It is closely connected to practical adaptation of open foundation models such as LLaMA.",
    shortSummary: "QLoRA makes LLM finetuning memory efficient through quantization and adapters.",
    keywords: ["QLoRA", "quantization", "finetuning", "low-rank adapters", "language model"]
  },
  {
    file: "2312.00752v2.pdf",
    id: "paper_2312_00752v2",
    fileId: "file_2312_00752v2",
    title: "Gemini: A Family of Highly Capable Multimodal Models",
    authors: ["Gemini Team"],
    year: 2023,
    summary:
      "Gemini presents a family of multimodal models with strong language, reasoning, coding, and multimodal capabilities. It extends the trajectory of large foundation models beyond text-only settings. It is naturally compared with prior open and closed foundation model families.",
    shortSummary: "Gemini extends foundation models into highly capable multimodal systems.",
    keywords: ["Gemini", "multimodal model", "foundation model", "reasoning", "large language model"]
  },
  {
    file: "Distilling the Knowledge in a Neural Network_paper.pdf",
    id: "paper_distillation_hinton",
    fileId: "file_distillation_hinton",
    title: "Distilling the Knowledge in a Neural Network",
    authors: ["Geoffrey Hinton", "Oriol Vinyals", "Jeff Dean"],
    year: 2015,
    summary:
      "This paper introduces knowledge distillation, where a compact student model learns from a larger teacher model. It provides a general method for compressing neural networks. The idea remains relevant to efficient model deployment and adaptation.",
    shortSummary: "Knowledge distillation transfers behavior from a larger teacher to a smaller student.",
    keywords: ["knowledge distillation", "model compression", "teacher student", "neural network", "efficiency"]
  }
];

const edgeSpecs = [
  ["paper_2004_04906v3", "paper_2005_11401v4", "uses_method", "방법 사용", "RAG는 DPR 계열 dense retrieval을 핵심 검색 구성요소로 사용한다."],
  ["paper_2005_14165v4", "paper_2107_13586v1", "extends", "후속/확장", "FLAN은 GPT-3가 보여준 prompting 기반 일반화를 instruction tuning으로 확장한다."],
  ["paper_2005_14165v4", "paper_2201_11903v6", "prerequisite", "선행 연구", "Chain-of-thought prompting은 GPT-3 이후 확립된 prompting 인터페이스를 reasoning 문제에 적용한다."],
  ["paper_2005_14165v4", "paper_2203_02155v1", "background", "배경 지식", "InstructGPT는 대규모 언어모델과 prompting 가능성을 전제로 instruction following을 개선한다."],
  ["paper_2107_13586v1", "paper_2203_02155v1", "supports", "뒷받침", "Instruction tuning 결과는 instruction-following alignment의 기반 근거가 된다."],
  ["paper_2201_11903v6", "paper_2210_03629v3", "extends", "후속/확장", "ReAct는 chain-of-thought reasoning trace를 외부 action과 결합한다."],
  ["paper_2005_11401v4", "paper_2210_03629v3", "conceptually_related", "개념 연결", "두 논문 모두 외부 지식 접근을 통해 language model의 한계를 보완한다."],
  ["paper_2302_13971v1", "paper_2305_14314v1", "applies", "적용", "QLoRA는 LLaMA 같은 foundation model을 저비용으로 finetuning하는 실용적 방법을 제시한다."],
  ["paper_distillation_hinton", "paper_2305_14314v1", "background", "배경 지식", "두 논문 모두 모델 효율화와 배포 가능성을 개선하려는 문제의식을 공유한다."],
  ["paper_2005_14165v4", "paper_2302_13971v1", "background", "배경 지식", "LLaMA는 GPT-3 이후 확립된 scaling 기반 foundation model 계보에 속한다."],
  ["paper_2302_13971v1", "paper_2312_00752v2", "compares_with", "비교", "Gemini와 LLaMA는 foundation model 계열로 비교 가능한 모델 패밀리다."],
  ["paper_2201_11903v6", "paper_2312_00752v2", "background", "배경 지식", "Gemini의 reasoning 평가는 chain-of-thought 이후 중요해진 reasoning 능력 평가 흐름과 연결된다."],
  ["paper_2203_02155v1", "paper_2312_00752v2", "background", "배경 지식", "Gemini 같은 assistant-style model은 instruction following과 alignment 흐름 위에 있다."]
];

function embeddingText(paper) {
  return [paper.title, paper.summary, paper.keywords.join(", ")].join("\n");
}

function nodeFor(paper) {
  const storedName = `${paper.fileId}_${paper.file}`;
  const localFilePath = path.join(papersDir, storedName);
  return {
    id: paper.id,
    type: "paper",
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    abstract: paper.summary,
    summary: paper.summary,
    shortSummary: paper.shortSummary,
    keywords: paper.keywords,
    embeddingText: embeddingText(paper),
    localFileId: paper.fileId,
    localFilePath,
    originalFilename: paper.file,
    createdAt: now,
    updatedAt: now
  };
}

function edgeFor([source, target, relationType, label, description], index) {
  return {
    id: `edge_seed_${String(index + 1).padStart(2, "0")}`,
    source,
    target,
    directed: relationType !== "conceptually_related" && relationType !== "compares_with",
    directionMeaning:
      relationType === "conceptually_related" || relationType === "compares_with"
        ? "undirected_conceptual_similarity"
        : "knowledge_flow",
    relationType,
    label,
    shortDescription: description,
    longDescription: `${description} 이 edge는 local_data 시연을 위해 seed된 임시 그래프 관계입니다.`,
    relationSource: "semantic_inference",
    confidence: 0.78,
    evidence: [
      {
        paperId: source,
        type: "llm_reasoning",
        text: "Seeded from known paper lineage and local PDF filenames."
      },
      {
        paperId: target,
        type: "llm_reasoning",
        text: "Seeded for local graph visualization while Google Drive mode is unavailable."
      }
    ],
    llmGenerated: true,
    userEdited: false,
    locked: false,
    createdAt: now,
    updatedAt: now
  };
}

await mkdir(papersDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });

for (const paper of papers) {
  await copyFile(path.join(sourceDir, paper.file), path.join(papersDir, `${paper.fileId}_${paper.file}`));
}

const graph = {
  version: "1.0",
  projectId,
  updatedAt: now,
  nodes: papers.map(nodeFor),
  edges: edgeSpecs.map(edgeFor),
  edgeSuggestions: [],
  analysisSettings: {
    semanticEdgeLimitPerPaper: 5,
    candidateLimitPerNewPaper: 8,
    minConfidenceForAutoEdge: 0.68,
    minConfidenceForSuggestion: 0.45
  }
};

await writeFile(path.join(cacheDir, "graph.json"), `${JSON.stringify(graph, null, 2)}\n`, "utf8");

console.log(`Seeded ${papers.length} papers and ${edgeSpecs.length} edges into ${projectRoot}`);
