"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Crown, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface QuotaStatus {
  isPremium: boolean;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  boostCredits: number;
  totalRemaining: number;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: QuotaStatus;
  onBuyBoost: () => void;
  onBuyPremium: () => void;
  isLoading?: boolean;
}

export function UpgradeModal({
  isOpen,
  onClose,
  quota,
  onBuyBoost,
  onBuyPremium,
  isLoading = false,
}: UpgradeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard variant="bordered" className="w-full max-w-md p-8 relative">
              {/* Bouton fermer */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Plus que 0 recherche aujourd'hui
                </h2>
                <p className="text-sm text-white/60">
                  Tu as bien cherché ! Tes {quota.dailyLimit} recherches quotidiennes sont épuisées.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-4">
                {/* Pack Boost */}
                <button
                  onClick={onBuyBoost}
                  disabled={isLoading}
                  className="w-full p-4 rounded-2xl bg-white/5 gradient-border hover:bg-white/10 transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                          +10 recherches
                        </h3>
                        <p className="text-xs text-white/50">Pour finir ta session</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-white">0,99€</span>
                  </div>
                </button>

                {/* Premium */}
                <button
                  onClick={onBuyPremium}
                  disabled={isLoading}
                  className="w-full p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/50 transition-all text-left group disabled:opacity-50 relative overflow-hidden"
                >
                  {/* Badge recommandé */}
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    RECOMMANDÉ
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                          ILLIMITÉ
                        </h3>
                        <p className="text-xs text-white/50">Recherches sans limite</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-white">9,99€</span>
                      <span className="text-xs text-white/50 block">/an</span>
                    </div>
                  </div>

                  {/* Features Premium */}
                  <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                    {[
                      "Alertes nouvelles annonces",
                      "Historique des prix",
                      "Nego-Coach",
                      "Sans publicité",
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-300/80">
                        <Check className="w-3 h-3" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </button>
              </div>

              {/* Footer */}
              <p className="text-center text-xs text-white/40 mt-6">
                Ou reviens demain - tes recherches se renouvellent à minuit
              </p>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Composant compteur de recherches restantes
export function SearchCounter({ remaining, total, onManageSubscription }: { remaining: number; total: number; onManageSubscription?: () => void }) {
  // Calculer la barre par rapport au max réel (daily + boost éventuel)
  const effectiveMax = Math.max(remaining, total);
  const percentage = effectiveMax > 0 ? Math.min(100, (remaining / effectiveMax) * 100) : 0;

  const getColor = () => {
    if (remaining === 0) return "bg-red-500";
    if (remaining <= 2) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (remaining < 0) {
    // Premium = illimité
    return (
      <div className="flex items-center gap-2 text-xs text-amber-400">
        <Crown className="w-3.5 h-3.5" />
        <span>Illimité</span>
        {onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="text-[10px] text-white/30 hover:text-white/60 underline transition-colors ml-1"
          >
            Gérer
          </button>
        )}
      </div>
    );
  }

  // Calculer le temps avant reset (minuit)
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const hoursLeft = Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));

  return (
    <div className="flex items-center gap-2" title={`Renouvellement dans ${hoursLeft}h (minuit)`}>
      <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-white/50">
        {remaining} recherche{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}
      </span>
      {remaining === 0 && (
        <span className="text-[10px] text-white/30">
          · renouvellement dans {hoursLeft}h
        </span>
      )}
    </div>
  );
}
