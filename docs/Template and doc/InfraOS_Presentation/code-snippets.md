# Code snippets shown in the deck (verbatim, @ 2753c19)

## Slide 11 — Money and audit commit together
`apps/api/src/modules/finance/finance.common.ts` L95–103

```ts
  95   const session = await mongoose.startSession();
  96   try {
  97     let out!: T;
  98     await session.withTransaction(async () => { out = await work(session); });
  99     return out;
 100   } finally {
 101     await session.endSession();
 102   }
 103 }
```

## Slide 13 — Validate first, then scope, then save
`apps/api/src/modules/projects/projects.routes.ts` L223–224, 227–233

```ts
 223     const parsed = projectCreateSchema.safeParse(req.body);
 224     if (!parsed.success) {
  // …
 227     }
 228     const result = await createProject(actor, parsed.data, req.requestId);
 229     if (!result.ok) {
 230       sendFailure(res, req, result);
 231       return;
 232     }
 233     res.status(201).json(success({ project: result.project }, req.requestId));
```

## Slide 15 — Space and time must both overlap
`apps/api/src/modules/roadsync/detection.service.ts` L175–175, 186–188, 192–193

```ts
 175   const area = searchPolygon(subject.geometry, subject.bufferMeters + radius);
  // …
 186   await run("work_request", () => fetchWorkRequests(area, subject.id));
 187   await run("project", () => fetchProjects(area, subject.projectId));
 188   await run("asset", () => fetchAssets(area));
  // …
 192     const { spatial, temporal } = analyzePair(subject, item, radius, subjectIsA);
 193     if (spatial.relation === "none") continue;
```

## Slide 17 — Two permissions per layer, strict queries
`apps/api/src/modules/inframap/inframap.routes.ts` L77–77, 79–82, 84–85

```ts
  77 const MAP = "map.view.internal" as const;
  // …
  79   res.setHeader("Cache-Control", "no-store");
  80   res.setHeader("Pragma", "no-cache");
  81   if (!req.actor) return;
  82   if (Object.keys(req.query).length > 0) {
  // …
  84     return;
  85   }
```

## Slide 19 — Abuse-resistant by default
`apps/api/src/modules/public/public.routes.ts` L106–107, 112–112, 116–118, 122–122

```ts
 106   const parsed = publicIssueBodySchema.safeParse(req.body);
 107   if (!parsed.success) {
  // …
 112   if (parsed.data.website && parsed.data.website.trim().length > 0) {
  // …
 116   const result = await createPublicIssue(parsed.data);
 117   if (!result.ok) {
 118     const status = result.code === "STORAGE_UNAVAILABLE" ? 503 : 400;
  // …
 122   res.status(201).json(success(result, req.requestId));
```

## Slide 21 — Risk scores you can reproduce
`apps/api/src/modules/risk/engine/index.ts` L51–51, 56–62

```ts
  51 export function evaluateRisk(
  // …
  56   const project = inputs.project.data;
  57   const status = project?.status ?? "DRAFT";
  58 
  59   const inputsHash = computeInputsHash(inputs, RISK_ENGINE_VERSION);
  60 
  61   // 1. Applicability check by project status
  62   if (NON_ASSESSABLE_STATUSES.has(status)) {
```

## Slide 23 — Five gates guard every request
`apps/api/src/modules/identity/authorization/require-permission.ts` L77–79, 82–84, 89–90

```ts
  77       const role = await Role.findById(actor.roleId);
  78       if (!role?.isActive || role.key !== actor.roleKey) {
  79         reject(res, req, 401, "AUTH_REQUIRED");
  // …
  82       const granted = Array.isArray(role.permissions) ? role.permissions : [];
  83       const hasAny = permissions.some((permission) => hasPermission(granted, permission));
  84       if (!hasAny) {
  // …
  89         reject(res, req, 403, "FORBIDDEN");
  90         return;
```

