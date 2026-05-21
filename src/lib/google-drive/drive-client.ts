import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";
import { getAuthorizedOAuthClient } from "./auth";
import { DRIVE_FOLDER_MIME, GRAPH_JSON_FILENAME } from "./constants";
import type { GoogleAuthStore } from "./auth-store";

export async function getDriveClient(authStore?: GoogleAuthStore): Promise<drive_v3.Drive> {
  const auth = await getAuthorizedOAuthClient(authStore);
  return google.drive({ version: "v3", auth });
}

export async function ensureChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await findChildFolder(drive, parentId, name);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [parentId]
    },
    fields: "id"
  });

  if (!created.data.id) throw new Error(`DRIVE_FOLDER_CREATE_FAILED:${name}`);
  return created.data.id;
}

export async function findChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string | null> {
  const response = await drive.files.list({
    q: [
      `name = '${escapeDriveQueryValue(name)}'`,
      `mimeType = '${DRIVE_FOLDER_MIME}'`,
      "trashed = false",
      `'${escapeDriveQueryValue(parentId)}' in parents`
    ].join(" and "),
    fields: "files(id, name)",
    pageSize: 1
  });

  return response.data.files?.[0]?.id ?? null;
}

export async function findChildFile(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  mimeType?: string
): Promise<drive_v3.Schema$File | null> {
  const query = [
    `name = '${escapeDriveQueryValue(name)}'`,
    "trashed = false",
    `'${escapeDriveQueryValue(parentId)}' in parents`
  ];
  if (mimeType) query.push(`mimeType = '${escapeDriveQueryValue(mimeType)}'`);

  const response = await drive.files.list({
    q: query.join(" and "),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, webViewLink)",
    pageSize: 1
  });

  return response.data.files?.[0] ?? null;
}

export async function readDriveFileAsBuffer(
  drive: drive_v3.Drive,
  fileId: string
): Promise<Buffer> {
  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  return streamToBuffer(response.data as Readable);
}

export async function writeGraphJsonFile(
  drive: drive_v3.Drive,
  cacheFolderId: string,
  graph: unknown
): Promise<string> {
  const body = Readable.from([Buffer.from(JSON.stringify(graph, null, 2))]);
  const existing = await findChildFile(drive, cacheFolderId, GRAPH_JSON_FILENAME, "application/json");

  if (existing?.id) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: { mimeType: "application/json", body },
      fields: "id"
    });
    if (!updated.data.id) throw new Error("DRIVE_GRAPH_UPDATE_FAILED");
    return updated.data.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: GRAPH_JSON_FILENAME,
      parents: [cacheFolderId],
      mimeType: "application/json"
    },
    media: { mimeType: "application/json", body },
    fields: "id"
  });

  if (!created.data.id) throw new Error("DRIVE_GRAPH_CREATE_FAILED");
  return created.data.id;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
