# Code Cleanup Plan for LeadsApp
**Created:** December 11, 2025  
**Status:** Planning Phase - No Changes Made Yet

---

## Executive Summary

This document outlines a comprehensive cleanup plan for the LeadsApp CRM system. After thorough inspection of the entire codebase, I've identified key areas for improvement across architecture, code quality, organization, and maintainability.

**Current State:**
- ~2,866 line single-file React component (`app/page.tsx`)
- 21+ API routes with varying patterns
- Multiple feature domains (CRM, Google Places, Demo Generator, Web Scraper)
- TypeScript with heavy `any` usage
- Comprehensive feature set but needs architectural refinement

---

## 🔴 Critical Issues (High Priority)

### 1. Monolithic Component Architecture

**Problem:** `app/page.tsx` is 2,866 lines containing ALL application logic
- **Lines 1-85:** 40+ useState declarations (state explosion)
- **Lines 100-800:** Business logic functions mixed with component
- **Lines 800-2866:** Massive JSX with deeply nested conditional rendering

**Impact:**
- Extremely difficult to maintain and test
- Poor code reusability
- Slow development velocity
- High risk of bugs when making changes

**Solution:**
```
📁 app/
├── 📁 dashboard/
│   ├── page.tsx (main dashboard shell)
│   ├── 📁 components/
│   │   ├── NewAnalysisForm.tsx
│   │   ├── CRMTable.tsx
│   │   ├── GooglePlacesSearch.tsx
│   │   ├── DemoGenerator.tsx
│   │   ├── WebsiteScraper.tsx
│   │   └── LeadDetails.tsx
│   └── 📁 hooks/
│       ├── useLeads.ts
│       ├── usePlaces.ts
│       ├── useAnalysis.ts
│       └── useCampaigns.ts
```

**Breakdown Strategy:**
1. Extract 5 main features into separate components (~400 lines each)
2. Create custom hooks for data fetching & state management
3. Extract business logic into service modules
4. Use context providers for shared state (campaigns, user)

---

### 2. Type Safety Issues

**Problem:** Excessive `any` types throughout codebase
- Found 17+ instances in critical files
- Lost type safety benefits
- Prone to runtime errors

**Examples:**
```typescript
// ❌ Current (unsafe)
const [leads, setLeads] = useState<any[]>([]);
const [analysisResults, setAnalysisResults] = useState<any>(null);
raw_content: any; // JSONB

// ✅ Proposed (safe)
const [leads, setLeads] = useState<Lead[]>([]);
const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
raw_content: JsonValue; // Proper JSONB type
```

**Action Items:**
1. Define proper TypeScript interfaces for all data structures
2. Create type definitions for API responses
3. Add Zod schemas for runtime validation
4. Replace all `any` with proper types
5. Enable stricter TypeScript compiler options

---

### 3. Inconsistent API Route Patterns

**Problem:** Different error handling, response formats, and logging patterns
- Some routes use `console.log`, others use emoji logging
- Inconsistent error response structures
- No centralized error handling

**Examples:**
```typescript
// Current inconsistencies:
console.log('📥 POST /api/analyze - Request received');  // Emoji style
console.log('Leads fetch error:', error);                 // Plain style
console.error('Failed to parse Instagram JSON:', e);      // Different error handling
```

**Solution:**
```typescript
// Proposed: Unified logging utility
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {...},
  error: (message: string, error: Error, meta?: object) => {...},
  api: (route: string, method: string, status: number) => {...}
};

// Proposed: Standardized API responses
// lib/api-utils.ts
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export function apiSuccess<T>(data: T): NextResponse {...}
export function apiError(message: string, status: number, code: string): NextResponse {...}
```

---

## 🟡 Code Quality Issues (Medium Priority)

### 4. File Organization & Naming

**Problem:** Inconsistent file structure and naming conventions

**Current Issues:**
- SQL files scattered in root: `DISMISSED_LEADS_MIGRATION.sql`, `STORY_HOOK_MIGRATION.sql`
- Demo HTML files in multiple locations: `leadsapp/demos/`, `leadsapp/public/demos/`, `demos/`
- JSON test data in root: `all-3.json`, `full.json`, `posts-only.json`
- Mixed documentation styles: ALL_CAPS.md and CamelCase.md

**Proposed Structure:**
```
📁 leadsapp/
├── 📁 app/                    # Next.js app directory
├── 📁 components/             # Reusable components
│   ├── 📁 forms/
│   ├── 📁 tables/
│   ├── 📁 modals/
│   └── 📁 ui/                # shadcn components
├── 📁 lib/
│   ├── 📁 services/          # Business logic
│   │   ├── lead-service.ts
│   │   ├── places-service.ts
│   │   ├── ai-service.ts
│   │   └── scraper-service.ts
│   ├── 📁 hooks/             # Custom React hooks
│   ├── 📁 utils/             # Helper functions
│   └── 📁 types/             # TypeScript types
├── 📁 database/
│   ├── schema.sql
│   └── 📁 migrations/        # All migration SQL files
├── 📁 docs/                  # All documentation
│   ├── setup/
│   ├── api/
│   └── features/
├── 📁 public/
│   └── 📁 demos/             # Generated demo sites
└── 📁 __tests__/             # Test files
```

---

### 5. Duplicate & Dead Code

**Problem:** Code duplication and unused files

**Duplicates Found:**
- Demo HTML files duplicated across 3 locations
- Similar data fetching logic repeated in multiple components
- Instagram analytics extraction logic duplicated

**Potentially Dead Code:**
- `leadsapp/demo.html` (1 file, unclear purpose)
- `leadsapp/vibe-coded-toni.html` (test file?)
- `leadsapp/sample.txt` (test data?)
- `leadsapp/proxy.ts` (unused import?)
- Multiple auth components that may not be used (based on monolithic page.tsx)

**Action Items:**
1. Audit all HTML files - consolidate or delete
2. Remove unused test data files
3. Check if auth components are actually used
4. Extract duplicate logic into shared utilities
5. Run dead code detection tools (ts-prune, knip)

---

### 6. State Management Complexity

**Problem:** 40+ useState declarations in single component

**Current Complexity:**
```typescript
// From app/page.tsx (lines 9-85)
const [currentTab, setCurrentTab] = useState('new-analysis');
const [leads, setLeads] = useState<any[]>([]);
const [prospectName, setProspectName] = useState('');
const [company, setCompany] = useState('');
// ... 36 more useState declarations
```

**Proposed Solutions:**

**Option A: Context + Reducer Pattern**
```typescript
// contexts/LeadsContext.tsx
type LeadsState = {
  leads: Lead[];
  selectedLeads: Set<string>;
  filters: LeadFilters;
  isLoading: boolean;
};

type LeadsAction = 
  | { type: 'SET_LEADS'; payload: Lead[] }
  | { type: 'SELECT_LEAD'; payload: string }
  | { type: 'SET_FILTER'; payload: Partial<LeadFilters> };

const leadsReducer = (state: LeadsState, action: LeadsAction): LeadsState => {...};
```

**Option B: Zustand Store (Recommended)**
```typescript
// stores/useLeadsStore.ts
import create from 'zustand';

interface LeadsStore {
  leads: Lead[];
  selectedLeads: Set<string>;
  filters: LeadFilters;
  setLeads: (leads: Lead[]) => void;
  selectLead: (id: string) => void;
  setFilter: (filter: Partial<LeadFilters>) => void;
}

export const useLeadsStore = create<LeadsStore>((set) => ({...}));
```

---

## 🟢 Improvements & Best Practices (Lower Priority)

### 7. Documentation Consolidation

**Current Issues:**
- 12+ markdown files with overlapping information
- ALL_CAPS naming (SETUP_GUIDE.md, CHANGELOG.md)
- Inconsistent formatting and structure

**Proposed Structure:**
```
📁 docs/
├── README.md                 # Main entry point
├── 📁 getting-started/
│   ├── quickstart.md
│   ├── installation.md
│   └── configuration.md
├── 📁 features/
│   ├── lead-analysis.md
│   ├── google-places.md
│   ├── demo-generator.md
│   └── web-scraper.md
├── 📁 database/
│   ├── schema.md
│   └── migrations.md
├── 📁 api/
│   └── reference.md          # API documentation
├── 📁 development/
│   ├── architecture.md
│   └── contributing.md
└── CHANGELOG.md             # Keep in root per convention
```

**Action:** Consolidate redundant docs:
- Merge `SETUP_GUIDE.md`, `QUICKSTART.md`, `GOOGLE_PLACES_QUICKSTART.md`
- Combine migration docs into single migrations guide
- Create proper API documentation

---

### 8. Environment & Configuration

**Current Issues:**
- No `.env.example` validation
- API keys hardcoded in multiple places
- No runtime config validation

**Proposed:**
```typescript
// lib/config.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  GEMINI_API_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// Usage: import { env } from '@/lib/config';
// Throws at startup if env vars are invalid
```

---

### 9. Error Handling & Logging

**Current Issues:**
- Mixed console.log/console.error patterns
- No structured logging
- Client-side errors not tracked
- API errors lack context

**Proposed:**
```typescript
// lib/logger.ts
import pino from 'pino'; // or winston

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined,
});

export const log = {
  info: (msg: string, meta?: object) => logger.info(meta, msg),
  error: (msg: string, error: Error, meta?: object) => 
    logger.error({ ...meta, error: error.stack }, msg),
  api: (method: string, path: string, status: number, duration: number) =>
    logger.info({ method, path, status, duration }, 'API Request'),
};

// Optional: Add Sentry/LogRocket for production error tracking
```

---

### 10. Testing Infrastructure

**Current State:** No tests found

**Proposed Test Strategy:**
```
📁 __tests__/
├── 📁 unit/
│   ├── services/
│   │   ├── ai-service.test.ts
│   │   └── instagram-analytics.test.ts
│   └── utils/
├── 📁 integration/
│   └── api/
│       ├── leads.test.ts
│       ├── places.test.ts
│       └── analyze.test.ts
└── 📁 e2e/
    └── critical-flows.spec.ts
```

**Setup Required:**
1. Install testing libraries: `vitest`, `@testing-library/react`, `msw`
2. Create test utilities and mocks
3. Add test scripts to package.json
4. Set up CI/CD testing pipeline

**Priority Tests:**
- Instagram analytics extraction (unit)
- AI service response parsing (unit)
- Lead CRUD operations (integration)
- Google Places search & filtering (integration)

---

## 🛠️ Technical Debt Items

### 11. Database Schema Improvements

**Issues:**
- Missing indexes on frequently queried columns
- No database migrations framework
- Schema split across multiple SQL files
- Missing foreign key constraints in some tables

**Recommendations:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_open_leads_user_campaign ON open_leads(user_id, campaign_id);

-- Add missing constraints
ALTER TABLE dismissed_leads 
  ADD CONSTRAINT fk_campaign 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- Consider migration framework (e.g., Prisma Migrate, Supabase Migrations)
```

---

### 12. API Route Optimizations

**Current Issues:**
- No request validation middleware
- No rate limiting
- Cache implementation only in places API (inconsistent)
- Large payloads without pagination

**Proposed:**
```typescript
// middleware/validation.ts
import { z } from 'zod';

export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (req: NextRequest) => {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return apiError('Invalid request body', 400, 'VALIDATION_ERROR');
    }
    return result.data;
  };
}

// middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';

export const rateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});
```

**Add pagination to all list endpoints:**
```typescript
// GET /api/leads?page=1&limit=50&status=lead_collected
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = (page - 1) * limit;
  
  // Query with pagination...
}
```

---

### 13. Performance Considerations

**Current Issues:**
- No image optimization for profile pictures
- Large Instagram JSON files processed synchronously
- No lazy loading for large lead lists
- Missing loading states in some UI sections

**Recommendations:**
1. **Image Optimization:**
   - Use Next.js `<Image>` component for profile pictures
   - Implement image upload size limits
   - Add compression before Supabase storage

2. **Data Processing:**
   - Move Instagram analytics extraction to background job
   - Stream large file uploads instead of loading into memory
   - Add Web Workers for client-side processing

3. **UI Performance:**
   - Implement virtual scrolling for large lead tables (react-virtual)
   - Add React.memo for expensive components
   - Use Suspense boundaries for lazy loading
   - Debounce search/filter inputs

4. **Caching Strategy:**
   - Add Redis/Upstash for API response caching
   - Implement SWR or React Query for client-side caching
   - Cache Instagram analytics results

---

## 📋 Migration Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up proper TypeScript configuration (strict mode)
- [ ] Create type definitions file (types/index.ts)
- [ ] Add Zod for runtime validation
- [ ] Set up logging utility
- [ ] Create API response utilities
- [ ] Document current architecture

### Phase 2: Component Refactoring (Week 2-3)
- [ ] Extract NewAnalysisForm component
- [ ] Extract CRMTable component
- [ ] Extract GooglePlacesSearch component
- [ ] Extract DemoGenerator component
- [ ] Extract WebsiteScraper component
- [ ] Create custom hooks (useLeads, usePlaces, useAnalysis)
- [ ] Set up Zustand store (or Context)

### Phase 3: API Standardization (Week 4)
- [ ] Standardize all API route responses
- [ ] Add request validation to all routes
- [ ] Implement consistent error handling
- [ ] Add pagination to list endpoints
- [ ] Create API documentation

### Phase 4: File Organization (Week 5)
- [ ] Reorganize folder structure
- [ ] Move SQL files to database/migrations
- [ ] Consolidate demo files
- [ ] Remove dead code
- [ ] Consolidate documentation

### Phase 5: Testing & Quality (Week 6)
- [ ] Set up testing infrastructure
- [ ] Write unit tests for core utilities
- [ ] Write integration tests for API routes
- [ ] Add E2E tests for critical flows
- [ ] Set up CI/CD pipeline

### Phase 6: Performance & Polish (Week 7)
- [ ] Implement caching strategy
- [ ] Add pagination and virtual scrolling
- [ ] Optimize image handling
- [ ] Add loading states everywhere
- [ ] Performance audit with Lighthouse

---

## 🎯 Quick Wins (Can Do Immediately)

These can be done safely without breaking changes:

1. **Rename documentation files** (5 min)
   ```bash
   mv SETUP_GUIDE.md docs/setup-guide.md
   mv GOOGLE_PLACES_QUICKSTART.md docs/google-places-quickstart.md
   # etc.
   ```

2. **Add ESLint rules** (10 min)
   ```javascript
   // eslint.config.mjs
   rules: {
     '@typescript-eslint/no-explicit-any': 'warn',
     '@typescript-eslint/no-unused-vars': 'warn',
     'no-console': ['warn', { allow: ['error'] }]
   }
   ```

3. **Create .env.example** (5 min)
   ```env
   # Copy from .env.local and remove actual values
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   # etc.
   ```

4. **Add README badges** (5 min)
   ```markdown
   ![Next.js](https://img.shields.io/badge/Next.js-15-black)
   ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
   ![Supabase](https://img.shields.io/badge/Supabase-Database-green)
   ```

5. **Add proper .gitignore entries** (2 min)
   ```gitignore
   # Add if missing
   *.log
   .env*.local
   .DS_Store
   ```

6. **Organize SQL migrations** (10 min)
   ```bash
   mkdir -p database/migrations
   mv *.sql database/migrations/
   ```

7. **Remove test data files** (5 min)
   ```bash
   # Archive or delete
   rm all-3.json full.json posts-only.json sample.txt
   ```

---

## 🚨 Risks & Considerations

### Breaking Changes
- Refactoring page.tsx will require extensive testing
- API response format changes need client updates
- Database schema changes need migration strategy

### Migration Strategy
1. **Feature Flags:** Use environment variables to toggle new/old code
2. **Parallel Implementation:** Build new structure alongside old
3. **Gradual Migration:** Move one feature at a time
4. **Comprehensive Testing:** Test each change thoroughly
5. **Rollback Plan:** Keep old code commented until stable

### Time Estimates
- **Minimal cleanup (Quick Wins only):** 1-2 hours
- **Phase 1-2 (Foundation + Components):** 2-3 weeks
- **Full cleanup (All phases):** 6-8 weeks
- **Ongoing maintenance:** Establish code review standards

---

## 📚 Recommended Tools & Libraries

### Development
- **zod** - Runtime type validation
- **zustand** - Simple state management
- **react-query** or **swr** - Data fetching & caching
- **react-hook-form** - Form handling
- **date-fns** - Date utilities

### Testing
- **vitest** - Fast unit testing
- **@testing-library/react** - Component testing
- **msw** - API mocking
- **playwright** - E2E testing

### Code Quality
- **prettier** - Code formatting
- **eslint** - Linting
- **husky** - Git hooks
- **lint-staged** - Pre-commit checks
- **ts-prune** - Find unused exports

### Monitoring (Production)
- **Sentry** - Error tracking
- **Vercel Analytics** - Performance monitoring
- **PostHog** or **Mixpanel** - Product analytics

---

## ✅ Success Metrics

How to measure improvement:

1. **Code Metrics:**
   - Reduce average file size from 2866 lines to <300 lines
   - Eliminate all `any` types (currently 17+)
   - Achieve 80%+ test coverage

2. **Developer Experience:**
   - Reduce time to add new feature from days to hours
   - Faster onboarding for new developers
   - Fewer bugs in production

3. **Performance:**
   - Improve Lighthouse scores (target: 90+)
   - Reduce Time to Interactive (TTI)
   - Lower API response times

4. **Maintainability:**
   - All code follows consistent patterns
   - Documentation is up-to-date
   - CI/CD passes all checks

---

## 📞 Next Steps

1. **Review this plan** with the team
2. **Prioritize phases** based on business needs
3. **Create tickets** for each task in your project management tool
4. **Assign ownership** for each phase
5. **Start with Quick Wins** to build momentum
6. **Schedule weekly reviews** to track progress

---

## 📝 Notes

- This is a living document - update as you make progress
- Don't try to do everything at once - prioritize ruthlessly
- Test thoroughly after each change
- Keep the existing functionality working throughout migration
- Consider hiring a code reviewer for critical changes

---

**Remember:** The goal is sustainable, maintainable code - not perfection. Ship incremental improvements!

**Last Updated:** December 11, 2025  
**Author:** Code Architect AI  
**Status:** ✅ Planning Complete - Ready for Review
