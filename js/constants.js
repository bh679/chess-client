/**
 * Shared constants used across multiple modules.
 */

// Analysis classification icons — used by AnalysisController (main-board) and ReplayViewer (overlay)
const CLASSIFICATION_ICONS = {
  brilliant:  { text: '!!',    cls: 'analysis-brilliant' },
  great:      { text: '!',     cls: 'analysis-great' },
  best:       { text: '\u2713', cls: 'analysis-best' },
  excellent:  { text: '\u25CF', cls: 'analysis-excellent' },
  good:       { text: '\u25CF', cls: 'analysis-good' },
  book:       { text: '\u2261', cls: 'analysis-book' },
  inaccuracy: { text: '?!',    cls: 'analysis-inaccuracy' },
  mistake:    { text: '?',     cls: 'analysis-mistake' },
  miss:       { text: '\u00D7', cls: 'analysis-miss' },
  blunder:    { text: '??',    cls: 'analysis-blunder' },
};

const ANALYSIS_CACHE_KEY = 'chess-analysis-cache';

export { CLASSIFICATION_ICONS, ANALYSIS_CACHE_KEY };
