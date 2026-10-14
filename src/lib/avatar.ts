/**
 * Avatars are memoji images shipped locally in `public/memoji pack/`.
 * Stored as a short `memoji:<index>` string so they travel over the socket
 * and through Supabase unchanged.
 *
 * The roster order is fixed — append new files at the end, never reorder or
 * remove, so saved indices keep pointing at the same face.
 */
const MEMOJI_DIR = "memoji pack";

const MEMOJI_FILES = [
  "1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png",
  "9.png", "10.png", "11.png", "12.png", "13.png", "14.png", "15.png",
];

const MEMOJI_PREFIX = "memoji:";

export function isMemoji(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.startsWith(MEMOJI_PREFIX)) return false;
  const i = Number(value.slice(MEMOJI_PREFIX.length));
  return Number.isInteger(i) && i >= 0 && i < MEMOJI_FILES.length;
}

export function memojiValue(index: number): string {
  return `${MEMOJI_PREFIX}${index}`;
}

function memojiIndex(value: string): number {
  const i = Number(value.slice(MEMOJI_PREFIX.length));
  if (!Number.isInteger(i) || i < 0 || i >= MEMOJI_FILES.length) return 0;
  return i;
}

/** Public URL for a stored memoji value (respects the app base path). */
export function memojiSrc(value: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return base + [MEMOJI_DIR, MEMOJI_FILES[memojiIndex(value)]].map(encodeURIComponent).join("/");
}

/** Fixed picker roster. */
export const MEMOJI_OPTIONS: string[] = MEMOJI_FILES.map((_, i) => memojiValue(i));

export const DEFAULT_MEMOJI = MEMOJI_OPTIONS[0];

/**
 * Retire the emoji set: anything that isn't a valid memoji reference
 * (legacy emoji, empty, invalid) becomes the default memoji.
 */
export function coerceAvatar(saved: string | null | undefined): string {
  return isMemoji(saved) ? (saved as string) : DEFAULT_MEMOJI;
}
