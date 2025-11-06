/**
 * 複数パターン分析モードのUI制御
 * Backward compatibility wrapper - re-exports from modular components
 *
 * This file maintains backward compatibility by re-exporting all public functions
 * from the modular components in the multi-pattern-ui/ directory.
 */

// Re-export all public functions from the core module
export {
  initMultiPatternUI,
  resetMultiPatternUI,
  setFromYieldStats,
  setStatValue,
  replaceAllPatterns
} from './multi-pattern-ui/core.js';
