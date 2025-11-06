# REFACTORING PLAN: yield-stats-display.js
## Complete Module Split Analysis & Implementation Guide

**Analysis Date:** 2025-11-06  
**File Size:** 1,392 lines  
**Target Structure:** 5 modules (368 + 113 + 362 + 397 + 113 = 1,353 lines estimated)  
**Circular Dependencies:** 0 (VERIFIED)

---

## QUICK REFERENCE: MODULE OVERVIEW

### Module Distribution

| Module | Lines | Functions | Purpose |
|--------|-------|-----------|---------|
| **core.js** | ~368 | 4 exported | Main orchestration & coordination |
| **statistics.js** | ~113 | 2 exported | Statistics display with animations |
| **validation.js** | ~362 | 1 exported | Sample size validation UI |
| **buttons.js** | ~397 | 2 exported | Load buttons & value management |
| **recommended.js** | ~113 | 1 exported | Recommended value display |

---

## EXPORTED FUNCTIONS MAPPING

```javascript
// CORE.JS - 4 functions
export { displayCurrentStatistics, setupFormulaModal, handleOutlierCheckboxChange, deleteOutlierRows }

// STATISTICS.JS - 2 functions (internal use)
export { displayStatistics, displayMatrixEvaluation }

// VALIDATION.JS - 1 function
export { displaySampleSizeValidation }

// BUTTONS.JS - 2 functions
export { updateLoadStatsButtons, generateSigmaPatterns }

// RECOMMENDED.JS - 1 function (internal use)
export { displayRecommendedValue }
```

---

## DEPENDENCY GRAPH SUMMARY

```
core.js (Top Coordinator)
├─> statistics.js       (displayStatistics, displayMatrixEvaluation)
├─> validation.js       (displaySampleSizeValidation)
├─> buttons.js          (updateLoadStatsButtons)
└─> recommended.js      (displayRecommendedValue)

validation.js
├─> buttons.js
└─> recommended.js

buttons.js              (Self-contained)
recommended.js          (Self-contained)
statistics.js           (Self-contained)
```

**Result:** ZERO CIRCULAR DEPENDENCIES ✓

---

## IMPLEMENTATION STEPS

### Phase 1: Create Leaf Modules (No Inter-dependencies)

1. **Create statistics.js** (lines 214-310)
   - Copy: displayMatrixEvaluation, displayStatistics
   - Imports: dom-utils, yield-stats-helpers
   - Time: 15 min

2. **Create buttons.js** (lines 877-1382)
   - Copy: getRecommendedValue, generateSigmaPatterns, attachButtonHandler, updateLoadStatsButtons
   - Imports: dom-utils, state, logger
   - Time: 20 min

3. **Create recommended.js** (lines 937-1040)
   - Copy: displayRecommendedValue
   - Imports: dom-utils, state
   - Time: 10 min

### Phase 2: Create Dependent Module

4. **Create validation.js** (lines 322-677)
   - Copy: displaySampleSizeValidation, displayOutlierInfo
   - Imports: dom-utils, state, helpers, recommended, buttons, outlier-management
   - Time: 20 min

### Phase 3: Refactor Original

5. **Create core.js** (lines 1-1392, keeping only core functions)
   - Copy: displayCurrentStatistics, setupFormulaModal, handleOutlierCheckboxChange, deleteOutlierRows
   - Import from: statistics, validation, buttons, recommended + external
   - Time: 25 min

6. **Update Consumer Imports**
   - Find all imports of yield-stats-display.js
   - Update to specific module imports
   - Time: 10 min

---

## CRITICAL CONSTRAINTS

### 1. External Callbacks (KEEP AS-IS)
```javascript
// In deleteOutlierRows() - EXTERNAL, do not remove
compactYieldStatsRows(yieldStatsCallbacks)
updateYieldStatsStatistics(displayCurrentStatistics)
```

### 2. Window Globals (VERIFY EXIST)
```javascript
// In updateLoadStatsButtons() - must be defined by caller
window.loadAllStatsToMultiPattern()
window.loadStatsValueToMultiPattern()
window.showTransferNotification()
window.focusFirstPatternInput()
```

### 3. Required HTML Elements
```
#statsTypeSelect
#yieldStatsResults
#sampleSizeResult
#outlierInfo
#recommendedValue
#formulaModal
#matrixEvalSampleSize
#matrixEvalCV
#matrixEvalMessage
... and 20+ more
```

### 4. Animation Timing
- statistics.js: 50ms stagger for 17 items
- validation.js: 100ms+ delays, count-up animations
- recommended.js: 50ms-500ms cascade
- **Total: up to 750ms for full display**

---

## FILE LOCATIONS

### Create in: `/home/user/tool/scripts/`

1. `/home/user/tool/scripts/yield-stats-display/core.js` (OR keep in scripts/)
2. `/home/user/tool/scripts/yield-stats-display/statistics.js`
3. `/home/user/tool/scripts/yield-stats-display/validation.js`
4. `/home/user/tool/scripts/yield-stats-display/buttons.js`
5. `/home/user/tool/scripts/yield-stats-display/recommended.js`

**Option A:** Create subdirectory `scripts/yield-stats-display/`
**Option B:** Keep in `scripts/` with names `yield-stats-core.js`, `yield-stats-statistics.js`, etc.

---

## TEST VERIFICATION CHECKLIST

After split, verify:

- [ ] No console errors
- [ ] All animations work (no timing issues)
- [ ] Statistics display correctly
- [ ] Sample size validation works
- [ ] Outlier detection & UI works
- [ ] Button loading works
- [ ] Formula modal opens/closes
- [ ] No circular import errors
- [ ] All exports accessible
- [ ] State management consistent
- [ ] No missing HTML elements

---

## RISK ASSESSMENT

| Item | Risk | Mitigation |
|------|------|-----------|
| Timing coordination | Low | Test with performance monitor |
| State management | Low | Verify appState initialized |
| External callbacks | Medium | List all callback dependencies |
| Window globals | Medium | Document global expectations |
| Element selection | Medium | Add null checks where needed |

---

## DETAILED SPECIFICATION BY MODULE

### CORE.JS

**Responsibility:** Orchestrate entire display flow

**Functions to include:**
```javascript
// Line 52-208: displayCurrentStatistics()
async function displayCurrentStatistics() {
  // Main orchestrator
  // Calls: calculateStatistics, displayStatistics, displayMatrixEvaluation,
  //        displaySampleSizeValidation, renderStatsChart, displayRecommendedValue,
  //        updateLoadStatsButtons
}

// Line 786-870: setupFormulaModal()
function setupFormulaModal() {
  // Modal UI setup with XSS protection
}

// Line 682-696: handleOutlierCheckboxChange()
function handleOutlierCheckboxChange() {
  // Checkbox state handler - calls displayCurrentStatistics recursively
}

// Line 702-781: deleteOutlierRows()
function deleteOutlierRows() {
  // Row deletion with confirmation
  // Calls external callbacks: compactYieldStatsRows, updateYieldStatsStatistics
}
```

**Imports needed:**
```javascript
import { logger } from './core/logger.js';
import { qs, qsa, hide, show } from './dom-utils.js';
import { appState } from './state.js';
import { UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { showInfo, showWarning } from './toast.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { renderStatsChart } from './yield-stats-charts.js';
import { updateToleranceUnit } from './event-handlers-setup.js';
import { isOutlierValue, highlightOutlierRows } from './outlier-management.js';
import { displayStatistics, displayMatrixEvaluation } from './statistics.js';
import { displaySampleSizeValidation } from './validation.js';
import { displayRecommendedValue } from './recommended.js';
import { updateLoadStatsButtons } from './buttons.js';
```

---

### STATISTICS.JS

**Responsibility:** Display statistics with animations

**Functions to include:**
```javascript
// Line 265-310: displayStatistics(stats, unit = '%')
function displayStatistics(stats, unit = '%') {
  // 17 step-by-step fadeIn animations (50ms stagger)
  // Displays: count, max, min, range, avg, median, stdDev, cv, q1, q3, iqr,
  //           skewness, kurtosis, sigma1, sigma2, sigma3
}

// Line 214-260: displayMatrixEvaluation(stats)
function displayMatrixEvaluation(stats) {
  // FadeInUp animation with icon indicators
  // Icons: 🌟 excellent, ✓ good, ⚡ fair, ⚠️ poor
}
```

**Exports:**
```javascript
export { displayStatistics, displayMatrixEvaluation }
```

---

### VALIDATION.JS

**Responsibility:** Sample size validation & outlier management

**Functions to include:**
```javascript
// Line 322-553: displaySampleSizeValidation()
export function displaySampleSizeValidation() {
  // Progress bar with count-up animation
  // Calls: displayOutlierInfo, displayRecommendedValue, updateLoadStatsButtons
}

// Line 567-677: displayOutlierInfo()
function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid) {
  // Checkbox list generation, color coding, recommendations
  // Calls: highlightOutlierRows
}
```

**Exports:**
```javascript
export { displaySampleSizeValidation }
```

---

### BUTTONS.JS

**Responsibility:** Load button management & recommended values

**Functions to include:**
```javascript
// Line 877-888: getRecommendedValue(stats)
function getRecommendedValue(stats) {
  // Pure logic: mean (skewness <= 0.5) vs median
}

// Line 896-929: generateSigmaPatterns(stats, sigmaRange = 2)
export function generateSigmaPatterns(stats, sigmaRange = 2) {
  // Generate sigma range patterns
}

// Line 1046-1066: attachButtonHandler(button, handler)
function attachButtonHandler(button, handler) {
  // Touch + click event adapter
}

// Line 1072-1382: updateLoadStatsButtons()
export function updateLoadStatsButtons() {
  // Dynamic button/table generation for multi-pattern analysis
  // Calls: getRecommendedValue, attachButtonHandler
  // Calls globals: window.loadAllStatsToMultiPattern, window.loadStatsValueToMultiPattern
}
```

**Exports:**
```javascript
export { updateLoadStatsButtons, generateSigmaPatterns }
```

---

### RECOMMENDED.JS

**Responsibility:** Recommended value display with reasoning

**Functions to include:**
```javascript
// Line 937-1040: displayRecommendedValue()
export function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate') {
  // Scale animation for badge, fade-in for reasoning
  // Shows either mean (normal distribution) or median (skewed distribution)
  // Displays multi-pattern link visibility
}
```

**Exports:**
```javascript
export { displayRecommendedValue }
```

---

## FUTURE OPTIMIZATION OPPORTUNITIES

1. **Extract Animation Timing Constants**
   ```javascript
   const ANIMATION_TIMING = {
     STAT_STEP_DELAY: 50,      // 50ms between each stat
     VALIDATION_INITIAL: 100,  // 100ms before showing validation
     RECOMMENDED_DELAY: 50,    // 50ms slide-in
     PROGRESS_DURATION: 1000   // 1s progress bar animation
   }
   ```

2. **Extract HTML Element Selectors**
   ```javascript
   const SELECTORS = {
     STATS_TYPE: '#statsTypeSelect',
     RESULTS: '#yieldStatsResults',
     VALIDATION: '#sampleSizeResult',
     // ... etc
   }
   ```

3. **Extract Format Utilities**
   ```javascript
   function formatStatValue(value, unit, type) {
     // Centralize formatting logic
   }
   ```

---

## REFERENCE: FULL FUNCTION LIST WITH LINE NUMBERS

| # | Function | Lines | Module | Exported |
|---|----------|-------|--------|----------|
| 1 | displayCurrentStatistics | 52-208 | core.js | YES |
| 2 | displayMatrixEvaluation | 214-260 | statistics.js | NO |
| 3 | displayStatistics | 265-310 | statistics.js | NO |
| 4 | displaySampleSizeValidation | 322-553 | validation.js | YES |
| 5 | displayOutlierInfo | 567-677 | validation.js | NO |
| 6 | handleOutlierCheckboxChange | 682-696 | core.js | YES |
| 7 | deleteOutlierRows | 702-781 | core.js | YES |
| 8 | setupFormulaModal | 786-870 | core.js | YES |
| 9 | getRecommendedValue | 877-888 | buttons.js | NO |
| 10 | generateSigmaPatterns | 896-929 | buttons.js | YES |
| 11 | displayRecommendedValue | 937-1040 | recommended.js | YES |
| 12 | attachButtonHandler | 1046-1066 | buttons.js | NO |
| 13 | updateLoadStatsButtons | 1072-1382 | buttons.js | YES |

---

## VALIDATION COMMANDS POST-SPLIT

```bash
# Check imports compile
npm run build

# Run linter
npm run lint scripts/yield-stats-*.js

# Check for circular deps
npm run test -- --testPathPattern="circular"

# Check exports
grep -h "^export" scripts/yield-stats-*.js

# Verify no missing imports
grep "from '\." scripts/yield-stats-*.js | sort | uniq
```

---

## COMPLETION CHECKLIST

- [ ] Read original file completely
- [ ] Extract all 13 functions
- [ ] Create statistics.js
- [ ] Create buttons.js
- [ ] Create recommended.js
- [ ] Create validation.js
- [ ] Create core.js
- [ ] Update imports in core.js
- [ ] Update consumer file imports
- [ ] Run full test suite
- [ ] Verify animations work
- [ ] Verify state management works
- [ ] Code review
- [ ] Merge to main

**Estimated Total Time:** 2-3 hours

