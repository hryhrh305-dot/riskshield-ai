## Project Rules for AI Coding Agents

1. Do NOT delete existing functionality without explicit user permission
2. Keep all API routes intact (v1, bulk-check, web-risk, etc.)
3. Scoring rules are sacred. Do not change point values or decision boundaries (0-25/26-65/66-100)
4. Google Sheets compatibility mandatory: batch-check must accept x-api-key header
5. DNS cache TTL = 7 days, do not reduce
6. Credit consumption must be server-side, never client-side
7. Supabase schema changes require migration scripts
8. Test before claiming completion: run build locally before pushing
9. Conversation with user in Chinese, website UI in English
10. Provide complete files, not patches
11. Push to GitHub triggers Vercel deploy automatically (warn user to wait ~30s)
12. Do not use xlsx dynamic import in browser (causes page crashes in Turbopack). Use static import at file top.
