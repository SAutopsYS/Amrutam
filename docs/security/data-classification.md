# Data Classification

| Class | Examples | Protection |
|-------|----------|------------|
| Public | Doctor specializations, API docs | No restrictions |
| Internal | Appointment counts, queue metrics | Internal network only |
| Confidential | Email, phone, payment refs | RBAC, encrypted transit, masked logs |
| Sensitive Medical | Diagnosis, prescriptions, clinical notes | Strict RBAC, never logged, audit on access |

## Rules
- Sensitive Medical data never appears in application logs or metrics labels
- Confidential fields masked in structured logs via `sanitizeForLog()`
- API responses filtered by role — patients see only their records
