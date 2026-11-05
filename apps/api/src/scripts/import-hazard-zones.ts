import { readFile } from "node:fs/promises";

import { connectDatabase, disconnectDatabase, sanitizeMongoError } from "../config/database.js";
import { env, requireMongoConfig } from "../config/env.js";
import { planImport, parseArgs, type ImportOptions } from "../modules/risk/hazard-import.js";
import { HazardZone } from "../modules/risk/models/hazard-zone.model.js";

/**
 * Imports hazard zones from a GeoJSON file you have the right to use. Provenance is mandatory, the run is a DRY RUN
 * unless --commit is given, and DEMO data can never be written here. No dataset is bundled or fetched by this script.
 *
 *   npm run db:import:hazards -w @infraos/api -- --file zones.geojson --hazard-type FLOOD --level-property risk \
 *     --level-map '{"1":"LOW","2":"HIGH"}' --organisation "..." --dataset "..." --licence "..." --kind OFFICIAL_PUBLIC \
 *     [--source-url ...] [--data-date 2024-01-01] [--agency-id <id>] [--commit]
 */
async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
  let levelMap: Record<string, string> = {};
  try { levelMap = str("level-map") ? (JSON.parse(str("level-map") as string) as Record<string, string>) : {}; } catch { console.error("--level-map must be JSON"); process.exitCode = 1; return; }
  const file = str("file");
  if (!file) { console.error("--file <geojson> is required"); process.exitCode = 1; return; }
  const options: ImportOptions = {
    hazardType: str("hazard-type") ?? "", levelProperty: str("level-property") ?? "level", levelMap, organisation: str("organisation") ?? "", dataset: str("dataset") ?? "",
    licence: str("licence") ?? "", kind: str("kind") ?? "", sourceUrl: str("source-url"), dataDate: str("data-date"), agencyId: str("agency-id"), commit: a.commit === true,
  };
  const plan = planImport(JSON.parse(await readFile(file, "utf8")), options);
  if (plan.refused) { console.error(`REFUSED: ${plan.refused}`); process.exitCode = 1; return; }
  console.log(JSON.stringify({ mode: options.commit ? "COMMIT" : "DRY RUN (add --commit to write)", read: plan.read, valid: plan.valid, skipped: plan.skipped.length, skippedDetail: plan.skipped.slice(0, 20) }, null, 2));
  if (!options.commit) return;
  try {
    requireMongoConfig(env);
    await connectDatabase(env);
    let inserted = 0, updated = 0;
    for (const z of plan.zones) {
      const result = await HazardZone.updateOne(
        { "source.datasetName": options.dataset, externalId: z.externalId },
        { $set: { name: z.name, hazardType: z.hazardType, level: z.level, geometry: z.geometry, isDemo: false, visibility: options.agencyId ? "AGENCY" : "ALL_STAFF", ...(options.agencyId ? { agencyId: options.agencyId } : {}),
          source: { kind: options.kind, organisation: options.organisation, datasetName: options.dataset, licence: options.licence, ...(options.sourceUrl ? { url: options.sourceUrl } : {}), ...(options.dataDate ? { dataDate: new Date(options.dataDate) } : {}), retrievedAt: new Date() } },
          $setOnInsert: { externalId: z.externalId } },
        { upsert: true, runValidators: true },
      );
      if (result.upsertedCount) inserted += 1; else updated += 1;
    }
    console.log(JSON.stringify({ inserted, updated }));
  } catch (error) {
    console.error(`import failed: ${sanitizeMongoError(error)}`);
    process.exitCode = 1;
  } finally {
    try { await disconnectDatabase(); } catch { /* keep the original result */ }
  }
}

await main();
