"use client";

import { motion } from "framer-motion";
import { ExternalLink, Lightbulb } from "lucide-react";
import { buildAmazonSearchLink, wrapAffiliateLink } from "@/lib/affiliate";

interface NewProductBannerProps {
  productName: string;
  estimatedPrice?: number;
  reason: string;
  searchQuery: string;
  amazonUrl?: string;
  isRealPrice?: boolean;
}

export function NewProductBanner({ productName, estimatedPrice, reason, searchQuery, amazonUrl, isRealPrice }: NewProductBannerProps) {
  // Si on a un lien direct Amazon (scrapé), l'utiliser wrappé affilié. Sinon, lien de recherche.
  const amazonLink = amazonUrl ? wrapAffiliateLink(amazonUrl) : buildAmazonSearchLink(searchQuery);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="mt-6 p-4 rounded-[20px] bg-[var(--card-bg)] border border-[var(--accent)]/15 shadow-[var(--card-shadow)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary,#8B5CF6)] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm shadow-[var(--accent)]/20">
          <Lightbulb className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--accent)]">
            Et en neuf ?
          </p>
          <p className="text-[var(--text-primary)] font-medium mt-1">
            {productName}
            {estimatedPrice && (
              <span className="ml-2 text-[var(--accent)]">
                {isRealPrice ? '' : '~'}{estimatedPrice} €
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            {reason}
          </p>
        </div>
        <a
          href={amazonLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF9900] text-white text-xs font-medium hover:bg-[#E68A00] hover:scale-105 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        >
          Voir sur Amazon
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}
