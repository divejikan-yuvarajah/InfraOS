import { Readable } from "node:stream";

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
}

const BUCKET = "inspectionEvidence";

class GridFsStorage implements EvidenceStorage {
  private bucket(): mongoose.mongo.GridFSBucket {
    const db = mongoose.connection.db;
    if (!db || mongoose.connection.readyState !== 1) throw new Error("storage unavailable");
    return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
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

export const storageKeyFor = (inspectionId: string, evidenceId: string, variant: "full" | "thumb") => `ins/${inspectionId}/${evidenceId}/${variant}`;
