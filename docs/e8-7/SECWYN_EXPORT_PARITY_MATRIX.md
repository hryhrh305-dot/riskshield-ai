# Secwyn E8.7 Export Parity Matrix

| Core fact | Web detail | HTML report | Print/PDF | Full CSV | XLSX | Queue CSV | Sheets | API |
|---|---|---|---|---|---|---|---|---|
| Email | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Final Decision | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Base Signal Score | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Primary reason | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Recommended action | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| MX state | Yes | Yes | Yes | Yes | Yes | Plan column | Yes | Yes |
| Mailbox state | Yes | Yes | Yes | Yes | Yes | Evidence summary | Yes | Yes |
| Catch-all state | Technical | Yes | Yes | Yes | Yes | Evidence summary | Yes | Yes |
| Engine/policy version | Technical/export | Metadata/contact | Metadata/contact | Yes | Yes | No | Yes | Yes |
| Audit ID/time | Technical/export | Metadata/contact | Metadata/contact | Yes | Yes | No | Yes | Yes |
| Input reconciliation | Web card | Yes | Yes | Separate summary | Separate summary | No | Dialog summary | API object |
| Credits consumed | Web reconciliation | Yes | Yes | Summary only | Summary only | No | Dialog/API | API object |

## Rules

- “No” in the table means the artifact is intentionally narrower, not that it may contradict another surface.
- A narrower artifact never recomputes the fact it includes.
- Web/API/Sheets canonical contact facts continue to originate from `attachCanonicalDecisionResult` and `getBatchExportColumnsForPlan`.
- E8.7 changes no API DTO and no Apps Script mapping.
- HTML/print/CSV/XLSX generation and repeated download call no Credits helper.
- Formula/HTML safety is applied only in artifact context; the canonical result and risk-engine input are unchanged.
