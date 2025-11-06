# DETAILED MODULE SPECIFICATIONS
## yield-stats-display.js Refactoring

---

## FILE 1: yield-stats-display-core.js (368 lines)

### Module Header
```javascript
/**
 * 歩留まり統計: 表示管理モジュール - Core Orchestration
 * Phase 9: UX改善完了版 - Main coordination and entry points
 * 
 * Responsibilities:
 * - Main display orchestration (displayCurrentStatistics)
 * - Formula modal setup
 * - Outlier checkbox handling
 * - Row deletion with confirmation
 */
```

### Function 1: displayCurrentStatistics (Lines 52-208)
**Signature:** `async function displayCurrentStatistics()`
**Purpose:** Main orchestrator - coordinates all display functions
**Complexity:** HIGH (157 lines)
**Calls:**
- appState.getYieldStatsRawData()
- appState.setCurrentDisplayType(selectedType)
- calculateStatistics() [external]
- appState.setCalculatedStats()
- appState.setYieldStatsCalculated()
- appState.setYieldStatsFromHistory()
- updateLoadStatsButtons() [from buttons.js]
- appState.getSampleSizeValidation()
- appState.setLastCalculatedStats()
- displayStatistics() [from statistics.js]
- displayMatrixEvaluation() [from statistics.js]
- displaySampleSizeValidation() [from validation.js]
- renderStatsChart() [external]
- updateToleranceUnit() [external]
- displayRecommendedValue() [from recommended.js]

### Function 2: setupFormulaModal (Lines 786-870)
**Signature:** `function setupFormulaModal()`
**Purpose:** Setup formula help modal UI with XSS protection
**Complexity:** MEDIUM (86 lines)
**Features:**
- Modal open/close handling
- Escape key support
- Touch/click event support
- XSS-safe HTML injection with escapeHTML()
- Event delegation for help icons

### Function 3: handleOutlierCheckboxChange (Lines 682-696)
**Signature:** `function handleOutlierCheckboxChange()`
**Purpose:** Handle outlier checkbox state changes
**Complexity:** LOW (15 lines)
**Calls:**
- appState.clearExcludedOutliers()
- appState.excludeOutlierByIndex()
- displayCurrentStatistics() [RECURSIVE]

### Function 4: deleteOutlierRows (Lines 702-781)
**Signature:** `function deleteOutlierRows()`
**Purpose:** Delete table rows containing outlier values
**Complexity:** MEDIUM (80 lines)
**External Dependencies:**
- compactYieldStatsRows(yieldStatsCallbacks) [CALLBACK - not defined here]
- updateYieldStatsStatistics(displayCurrentStatistics) [CALLBACK - not defined here]
**Features:**
- Confirmation dialog
- Outlier value detection using isOutlierValue()
- Row number reassignment
- Toast notifications

### Imports for core.js
```javascript
import { logger } from './core/logger.js';
import { qs, qsa, hide, show } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { showInfo, showWarning } from './toast.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { renderStatsChart } from './yield-stats-charts.js';
import { updateToleranceUnit } from './event-handlers-setup.js';
import { isOutlierValue, highlightOutlierRows } from './outlier-management.js';

// NEW IMPORTS from split modules
import { displayStatistics, displayMatrixEvaluation } from './yield-stats-statistics.js';
import { displaySampleSizeValidation } from './yield-stats-validation.js';
import { displayRecommendedValue } from './yield-stats-recommended.js';
import { updateLoadStatsButtons } from './yield-stats-buttons.js';
```

### Exports from core.js
```javascript
export {
  displayCurrentStatistics,
  setupFormulaModal,
  handleOutlierCheckboxChange,
  deleteOutlierRows
}
```

---

## FILE 2: yield-stats-statistics.js (113 lines)

### Module Header
```javascript
/**
 * 歩留まり統計: Statistics Display with Animations
 * 
 * Responsibilities:
 * - Display statistical values with step-by-step animations
 * - Display matrix evaluation with icon indicators
 * 
 * Animation Timing:
 * - Statistics: 50ms stagger for 17 items = 850ms total
 * - Matrix: 500ms fadeInUp animation
 */
```

### Function 1: displayStatistics (Lines 265-310)
**Signature:** `function displayStatistics(stats, unit = '%')`
**Purpose:** Display all 17 statistical values with staggered animations
**Complexity:** MEDIUM (46 lines)
**Parameters:**
- stats: Object with {count, max, min, range, mean, median, stdDev, cv, q1, q3, iqr, skewness, kurtosis, sigma1, sigma2, sigma3}
- unit: string ('%' or 'g')
**Animations:**
- 50ms stagger between items
- Opacity fade from 0 to 1 (0.2s ease-out)
- Total display time: ~850ms

**Displays (17 items):**
1. statsCount: `${stats.count}個`
2. statsMax: formatted value
3. statsMin: formatted value
4. statsRange: formatted value
5. statsAvg: mean value
6. statsMedian: median value
7. statsStdDev: standard deviation
8. statsCV: coefficient of variation %
9. statsQ1: 1st quartile
10. statsQ3: 3rd quartile
11. statsIQR: interquartile range
12. statsSkewness: 3 decimal places
13. statsKurtosis: 3 decimal places
14. statsSigma1: range string `${lower} ～ ${upper}`
15. statsSigma2: range string
16. statsSigma3: range string

### Function 2: displayMatrixEvaluation (Lines 214-260)
**Signature:** `function displayMatrixEvaluation(stats)`
**Purpose:** Display matrix evaluation with animated updates
**Complexity:** MEDIUM (47 lines)
**Parameters:**
- stats: Object with {count (n), cv, ...}
**Animations:**
- Opacity & transform animation (0.3s ease-out)
- FadeInUp for message (0.5s ease-out)

**Icon Mapping:**
- 'excellent': '🌟'
- 'good': '✓'
- 'fair': '⚡'
- 'poor': '⚠️'

**CSS Classes:**
- `matrix-eval-message`
- `${evaluation.className}` (excellent|good|fair|poor)

### Imports for statistics.js
```javascript
import { logger } from './core/logger.js';
import { qs, toFixed, pct } from './dom-utils.js';
import { getMatrixEvaluation } from './yield-stats-helpers.js';
```

### Exports from statistics.js
```javascript
export {
  displayStatistics,
  displayMatrixEvaluation
}
```

---

## FILE 3: yield-stats-validation.js (362 lines)

### Module Header
```javascript
/**
 * 歩留まり統計: Sample Size Validation & Outlier Management
 * 
 * Responsibilities:
 * - Display sample size validation with progress bar
 * - Generate and display outlier information
 * - Handle outlier checkbox UI
 * 
 * Features:
 * - Progress bar with count-up animation
 * - Color-coded validity status
 * - Outlier checkbox list generation
 * - Confidence message display
 * - Sample size comparison
 */
```

### Function 1: displaySampleSizeValidation (Lines 322-553)
**Signature:** `function displaySampleSizeValidation()`
**Purpose:** Display sample size validation with interactive progress bar
**Complexity:** HIGH (231 lines)
**Calls:**
- displayOutlierInfo() [internal]
- appState methods (get/set operations)
- calculateStatistics() [external]
- detectOutliers() [external]
- calculateRequiredSampleSize() [external]
- getConfidenceMessage() [external]
- displayRecommendedValue() [from recommended.js]
- updateLoadStatsButtons() [from buttons.js]

**Animations:**
- Progress bar width (1s ease-out)
- Count-up percentage (50ms intervals)
- Badge scale animation (0.3s ease-out)
- Fade-in for numbers (0.3s ease-out)
- Fade-in for explanation (0.3s ease-out)

**UI Components Created:**
- Progress container with #sampleSizeProgressContainer
  - Progress bar #progressBar with gradient
  - Percentage label #progressPercentage
- Color coding based on validity:
  - Valid (green): #2ecc71, #27ae60
  - Warning (yellow): #f39c12, #e67e22
  - Invalid (red): #e74c3c, #c0392b

**State Management:**
- setSampleSizeValidation(type, {isValid, actualSize, requiredSize})
- setLastCalculatedStats(stats)

### Function 2: displayOutlierInfo (Lines 567-677)
**Signature:** `function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid)`
**Purpose:** Display outlier information and generate checkboxes
**Complexity:** MEDIUM (111 lines)
**Parameters:**
- outlierResult: {outliers: [], cleanedValues: [], lowerBound, upperBound}
- statsType: 'yieldRate' | 'beforeWeight' | 'afterWeight'
- isSampleSizeValid: boolean

**Calls:**
- highlightOutlierRows() [from outlier-management.js]
- appState state management methods

**Generates:**
- Outlier count display
- Normal range display (lower ～ upper)
- Checkbox list with labels
- Recommendation message based on:
  - Number of outliers
  - Manual exclusion count
  - Remaining data availability

**Checkbox HTML:**
```html
<div class="outlier-checkbox-item">
  <input type="checkbox" id="outlier-${index}" data-index="${index}" />
  <label for="outlier-${index}" class="outlier-checkbox-label">${value}</label>
</div>
```

**Event Handling:**
- Checkbox change → handleOutlierCheckboxChange()

### Imports for validation.js
```javascript
import { qs, qsa, toFixed, pct } from './dom-utils.js';
import { appState } from './state.js';
import { UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { calculateRequiredSampleSize, getConfidenceMessage } from './yield-stats-helpers.js';
import { highlightOutlierRows } from './outlier-management.js';
import { displayRecommendedValue } from './yield-stats-recommended.js';
import { updateLoadStatsButtons } from './yield-stats-buttons.js';
```

### Exports from validation.js
```javascript
export {
  displaySampleSizeValidation
}
```

---

## FILE 4: yield-stats-buttons.js (397 lines)

### Module Header
```javascript
/**
 * 歩留まり統計: Load Buttons & Value Management
 * 
 * Responsibilities:
 * - Update load button states based on statistics validity
 * - Generate value recommendation tables (mean/median/recommended)
 * - Generate sigma range patterns
 * - Manage button event handlers (touch + click support)
 * 
 * Features:
 * - Bulk import mode (2-column table)
 * - Individual value mode (3-column table with buttons)
 * - Mode-aware option rendering
 * - Cross-browser button handling
 */
```

### Function 1: getRecommendedValue (Lines 877-888)
**Signature:** `function getRecommendedValue(stats)`
**Purpose:** Pure logic - determine mean vs median based on skewness
**Complexity:** LOW (12 lines)
**Logic:**
```
if (|skewness| <= 0.5) → mean
else → median
```
**Returns:** `{ type: 'mean'|'median', value: number, label: string }`

### Function 2: generateSigmaPatterns (Lines 896-929)
**Signature:** `function generateSigmaPatterns(stats, sigmaRange = 2)`
**Purpose:** Generate sigma range patterns for display
**Complexity:** MEDIUM (34 lines)
**Parameters:**
- stats: {mean, stdDev}
- sigmaRange: number (default 2)
**Returns:** Array of patterns
```javascript
[
  {label: '平均-2σ', value: mean - 2*stdDev, sigma: -2},
  {label: '平均-1σ', value: mean - stdDev, sigma: -1},
  {label: '平均値', value: mean, sigma: 0},
  {label: '平均+1σ', value: mean + stdDev, sigma: 1},
  {label: '平均+2σ', value: mean + 2*stdDev, sigma: 2}
]
```

### Function 3: attachButtonHandler (Lines 1046-1066)
**Signature:** `function attachButtonHandler(button, handler)`
**Purpose:** Cross-browser button event attachment (touch + click)
**Complexity:** LOW (20 lines)
**Features:**
- Touch support with preventDefault
- Click support (prevents double-firing on touch devices)
- Passive event listeners for better performance

### Function 4: updateLoadStatsButtons (Lines 1072-1382)
**Signature:** `function updateLoadStatsButtons()`
**Purpose:** Update load button UI based on statistics and mode
**Complexity:** HIGH (311 lines)

**Modes:**
1. **Bulk Mode** (selectedStatsType === 'bulk')
   - 2-column table: Item | Recommended Value
   - Shows multiple stats (yieldRate, beforeWeight, afterWeight as available)
   - Single button: "推奨値を一括転記" (Import all recommended values)
   
2. **Individual Mode** (selectedStatsType === specific type)
   - 3-column table: Statistics | Value | Load Button
   - Rows: Mean, Median, Recommended
   - Each row has individual load button

**Data Checks:**
- Check sample size validity: appState.getSampleSizeValidation(type)
- Check data availability: appState.getCalculatedStats(type)
- Min sample size: 2 records
- Validity required for buttons to show

**Mode Filtering:**
- Direct method: shows yieldRate + beforeWeight only
- Weight method: shows beforeWeight + afterWeight only

**Window Globals Called:**
- window.loadAllStatsToMultiPattern() [bulk mode]
- window.loadStatsValueToMultiPattern(value, type, isRecommended) [individual]
- window.showTransferNotification(message) [feedback]
- window.focusFirstPatternInput() [UX]

**No Data Messages:**
- If data insufficient: "歩留まり統計のデータがありません"
- If sample size invalid: Shows actual vs required comparison

### Imports for buttons.js
```javascript
import { qs, qsa, toFixed } from './dom-utils.js';
import { appState } from './state.js';
import { logger } from './core/logger.js';
```

### Exports from buttons.js
```javascript
export {
  updateLoadStatsButtons,
  generateSigmaPatterns
}
```

---

## FILE 5: yield-stats-recommended.js (113 lines)

### Module Header
```javascript
/**
 * 歩留まり統計: Recommended Value Display
 * 
 * Responsibilities:
 * - Display recommended representative value with reasoning
 * - Show confidence reasoning (normal vs skewed distribution)
 * - Manage multi-pattern analysis link visibility
 * 
 * Features:
 * - Scale animation for badge
 * - Fade-in for explanation text
 * - Smart visibility based on stats validity
 * - Mode-aware display (hide for non-yield-rate)
 */
```

### Function 1: displayRecommendedValue (Lines 937-1040)
**Signature:** `function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate')`
**Purpose:** Display recommended representative value with detailed reasoning
**Complexity:** MEDIUM (103 lines)
**Parameters:**
- stats: {skewness, mean, median, ...}
- isSampleSizeValid: boolean
- statsType: 'yieldRate' | 'beforeWeight' | 'afterWeight'

**Hidden if:** isSampleSizeValid === false
- Element #recommendedValue gets 'is-hidden' class

**Logic:**
```javascript
absSkewness = |stats.skewness|

if (absSkewness <= 0.5) {
  recommendedType = '平均値'
  reason = "正規分布に近く、外れ値の影響が少ない..."
} else {
  recommendedType = '中央値'
  direction = skewness > 0 ? '右に歪んでおり' : '左に歪んでおり'
  reason = "分布が${direction}...より頑健な中央値を推奨"
}
```

**Animations:**
1. Badge scale: 0.5 → 1 (400ms cubic-bezier spring)
2. Reason text: opacity 0 → 1 (500ms ease-out, 300ms delay)
3. Container slide-in: translateY(20px) → 0 (500ms ease-out, 50ms delay)

**Multi-Pattern Link Visibility:**
- Element: #multiPatternLink
- Visible if:
  - statsType === 'yieldRate'
  - isSampleSizeValid === true
  - yieldRateStats exists and count >= 2
  - hasYieldStatsDataByType('yieldRate') === true
- Animation: fade-in (300ms ease-out, 500ms delay)

### Imports for recommended.js
```javascript
import { qs, toFixed, pct } from './dom-utils.js';
import { appState } from './state.js';
```

### Exports from recommended.js
```javascript
export {
  displayRecommendedValue
}
```

---

## SUMMARY: LINE DISTRIBUTION

```
Original file: 1,392 lines
├─ Header/imports: 50 lines (shared)
├─ displayCurrentStatistics: 157 lines → CORE.JS
├─ displayMatrixEvaluation: 47 lines → STATISTICS.JS
├─ displayStatistics: 46 lines → STATISTICS.JS
├─ displaySampleSizeValidation: 231 lines → VALIDATION.JS
├─ displayOutlierInfo: 111 lines → VALIDATION.JS
├─ handleOutlierCheckboxChange: 15 lines → CORE.JS
├─ deleteOutlierRows: 80 lines → CORE.JS
├─ setupFormulaModal: 86 lines → CORE.JS
├─ getRecommendedValue: 12 lines → BUTTONS.JS
├─ generateSigmaPatterns: 34 lines → BUTTONS.JS
├─ displayRecommendedValue: 103 lines → RECOMMENDED.JS
├─ attachButtonHandler: 20 lines → BUTTONS.JS
└─ updateLoadStatsButtons: 311 lines → BUTTONS.JS

New files:
├─ yield-stats-core.js: ~368 lines
├─ yield-stats-statistics.js: ~113 lines
├─ yield-stats-validation.js: ~362 lines
├─ yield-stats-buttons.js: ~397 lines
└─ yield-stats-recommended.js: ~113 lines
```

---

## NOTES FOR IMPLEMENTATION

1. **Animation Timing Contract**
   - Statistics: 50ms stagger (total ~850ms)
   - Matrix: 500ms
   - Validation: 100-500ms cascade
   - Recommended: 50-400ms cascade
   - **Total max:** ~750ms initial display

2. **State Management Order**
   - ALWAYS read appState first
   - Perform calculations
   - THEN write back to appState
   - This prevents race conditions

3. **Required HTML Elements** (verify existence before display)
   - #statsTypeSelect
   - #yieldStatsResults
   - #sampleSizeResult
   - #outlierInfo
   - #recommendedValue
   - #formulaModal
   - #matrixEvalSampleSize, #matrixEvalCV, #matrixEvalMessage
   - Plus 15+ more in validation/buttons modules

4. **XSS Protection**
   - setupFormulaModal uses escapeHTML() on dataset values
   - No innerHTML without sanitization
   - Consider htmlWithRaw if raw HTML needed

5. **Error Handling**
   - Add try-catch around DOM selectors
   - Log errors with logger
   - Gracefully handle missing stats
   - Validate appState data before use

