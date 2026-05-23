import { Readable } from "stream";
import type { drive_v3 } from "googleapis";
import type { GraphData, StorageAdapter, StoredFile } from "@/lib/types";
import {
  CACHE_FOLDER_NAME,
  GRAPH_JSON_FILENAME,
  PAPERS_FOLDER_NAME,
  PROJECTS_FOLDER_NAME,
  ROOT_FOLDER_NAME
} from "./constants";
import {
  ensureChildFolder,
  findChildFile,
  getDriveClient,
  readDriveFileAsBuffer,
  writeGraphJsonFile
} from "./drive-client";
import { createGoogleAuthStore, type GoogleAuthStore } from "./auth-store";

export type GoogleDriveProjectFolders = {
  rootFolderId: string;
  projectsFolderId: string;
  projectFolderId: string;
  papersFolderId: string;
  cacheFolderId: string;
};

export type DrivePdfInfo = {
  id: string;
  filename: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
};

export class GoogleDriveStorageAdapter implements StorageAdapter {
  constructor(private readonly authStore: GoogleAuthStore = createGoogleAuthStore()) {}

  async readGraph(projectId: string): Promise<GraphData | null> {
    const drive = await getDriveClient(this.authStore);
    const folders = await this.ensureProjectFolders(projectId);
    const graphFile = await findChildFile(
      drive,
      folders.cacheFolderId,
      GRAPH_JSON_FILENAME,
      "application/json"
    );

    if (!graphFile?.id) return null;

    const buffer = await readDriveFileAsBuffer(drive, graphFile.id);
    const graph = JSON.parse(buffer.toString("utf8")) as GraphData;
    return hydrateDriveGraph(graph);
  }

  async writeGraph(projectId: string, graph: GraphData): Promise<void> {
    assertGraphData(graph);
    const drive = await getDriveClient(this.authStore);
    const folders = await this.ensureProjectFolders(projectId);
    await writeGraphJsonFile(drive, folders.cacheFolderId, graph);
  }

  async savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile> {
    const drive = await getDriveClient(this.authStore);
    const folders = await this.ensureProjectFolders(projectId);
    const cleanName = sanitizeDriveFilename(filename);

    const created = await drive.files.create({
      requestBody: {
        name: cleanName,
        parents: [folders.papersFolderId],
        mimeType: "application/pdf"
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from([file])
      },
      fields: "id, name, size, webViewLink"
    });

    if (!created.data.id) throw new Error("DRIVE_PDF_UPLOAD_FAILED");

    return {
      id: created.data.id,
      driveFileId: created.data.id,
      filename: created.data.name ?? cleanName,
      size: Number(created.data.size ?? file.byteLength),
      webViewLink: created.data.webViewLink ?? undefined
    };
  }

  async readPdf(projectId: string, fileId: string): Promise<Buffer> {
    const drive = await getDriveClient(this.authStore);
    const folders = await this.ensureProjectFolders(projectId);
    await assertPdfBelongsToProject(drive, fileId, folders.papersFolderId);
    return readDriveFileAsBuffer(drive, fileId);
  }

  async ensureProjectFolders(projectId: string): Promise<GoogleDriveProjectFolders> {
    const drive = await getDriveClient(this.authStore);
    const rootFolderId = await ensureChildFolder(drive, "root", ROOT_FOLDER_NAME);
    const projectsFolderId = await ensureChildFolder(drive, rootFolderId, PROJECTS_FOLDER_NAME);
    const projectFolderId = await ensureChildFolder(drive, projectsFolderId, projectId);
    const papersFolderId = await ensureChildFolder(drive, projectFolderId, PAPERS_FOLDER_NAME);
    const cacheFolderId = await ensureChildFolder(drive, projectFolderId, CACHE_FOLDER_NAME);

    return { rootFolderId, projectsFolderId, projectFolderId, papersFolderId, cacheFolderId };
  }

  async listProjectPdfs(projectId: string): Promise<DrivePdfInfo[]> {
    const drive = await getDriveClient(this.authStore);
    const folders = await this.ensureProjectFolders(projectId);
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: [
          "mimeType = 'application/pdf'",
          "trashed = false",
          `'${folders.papersFolderId}' in parents`
        ].join(" and "),
        fields: "nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink)",
        pageSize: 100,
        pageToken
      });
      files.push(...(response.data.files ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return files
      .filter((file): file is drive_v3.Schema$File & { id: string } => Boolean(file.id))
      .map((file) => ({
        id: file.id,
        filename: file.name ?? "untitled.pdf",
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }));
  }
}

function sanitizeDriveFilename(filename: string): string {
  const clean = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return clean || "paper.pdf";
}

function hydrateDriveGraph(graph: GraphData): GraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      localFileId: node.localFileId ?? node.driveFileId
    }))
  };
}

function assertGraphData(value: GraphData): void {
  if (
    typeof value.version !== "string" ||
    typeof value.projectId !== "string" ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    !Array.isArray(value.edgeSuggestions)
  ) {
    throw new Error("INVALID_GRAPH_DATA");
  }
}

async function assertPdfBelongsToProject(
  drive: drive_v3.Drive,
  fileId: string,
  papersFolderId: string
): Promise<void> {
  const metadata = await drive.files.get({
    fileId,
    fields: "id, mimeType, parents, trashed"
  });

  if (
    metadata.data.trashed ||
    metadata.data.mimeType !== "application/pdf" ||
    !metadata.data.parents?.includes(papersFolderId)
  ) {
    throw new Error("PDF_NOT_FOUND");
  }
}
