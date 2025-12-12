# Code Cleanup & Optimization Plan - December 2025

**Current Version**: 2.3.2  
**Last Major Refactoring**: December 11, 2025 (v2.0.0 - 96% code reduction)  
**Assessment Date**: December 12, 2025

---

## Executive Summary

After reviewing the changelog and current codebase structure, the application is in **excellent shape** following yesterday's major refactoring. However, there are opportunities for:

1. **Removing dead code and obsolete features**
2. **Standardizing patterns across API routes**
3. **Improving TypeScript type safety**
4. **Optimizing database queries**
5. **Enhancing error handling consistency**
6. **Documentation accuracy updates**

**Risk Level**: LOW - Most suggestions are non-breaking improvements

---

## 1. Dead Code & Obsolete Features

### 1.1 Gemini AI Integration (PRIORITY: HIGH)

**Status**: Deprecated December 11, 2025 but code still present

**Files to Clean**:
- `lib/ai-service.ts`:
  - Remove `analyzeWithGemini()` function
  - Remove `@google/genai` imports
  - Remove Gemini API key from environment checks
- `app/api/analyze/route.ts`:
  - Remove commented Gemini analysis calls (lines 138-148)
  - Remove `geminiAnalysis` variable declarations
- `app/api/leads/[id]/run-analysis/route.ts`:
  - Same as above
- `.env.example`:
  - Remove `GEMINI_API_KEY` line
- `SETUP_GUIDE.md`:
  - Remove Gemini API key setup instructions
  - Remove "Dual LLM" references
  - Update to "OpenAI-powered analysis"

**Impact**: Removes ~200 lines of unused code, simplifies setup

**Breaking Changes**: None (Gemini already disabled)

---

### 1.2 Commented Out Features

**Location**: `app/lead/[id]/page.tsx`

**Findings**:
- "Generate Website Mockup" button (commented v2.1.0)
- "Export to PDF" button (commented v2.1.0)
- Old "Cold Email Personalization" section (removed v1.1.0 but may have remnants)

**Action**: 
- Fully delete commented sections (no TODO to re-enable)
- Remove related state variables if present
- Remove mockup API route (`app/api/mockup/`) if exists and unused

**Impact**: Cleaner component, easier to read

---

### 1.3 Old Demo HTML Files

**Location**: `leadsapp/demos/` folder

**Findings**:
- `denee.html`
- `gailchristiereiki.com.html`
- `toni.html`
- `denee_files/` folder

**Status**: Demo generator moved to proper structure, old files left behind

**Action**:
- Review if any are actively linked/used
- Archive to separate folder outside leadsapp/ OR delete
- Keep only structure: `demos/client-name/index.html` pattern

**Impact**: Reduces clutter, clearer folder structure

---

## 2. API Route Standardization

### 2.1 Response Format Inconsistency

**Current State**: Mix of patterns across routes

**Examples**:
```typescript
// Pattern A (Good)
return NextResponse.json({ leads });

// Pattern B (Inconsistent)
return NextResponse.json({ data: { leads } });

// Pattern C (String errors)
return NextResponse.json({ error: 'message' }, { status: 500 });

// Pattern D (Structured errors)
return NextResponse.json({ 
  error: { message: 'X', code: 'Y' } 
}, { status: 500 });
```

**Recommendation**: Standardize to:
```typescript
// Success
return NextResponse.json({ 
  data: actualData,
  success: true 
});

// Error
return NextResponse.json({ 
  error: { message: string, code?: string },
  success: false 
}, { status: number });
```

**Files to Update**: ALL `/app/api/**/route.ts` files

**Impact**: Consistent error handling in frontend, easier debugging

---

### 2.2 Missing Input Validation

**Current State**: Some routes validate, others don't

**Example (Missing)**:
```typescript
// app/api/places/search/route.ts
const { query, location, minReviews, maxReviews } = body;
// No validation if query is empty string
```

**Recommendation**: Use Zod schemas for validation
```typescript
import { z } from 'zod';

const SearchSchema = z.object({
  query: z.string().min(1, 'Query required'),
  location: z.string().min(1, 'Location required'),
  minReviews: z.number().int().min(0).optional(),
  maxReviews: z.number().int().max(10000).optional(),
});

try {
  const validated = SearchSchema.parse(body);
  // Use validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ 
      error: { message: 'Validation failed', details: error.errors } 
    }, { status: 400 });
  }
}
```

**Files to Update**:
- All API routes accepting POST/PATCH bodies
- Install `zod` dependency

**Impact**: Better error messages, prevents bad data in database

---

### 2.3 Hardcoded userId Pattern

**Current State**: `'demo-user'` scattered across codebase

**Locations**:
- `components/places/GooglePlacesSearch.tsx` (5+ occurrences)
- Various API routes checking for userId

**Recommendation**: Centralize to config
```typescript
// lib/config.ts
export const DEMO_USER_ID = 'demo-user';

// Usage
import { DEMO_USER_ID } from '@/lib/config';
const userId = DEMO_USER_ID; // Easy to find/replace when auth added
```

**Impact**: Easier migration to real auth later

---

## 3. TypeScript Type Safety

### 3.1 Remaining `any` Types

**Search Pattern**: `grep -r "any" leadsapp/components leadsapp/app`

**Likely Locations**:
- Event handlers: `(e: any) => {}`
- API responses: `const data: any = await res.json()`
- Props: `props: any`

**Recommendation**: Replace with proper types
```typescript
// Bad
const handleClick = (e: any) => {};

// Good
import { MouseEvent } from 'react';
const handleClick = (e: MouseEvent<HTMLButtonElement>) => {};
```

**Impact**: Better IntelliSense, catch errors at compile time

---

### 3.2 Missing Return Types

**Example**:
```typescript
// Bad
async function fetchLeads() {
  // ...
}

// Good
async function fetchLeads(): Promise<Lead[]> {
  // ...
}
```

**Files to Audit**:
- All functions in `lib/ai-service.ts`
- All custom hooks in `lib/hooks/`
- All API route handlers

**Impact**: Better documentation, catches unexpected returns

---

## 4. Database Query Optimization

### 4.1 SELECT * Usage

**Current State**: Many queries use `SELECT *`

**Example**:
```typescript
const { data } = await supabaseAdmin
  .from('leads')
  .select('*'); // Returns ALL columns
```

**Recommendation**: Specify needed columns
```typescript
const { data } = await supabaseAdmin
  .from('leads')
  .select('id, name, website, status, automation_stage, created_at');
```

**Impact**: 
- Faster queries (less data transferred)
- Explicit about what's needed
- Prevents accidental data exposure

**Files to Audit**: All `/app/api/**/route.ts` with Supabase queries

---

### 4.2 Missing Indexes

**Check** `supabase-schema.sql` for indexes on frequently queried columns:

**Recommended Indexes**:
```sql
-- If not present
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_automation_stage ON leads(automation_stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_open_leads_user_id ON open_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_leads_user_id ON dismissed_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_promoted_leads_user_id ON promoted_leads(user_id);
```

**Impact**: Much faster queries, especially on large datasets

---

### 4.3 N+1 Query Problem

**Current Pattern** (in lead detail page):
```typescript
// 1 query for lead
const lead = await fetch(`/api/leads/${id}`);

// Inside that route: Multiple queries
const rawData = await supabase.from('raw_data_sources').select('*').eq('lead_id', id);
const analyses = await supabase.from('ai_analyses').select('*').eq('lead_id', id);
const emails = await supabase.from('generated_emails').select('*').eq('lead_id', id);
```

**Better**: Use Supabase joins
```typescript
const { data } = await supabase
  .from('leads')
  .select(`
    *,
    raw_data_sources (*),
    ai_analyses (*),
    generated_emails (*)
  `)
  .eq('id', leadId)
  .single();
```

**Impact**: 1 query instead of 4, faster page loads

---

## 5. Error Handling Improvements

### 5.1 Missing Error Boundaries

**Current State**: No React Error Boundaries

**Recommendation**: Add `app/error.tsx`
```typescript
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
```

**Impact**: Graceful error handling, better UX

---

### 5.2 Console.log Cleanup

**Search**: `grep -r "console.log" leadsapp/`

**Action**:
- Keep: Useful debugging logs with context
- Remove: `console.log('here')`, `console.log(data)` without labels
- Replace: With proper logger: `logger.info()`, `logger.error()`

**Files**: Likely scattered across components and API routes

---

### 5.3 Unhandled Promise Rejections

**Pattern to Find**:
```typescript
// Bad
fetch('/api/endpoint'); // No .catch() or try/catch

// Good
try {
  await fetch('/api/endpoint');
} catch (error) {
  console.error('Failed to fetch:', error);
  alert('Operation failed');
}
```

**Files to Audit**: All components with async operations

---

## 6. Performance Optimizations

### 6.1 Unnecessary Re-renders

**Check**: Components with inline functions as props

**Example**:
```typescript
// Bad - creates new function every render
<Button onClick={() => handleClick(id)} />

// Good - memoize with useCallback
const handleClickMemo = useCallback(() => handleClick(id), [id]);
<Button onClick={handleClickMemo} />
```

**Files**: Large components like `GooglePlacesSearch.tsx`, `CRMTable.tsx`

---

### 6.2 Bundle Size

**Audit**: Check what's actually imported

**Example**:
```typescript
// Bad
import { GoogleGenAI } from '@google/genai'; // Unused after Gemini removal

// Bad
import * as Icons from 'lucide-react'; // Imports entire library

// Good
import { Search, X, Check } from 'lucide-react'; // Tree-shakeable
```

**Action**: 
- Run `npm run build` and check bundle size warnings
- Remove unused imports
- Consider lazy loading for large components

---

## 7. Documentation Updates

### 7.1 README.md Accuracy

**Current Issues**:
- Still mentions "Dual LLM analysis" (Gemini removed)
- Demo Generator section incomplete
- Google Places not mentioned

**Updates Needed**:
- Change "Dual AI" to "AI-powered with OpenAI GPT-4o"
- Add Google Places feature bullet
- Update screenshots if present
- Remove Gemini setup steps

---

### 7.2 SETUP_GUIDE.md

**Updates**:
- Remove Gemini API key section
- Update AI model list (remove Gemini models)
- Add Google Places setup section
- Add automation explanation
- Update workflow diagrams

---

### 7.3 Inline Comments

**Recommendation**: Add JSDoc comments for:
- All exported functions
- Complex logic sections
- Magic numbers (e.g., `60000` → `const POLLING_INTERVAL = 60_000; // 1 minute`)

**Example**:
```typescript
/**
 * Analyzes lead content using OpenAI GPT-4o
 * @param content - Website text or social media data to analyze
 * @returns AI-generated persona profile with tone, story arc, and email opening
 * @throws Error if API call fails after retries
 */
export async function analyzeWithOpenAI(content: string): Promise<AIAnalysisResult>
```

---

## 8. Testing & Quality

### 8.1 Add Basic Tests

**Current State**: No tests

**Recommendation**: Start with critical paths
```typescript
// __tests__/api/leads.test.ts
describe('POST /api/analyze', () => {
  it('should create lead with valid input', async () => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', website: 'https://example.com' })
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lead).toBeDefined();
  });
});
```

**Files to Test**:
- `/api/analyze` (critical path)
- `/api/leads/create-from-places` (Google Places promotion)
- `lib/ai-service.ts` (AI analysis)

**Impact**: Confidence in refactoring, catch regressions

---

## 9. Security Improvements

### 9.1 Environment Variable Validation

**Current**: No validation on startup

**Recommendation**: Add to `lib/config.ts`
```typescript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

**Impact**: Fail fast on misconfiguration, clearer error messages

---

### 9.2 Rate Limiting

**Current**: No rate limiting on API routes

**Recommendation**: Add simple rate limiter for expensive routes
```typescript
// lib/rate-limiter.ts
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 500,
  ttl: 60_000, // 1 minute
});

export function rateLimit(identifier: string, limit: number) {
  const count = cache.get(identifier) as number | undefined;
  if (count && count >= limit) {
    return false;
  }
  cache.set(identifier, (count || 0) + 1);
  return true;
}

// Usage in API route
const ip = request.headers.get('x-forwarded-for') || 'unknown';
if (!rateLimit(ip, 100)) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

**Routes to Protect**:
- `/api/analyze` (expensive AI calls)
- `/api/places/search` (expensive Google API calls)
- `/api/scraper/deep` (expensive scraping)

---

## 10. Code Organization

### 10.1 Magic Numbers

**Example**:
```typescript
// Bad
if (Date.now() - lastUpdate > 120000) { ... }

// Good
const TWO_MINUTES_MS = 2 * 60 * 1000;
if (Date.now() - lastUpdate > TWO_MINUTES_MS) { ... }
```

**Files**: `app/api/automation/process/route.ts`, polling intervals

---

### 10.2 Duplicate Code

**Check for**: Similar patterns across API routes

**Example**: Error handling wrapper
```typescript
// lib/api-wrapper.ts
export function withErrorHandling(handler: Function) {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error('API Error:', error);
      return NextResponse.json({ 
        error: { message: 'Internal server error' } 
      }, { status: 500 });
    }
  };
}

// Usage
export const POST = withErrorHandling(async (request) => {
  // Main logic
});
```

---

## Implementation Priority

### Phase 1: Low-Risk Cleanup (1-2 hours)
1. Remove Gemini code
2. Delete commented features
3. Clean up console.logs
4. Update documentation (README, SETUP_GUIDE)

### Phase 2: Type Safety (2-3 hours)
1. Fix `any` types
2. Add return types
3. Add JSDoc comments
4. Centralize `DEMO_USER_ID`

### Phase 3: Performance (3-4 hours)
1. Optimize database queries (select specific columns)
2. Add missing indexes
3. Fix N+1 queries
4. Audit bundle size

### Phase 4: Standards (4-5 hours)
1. Standardize API response format
2. Add Zod validation
3. Add rate limiting
4. Create error boundary

### Phase 5: Quality (Ongoing)
1. Add basic tests
2. Continuous code review
3. Monitor performance metrics

---

## Estimated Impact

**Code Reduction**: ~500-700 lines removed (Gemini + dead code)  
**Performance**: 20-30% faster queries (indexes + optimized selects)  
**Type Safety**: 95%+ coverage (currently ~80%)  
**Maintainability**: Significantly improved (standardized patterns)  
**Breaking Changes**: Minimal (mostly internal refactoring)

---

## Risks & Mitigation

**Risk**: Breaking existing functionality  
**Mitigation**: Test each change locally, deploy incrementally

**Risk**: Time investment vs. benefit  
**Mitigation**: Prioritize Phase 1-2 (high impact, low effort)

**Risk**: New bugs introduced  
**Mitigation**: Add tests for changed code, thorough manual testing

---

## Conclusion

The codebase is in **strong shape** after yesterday's refactoring. The cleanup suggestions above are:

- **30% critical** (Gemini removal, documentation fixes)
- **40% recommended** (type safety, query optimization)
- **30% nice-to-have** (tests, advanced patterns)

**Recommendation**: Focus on Phase 1-2 first (4-5 hours total), significant impact with minimal risk.

---

**End of Code Cleanup Plan**
