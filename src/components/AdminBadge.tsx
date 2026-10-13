import { Crown } from "lucide-react";

/**
 * Admin marker — a restrained "verified" emblem rather than a game badge.
 *
 * Deliberately desaturated: an antique-gold hairline over a dark warm glass
 * fill, with a lifted inset highlight and a very soft ambient bloom. No
 * animation — a status indicator that moves pulls the eye away from the
 * avatar and the voice waveform, which are the things that actually matter
 * here.
 *
 * Two forms:
 *   - disc      — the emblem alone, for tight spots (strip, chat, drawer)
 *   - lockup    — emblem + spaced-out ADMIN, for the spotlight card where
 *                 there is room to state the role in words
 */
export default function AdminBadge({
  size = 16,
  ring = false,
  withLabel = false,
  className = "",
}: {
  /** Disc diameter in px. */
  size?: number;
  /** Dark hairline separator — use when the disc overlaps a busy edge. */
  ring?: boolean;
  /** Renders the spaced-out ADMIN wordmark beside the disc. */
  withLabel?: boolean;
  className?: string;
}) {
  const crown = Math.max(7, Math.round(size * 0.52));

  if (!withLabel) {
    return (
      <span
        title="Admin"
        aria-label="Admin"
        className={`admin-badge ${ring ? "ring-1 ring-[#0a0a0e]" : ""} ${className}`}
        style={{ width: size, height: size }}
      >
        <Crown size={crown} strokeWidth={2.2} className="admin-badge-crown" />
      </span>
    );
  }

  // The label stays in flow. An absolutely-placed wordmark escapes the grid
  // column, which then sizes to the disc alone - and on a right-aligned badge
  // that pushes the label past the card's padding and `overflow-hidden` clips
  // it. In flow, the column reserves the real width and the name truncates.
  return (
    <span
      title="Admin"
      aria-label="Admin"
      className={`inline-flex shrink-0 items-center gap-[5px] ${className}`}
    >
      <span className="admin-badge" style={{ width: size, height: size }}>
        <Crown size={crown} strokeWidth={2.2} className="admin-badge-crown" />
      </span>
      <span className="admin-badge-label">Admin</span>
    </span>
  );
}