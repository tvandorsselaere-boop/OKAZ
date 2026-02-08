"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { buildAmazonSearchLink } from "@/lib/affiliate";

interface NewProductBannerProps {
  productName: string;
  estimatedPrice?: number;
  reason: string;
  searchQuery: string;
}

export function NewProductBanner({ productName, estimatedPrice, reason, searchQuery }: NewProductBannerProps) {
  const amazonLink = buildAmazonSearchLink(searchQuery);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-300">
            Et en neuf ?
          </p>
          <p className="text-white font-medium mt-1">
            {productName}
            {estimatedPrice && (
              <span className="ml-2 text-indigo-400">~{estimatedPrice} €</span>
            )}
          </p>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            {reason}
          </p>
        </div>
        <a
          href={amazonLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF9900]/15 border border-[#FF9900]/30 text-[#FF9900] text-xs font-medium hover:bg-[#FF9900]/25 transition-colors"
        >
          Voir sur Amazon
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}
