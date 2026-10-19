# @infraos/shared-types

Wire contracts shared by Next.js and Express. Mongoose models stay in `apps/api`.

```ts
import type { ProjectSummaryDto, ApiResponse } from "@infraos/shared-types";
import { PROJECT_STATUSES, isApiSuccess, isInfraGeometry } from "@infraos/shared-types";
```

The package exports TypeScript source (`exports["."] = ./src/index.ts`). It must not import Mongoose, Express, Next, or React.

Permission constants describe names only. They do not authorize a request.

Role key is `GOV_ADMIN`, not `GOVERNMENT_ADMIN`.

See `docs/architecture/shared-contracts.md`.
