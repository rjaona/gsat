/**
 * EssentialBadge — badge "Essentiel" réutilisable.
 * Design Stitch : bg-secondary-container text-on-secondary-container, rounded-full, xs.
 */
export function EssentialBadge({ essential = true }: { essential?: boolean }) {
  if (!essential) {
    return (
      <span className="px-2 py-0.5 bg-[#eaeef7] text-[#454651] text-[10px] font-bold rounded-full uppercase tracking-tighter">
        Complémentaire
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 bg-[#b9eeab] text-[#3f6d38] text-[10px] font-bold rounded-full uppercase tracking-tighter">
      Essentiel
    </span>
  )
}
