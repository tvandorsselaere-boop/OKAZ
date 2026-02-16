"use client";

import { motion } from "framer-motion";
import { ExternalLink, Package, Sparkles } from "lucide-react";
import { buildAmazonSearchLink, wrapAffiliateLink } from "@/lib/affiliate";

interface NewProductBannerProps {
  productName: string;
  estimatedPrice?: number;
  reason: string;
  searchQuery: string;
  amazonUrl?: string;
  isRealPrice?: boolean;
  imageUrl?: string;
}

export function NewProductBanner({ productName, estimatedPrice, reason, searchQuery, amazonUrl, isRealPrice, imageUrl }: NewProductBannerProps) {
  const amazonLink = amazonUrl ? wrapAffiliateLink(amazonUrl) : buildAmazonSearchLink(searchQuery);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="mt-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-[#FF9900]/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#FF9900]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Et en neuf ?</h3>
      </div>

      {/* Carte produit — même format que les résultats occasion */}
      <a
        href={amazonLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 rounded-[20px] bg-[var(--card-bg)] border border-[#FF9900]/20 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group"
      >
        <div className="flex gap-4">
          {/* Image */}
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = parent.querySelector('.fallback-icon');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div className={`fallback-icon w-full h-full items-center justify-center absolute inset-0 ${imageUrl ? 'hidden' : 'flex'}`}>
              <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 group-hover:text-[#FF9900] transition-colors">
                {productName}
              </h4>
              <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[#FF9900] flex-shrink-0 mt-0.5 transition-colors" />
            </div>

            {/* Prix + badge */}
            <div className="flex items-center gap-2 mt-2">
              {estimatedPrice && (
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {isRealPrice ? '' : '~'}{estimatedPrice.toLocaleString('fr-FR')} €
                </span>
              )}
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FF9900]/10 text-[#FF9900] rounded-full uppercase tracking-wide">
                Neuf
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full">
                Amazon
              </span>
            </div>

            {/* Raison */}
            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 line-clamp-1">
              {reason}
            </p>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
