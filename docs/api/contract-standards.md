# Contract standards

API version is `/api/v1`.

Breaking changes: renaming a required field, changing an enum value, changing money units, changing the success envelope, or adding private fields to a public DTO.

Non-breaking changes: optional response fields and new error codes that clients can treat as generic failures.

Checklist:

1. Update `@infraos/shared-types`.
2. Update docs and drift tests.
3. Update serializers only when the endpoint exists.
4. Run lint, type-check, test, and build.
5. Team Leader reviews shared-package diffs.

OpenAPI generation is not used. The catalog in `endpoint-contract-catalog.md` is the contract inventory.
