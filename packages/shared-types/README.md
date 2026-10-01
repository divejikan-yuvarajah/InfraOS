# `@infraos/shared-types`

Cross-app TypeScript contracts only. Mongoose models stay in `apps/api`.

Currently exported:

- System role keys (`GOV_ADMIN`, not `GOVERNMENT_ADMIN`)
- User statuses, agency types/statuses, scope types
- Permission catalog strings from Step 4

Do not put `passwordHash`, `tokenHash`, or Mongo document shapes here.
