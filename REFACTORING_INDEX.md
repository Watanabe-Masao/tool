# yield-stats-display.js Refactoring Documentation Index

**Generated:** 2025-11-06  
**File Size:** 1,392 lines → 5 modules (~1,353 lines total)  
**Circular Dependencies:** 0 verified

---

## Documents Generated

### 1. REFACTORING_PLAN_yield-stats-display.md
**Purpose:** Quick reference implementation guide  
**Contents:**
- Module overview table
- Exported functions mapping
- Dependency graph
- Implementation steps (Phase 1-3)
- Critical constraints
- Testing verification checklist
- File locations
- Risk assessment

**Best For:** Project planning, implementation sequencing, risk mitigation

---

### 2. MODULE_SPLIT_DETAILED_SPECS.md
**Purpose:** Complete technical specifications for each module  
**Contents:**
- Detailed function specifications
- Parameter descriptions
- Animation timing details
- State management patterns
- UI component specifications
- HTML structure
- Line-by-line function mapping

**Best For:** Implementation, code review, testing

---

### 3. yield-stats-display-refactoring-analysis.md
**Purpose:** Comprehensive analysis document (15 sections)  
**Contents:**
- Executive summary
- Complete function inventory (13 functions)
- External dependencies (8 modules, 40+ APIs)
- Complete dependency graph
- Circular dependency verification
- Module structure specifications
- Animation & feature inventory
- Implementation sequence
- Code metrics
- Testing strategy
- Migration checklist
- Risk assessment

**Best For:** Deep understanding, comprehensive reference, debugging

---

## QUICK START

### Step 1: Review Architecture
Read: **REFACTORING_PLAN_yield-stats-display.md** → Sections 1-3

### Step 2: Understand Dependencies
Read: **yield-stats-display-refactoring-analysis.md** → Part 3 (Dependency Graph)

### Step 3: Implement Modules
Read: **MODULE_SPLIT_DETAILED_SPECS.md** → FILES 1-5 (in order)

### Step 4: Verify Integration
Read: **REFACTORING_PLAN_yield-stats-display.md** → Implementation Steps & Checklist

---

## MODULE ALLOCATION TABLE

| Module | Lines | Functions | Export Count | Complexity | Priority |
|--------|-------|-----------|--------------|------------|----------|
| **core.js** | 368 | 4 | 4 | HIGH | P1 |
| **statistics.js** | 113 | 2 | 2 | MEDIUM | P2 |
| **validation.js** | 362 | 2 | 1 | HIGH | P3 |
| **buttons.js** | 397 | 4 | 2 | HIGH | P2 |
| **recommended.js** | 113 | 1 | 1 | MEDIUM | P4 |

---

## DEPENDENCY TREE

```
External Dependencies (13 modules)
├─ logger
├─ sanitizer
├─ dom-utils
├─ appState
├─ constants
├─ toast
├─ yield-stats-calc
├─ yield-stats-charts
├─ yield-stats-helpers
├─ event-handlers-setup
├─ outlier-management
└─ window globals (4)

    ↓

Core Module (Coordinator)
├─→ statistics.js (2 functions)
├─→ validation.js (1 function)
├─→ buttons.js (2 functions)
└─→ recommended.js (1 function)

validation.js
├─→ buttons.js
└─→ recommended.js

ALL MODULES
└─→ Self-contained (no circular refs)
```

---

## FUNCTION REFERENCE

### **EXPORTED FUNCTIONS (11 total)**

| # | Function | Module | Source | Type |
|---|----------|--------|--------|------|
| 1 | displayCurrentStatistics | core.js | L52 | async |
| 2 | setupFormulaModal | core.js | L786 | sync |
| 3 | handleOutlierCheckboxChange | core.js | L682 | sync |
| 4 | deleteOutlierRows | core.js | L702 | sync |
| 5 | displayStatistics | statistics.js | L265 | sync |
| 6 | displayMatrixEvaluation | statistics.js | L214 | sync |
| 7 | displaySampleSizeValidation | validation.js | L322 | sync |
| 8 | updateLoadStatsButtons | buttons.js | L1072 | sync |
| 9 | generateSigmaPatterns | buttons.js | L896 | sync |
| 10 | displayRecommendedValue | recommended.js | L937 | sync |
| 11 | *attachButtonHandler | buttons.js | L1046 | sync |

**Note:** asterisk = helper function, exposed but not consumer-facing

### **PURE UTILITY FUNCTIONS (2 total)**

| # | Function | Module | Source | Signature |
|---|----------|--------|--------|-----------|
| 1 | getRecommendedValue | buttons.js | L877 | (stats) → Object |
| 2 | generateSigmaPatterns | buttons.js | L896 | (stats, range?) → Array |

---

## CRITICAL IMPLEMENTATION NOTES

### 1. External Callbacks (NOT DEFINED IN THESE FILES)

These functions are called by `deleteOutlierRows()` but are provided by the caller:

```javascript
// Called with callbacks:
compactYieldStatsRows(yieldStatsCallbacks)
updateYieldStatsStatistics(displayCurrentStatistics)
```

**Action:** Verify these exist in the calling context before testing

### 2. Window Global Functions

These globals are called by `updateLoadStatsButtons()`:

```javascript
window.loadAllStatsToMultiPattern()
window.loadStatsValueToMultiPattern(value, type, isRecommended)
window.showTransferNotification(message)
window.focusFirstPatternInput()
```

**Action:** Verify these are defined before running button updates

### 3. Animation Timing Cascade

Total animation display time: **~750ms maximum**

```
Statistics: 850ms (17 items × 50ms)
Matrix: 500ms
Validation: 100-500ms
Recommended: 50-400ms
Progress Bar: 1000ms
```

**Action:** Test animation performance with slow 3G

### 4. AppState Dependency

All modules depend on `appState` singleton. It MUST be:
- Initialized before any display function
- Consistent across module calls
- Free of race conditions (read → calculate → write)

**Action:** Verify initialization order in main entry point

### 5. HTML Element Dependencies

**Required elements for display functions:**
```
#statsTypeSelect (input select)
#yieldStatsResults (container)
#sampleSizeResult (container)
#outlierInfo (container)
#recommendedValue (container)
#formulaModal (modal)
#matrixEvalSampleSize (span)
#matrixEvalCV (span)
#matrixEvalMessage (div)
Plus 15+ more in specific modules
```

**Action:** Add null-check guards in all DOM selectors

---

## TESTING STRATEGY

### Unit Tests (Module Level)

**statistics.js:**
- Test displayStatistics with various stat objects
- Verify animation timing (50ms stagger)
- Test icon mapping in displayMatrixEvaluation

**buttons.js:**
- Test getRecommendedValue (skewness logic)
- Test generateSigmaPatterns (range generation)
- Test attachButtonHandler (touch + click detection)

**recommended.js:**
- Test displayRecommendedValue with normal distribution
- Test displayRecommendedValue with skewed distribution
- Verify animation triggers

### Integration Tests (Module Interaction)

**validation.js:**
- Test displaySampleSizeValidation workflow
- Verify calls to buttons.updateLoadStatsButtons
- Verify calls to recommended.displayRecommendedValue

**core.js:**
- Test displayCurrentStatistics workflow
- Verify all module calls in order
- Test outlier checkbox handling
- Test row deletion flow

### E2E Tests (Full Flow)

- Load sample data → run all displays
- Check animation completion
- Verify state management
- Check all elements rendered

---

## MIGRATION STEPS

### Pre-Implementation Checklist

- [ ] Create git branch `refactor/yield-stats-split`
- [ ] Review all 3 documentation files
- [ ] List all consumer files (search imports)
- [ ] Backup original file
- [ ] Identify all external callbacks
- [ ] Test original functionality thoroughly

### Implementation Order

1. **Create statistics.js** (~15 min)
   - Copy lines 214-310 with minimal changes
   - Add imports header
   - Verify no compiler errors

2. **Create buttons.js** (~20 min)
   - Copy lines 877-1382
   - Extract helper functions
   - Test pure functions

3. **Create recommended.js** (~10 min)
   - Copy lines 937-1040
   - Simple, single function
   - Test animations

4. **Create validation.js** (~20 min)
   - Copy lines 322-677
   - Import from buttons.js and recommended.js
   - Test inter-module calls

5. **Create core.js** (~25 min)
   - Copy lines 52-208, 682-696, 702-781, 786-870
   - Import from all new modules
   - Test main orchestration

6. **Update Imports** (~10 min)
   - Find all import statements from old file
   - Update to new module imports
   - Run linter/build

### Post-Implementation Validation

- [ ] Run full test suite
- [ ] Check browser console for errors
- [ ] Test all animations
- [ ] Verify state management
- [ ] Check performance (no regressions)
- [ ] Cross-browser testing
- [ ] Mobile touch testing

---

## ROLLBACK PLAN

If issues arise:

1. **Keep original file** as backup
2. **Revert imports** in consumers to original file
3. **Comment out new module** imports
4. **Add all functions** back to original file (temporary)
5. **Test thoroughly** before re-attempting split

---

## FILE CHECKLIST

After implementation, verify all files exist:

```bash
# Run these commands to verify
ls -lh scripts/yield-stats-*.js

# Check exports
grep "^export" scripts/yield-stats-*.js | wc -l
# Expected: 11 export statements

# Check imports between modules
grep "from './yield-stats" scripts/yield-stats-*.js
```

---

## CODE REVIEW FOCUS AREAS

1. **Circular Dependencies**
   - No imports creating cycles
   - Dependency flow is one-way
   - Core.js is true top-level

2. **Animation Timing**
   - All setTimeout values intact
   - Stagger calculations correct
   - No blocking operations

3. **State Management**
   - AppState calls in correct order
   - No race conditions
   - Consistent across modules

4. **HTML Element Selection**
   - All null-check guards present
   - Element IDs match HTML
   - Fallback handling

5. **External Callbacks**
   - Properly documented
   - Not accidentally removed
   - Signature unchanged

---

## DOCUMENTATION ARTIFACTS

### Location
All files saved to `/home/user/tool/`:
- `REFACTORING_PLAN_yield-stats-display.md` (15 KB)
- `MODULE_SPLIT_DETAILED_SPECS.md` (25 KB)
- `yield-stats-display-refactoring-analysis.md` (45 KB)
- `REFACTORING_INDEX.md` (this file)

### Version Control

```bash
# Commit these analysis docs first
git add REFACTORING*.md MODULE_SPLIT*.md
git commit -m "docs: Add comprehensive yield-stats-display refactoring analysis"

# Then implement in separate commits
git add scripts/yield-stats-*.js
git commit -m "refactor: Split yield-stats-display.js into 5 focused modules"
```

---

## TIMELINE ESTIMATE

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Pre-Implementation** | 30 min | Review docs, backup, setup |
| **Module Creation** | 100 min | Create 5 new files |
| **Import Updates** | 15 min | Update consumer imports |
| **Testing** | 45 min | Unit/integration/E2E tests |
| **Code Review** | 30 min | Review & feedback |
| **Fixes & Cleanup** | 20 min | Address review comments |
| **Total** | **4 hours** | Complete refactoring |

---

## SUCCESS CRITERIA

After refactoring:

- [ ] All 13 functions work identically
- [ ] No circular dependency errors
- [ ] All animations render smoothly
- [ ] No console errors
- [ ] State management consistent
- [ ] Test coverage maintained
- [ ] Bundle size unchanged
- [ ] Performance same or better
- [ ] Code review approved
- [ ] Merged to main

---

## QUESTIONS & TROUBLESHOOTING

### Q: Where should I create the new files?

**A:** Option 1: Create subdirectory `scripts/yield-stats-display/` with 5 files  
**Option 2:** Keep in `scripts/` with consistent prefix: `yield-stats-{module}.js`

### Q: How do I handle the external callbacks?

**A:** Don't! They're provided by caller. Just ensure they're documented and available at runtime.

### Q: Will this affect bundle size?

**A:** No. Same lines of code, just reorganized. Bundler should be identical size.

### Q: What about TypeScript/JSDoc?

**A:** Keep existing JSDoc comments. Add module-level headers describing responsibilities.

### Q: How do I test animation timing?

**A:** Use Chrome DevTools → Rendering → Paint flashing. Look for smooth, non-blocking animations.

---

## NEXT STEPS

1. **Start Implementation**
   - Review `MODULE_SPLIT_DETAILED_SPECS.md` for FILE 1
   - Create `yield-stats-core.js`
   - Copy first 4 functions with imports

2. **Build & Test**
   - Run `npm run build`
   - Test main orchestration
   - Check console errors

3. **Iterate**
   - Create remaining modules in sequence
   - Test inter-module calls
   - Fix imports

4. **Finalize**
   - Run full test suite
   - Code review
   - Merge to main

---

## RESOURCES

- **Original File:** `/home/user/tool/scripts/yield-stats-display.js` (1,392 lines)
- **Analysis Date:** 2025-11-06
- **Analyzer:** Claude Code v4.5
- **Status:** Ready for Implementation

---

**Last Updated:** 2025-11-06  
**Analysis Status:** Complete - Ready for Development

