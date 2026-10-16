import type { Connection, IndexDefinition, IndexOptions } from "mongoose";

type IndexKey = Record<string, unknown>;

export type IndexModel = {
  modelName: string;
  collection: { name: string };
  schema: {
    indexes: () => Array<[IndexDefinition, IndexOptions]>;
  };
};

export type ExpectedIndex = {
  key: IndexKey;
  options: Record<string, unknown>;
};

export type ExistingIndex = ExpectedIndex & {
  name: string;
};

export type CollectionIndexReport = {
  model: string;
  collection: string;
  expected: ExpectedIndex[];
  existing: ExistingIndex[];
  missing: ExpectedIndex[];
  mismatch: Array<{
    expected: ExpectedIndex;
    existing: ExistingIndex;
  }>;
};

const ENFORCEMENT_OPTIONS = [
  "unique",
  "sparse",
  "expireAfterSeconds",
  "partialFilterExpression",
  "collation",
] as const;

function comparableOptions(options: IndexOptions | Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    ENFORCEMENT_OPTIONS
      .filter((key) => options[key] !== undefined)
      .map((key) => [key, options[key]]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameKey(left: IndexKey, right: IndexKey): boolean {
  return sameValue(Object.entries(left), Object.entries(right));
}

function expectedIndexes(model: IndexModel): ExpectedIndex[] {
  return model.schema.indexes().map(([key, options]: [IndexDefinition, IndexOptions]) => ({
    key: { ...key },
    options: comparableOptions(options),
  }));
}

function isNamespaceMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 26;
}

async function existingIndexes(
  connection: Connection,
  collectionName: string,
): Promise<ExistingIndex[]> {
  try {
    const indexes = await connection.collection(collectionName).listIndexes().toArray();
    return indexes.map((index) => ({
      name: index.name ?? "unnamed",
      key: { ...index.key },
      options: comparableOptions(index),
    }));
  } catch (error) {
    if (isNamespaceMissing(error)) return [];
    throw error;
  }
}

/** Compare declared and installed indexes. This function never creates or drops indexes. */
export async function inspectIndexes(
  connection: Connection,
  models: readonly IndexModel[],
): Promise<CollectionIndexReport[]> {
  const reports: CollectionIndexReport[] = [];
  for (const model of models) {
    const expected = expectedIndexes(model);
    const existing = await existingIndexes(connection, model.collection.name);
    const missing: ExpectedIndex[] = [];
    const mismatch: CollectionIndexReport["mismatch"] = [];
    for (const declared of expected) {
      const installed = existing.find((candidate) => sameKey(candidate.key, declared.key));
      if (!installed) {
        missing.push(declared);
      } else if (!sameValue(installed.options, declared.options)) {
        mismatch.push({ expected: declared, existing: installed });
      }
    }
    reports.push({
      model: model.modelName,
      collection: model.collection.name,
      expected,
      existing,
      missing,
      mismatch,
    });
  }
  return reports;
}
