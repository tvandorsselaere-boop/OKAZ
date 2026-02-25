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

// Logo Amazon SVG simplifié
function AmazonLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705a.66.66 0 01-.753.074c-1.057-.878-1.247-1.287-1.826-2.124-1.746 1.781-2.983 2.314-5.244 2.314-2.678 0-4.762-1.653-4.762-4.96 0-2.582 1.399-4.339 3.393-5.2 1.727-.756 4.14-.891 5.983-1.1v-.41c0-.753.058-1.643-.384-2.293-.384-.579-1.117-.818-1.764-.818-1.199 0-2.266.615-2.527 1.89a.538.538 0 01-.461.467l-2.585-.278a.454.454 0 01-.382-.537C6.827 1.903 9.723.75 12.328.75c1.33 0 3.068.354 4.115 1.362 1.33 1.242 1.203 2.9 1.203 4.705v4.264c0 1.282.532 1.844 1.032 2.536.176.247.215.544-.009.728-.559.467-1.554 1.334-2.1 1.82l-.425-.365z" fill="#FF9900"/>
      <path d="M21.535 18.504C19.297 20.195 15.962 21.1 13.078 21.1c-4.074 0-7.742-1.506-10.515-4.013-.218-.197-.023-.466.239-.313 2.994 1.742 6.698 2.789 10.523 2.789 2.58 0 5.417-.535 8.029-1.642.394-.17.724.259.181.583z" fill="#FF9900"/>
      <path d="M22.394 17.492c-.297-.381-1.972-.181-2.723-.091-.228.028-.264-.171-.058-.315 1.334-.937 3.523-.667 3.779-.353.257.316-.067 2.509-1.319 3.556-.192.161-.376.075-.29-.138.282-.704.914-2.277.611-2.659z" fill="#FF9900"/>
    </svg>
  );
}

// Logo eBay SVG simplifié (4 lettres colorées)
function EbayLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="19" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20">
        <tspan fill="#E53238">e</tspan>
        <tspan fill="#0064D2">b</tspan>
        <tspan fill="#F5AF02">a</tspan>
        <tspan fill="#86B817">y</tspan>
      </text>
    </svg>
  );
}

// Bannière affiliée contextuelle (remplace le placeholder quand des keywords sont dispo)
export function AffiliateBanner({
  site,
  keywords,
  className = ""
}: {
  site: "amazon" | "ebay";
  keywords: string;
  className?: string;
}) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_TAG || "";
  const epnCampid = process.env.NEXT_PUBLIC_EPN_CAMPID || "";
  const encodedKw = encodeURIComponent(keywords);

  // eBay EPN link with tracking params (same format as wrapEbayEPN in affiliate.ts)
  const ebayBaseUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodedKw}`;
  const ebayHref = epnCampid
    ? `${ebayBaseUrl}&mkevt=1&mkcid=1&mkrid=709-53476-19255-0&campid=${epnCampid}&toolid=10001`
    : ebayBaseUrl;

  const config = site === "amazon"
    ? {
        label: "Voir aussi sur Amazon",
        sublabel: "Comparer les prix neufs",
        color: "#FF9900",
        bgColor: "rgba(255, 153, 0, 0.06)",
        borderColor: "rgba(255, 153, 0, 0.15)",
        href: `https://www.amazon.fr/s?k=${encodedKw}${tag ? `&tag=${tag}` : ""}`,
      }
    : {
        label: "Voir aussi sur eBay",
        sublabel: "Enchères et occasions",
        color: "#E53238",
        bgColor: "rgba(229, 50, 56, 0.06)",
        borderColor: "rgba(229, 50, 56, 0.15)",
        href: ebayHref,
      };

  return (
    <a
      href={config.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer ${className}`}
      style={{
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        {site === "amazon" ? <AmazonLogo size={28} /> : <EbayLogo size={36} />}
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {config.label}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-tertiary)", marginLeft: "auto" }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {config.sublabel}
      </p>
      <p className="text-xs mt-2 font-medium truncate" style={{ color: config.color }}>
        &quot;{keywords}&quot;
      </p>
    </a>
  );
}

// Placeholder pour le développement (sans régies configurées)
export function AdPlaceholder({
  size,
  label = "Espace partenaire",
  sublabel,
  keywords,
  className = ""
}: {
  size: AdSize;
  label?: string;
  sublabel?: string;
  keywords?: string;
  className?: string;
}) {
  const dimensions = AD_SIZES[size];

  // Si des keywords sont dispo, afficher des bannières affiliées au lieu du placeholder générique
  if (keywords) {
    return (
      <div className={`flex flex-col gap-3 ${className}`} style={{ maxWidth: "100%" }}>
        <AffiliateBanner site="amazon" keywords={keywords} />
        <AffiliateBanner site="ebay" keywords={keywords} />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-2xl ${className}`}
      style={{
        minHeight: dimensions.height,
        maxWidth: "100%",
        background: "var(--bg-secondary)",
        border: "1px solid var(--separator)",
      }}
    >
      <div className="text-center p-4">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>{label}</p>
        {sublabel && <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>{sublabel}</p>}
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

  const keywordsStr = keywords.length > 0 ? keywords.join(" ") : undefined;

  if (!isConfigured) {
    return <AdPlaceholder size={size} label={label} sublabel={sublabel} keywords={keywordsStr} className={className} />;
  }

  return (
    <AdSlot
      network={network}
      size={size}
      keywords={keywords}
      className={className}
      fallback={<AdPlaceholder size={size} label={label} sublabel={sublabel} keywords={keywordsStr} className={className} />}
    />
  );
}

// eBay Smart Placement — widget dynamique EPN
// Nécessite NEXT_PUBLIC_EPN_PLACEMENT_ID (data-config-id du dashboard EPN)
// Fallback: si le widget ne rend rien après 3s, affiche AffiliateBanner
export function EbaySmartPlacement({
  keywords,
  className = "",
}: {
  keywords: string;
  className?: string;
}) {
  const placementId = process.env.NEXT_PUBLIC_EPN_PLACEMENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!placementId || !containerRef.current) return;

    setShowFallback(false);

    // Nettoyer le contenu précédent (changement de keywords)
    containerRef.current.innerHTML = "";

    // Créer l'élément <ins> attendu par epn-smart-tools.js
    const ins = document.createElement("ins");
    ins.className = "epn-placement";
    ins.setAttribute("data-config-id", placementId);
    if (keywords) {
      ins.setAttribute("data-keyword", keywords);
    }
    ins.setAttribute("data-marketplace-id", "EBAY_FR");
    containerRef.current.appendChild(ins);

    // Re-déclencher le scan du script EPN pour les nouveaux éléments
    if (typeof window !== "undefined" && (window as EPNWindow)._epn_process) {
      (window as EPNWindow)._epn_process!();
    }

    // Fallback: si le widget EPN ne rend rien après 3s, afficher la bannière affiliée
    const timeout = setTimeout(() => {
      if (containerRef.current) {
        const rendered = containerRef.current.querySelector("iframe, .epn-widget, [data-epn]");
        if (!rendered) {
          setShowFallback(true);
        }
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [placementId, keywords]);

  // Pas de config-id ou widget EPN n'a rien rendu → fallback bannière affiliée
  if (!placementId || showFallback) {
    return <AffiliateBanner site="ebay" keywords={keywords} className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={`ebay-smart-placement rounded-2xl overflow-hidden ${className}`}
      style={{ minHeight: 250, width: "100%" }}
    />
  );
}

// Déclarations TypeScript pour les objets globaux des régies
interface EPNWindow extends Window {
  _epn_process?: () => void;
}

declare global {
  interface Window {
    _mNHandle?: unknown;
    adsbygoogle?: unknown[];
  }
}
