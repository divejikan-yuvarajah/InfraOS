import mongoose from "mongoose";

const WRITE_METHODS = [
  "insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany",
  "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "bulkWrite", "drop", "createIndex", "createIndexes",
] as const;

/**
 * Records every write the Mongo driver is asked to perform, keyed by collection name.
 * It patches the driver Collection prototype that the active mongoose connection actually uses.
 */
export function installWriteSpy() {
  const proto = Object.getPrototypeOf(mongoose.connection.getClient().db().collection("__spy__")) as Record<string, unknown>;
  const written = new Map<string, Set<string>>();
  const originals = new Map<string, unknown>();
  for (const method of WRITE_METHODS) {
    const original = proto[method];
    if (typeof original !== "function") continue;
    originals.set(method, original);
    proto[method] = function patched(this: { collectionName: string }, ...args: unknown[]) {
      const ops = written.get(this.collectionName) ?? new Set<string>();
      ops.add(method);
      written.set(this.collectionName, ops);
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
  return {
    reset: () => written.clear(),
    collections: () => [...written.keys()].sort(),
    operations: () => Object.fromEntries([...written].map(([name, ops]) => [name, [...ops].sort()])),
    stop: () => { for (const [method, original] of originals) proto[method] = original; },
  };
}
