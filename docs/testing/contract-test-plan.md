# Contract tests

`apps/api/tests/contracts.shared.test.ts` checks:

- shared source does not import Mongoose, Express, Next, or React
- status arrays match Step 13 constants
- role key `GOV_ADMIN`
- JSON-safe project summary
- success/failure narrowing
- GeoJSON longitude/latitude bounds
- public project sample has no budget or hashes

`apps/web/src/lib/api/shared-contract.test.ts` proves the web workspace can import the package.

No database is required.
