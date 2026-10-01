# INFRAOS Permission Matrix

**Document:** `/docs/security/permission-matrix.md`  
**Step:** 04  
**Status:** Locked  
**Legend**

| Cell | Meaning |
|------|---------|
| **None** | No |
| **Public** | Public DTO only |
| **Own** | Own records only |
| **Assigned** | Assigned project or inspection |
| **Agency** | Own agency (+ affecting conflicts) |
| **Org** | Organization / ministry |
| **Platform** | Whole deployment |
| **Limited** | Subset of fields or actions |
| **Full** | All actions in that row **within scope** |

Columns: Super Admin (SA) · Gov Admin (GA) · Agency Officer (AO) · Project Manager (PM) · Contractor (CO) · Inspector (IN) · Citizen (CI)

SA **Full** on a row still obeys SoD (no operational approve/pay/verify).

---

## 1. Master visibility matrix

| Area | SA | GA | AO | PM | CO | IN | CI |
|------|----|----|----|----|----|----|----|
| App dashboard | Platform (ops read) | Org | Agency | Assigned / agency summary | Assigned limited | Assigned inspect | None (public home instead) |
| Users | Full | Org read + limited manage | Agency read | None | None | None | None |
| Agencies | Full | Org | Agency read | Agency read | None | None | None |
| Roles / permissions | Full | Read | None | None | None | None | None |
| Projects list/detail | Platform read | Org | Agency | Assigned write; agency read | Assigned limited | Assigned context | Public |
| Project approvals | None (SoD) | Org | Submit only | Submit assigned | None | None | None |
| Milestones | Platform read | Org | Agency | Assigned | Assigned read | Assigned read | None |
| Physical progress | Platform read | Org | Agency | Assigned | Assigned submit | Assigned read | None |
| Budget visibility | Platform read | Org | Agency limited | Assigned read | None | None | None |
| RoadSync / work requests | Platform read | Org | Agency | Assigned / agency | None | None | None |
| Conflicts | Platform read | Org | Affecting agency | Assigned related | None | None | None |
| Conflict resolution | None (SoD) | Org | Agency (see action matrix) | None | None | None | None |
| InfraMap internal | Platform | Org | Agency | Assigned / agency | Assigned limited | Assigned limited | Public map |
| Contractor information | Platform | Org | Agency | Assigned project | Own profile limited | None | None |
| Payments | Platform read | Org | Agency read | Assigned create/read | None | None | None |
| Project documents | Platform | Org | Agency | Assigned | Granted categories | Assigned inspect | Public-flagged only |
| DocTrace AI / RAG | Platform | Org | Agency | Assigned | None | Assigned if docs readable | None |
| AI Risk | Platform | Org | Agency | Assigned | None | None | None |
| Inspections | Platform read | Org | Agency | Assigned request | None | Assigned | None |
| Assets / maintenance | Platform | Org | Agency | Assigned related | None | Read if inspect asset | Public summary optional |
| Citizen issues | Platform | Org | Agency | None typical | None | None | Own + public create |
| Notifications | Own + platform support | Own | Own | Own | Own | Own | Own if account |
| Reports | Platform | Org | Agency | Assigned / agency | None | None | None |
| Exports | Platform | Org | Agency | Assigned if permitted | None | None | None |
| Audit logs | Platform | Org | None | None | None | None | None |
| System settings | Full | None | None | None | None | None | None |

---

## 2. ProjectTrace action matrix

| Action | SA | GA | AO | PM | CO | IN | CI |
|--------|----|----|----|----|----|----|----|
| Create project | None | Org | Agency | Agency (DRAFT) | None | None | None |
| Read project | Platform | Org | Agency | Assigned + agency read | Assigned limited | Assigned context | Public summary |
| Edit project | None* | Org if state allows | Agency if state allows | Assigned if state allows | None | None | None |
| Submit project | None | None typical | Agency | Assigned | None | None | None |
| Approve / reject project | None | Org | None | None | None | None | None |
| Put on hold | None | Org | Agency | Assigned | None | None | None |
| Cancel project | None | Org | Agency | Assigned | None | None | None |
| Complete project | None | Org | Agency | Assigned | None | None | None |
| View internal details | Platform | Org | Agency | Assigned | Limited | Limited | None |
| View public summary | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

\*SA may apply an **audited correction** path on COMPLETED (BR-PRJ-006), not casual edit.

**SoD:** the user who **submitted** a project cannot **approve** the same project.

---

## 3. RoadSync action matrix

| Action | SA | GA | AO | PM | CO | IN | CI |
|--------|----|----|----|----|----|----|----|
| Create work request | None | Org | Agency | Assigned project | None | None | None |
| Edit work request | None | Org | Agency | Assigned if editable | None | None | None |
| Detect / recalculate | Platform | Org | Agency | Assigned | None | None | None |
| View conflict | Platform | Org | Affecting agency | Related assigned | None | None | None |
| Send coordination | None | Org | Agency | Assigned (create request) | None | None | None |
| Respond to coordination | None | Org | **Target agency** | None | None | None | None |
| Resolve conflict | None | Org | Agency party after coordination | None | None | None | None |
| View coordination history | Platform | Org | Affecting agency | Related | None | None | None |

HIGH / blocking: no silent APPROVED of work without resolve or `ACCEPTED_RISK` by GA/AO with `roadsync.conflict.resolve` (Q-003 still defines which severities block).

---

## 4. Finance action matrix

| Action | SA | GA | AO | PM | CO | IN | CI |
|--------|----|----|----|----|----|----|----|
| View budget | Platform | Org | Agency | Assigned | None | None | None |
| Update budget | None | Org | Agency | Assigned | None | None | None |
| Add / submit payment | None | Org | Agency | Assigned | None | None | None |
| Edit pending payment | None | Org | Agency | Assigned | None | None | None |
| Approve payment | None | Org | None default | None | None | None | None |
| Reject payment | None | Org | None default | None | None | None | None |
| Export finance report | Platform | Org | Agency | Assigned | None | None | None |

**Hard:** contractor never has payment approve. Payment **submitter ≠ approver**. Inspector has no payment approve.

V1: `finance.payment.approve` is **Gov Admin (org)** only, to keep SoD simple.

---

## 5. Inspection action matrix

| Action | SA | GA | AO | PM | CO | IN | CI |
|--------|----|----|----|----|----|----|----|
| Schedule / assign inspection | None | Org | Agency | Assigned | None | None | None |
| View inspection | Platform | Org | Agency | Assigned | None | Assigned | None |
| Submit inspection report | None | None | None | None | None | Assigned | None |
| Verify progress (outcome) | None | None | None | None | None | Assigned | None |
| Reject / request review | None | None | None | None | None | Assigned | None |

PM cannot submit inspection as if they were the inspector.

---

## 6. Document action matrix

| Action | SA | GA | AO | PM | CO | IN | CI |
|--------|----|----|----|----|----|----|----|
| Upload | Platform support | Org | Agency | Assigned | Granted types on assigned | Evidence on assigned inspect | Issue photo only |
| View / download | Platform | Org | Agency | Assigned | Granted | Assigned inspect | Public-flagged only |
| Delete | Platform privileged | Org | Agency | Assigned if policy | None | None | None |
| AI process / RAG | Platform | Org | Agency | Assigned | None | If `document.read` | None |

RAG cannot retrieve document ids the user cannot `document.read`.

---

## 7. Identity action matrix (abbreviated)

| Action | SA | GA | AO | Others |
|--------|----|----|----|--------|
| Provision / disable users | Full | Org staff only | None | None |
| Assign agency | Full | Org | None | None |
| Change roles | Full | None (request SA) | None | None |
| Own profile | Yes | Yes | Yes | All staff/citizen-if-account |
