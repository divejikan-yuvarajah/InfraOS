# Form data contracts (Step 20)

Client form values are not API DTOs until a later feature maps `z.output` explicitly.

Step 16 envelope:

- Success: `{ success: true, data, meta.requestId }`
- Failure: `{ success: false, error: { code, message, details }, meta.requestId }`

Field errors, when the API sends them, are expected at `error.details.fieldErrors` as a string map. The current health API does not emit that shape; the mapper is tested with synthetic failures only. No new Express routes were added.

`GOV_ADMIN` remains the role key from Step 16. This step does not collect roles.
