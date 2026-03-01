export const INTENSITY_MAP: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 6,
  4: 10,
};

export const DEFAULT_TARGET_FILE = "README.md";

export const DEFAULT_CONTENT_TEMPLATE = `<!-- Contribution update: {{date}} {{time}} -->\n`;

export const BRANCH_PREFIX = "backfill";

export const JOB_CLEANUP_AFTER_MS = 60 * 60 * 1000; // 1 hour
