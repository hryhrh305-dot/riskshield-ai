## Changelog

### 2026-06-22 (985df12)
- XLSX: static import xlsx, real ZIP+XLSX via writeFile()
- Clean CSV: fixed decision to risk_level field name

### 2026-06-22 (b65b87e)
- DNS cache TTL: 24h to 7 days
- Fixed bulk-check page corruption
- Percentage rounding: guaranteed 100% sum

### 2026-06-22 (b18d3ad)
- Unified output fields across all APIs
- Decision boundaries: ALLOW 0-25, REVIEW 26-65, BLOCK 66-100

### 2026-06-21
- Major scoring improvements (f04907e)
- 7557 disposable domains
- RFC 5321 input validation
- Domain keyword blacklist +30
- Suspicious TLD +15
- Role-based email +20
- Catch-all detection
- Confidence field
- Disposable: +45, personal: -10
