# Phase 103 Validation — AI Classification Assist

## Requirements Covered
- AI-01: POST /api/ai/classify endpoint, job description → Davis-Bacon classification + confidence
- AI-02: ai_classifications audit trail table, IL AI Act disclosure notice

## Plan 01 — Server + DB

### Migration check
```bash
cd /c/Users/glcar/prevailing-wage && node -e "const j=require('./src/server/db/migrations/meta/_journal.json'); console.log(JSON.stringify(j.entries.find(e=>e.idx===63)))"
```
Expected: journal entry with tag `0063_ai_classifications`.

```bash
cd /c/Users/glcar/prevailing-wage && grep "CREATE TABLE" src/server/db/migrations/0063_ai_classifications.sql
```
Expected: `CREATE TABLE IF NOT EXISTS ai_classifications`

### Route registration
```bash
cd /c/Users/glcar/prevailing-wage && grep "aiClassify\|/api/ai" src/server/index.ts
```
Expected: import line + `app.use('/api/ai', aiClassifyRouter)`

### Auth protection (unauthenticated should get 401)
```bash
cd /c/Users/glcar/prevailing-wage && curl -s -X POST http://localhost:4099/api/ai/classify -H "Content-Type: application/json" -d '{"jobDescription":"test"}' | python3 -m json.tool
```
Expected: `{"error": "..."}` with HTTP 401 (or 403).

## Plan 02 — Client UI

### Manual checks
- [ ] Visit http://localhost:5173/classification-assist (must redirect to /login if not authenticated)
- [ ] After login, page loads with "AI Classification Assist" PageHeader
- [ ] IL AI Act disclosure notice visible in amber banner at top
- [ ] Textarea accepts text with character counter
- [ ] "Classify with AI" button disables during loading
- [ ] Result shows trade code (gold badge), description, confidence bar, reasoning
- [ ] Alternatives section shows 1-3 rows
- [ ] Classification ID shown at bottom of result
- [ ] Error state shows if ANTHROPIC_API_KEY is missing/invalid

### TypeScript check
```bash
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | grep "error" | wc -l
```
Expected: 0 new errors.

## Environment Variable
ANTHROPIC_API_KEY must be set in server .env / Render environment for the endpoint to work in production.
The server should start successfully even without ANTHROPIC_API_KEY (lazy-init client prevents startup crash).
