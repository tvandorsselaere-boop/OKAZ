"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Star, Crown, Check } from "lucide-react";

interface QuotaStatus {
  isPremium: boolean;
  planType: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  boostCredits: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  totalRemaining: number;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: QuotaStatus;
  onBuyBoost: () => void;
  onBuyPlan: (planType: 'pro' | 'premium') => void;
  isLoading?: boolean;
}

export function UpgradeModal({
  isOpen,
  onClose,
  quota,
  onBuyBoost,
  onBuyPlan,
  isLoading = false,
}: UpgradeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-lg"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--card-bg)] backdrop-blur-2xl rounded-3xl shadow-2xl border border-[var(--separator)] p-8 relative"
          >
            {/* Bouton fermer */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary,#8B5CF6)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/20">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Quota epuise
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Choisis l&apos;option qui te convient pour continuer.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Pack Boost */}
              <button
                onClick={onBuyBoost}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)] hover:border-[var(--accent)]/30 hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-left group disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        +10 recherches
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)]">Achat unique, pour finir ta session</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-[var(--text-primary)]">0,99&euro;</span>
                </div>
              </button>

              {/* Pro */}
              <button
                onClick={() => onBuyPlan('pro')}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)] hover:border-[var(--accent)]/30 hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-left group disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        Pro
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)]">100 recherches/mois, recharge auto</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[var(--text-primary)]">19,99&euro;</span>
                    <span className="text-xs text-[var(--text-tertiary)] block">/an</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--separator)] flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    "100 recherches/mois",
                    "Pas de limite quotidienne",
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
                      <Check className="w-3 h-3" />
                      {feature}
                    </div>
                  ))}
                </div>
              </button>

              {/* Premium */}
              <button
                onClick={() => onBuyPlan('premium')}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-[var(--accent)]/30 hover:border-[var(--accent)]/50 hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-left group disabled:opacity-50 relative overflow-hidden"
              >
                {/* Badge recommandé — gradient avec pulse */}
                <div className="absolute top-0 right-0 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary,#8B5CF6)] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg animate-pulse">
                  RECOMMANDE
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)]/15 to-[var(--accent-secondary,#8B5CF6)]/15 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        Premium
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)]">500 recherches/mois, recharge auto</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[var(--text-primary)]">49,99&euro;</span>
                    <span className="text-xs text-[var(--text-tertiary)] block">/an</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--separator)] flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    "500 recherches/mois",
                    "Pas de limite quotidienne",
                    "Acces prioritaire nouveautes",
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
                      <Check className="w-3 h-3" />
                      {feature}
                    </div>
                  ))}
                </div>
              </button>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
              {quota.planType === 'free'
                ? "Ou reviens demain - tes recherches se renouvellent a minuit"
                : "Ton quota mensuel se recharge le 1er de chaque mois"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Composant compteur de recherches restantes
export function SearchCounter({ remaining, total, planType, monthlyRemaining, monthlyLimit, onManageSubscription }: {
  remaining: number;
  total: number;
  planType?: string;
  monthlyRemaining?: number;
  monthlyLimit?: number;
  onManageSubscription?: () => void;
}) {
  const isPlan = planType === 'pro' || planType === 'premium';

  if (isPlan && monthlyRemaining !== undefined && monthlyLimit) {
    const percentage = Math.min(100, (monthlyRemaining / monthlyLimit) * 100);
    const getColor = () => {
      if (monthlyRemaining === 0) return "bg-[var(--score-low)]";
      if (monthlyRemaining <= 5) return "bg-[var(--score-medium)]";
      return "bg-[var(--score-high)]";
    };

    return (
      <div className="flex items-center gap-2" title={`${planType === 'premium' ? 'Premium' : 'Pro'} - Recharge le 1er du mois`}>
        <Crown className="w-3.5 h-3.5 text-[var(--accent)]" />
        <div className="w-20 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {monthlyRemaining}/{monthlyLimit} ce mois
        </span>
        <span className="text-[10px] text-[var(--accent)] ml-0.5">
          {planType === 'premium' ? 'Premium' : 'Pro'}
        </span>
        {onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline transition-colors ml-1"
          >
            Gerer
          </button>
        )}
      </div>
    );
  }

  // Free user
  const effectiveMax = Math.max(remaining, total);
  const percentage = effectiveMax > 0 ? Math.min(100, (remaining / effectiveMax) * 100) : 0;

  const getColor = () => {
    if (remaining === 0) return "bg-[var(--score-low)]";
    if (remaining <= 2) return "bg-[var(--score-medium)]";
    return "bg-[var(--score-high)]";
  };

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const hoursLeft = Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));

  return (
    <div className="flex items-center gap-2" title={`Renouvellement dans ${hoursLeft}h (minuit)`}>
      <div className="w-20 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-[var(--text-secondary)]">
        {remaining} recherche{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}
      </span>
      {remaining === 0 && (
        <span className="text-[10px] text-[var(--text-tertiary)]">
          · renouvellement dans {hoursLeft}h
        </span>
      )}
    </div>
  );
}
