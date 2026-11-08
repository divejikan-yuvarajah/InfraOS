import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import mongoose from "mongoose";

import { env } from "../../config/env.js";

/**
 * Evidence bytes live behind this interface so a future object-storage provider (Cloudflare R2) is a drop-in.
 * Only the opaque `key` is persisted elsewhere (Document.storageKey). No URLs, credentials or presigned links exist anywhere.
 */
export interface EvidenceStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  open(key: string): Readable;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Streams bytes in without buffering the whole file (DocTrace). The source stream's errors abort and remove the partial blob. */
  putStream(key: string, source: Readable, contentType: string): Promise<void>;
}

const BUCKET = "inspectionEvidence";
/** DocTrace documents use their own GridFS bucket on the same provider. */
const DOCUMENT_BUCKET = "documents";

class GridFsStorage implements EvidenceStorage {
  constructor(private readonly bucketName: string = BUCKET) {}
  private bucket(): mongoose.mongo.GridFSBucket {
    const db = mongoose.connection.db;
    if (!db || mongoose.connection.readyState !== 1) throw new Error("storage unavailable");
    return new mongoose.mongo.GridFSBucket(db, { bucketName: this.bucketName });
  }
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.delete(key);
    await new Promise<void>((resolve, reject) => {
      const up = this.bucket().openUploadStream(key, { metadata: { contentType } });
      up.once("error", reject);
      up.once("finish", () => resolve());
      up.end(data);
    });
  }
  async putStream(key: string, source: Readable, contentType: string): Promise<void> {
    await this.delete(key);
    const up = this.bucket().openUploadStream(key, { metadata: { contentType } });
    try {
      await pipeline(source, up);
    } catch (error) {
      await this.delete(key).catch(() => undefined);
      throw error;
    }
  }
  open(key: string): Readable { return this.bucket().openDownloadStreamByName(key); }
  async exists(key: string): Promise<boolean> { return (await this.bucket().find({ filename: key }).limit(1).toArray()).length > 0; }
  async delete(key: string): Promise<void> {
    const b = this.bucket();
    for (const f of await b.find({ filename: key }).toArray()) await b.delete(f._id);
  }
}

let gridfs: EvidenceStorage | null = null;

/** `gridfs` (default, also when empty or `local`) is built in. `r2` is reserved for a future provider and reports not-configured. */
export function getEvidenceStorage(): EvidenceStorage | null {
  const provider = env.STORAGE_PROVIDER;
  if (provider === "r2") return null;
  gridfs ??= new GridFsStorage();
  return gridfs;
}

let documentsGridfs: EvidenceStorage | null = null;
/** Same provider switch as evidence; `null` means storage is not configured (callers answer STORAGE_UNAVAILABLE). */
export function getDocumentStorage(): EvidenceStorage | null {
  if (env.STORAGE_PROVIDER === "r2") return null;
  documentsGridfs ??= new GridFsStorage(DOCUMENT_BUCKET);
  return documentsGridfs;
}

export const storageKeyFor = (inspectionId: string, evidenceId: string, variant: "full" | "thumb") => `ins/${inspectionId}/${evidenceId}/${variant}`;
