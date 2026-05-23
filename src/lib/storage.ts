import { mkdir, readFile, readdir, writeFile, copyFile } from "fs/promises";
import path from "path";
import type { GraphData, StorageAdapter, StoredFile } from "./types";
import { createEmptyGraph, DEFAULT_ANALYSIS_SETTINGS } from "./types";
import { GoogleDriveStorageAdapter } from "./google-drive/storage-adapter";

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_ROOT ?? "local_data");
const DATA_DIR = path.join(LOCAL_STORAGE_ROOT, "projects");

function sanitizeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "-") || "demo-project";
}

function sanitizeFilename(filename: string): string {
  const fallback = "paper.pdf";
  const clean = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return clean || fallback;
}

function projectRoot(projectId: string): string {
  return path.join(DATA_DIR, sanitizeProjectId(projectId));
}

function graphPath(projectId: string): string {
  return path.join(projectRoot(projectId), "cache", "graph.json");
}

function inferLocalFileId(localFilePath?: string): string | undefined {
  if (!localFilePath) return undefined;
  const filename = path.basename(localFilePath);
  const match = filename.match(/^(file_[0-9a-f-]{36})_/i);
  return match?.[1];
}

function hydrateGraph(graph: GraphData): GraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      localFileId: node.localFileId ?? inferLocalFileId(node.localFilePath)
    })),
    analysisSettings: {
      ...DEFAULT_ANALYSIS_SETTINGS,
      ...graph.analysisSettings
    },
    uiSettings: {
      nodeShapeMode: graph.uiSettings?.nodeShapeMode ?? "square",
      showEdgeLabels: graph.uiSettings?.showEdgeLabels ?? true,
      freeMoveMode: graph.uiSettings?.freeMoveMode ?? false,
      nodePositions: graph.uiSettings?.nodePositions ?? {},
      ...graph.uiSettings,
      edgeColors: graph.uiSettings?.edgeColors ?? {},
      edgeLineStyles: graph.uiSettings?.edgeLineStyles ?? {}
    }
  };
}

async function ensureProjectDirs(projectId: string): Promise<void> {
  await mkdir(path.join(projectRoot(projectId), "papers"), { recursive: true });
  await mkdir(path.join(projectRoot(projectId), "cache"), { recursive: true });
}

export class LocalStorageAdapter implements StorageAdapter {
  async readGraph(projectId: string): Promise<GraphData | null> {
    try {
      const raw = await readFile(graphPath(projectId), "utf8");
      const graph = JSON.parse(raw) as GraphData;
      return hydrateGraph(graph);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async writeGraph(projectId: string, graph: GraphData): Promise<void> {
    await ensureProjectDirs(projectId);
    const target = graphPath(projectId);
    const backup = `${target}.bak`;
    try {
      await copyFile(target, backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(target, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  }

  async savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile> {
    await ensureProjectDirs(projectId);
    const id = `file_${crypto.randomUUID()}`;
    const cleanName = sanitizeFilename(filename);
    const storedName = `${id}_${cleanName}`;
    const localFilePath = path.join(projectRoot(projectId), "papers", storedName);
    await writeFile(localFilePath, file);
    return { id, filename: storedName, localFilePath, size: file.byteLength };
  }

  async readPdf(projectId: string, fileId: string): Promise<Buffer> {
    const papersDir = path.join(projectRoot(projectId), "papers");
    const files = await readdir(papersDir);
    const match = files.find((file) => file.startsWith(`${fileId}_`));
    if (!match) throw new Error("PDF_NOT_FOUND");
    return readFile(path.join(papersDir, match));
  }
}

export function createStorageAdapter(): StorageAdapter {
  const backend = process.env.STORAGE_BACKEND ?? "local";

  if (backend === "google_drive") {
    return new GoogleDriveStorageAdapter();
  }

  if (backend !== "local") {
    throw new Error(`UNSUPPORTED_STORAGE_BACKEND:${backend}`);
  }

  return new LocalStorageAdapter();
}

export const storage = createStorageAdapter();

export async function readOrCreateGraph(projectId: string): Promise<GraphData> {
  return (await storage.readGraph(projectId)) ?? createEmptyGraph(projectId);
}
