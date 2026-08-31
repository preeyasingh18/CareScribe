/**
 * The CareScribe mark rendered as ONE indivisible element.
 *
 * This exists specifically so the logo cannot be taken apart. `public/logo.svg`
 * is the canonical artwork; loading it through <img> means there are no inner
 * paths in the React tree for anything to translate, scale, skew or cross-fade.
 * Whatever animates the logo can only ever animate this whole box.
 *
 * The intro sequence and the landing navbar both render this, at different
 * sizes, which is what makes the hand-off between them look like one object
 * moving rather than one logo turning into another.
 *
 * `LogoMark` (inline SVG, src/components/Logo.tsx) still exists for dark
 * surfaces — the sidebar and the auth panel — where the artwork has to be
 * recoloured and an <img> cannot be. Its geometry is identical to logo.svg.
 */

/**
 * The approved mark: the purple C and the microphone. One file, used by the
 * intro animation, the landing navbar, the footer and the loading screen, so
 * every one of them is the same drawing rather than a redraw of it.
 *
 * `public/logo.svg` still holds the older, more detailed lockup (note, cross,
 * stethoscope) for anything that wants it — nothing in the app points at it.
 */
export const BRAND_LOGO_SRC = '/logo-mark.svg';

/**
 * The mark's two pieces, for the entrance animation, as separate files holding
 * the SAME paths and the SAME viewBox as the whole mark.
 *
 * They are split by ELEMENT, not by geometry. An earlier version sliced one
 * image with a vertical clip-path, which cut the "C" ring into a left arc plus
 * two orphaned top/bottom-right fragments — so neither side held a whole C and
 * a stray arc rode along on the right with the microphone. Overlaying these two
 * files instead reproduces the mark exactly, with nothing clipped.
 */
export const LOGO_PART_C_SRC = '/logo-part-c.svg';
export const LOGO_PART_MIC_SRC = '/logo-part-mic.svg';

export default function BrandLogo({
  size,
  className = '',
  priority = false,
}: {
  size: number;
  className?: string;
  /** Set on the first logo painted so the browser does not lazy-defer it. */
  priority?: boolean;
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="CareScribe"
      width={size}
      height={size}
      // width === height and the artwork is a square viewBox, so any scale()
      // applied to an ancestor stays uniform — the mark can never stretch.
      // A caller may pass h-full/w-full to fill a responsive box instead; the
      // aspect ratio is still locked by the square viewBox either way.
      style={className.includes('h-full') ? undefined : { width: size, height: size }}
      className={`block select-none ${className}`}
      draggable={false}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
    />
  );
}
