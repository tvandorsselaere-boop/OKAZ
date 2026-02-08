"use client";

import { SmartAdSlot } from "./AdSlot";

interface AdSidebarProps {
  keywords?: string[];
  phase?: "loading" | "results";
}

export function AdSidebar({ keywords = [], phase = "loading" }: AdSidebarProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Pub 1 - Rectangle Medium (300x250) - Media.net CPC */}
      <SmartAdSlot
        network="medianet"
        size="rectangle"
        keywords={keywords}
        label="Offre partenaire"
        sublabel={phase === "loading" ? "Publicité contextuelle" : undefined}
        className="rounded-2xl overflow-hidden"
      />

      {/* Pub 2 - Rectangle Medium (300x250) - AdSense CPM backup */}
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
