import { DEFAULT_MEMOJI, isMemoji, memojiSrc } from "../lib/avatar";

interface AvatarProps {
  /** Stored avatar value (`memoji:<index>`), a single-letter initial, or legacy text. */
  value?: string | null;
  /** Class names for the letter-initial form. The image form fills its parent. */
  className?: string;
  /** Accessible label. Leave empty for decorative avatars next to a name. */
  alt?: string;
}

/**
 * Renders a person's avatar. Memoji faces fill their parent, so the parent
 * must be sized and `overflow-hidden` (rounded) for the circle/square crop.
 * The emoji set is retired: legacy emoji values fall back to the default
 * memoji instead of rendering as text; only a single-letter initial (used
 * when a person has no avatar yet) still renders as text.
 */
export default function Avatar({ value, className = "", alt = "" }: AvatarProps) {
  const raw = (value ?? "").toString();

  const src = isMemoji(raw) ? memojiSrc(raw) : /^[A-Za-z]$/.test(raw) ? null : memojiSrc(DEFAULT_MEMOJI);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        draggable={false}
        className="h-full w-full select-none object-cover"
      />
    );
  }

  return <span className={className}>{raw}</span>;
}
