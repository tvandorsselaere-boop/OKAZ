"use client";

import { SmartAdSlot, AffiliateBanner, EbaySmartPlacement } from "./AdSlot";

interface AdSidebarProps {
  keywords?: string[];
  phase?: "loading" | "results";
}

// Vérifie si au moins une régie pub est configurée
const hasAdNetwork =
  !!(process.env.NEXT_PUBLIC_MEDIANET_CID && process.env.NEXT_PUBLIC_MEDIANET_CRID) ||
  !!(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

export function AdSidebar({ keywords = [], phase = "loading" }: AdSidebarProps) {
  const keywordsStr = keywords.length > 0 ? keywords.join(" ") : "";

  // Si pas de régie configurée → Amazon affiliate + eBay Smart Placement
  if (!hasAdNetwork && keywordsStr) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <AffiliateBanner site="amazon" keywords={keywordsStr} />
        <EbaySmartPlacement keywords={keywordsStr} />
      </div>
    );
  }

  // Sinon, les vraies pubs avec fallback
  return (
    <div className="flex flex-col gap-4 w-full">
      <SmartAdSlot
        network="medianet"
        size="rectangle"
        keywords={keywords}
        label="Offre partenaire"
        sublabel={phase === "loading" ? "Publicité contextuelle" : undefined}
        className="rounded-2xl overflow-hidden"
      />
      <SmartAdSlot
        network="adsense"
        size="rectangle"
        keywords={keywords}
        label="Offre du moment"
        sublabel={phase === "loading" ? "Suggestion" : undefined}
        className="rounded-2xl overflow-hidden"
      />
    </div>
  );
}

// Version sticky pour la page résultats
export function AdSidebarSticky({ keywords = [] }: { keywords?: string[] }) {
  return (
    <div className="sticky top-4">
      <AdSidebar keywords={keywords} phase="results" />
    </div>
  );
}
