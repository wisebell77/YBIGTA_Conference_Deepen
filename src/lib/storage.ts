import { promises as fs } from "fs";
import path from "path";
import type { GraphData, StorageAdapter, StoredFile } from "./types";
import { createEmptyGraph, DEFAULT_ANALYSIS_SETTINGS } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "projects");

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
    }
  };
}

async function ensureProjectDirs(projectId: string): Promise<void> {
  await fs.mkdir(path.join(projectRoot(projectId), "papers"), { recursive: true });
  await fs.mkdir(path.join(projectRoot(projectId), "cache"), { recursive: true });
}

export class LocalStorageAdapter implements StorageAdapter {
  async readGraph(projectId: string): Promise<GraphData | null> {
    try {
      const raw = await fs.readFile(graphPath(projectId), "utf8");
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
      await fs.copyFile(target, backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.writeFile(target, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  }

  async savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile> {
    await ensureProjectDirs(projectId);
    const id = `file_${crypto.randomUUID()}`;
    const cleanName = sanitizeFilename(filename);
    const storedName = `${id}_${cleanName}`;
    const localFilePath = path.join(projectRoot(projectId), "papers", storedName);
    await fs.writeFile(localFilePath, file);
    return { id, filename: storedName, localFilePath, size: file.byteLength };
  }

  async readPdf(projectId: string, fileId: string): Promise<Buffer> {
    const papersDir = path.join(projectRoot(projectId), "papers");
    const files = await fs.readdir(papersDir);
    const match = files.find((file) => file.startsWith(`${fileId}_`));
    if (!match) throw new Error("PDF_NOT_FOUND");
    return fs.readFile(path.join(papersDir, match));
  }
}

export const storage = new LocalStorageAdapter();

export async function readOrCreateGraph(projectId: string): Promise<GraphData> {
  return (await storage.readGraph(projectId)) ?? createEmptyGraph(projectId);
}
