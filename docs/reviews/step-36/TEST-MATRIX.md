# Step 36 — Test matrix

| Case | Test | Result |
| --- | --- | --- |
| Pending user, cost-12 hash, normalized email, no session | `creates a pending unverified user...` | **PASS** |
| 72-byte boundary and over-limit UTF-8 | `rejects passwords longer than 72...` | **PASS** |
| Sentinel hash cannot authenticate | `does not let the demo sentinel hash authenticate` | **PASS** |
| Anonymous privileged body and fake HTTP actor | `denies anonymous staff signup...` | **PASS** |
| Citizen signup | same test, `requestCitizenRegistration` | **PASS** — blocked by Q-005 |
| Extra `status` / inactive agency | `rejects mass-assignment...` | **PASS** |
| Concurrent duplicate email | `maps duplicate emails...` | **PASS** |
| Database failure message | `hides database failures` | **PASS** |
| HTTP registration route | not mounted | **PASS** by absence |
| Login, JWT, email send | not implemented | **PLANNED** |
| Browser UI | no page added | **NOT RUN** |
