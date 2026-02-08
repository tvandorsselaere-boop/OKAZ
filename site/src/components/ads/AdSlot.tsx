"use client";

import { useEffect, useRef, useState } from "react";

type AdNetwork = "medianet" | "adsense";
type AdSize = "banner" | "rectangle" | "leaderboard" | "skyscraper";

interface AdSlotProps {
  network: AdNetwork;
  size: AdSize;
  keywords?: string[];
  className?: string;
  fallback?: React.ReactNode;
}

// Dimensions standard IAB
const AD_SIZES: Record<AdSize, { width: number; height: number }> = {
  banner: { width: 468, height: 60 },
  rectangle: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
  skyscraper: { width: 160, height: 600 },
};

// IDs à configurer dans .env.local
// NEXT_PUBLIC_MEDIANET_CID - Media.net Customer ID
// NEXT_PUBLIC_MEDIANET_CRID - Media.net CRID
// NEXT_PUBLIC_ADSENSE_CLIENT - AdSense Publisher ID (ca-pub-XXXX)
// NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE - AdSense Slot ID pour rectangle
// NEXT_PUBLIC_ADSENSE_SLOT_BANNER - AdSense Slot ID pour banner

export function AdSlot({ network, size, keywords = [], className = "", fallback }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const dimensions = AD_SIZES[size];

  useEffect(() => {
    if (!containerRef.current) return;

    const loadAd = async () => {
      try {
        if (network === "medianet") {
          await loadMediaNetAd();
        } else if (network === "adsense") {
          await loadAdSenseAd();
        }
        setAdLoaded(true);
      } catch (err) {
        console.error(`[AdSlot] Error loading ${network} ad:`, err);
        setAdError(true);
      }
    };

    loadAd();
  }, [network, size, keywords]);

  const loadMediaNetAd = async () => {
    const cid = process.env.NEXT_PUBLIC_MEDIANET_CID;
    const crid = process.env.NEXT_PUBLIC_MEDIANET_CRID;

    if (!cid || !crid) {
      console.warn("[AdSlot] Media.net IDs not configured");
      throw new Error("Media.net not configured");
    }

    // Media.net contextual ads
    // Documentation: https://www.media.net/
    const container = containerRef.current;
    if (!container) return;

    // Créer le div Media.net
    const adDiv = document.createElement("div");
    adDiv.id = `_mN_${Date.now()}`;
    adDiv.setAttribute("data-cid", cid);
    adDiv.setAttribute("data-crid", crid);
    adDiv.setAttribute("data-keywords", keywords.join(","));
    container.appendChild(adDiv);

    // Charger le script Media.net si pas déjà chargé
    if (!window._mNHandle) {
      const script = document.createElement("script");
      script.src = `https://contextual.media.net/dmedianet.js?cid=${cid}`;
      script.async = true;
      document.head.appendChild(script);
    }
  };

  const loadAdSenseAd = async () => {
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    const slot = size === "rectangle"
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE
      : process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;

    if (!client || !slot) {
      console.warn("[AdSlot] AdSense IDs not configured");
      throw new Error("AdSense not configured");
    }

    const container = containerRef.current;
    if (!container) return;

    // Créer l'ins AdSense
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "inline-block";
    ins.style.width = `${dimensions.width}px`;
    ins.style.height = `${dimensions.height}px`;
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slot);
    container.appendChild(ins);

    // Push pour afficher
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("[AdSlot] AdSense push error:", e);
    }
  };

  // Si erreur et fallback fourni, afficher le fallback
  if (adError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div
      ref={containerRef}
      className={`ad-slot flex items-center justify-center ${className}`}
      style={{
        minWidth: dimensions.width,
        minHeight: dimensions.height,
        maxWidth: "100%",
      }}
      data-network={network}
      data-size={size}
      data-keywords={keywords.join(",")}
    >
      {!adLoaded && !adError && (
        <div className="text-center text-white/20 text-xs">
          <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-white/5 flex items-center justify-center">
            <span className="text-lg">📢</span>
          </div>
          <span className="uppercase tracking-wide">Chargement...</span>
        </div>
      )}
    </div>
  );
}

// Placeholder pour le développement (sans régies configurées)
export function AdPlaceholder({
  size,
  label = "Espace partenaire",
  sublabel,
  className = ""
}: {
  size: AdSize;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const dimensions = AD_SIZES[size];

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 ${className}`}
      style={{
        minHeight: dimensions.height,
        maxWidth: "100%",
      }}
    >
      <div className="text-center p-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
          <span className="text-2xl">📢</span>
        </div>
        <p className="text-xs text-white/30 uppercase tracking-wide">{label}</p>
        {sublabel && <p className="text-[10px] text-white/20 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

// Composant intelligent qui utilise la vraie pub ou le placeholder
export function SmartAdSlot({
  network,
  size,
  keywords = [],
  label = "Espace partenaire",
  sublabel,
  className = "",
}: AdSlotProps & { label?: string; sublabel?: string }) {
  const isConfigured = network === "medianet"
    ? !!(process.env.NEXT_PUBLIC_MEDIANET_CID && process.env.NEXT_PUBLIC_MEDIANET_CRID)
    : !!(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

  if (!isConfigured) {
    return <AdPlaceholder size={size} label={label} sublabel={sublabel} className={className} />;
  }

  return (
    <AdSlot
      network={network}
      size={size}
      keywords={keywords}
      className={className}
      fallback={<AdPlaceholder size={size} label={label} sublabel={sublabel} className={className} />}
    />
  );
}

// Déclarations TypeScript pour les objets globaux des régies
declare global {
  interface Window {
    _mNHandle?: unknown;
    adsbygoogle?: unknown[];
  }
}
