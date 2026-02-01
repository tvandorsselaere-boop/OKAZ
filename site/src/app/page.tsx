"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Shield, Zap, ArrowLeft, ExternalLink, AlertTriangle, Settings, Check, Wand2, TrendingDown, Lightbulb, BadgeCheck, ShoppingBag, X, MapPin, Navigation } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { UpgradeModal, SearchCounter } from "@/components/ui/upgrade-modal";
import { analyzeResults } from "@/lib/scoring";
import type { AnalyzedResult, CategorizedResults, SearchResult } from "@/lib/scoring";
import { useGeolocation } from "@/hooks/useGeolocation";
import { geocodeLocation, calculateDistance, formatDistance } from "@/lib/geo";

// Interface pour le quota
interface QuotaStatus {
  isPremium: boolean;
  premiumUntil?: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  boostCredits: number;
  totalRemaining: number;
}

// Extension ID - will be loaded from localStorage or env
const EXTENSION_ID_KEY = 'okaz_extension_id';

interface ExtensionResponse {
  success: boolean;
  results?: SearchResult[];
  version?: string;
  error?: string;
}

type SearchSite = 'leboncoin' | 'vinted' | 'backmarket';

interface SearchCriteria {
  keywords: string;
  priceMin?: number;
  priceMax?: number;
  shippable?: boolean;
  ownerType?: 'private' | 'pro' | 'all';
  category?: string;
  sites?: SearchSite[];
  originalQuery: string;
}

// Briefing Pré-Chasse
interface SearchBriefing {
  marketPriceRange: {
    min: number;
    max: number;
    label: string;
  };
  warningPrice: number;
  warningText: string;
  tips: string[];
  backMarketAlternative?: {
    available: boolean;
    estimatedPrice?: number;
    url: string;
    label: string;
  };
}

interface OptimizeResponse {
  success: boolean;
  criteria: SearchCriteria;
  briefing?: SearchBriefing;
  optimizedUrl: string;
}

// LA recommandation - Le TOP PICK identifié par Gemini
interface TopPick {
  id: string;
  confidence: 'high' | 'medium' | 'low';
  headline: string;
  reason: string;
  highlights: string[];
}

interface AnalyzeResponse {
  success: boolean;
  analyzed: Array<{
    id: string;
    relevant?: boolean;
    confidence?: number;        // 0-100: niveau de confiance du match
    matchDetails?: string;      // Ce qui matche ou pas
    correctedPrice?: number;
    marketPrice?: number;
    dealScore?: number;
    dealType?: string;
    explanation?: string;
    redFlags?: string[];
  }>;
  topPick?: TopPick;
}

function ScoreBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white rounded-full ${getColor()}`}
    >
      {score}%
    </span>
  );
}

// Indicateur de confiance du match (Gemini)
function ConfidenceIndicator({ confidence, matchDetails }: { confidence: number; matchDetails?: string }) {
  // Couleur selon le niveau de confiance
  const getConfidenceStyle = () => {
    if (confidence >= 90) return { bg: 'bg-green-500/10', text: 'text-green-400', icon: '✓' };
    if (confidence >= 70) return { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: '~' };
    if (confidence >= 50) return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: '?' };
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', icon: '⚠' };
  };

  const style = getConfidenceStyle();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] ${style.bg} ${style.text}`} title={matchDetails || `Confiance: ${confidence}%`}>
      <span>{style.icon}</span>
      <span>{confidence}%</span>
    </div>
  );
}

// Composant "LA recommandation" - Carte dorée unique
function TopRecommendation({ result, topPick }: { result: AnalyzedResult; topPick: TopPick }) {
  const confidenceColors = {
    high: 'from-amber-500/20 to-yellow-500/20 border-amber-500/40',
    medium: 'from-amber-500/15 to-yellow-500/15 border-amber-500/30',
    low: 'from-amber-500/10 to-yellow-500/10 border-amber-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-6"
    >
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-5 rounded-2xl bg-gradient-to-br ${confidenceColors[topPick.confidence]} border-2 hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden`}
      >
        {/* Badge "Mon choix" */}
        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-black text-xs font-bold px-4 py-1.5 rounded-bl-xl">
          ✨ MON CHOIX
        </div>

        {/* Header avec headline */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="text-amber-400 font-semibold text-sm">{topPick.headline}</span>
        </div>

        {/* Contenu principal */}
        <div className="flex gap-4">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 ring-2 ring-amber-500/30">
            {result.image ? (
              <img
                src={result.image}
                alt={result.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                📦
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white line-clamp-2 group-hover:text-amber-300 transition-colors">
              {result.title}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-white">
                {result.price > 0 ? `${result.price.toLocaleString('fr-FR')} €` : 'Prix non indiqué'}
              </span>
              {result.analysis.dealType === 'good' && (
                <span className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">
                  {result.analysis.badges.find(b => b.text.includes('%'))?.text || 'Bon prix'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Raison de la recommandation */}
        <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5">
          <p className="text-sm text-white/90 leading-relaxed">
            "{topPick.reason}"
          </p>
        </div>

        {/* Points forts */}
        {topPick.highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {topPick.highlights.map((highlight, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-500/10 text-amber-300 rounded-full"
              >
                <Check className="w-3 h-3" />
                {highlight}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-end mt-4 text-amber-400 text-sm font-medium group-hover:text-amber-300">
          Voir l'annonce
          <ExternalLink className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </a>
    </motion.div>
  );
}

function ResultCard({ result, index = 0, showLocalBadge = false }: { result: AnalyzedResult; index?: number; showLocalBadge?: boolean }) {
  // Utiliser l'analyse Gemini si disponible, sinon fallback sur l'analyse locale
  const gemini = result.geminiAnalysis;
  const dealType = gemini?.dealType || result.analysis.dealType;
  const isLocal = (result as AnalyzedResult & { isLocal?: boolean }).isLocal;

  const dealClass = dealType === 'excellent' || dealType === 'good'
    ? 'bg-green-500/10 text-green-400'
    : dealType === 'overpriced' || dealType === 'suspicious'
    ? 'bg-red-500/10 text-red-400'
    : dealType === 'fair'
    ? 'bg-yellow-500/10 text-yellow-400'
    : 'bg-white/5 text-white/50';

  const dealIcon = dealType === 'excellent' ? '🔥'
    : dealType === 'good' ? '✓'
    : dealType === 'suspicious' ? '⚠'
    : dealType === 'overpriced' ? '📉'
    : '•';

  // Couleur spotlight selon le deal type
  const spotlightColor = dealType === 'excellent' || dealType === 'good'
    ? 'rgba(34, 197, 94, 0.12)'
    : dealType === 'suspicious' || dealType === 'overpriced'
    ? 'rgba(239, 68, 68, 0.12)'
    : 'rgba(99, 102, 241, 0.12)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <SpotlightCard
          spotlightColor={spotlightColor}
          className="p-4 group cursor-pointer hover:scale-[1.01] transition-transform duration-200"
        >
          <div className="flex gap-4">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
              {result.image ? (
                <img
                  src={result.image}
                  alt={result.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  📦
                </div>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 py-0.5 text-[10px] text-white text-center font-medium"
                style={{ backgroundColor: result.siteColor }}
              >
                {result.site}
              </div>
              {/* Badge "Près de vous" sur l'image */}
              {isLocal && showLocalBadge && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500/90 text-white text-[8px] font-bold rounded">
                  LOCAL
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-[var(--primary-light)] transition-colors">
                  {result.title}
                </h3>
                <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-[var(--primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-lg font-bold text-white">
                  {result.price > 0 ? `${result.price.toLocaleString('fr-FR')} €` : 'Prix non indiqué'}
                </span>
                <ScoreBadge score={result.score} />
                {/* Indicateur de confiance Gemini */}
                {gemini?.confidence !== undefined && (
                  <ConfidenceIndicator confidence={gemini.confidence} matchDetails={gemini.matchDetails} />
                )}
              </div>
            </div>
          </div>

          {/* Match details si confiance < 70% */}
          {gemini?.matchDetails && gemini.confidence !== undefined && gemini.confidence < 70 && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/10 text-[11px] text-orange-300/80">
              {gemini.matchDetails}
            </div>
          )}

          {/* Explication Gemini ou texte local */}
          {(gemini?.explanation || result.analysis.dealText) && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${dealClass}`}>
              <span>{dealIcon}</span>
              <span>{gemini?.explanation || result.analysis.dealText}</span>
            </div>
          )}

          {/* Badges : RedFlags Gemini + badges locaux */}
          {((gemini?.redFlags?.length ?? 0) > 0 || result.analysis.badges.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {/* Red flags de Gemini */}
              {gemini?.redFlags?.map((flag, i) => (
                <span
                  key={`rf-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-red-500/15 text-red-400"
                >
                  <Shield className="w-3 h-3" />
                  {flag}
                </span>
              ))}
              {/* Badges locaux */}
              {result.analysis.badges.map((badge, i) => (
                <span
                  key={`b-${i}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${
                    badge.type === 'positive'
                      ? 'bg-green-500/15 text-green-400'
                      : badge.type === 'warning'
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {badge.type === 'danger' && <Shield className="w-3 h-3" />}
                  {badge.text}
                </span>
              ))}
            </div>
          )}
        </SpotlightCard>
      </a>
    </motion.div>
  );
}

// Section Main propre avec tri par distance si géoloc activée
function HandDeliverySection({ results, userLocation }: { results: AnalyzedResult[]; userLocation?: { lat: number; lng: number } }) {
  // Calculer les distances si géoloc active
  const resultsWithDistance = results.map(result => {
    if (!userLocation || !result.location) {
      return { ...result, distance: null as number | null };
    }
    const coords = geocodeLocation(result.location);
    if (!coords) {
      return { ...result, distance: null as number | null };
    }
    const distance = calculateDistance(userLocation, coords.coords);
    return { ...result, distance };
  });

  // Toujours trier par score (le plus pertinent en premier)
  const sortedResults = [...resultsWithDistance].sort((a, b) => b.score - a.score);

  // Trouver la meilleure offre (score + deal type + distance)
  const bestDeal = sortedResults.length > 0 ? sortedResults.reduce((best, current) => {
    const currentDealType = current.geminiAnalysis?.dealType || current.analysis.dealType;
    const bestDealType = best.geminiAnalysis?.dealType || best.analysis.dealType;

    // Score composite: score de base + bonus deal type + bonus distance
    const getDealBonus = (dealType: string) => {
      if (dealType === 'excellent') return 30;
      if (dealType === 'good') return 20;
      if (dealType === 'fair') return 5;
      return 0;
    };

    const currentComposite = current.score + getDealBonus(currentDealType || '') + (current.distance !== null && current.distance < 20 ? 10 : 0);
    const bestComposite = best.score + getDealBonus(bestDealType || '') + (best.distance !== null && best.distance < 20 ? 10 : 0);

    return currentComposite > bestComposite ? current : best;
  }, sortedResults[0]) : null;

  // Filtrer le bestDeal des autres résultats
  const otherResults = bestDeal ? sortedResults.filter(r => r.id !== bestDeal.id) : sortedResults;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🤝</span>
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
          Main propre
          <span className="text-white/30 font-normal ml-2">({results.length})</span>
        </h3>
      </div>

      {/* Meilleur deal main propre - Carte mise en avant */}
      {bestDeal && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <a
            href={bestDeal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/30 hover:border-emerald-500/50 hover:scale-[1.01] transition-all group relative overflow-hidden"
          >
            {/* Badge "Meilleur deal" */}
            <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
              🎯 MEILLEUR DEAL
            </div>

            <div className="flex gap-4">
              <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 ring-2 ring-emerald-500/30">
                {bestDeal.image ? (
                  <img
                    src={bestDeal.image}
                    alt={bestDeal.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 py-0.5 text-[10px] text-white text-center font-medium"
                  style={{ backgroundColor: bestDeal.siteColor }}
                >
                  {bestDeal.site}
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-2">
                <h4 className="text-base font-semibold text-white line-clamp-2 group-hover:text-emerald-300 transition-colors">
                  {bestDeal.title}
                </h4>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-2xl font-bold text-white">
                    {bestDeal.price > 0 ? `${bestDeal.price.toLocaleString('fr-FR')} €` : 'Prix sur demande'}
                  </span>
                  <ScoreBadge score={bestDeal.score} />
                </div>

                {/* Infos localisation */}
                <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400">
                  <MapPin className="w-3 h-3" />
                  {bestDeal.distance !== null ? (
                    <span>{formatDistance(bestDeal.distance)} de vous</span>
                  ) : bestDeal.location ? (
                    <span>{bestDeal.location}</span>
                  ) : (
                    <span>Localisation non précisée</span>
                  )}
                </div>
              </div>

              <ExternalLink className="w-5 h-5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-2" />
            </div>
          </a>
        </motion.div>
      )}

      {/* Autres résultats */}
      {otherResults.length > 0 && (
        <div className="space-y-3">
          {otherResults.map((result, index) => (
            <div key={result.id} className="relative">
              <ResultCard result={result} index={index} />
              {/* Badge distance si géoloc active */}
              {userLocation && result.distance !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="absolute top-4 right-4 px-2 py-1 bg-blue-500/20 backdrop-blur-sm text-blue-400 text-[10px] rounded-full flex items-center gap-1 border border-blue-500/30"
                >
                  <MapPin className="w-3 h-3" />
                  {formatDistance(result.distance)}
                </motion.div>
              )}
              {/* Badge "Près de vous" pour résultats locaux */}
              {(result as AnalyzedResult & { isLocal?: boolean }).isLocal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="absolute top-4 left-4 px-2 py-1 bg-green-500/20 backdrop-blur-sm text-green-400 text-[10px] rounded-full flex items-center gap-1 border border-green-500/30"
                >
                  <Navigation className="w-3 h-3" />
                  Près de vous
                </motion.div>
              )}
              {/* Afficher la ville si pas de géoloc */}
              {!userLocation && result.location && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-white/10 backdrop-blur-sm text-white/50 text-[10px] rounded-full border border-white/10">
                  {result.location}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SearchResults({ data, onBack }: { data: { query: string; categorized: CategorizedResults; totalResults: number; duration: number; criteria?: SearchCriteria; topPick?: TopPick; userLocation?: { lat: number; lng: number } }; onBack: () => void }) {
  const { categorized, totalResults, duration, query, criteria, topPick, userLocation } = data;
  const { results } = categorized;

  // Trouver le résultat correspondant au topPick (Coup de cœur unique)
  const topPickResult = topPick
    ? results.find(r => r.id === topPick.id)
    : null;

  // Filtrer le topPick des autres résultats pour éviter la duplication
  const otherResults = topPick
    ? results.filter(r => r.id !== topPick.id)
    : results;

  // Séparer les résultats : Livraison vs Main propre
  // - Livraison = a une option livraison (même si main propre aussi possible)
  // - Main propre = UNIQUEMENT main propre (pas de livraison)
  const shippingResults = otherResults.filter(r => r.hasShipping === true);
  const handDeliveryResults = otherResults.filter(r => r.handDelivery === true && r.hasShipping !== true);

  const wasOptimized = criteria && criteria.keywords !== criteria.originalQuery;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.button
          onClick={onBack}
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors btn-secondary px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </motion.button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shadow-lg">
            <Search className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold logo-gradient">OKAZ</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4 rounded-xl space-y-2"
      >
        <div>
          <div className="text-sm text-white/50">Recherche :</div>
          <div className="text-white font-medium">{query}</div>
        </div>

        {wasOptimized && criteria && (
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-[var(--primary)]">
              <Wand2 className="w-3 h-3" />
              Optimise par IA
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/70">
                {criteria.keywords}
              </span>
              {criteria.priceMax && (
                <span className="text-xs bg-green-500/10 px-2 py-0.5 rounded text-green-400">
                  Max {criteria.priceMax}€
                </span>
              )}
              {criteria.priceMin && (
                <span className="text-xs bg-blue-500/10 px-2 py-0.5 rounded text-blue-400">
                  Min {criteria.priceMin}€
                </span>
              )}
              {criteria.shippable && (
                <span className="text-xs bg-purple-500/10 px-2 py-0.5 rounded text-purple-400">
                  Livrable
                </span>
              )}
              {criteria.ownerType === 'private' && (
                <span className="text-xs bg-yellow-500/10 px-2 py-0.5 rounded text-yellow-400">
                  Particulier
                </span>
              )}
              {criteria.category && (
                <span className="text-xs bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-400">
                  {criteria.category}
                </span>
              )}
            </div>
            {criteria.sites && criteria.sites.length < 3 && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-white/40">
                <span>Sites:</span>
                {criteria.sites.map(site => (
                  <span key={site} className="px-1.5 py-0.5 bg-white/5 rounded">
                    {site === 'leboncoin' ? 'LBC' : site === 'vinted' ? 'Vinted' : 'BackMarket'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-white/40">
          {totalResults} résultat{totalResults > 1 ? 's' : ''} en {(duration / 1000).toFixed(1)}s
        </div>
      </motion.div>

      {totalResults === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-white/60">Aucun resultat trouve pour cette recherche</p>
        </div>
      )}

      {/* Coup de cœur unique - Carte dorée (choisi par Gemini) */}
      {topPickResult && topPick && (
        <TopRecommendation result={topPickResult} topPick={topPick} />
      )}

      {/* Section Livraison */}
      {shippingResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
              Livraison
              <span className="text-white/30 font-normal ml-2">({shippingResults.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {shippingResults.map((result, index) => (
              <ResultCard key={result.id} result={result} index={index} showLocalBadge={true} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Section Main propre */}
      {handDeliveryResults.length > 0 && (
        <HandDeliverySection results={handDeliveryResults} userLocation={userLocation} />
      )}
    </div>
  );
}

// Composant Briefing Pré-Chasse - Affiché pendant le loading
function LoadingBriefing({ briefing, searchPhase }: { briefing: SearchBriefing | null; searchPhase: 'optimizing' | 'searching' | 'analyzing' }) {
  const [visibleCards, setVisibleCards] = useState(0);

  // Afficher les cartes progressivement
  useEffect(() => {
    if (!briefing || searchPhase === 'optimizing') {
      setVisibleCards(0);
      return;
    }

    // Afficher carte 1 immédiatement quand la recherche commence
    setVisibleCards(1);

    // Carte 2 après 3 secondes
    const timer1 = setTimeout(() => setVisibleCards(2), 3000);

    // Carte 3 après 7 secondes
    const timer2 = setTimeout(() => setVisibleCards(3), 7000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [briefing, searchPhase]);

  if (!briefing || searchPhase === 'optimizing') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 mt-4"
    >
      {/* Carte 1: Prix du marché */}
      {visibleCards >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-400">Prix du marché</p>
              <p className="text-white font-semibold">{briefing.marketPriceRange.label}</p>
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {briefing.warningText}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Carte 2: Tips contextuels */}
      {visibleCards >= 2 && briefing.tips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">À vérifier</p>
              <ul className="mt-1 space-y-1">
                {briefing.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-white/80 flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Carte 3: Alternative Back Market (monétisable) */}
      {visibleCards >= 3 && briefing.backMarketAlternative?.available && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">Option sécurisée</p>
              <p className="text-xs text-white/60 mt-0.5">{briefing.backMarketAlternative.label}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white font-semibold">
                  {briefing.backMarketAlternative.estimatedPrice
                    ? `~${briefing.backMarketAlternative.estimatedPrice}€`
                    : 'Voir prix'}
                  <span className="text-xs text-white/50 ml-1">· Garantie 2 ans</span>
                </span>
                <a
                  href={briefing.backMarketAlternative.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-1"
                >
                  <ShoppingBag className="w-3 h-3" />
                  Voir
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ExtensionSetup({ onSave }: { onSave: (id: string) => void }) {
  const [extensionId, setExtensionId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const testConnection = async () => {
    if (!extensionId.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      // @ts-ignore - chrome is available in browser
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId.trim(), { type: 'PING' }, (response: ExtensionResponse) => {
          // @ts-ignore
          if (chrome.runtime.lastError) {
            // @ts-ignore
            console.error('Extension error:', chrome.runtime.lastError);
            setTestResult('error');
          } else if (response && response.success) {
            setTestResult('success');
            onSave(extensionId.trim());
          } else {
            setTestResult('error');
          }
          setTesting(false);
        });
      } else {
        setTestResult('error');
        setTesting(false);
      }
    } catch (err) {
      console.error('Test error:', err);
      setTestResult('error');
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--primary)]/20 flex items-center justify-center">
          <Settings className="w-8 h-8 text-[var(--primary)]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Configuration requise</h2>
        <p className="text-sm text-white/60">
          Connectez l'extension Chrome pour utiliser OKAZ
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-2">
            ID de l'extension Chrome
          </label>
          <input
            type="text"
            value={extensionId}
            onChange={(e) => setExtensionId(e.target.value)}
            placeholder="Ex: abcdefghijklmnopqrstuvwxyz123456"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
          />
        </div>

        <div className="text-xs text-white/40 space-y-1">
          <p>Pour trouver l'ID :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Ouvrez <code className="bg-white/10 px-1 rounded">chrome://extensions</code></li>
            <li>Activez le "Mode developpeur"</li>
            <li>Trouvez "OKAZ" et copiez l'ID</li>
          </ol>
        </div>

        {testResult === 'error' && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            Connexion echouee. Verifiez que l'extension est installee et l'ID est correct.
          </div>
        )}

        {testResult === 'success' && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Extension connectee avec succes !
          </div>
        )}

        <button
          onClick={testConnection}
          disabled={!extensionId.trim() || testing}
          className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-medium transition-all"
        >
          {testing ? 'Test en cours...' : 'Tester la connexion'}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchData, setSearchData] = useState<{ query: string; categorized: CategorizedResults; totalResults: number; duration: number; criteria?: SearchCriteria; topPick?: TopPick; userLocation?: { lat: number; lng: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [currentCriteria, setCurrentCriteria] = useState<SearchCriteria | null>(null);
  const [currentBriefing, setCurrentBriefing] = useState<SearchBriefing | null>(null);
  const [searchPhase, setSearchPhase] = useState<'idle' | 'optimizing' | 'searching' | 'analyzing'>('idle');
  // Hook géolocalisation (doit être avant les effets qui l'utilisent)
  const { position, permissionState, isLoading: geoLoading, requestPermission } = useGeolocation();

  const [geolocEnabled, setGeolocEnabled] = useState(() => {
    // Charger depuis localStorage au premier render
    if (typeof window !== 'undefined') {
      return localStorage.getItem('okaz_geoloc_enabled') === 'true';
    }
    return false;
  });

  // Persister geolocEnabled
  useEffect(() => {
    localStorage.setItem('okaz_geoloc_enabled', geolocEnabled.toString());
  }, [geolocEnabled]);

  // Note: On n'auto-active plus la géoloc pour permettre à l'utilisateur de la désactiver

  // État du quota
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Récupérer le quota depuis l'extension
  const fetchQuotaFromExtension = useCallback(() => {
    if (!extensionId) return;
    try {
      // @ts-ignore
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId, { type: 'GET_QUOTA' }, (response: { success: boolean; quota?: QuotaStatus }) => {
          // @ts-ignore
          if (!chrome.runtime.lastError && response?.success && response.quota) {
            setQuota(response.quota);
          }
        });
      }
    } catch (err) {
      console.error('[OKAZ] Erreur récupération quota:', err);
    }
  }, [extensionId]);

  // Charger le quota initial quand l'extension est connectée
  useEffect(() => {
    if (extensionConnected && extensionId) {
      fetchQuotaFromExtension();
    }
  }, [extensionConnected, extensionId, fetchQuotaFromExtension]);

  // Handlers pour l'upgrade modal
  const handleBuyBoost = async () => {
    setIsUpgrading(true);
    try {
      // Récupérer l'UUID de l'extension
      // @ts-ignore
      const uuidResponse = await new Promise<{ success: boolean; uuid?: string }>((resolve) => {
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId, { type: 'GET_UUID' }, resolve);
      });

      if (!uuidResponse?.uuid) {
        throw new Error('UUID non disponible');
      }

      const response = await fetch('/api/checkout/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuidResponse.uuid }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Erreur checkout');
      }
    } catch (err) {
      console.error('[OKAZ] Erreur achat boost:', err);
      setError('Erreur lors de la création du paiement');
      setShowUpgradeModal(false);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleBuyPremium = async () => {
    // Demander l'email pour le Premium
    const email = window.prompt('Entrez votre email pour le compte Premium:');
    if (!email || !email.includes('@')) {
      return; // Annulé ou email invalide
    }

    setIsUpgrading(true);
    try {
      // Récupérer l'UUID de l'extension
      // @ts-ignore
      const uuidResponse = await new Promise<{ success: boolean; uuid?: string }>((resolve) => {
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId, { type: 'GET_UUID' }, resolve);
      });

      const response = await fetch('/api/checkout/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          uuid: uuidResponse?.uuid || ''
        }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Erreur checkout');
      }
    } catch (err) {
      console.error('[OKAZ] Erreur achat premium:', err);
      setError('Erreur lors de la création du paiement');
      setShowUpgradeModal(false);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Refs pour éviter les closures stale dans les callbacks async
  const positionRef = useRef(position);
  const geolocEnabledRef = useRef(geolocEnabled);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    geolocEnabledRef.current = geolocEnabled;
  }, [geolocEnabled]);

  // Demander la permission quand on active la checkbox
  const handleGeolocToggle = async () => {
    console.log('[OKAZ] Geoloc toggle clicked, current state:', { geolocEnabled, permissionState, position });

    // Si on n'a pas de position, toujours la demander (peu importe geolocEnabled)
    if (!position) {
      console.log('[OKAZ] No position, requesting...');
      await requestPermission();
      setGeolocEnabled(true);
      return;
    }

    // On a une position, toggle l'état
    setGeolocEnabled(!geolocEnabled);
  };

  // Load extension ID from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(EXTENSION_ID_KEY);
    if (savedId) {
      setExtensionId(savedId);
      // Test connection
      testExtensionConnection(savedId);
    } else {
      setShowSetup(true);
    }
  }, []);

  const testExtensionConnection = useCallback((id: string) => {
    try {
      // @ts-ignore
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // @ts-ignore
        chrome.runtime.sendMessage(id, { type: 'PING' }, (response: ExtensionResponse) => {
          // @ts-ignore
          if (chrome.runtime.lastError || !response || !response.success) {
            setExtensionConnected(false);
            setShowSetup(true);
          } else {
            setExtensionConnected(true);
            setShowSetup(false);
          }
        });
      } else {
        setExtensionConnected(false);
        setShowSetup(true);
      }
    } catch {
      setExtensionConnected(false);
      setShowSetup(true);
    }
  }, []);

  const handleSaveExtensionId = (id: string) => {
    localStorage.setItem(EXTENSION_ID_KEY, id);
    setExtensionId(id);
    setExtensionConnected(true);
    setShowSetup(false);
  };

  // Annuler la recherche en cours
  const handleCancelSearch = () => {
    console.log('[OKAZ] Recherche annulée par l\'utilisateur');
    setIsSearching(false);
    setIsOptimizing(false);
    setSearchPhase('idle');
    setCurrentBriefing(null);
    setCurrentCriteria(null);
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;

    // Si recherche en cours, annuler
    if (isSearching) {
      handleCancelSearch();
      return;
    }

    if (!q.trim() || !extensionId) return;

    // Vérifier le quota avant de lancer la recherche
    if (quota && !quota.isPremium && quota.totalRemaining <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    setIsSearching(true);
    setIsOptimizing(true);
    setError(null);
    setSearchData(null);
    setCurrentCriteria(null);
    setCurrentBriefing(null);
    setSearchPhase('optimizing');

    const startTime = Date.now();

    try {
      // Étape 1: Optimiser la requête via Gemini
      console.log('[OKAZ] ====== DÉBUT RECHERCHE ======');
      console.log('[OKAZ] 1. Optimisation Gemini en cours...');
      console.log('[OKAZ] Requête:', q);
      let criteria: SearchCriteria;

      try {
        console.log('[OKAZ] 1a. Appel API /api/optimize...');
        const optimizeRes = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q.trim() }),
        });
        console.log('[OKAZ] 1b. Réponse reçue, parsing JSON...');
        const optimizeData: OptimizeResponse = await optimizeRes.json();
        console.log('[OKAZ] 1c. Données:', optimizeData);

        if (optimizeData.success && optimizeData.criteria) {
          criteria = optimizeData.criteria;
          console.log('[OKAZ] 1d. ✓ Critères optimisés:', criteria);
          // Stocker le briefing s'il existe
          if (optimizeData.briefing) {
            console.log('[OKAZ] 1e. ✓ Briefing reçu:', optimizeData.briefing);
            setCurrentBriefing(optimizeData.briefing);
          }
        } else {
          // Fallback: utiliser la requête brute
          console.log('[OKAZ] 1d. ⚠ Pas de critères, fallback');
          criteria = { keywords: q.trim(), originalQuery: q.trim() };
        }
      } catch (optimizeErr) {
        console.warn('[OKAZ] 1e. ❌ Optimisation échouée:', optimizeErr);
        criteria = { keywords: q.trim(), originalQuery: q.trim() };
      }

      console.log('[OKAZ] 2. Gemini terminé, critères finaux:', criteria);
      setCurrentCriteria(criteria);
      setIsOptimizing(false);
      setSearchPhase('searching');

      // Étape 2: Envoyer les critères à l'extension
      // Si géoloc activée, ajouter la position pour recherche locale LeBonCoin
      const searchCriteria = {
        ...criteria,
        userLocation: geolocEnabledRef.current && positionRef.current ? positionRef.current : undefined
      };

      console.log('[OKAZ] 3. Envoi à l\'extension MAINTENANT...');
      console.log('[OKAZ] 3a. Keywords:', criteria.keywords);
      console.log('[OKAZ] 3b. PriceMax:', criteria.priceMax);
      console.log('[OKAZ] 3c. Shippable:', criteria.shippable);
      console.log('[OKAZ] 3d. UserLocation:', searchCriteria.userLocation ? 'OUI' : 'NON');
      // @ts-ignore
      chrome.runtime.sendMessage(extensionId, { type: 'SEARCH', query: criteria.keywords, criteria: searchCriteria }, async (response: ExtensionResponse) => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          setError('Erreur de connexion a l\'extension: ' + chrome.runtime.lastError.message);
          setIsSearching(false);
          return;
        }

        if (response && response.success && response.results) {
          console.log('[OKAZ] 4. Résultats reçus de l\'extension:', response.results.length);

          // Étape 3: Analyser les résultats avec Gemini
          console.log('[OKAZ] 5. Analyse Gemini des résultats...');
          setSearchPhase('analyzing');
          let geminiAnalysis: Record<string, { relevant?: boolean; confidence?: number; matchDetails?: string; correctedPrice?: number; marketPrice?: number; dealScore?: number; dealType?: string; explanation?: string; redFlags?: string[] }> = {};
          let topPick: TopPick | undefined;

          try {
            const analyzeRes = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: response.results, query: q }),
            });
            const analyzeData: AnalyzeResponse = await analyzeRes.json();

            console.log('[OKAZ] 5a. Réponse API analyze:', analyzeData);

            if (analyzeData.success && analyzeData.analyzed) {
              console.log('[OKAZ] 5b. ✓ Analyse Gemini terminée:', analyzeData.analyzed.length);
              // Créer un map id -> analyse
              analyzeData.analyzed.forEach((a) => {
                geminiAnalysis[a.id] = a;
                // Debug: afficher dealScore de chaque résultat
                console.log(`[OKAZ] Résultat ${a.id}: dealScore=${a.dealScore}, marketPrice=${a.marketPrice}, dealType=${a.dealType}`);
              });

              // Récupérer le topPick si présent
              if (analyzeData.topPick) {
                topPick = analyzeData.topPick;
                console.log('[OKAZ] 5c. ✓ TopPick identifié:', topPick.id, '-', topPick.headline);
              }
            } else {
              console.warn('[OKAZ] 5b. ⚠ Analyse Gemini: success=false ou pas de données', analyzeData);
            }
          } catch (analyzeErr) {
            console.error('[OKAZ] 5d. ❌ Analyse Gemini échouée:', analyzeErr);
          }

          // Appliquer les corrections Gemini
          // 1. Filtrer si confidence < 30% (vraiment hors-sujet)
          // 2. Pondérer le score par la pertinence : scoreFinal = score × (confidence/100)
          const MIN_CONFIDENCE = 30; // Seuil minimum pour afficher

          const correctedResults = response.results.map(r => {
            const analysis = geminiAnalysis[r.id];
            const confidence = analysis?.confidence ?? 70; // 70% par défaut si pas d'analyse

            // Filtrer les résultats avec pertinence trop basse
            const isRelevant = confidence >= MIN_CONFIDENCE;

            // Pondérer le score par la pertinence
            const originalScore = r.score || 75;
            const weightedScore = Math.round(originalScore * (confidence / 100));

            console.log(`[OKAZ] Résultat ${r.id}: confidence=${confidence}%, score=${originalScore} → ${isRelevant ? `GARDÉ (score pondéré: ${weightedScore})` : 'FILTRÉ'}`);

            return {
              ...r,
              price: analysis?.correctedPrice || r.price,
              score: weightedScore, // Score pondéré par la pertinence
              geminiAnalysis: analysis,
              relevant: isRelevant
            };
          }).filter(r => r.relevant);

          const duration = Date.now() - startTime;
          const categorized = analyzeResults(correctedResults, q);

          console.log('[OKAZ] 6. Affichage des résultats');
          setSearchData({
            query: q,
            categorized,
            totalResults: correctedResults.length,
            duration,
            criteria,
            topPick,
            userLocation: geolocEnabledRef.current && positionRef.current ? positionRef.current : undefined
          });
        } else {
          // Vérifier si c'est une erreur de quota
          if (response?.error === 'quota_exhausted') {
            fetchQuotaFromExtension(); // Rafraîchir le quota
            setShowUpgradeModal(true);
          } else {
            setError(response?.error || 'Erreur de recherche');
          }
        }
        setIsSearching(false);
        setSearchPhase('idle');
        // Rafraîchir le quota après la recherche
        fetchQuotaFromExtension();
      });
    } catch (err) {
      setError('Erreur de connexion a l\'extension');
      setIsSearching(false);
      setIsOptimizing(false);
      setSearchPhase('idle');
      console.error('Search error:', err);
    }
  };

  const handleBack = () => {
    setSearchData(null);
    setError(null);
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    handleSearch(exampleQuery);
  };

  // Show results screen
  if (searchData) {
    return (
      <main className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-[var(--accent)]/10" />
        <div className="relative z-10 container mx-auto px-4 py-8 max-w-2xl">
          <SearchResults data={searchData} onBack={handleBack} />
        </div>
      </main>
    );
  }

  // Show setup screen
  if (showSetup) {
    return (
      <main className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-[var(--accent)]/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--primary)]/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--accent)]/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }} />

        <div className="relative z-10 container mx-auto px-4 py-16 max-w-md">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold gradient-text text-center mb-8">OKAZ</h1>
            <GlassCard variant="bordered" className="p-6">
              <ExtensionSetup onSave={handleSaveExtensionId} />
            </GlassCard>
          </motion.div>
        </div>
      </main>
    );
  }

  // Show home/search screen
  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-[var(--accent)]/10" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--primary)]/20 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--accent)]/20 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            {/* Logo Icon + Text */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <motion.div
                className="logo-icon"
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Search className="w-7 h-7 text-[var(--primary-light)]" />
              </motion.div>
              <h1 className="logo-text text-5xl sm:text-6xl logo-gradient logo-glow">
                OKAZ
              </h1>
            </div>

            <p className="text-lg text-[var(--text-secondary)] max-w-md mx-auto">
              Comparez <strong className="text-white">LeBonCoin</strong>,{" "}
              <strong className="text-white">Vinted</strong> et{" "}
              <strong className="text-white">Back Market</strong> en une recherche
            </p>
            {extensionConnected && (
              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                  <Check className="w-3 h-3" />
                  Extension connectée
                </div>
                {quota && (
                  <SearchCounter
                    remaining={quota.isPremium ? -1 : quota.totalRemaining}
                    total={quota.dailyLimit}
                  />
                )}
              </div>
            )}
          </motion.div>

          {/* Search box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="glass-card glass-card-hover p-6 rounded-2xl">
              {/* Form de recherche */}
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Que cherchez-vous ?"
                    className="input-glass w-full px-6 py-4 pr-16 text-lg rounded-xl text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!isSearching && !query.trim()}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 ${
                      isSearching
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'search-btn'
                    }`}
                    onClick={(e) => { console.log('[OKAZ] Search button clicked'); }}
                  >
                    {isSearching ? <X className="w-5 h-5 text-white" /> : <Search className="w-5 h-5 text-white" />}
                  </button>
                </div>
              </form>

              {/* Option géolocalisation - EN DEHORS du form */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGeolocToggle}
                  disabled={geoLoading || isSearching}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ${
                    geolocEnabled && position
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {geoLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MapPin className={`w-4 h-4 ${geolocEnabled && position ? 'text-blue-400' : ''}`} />
                  )}
                  <span>
                    {geolocEnabled && position
                      ? 'Localisation activée'
                      : 'Activer ma position'}
                  </span>
                  {geolocEnabled && position && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </button>

                {geolocEnabled && permissionState === 'denied' && (
                  <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    Permission refusée
                  </span>
                )}
              </div>

              {/* Loading state */}
              <AnimatePresence>
                {isSearching && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6"
                  >
                    <div className="space-y-4">
                      {/* Étape 1: Optimisation Gemini */}
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${isOptimizing ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOptimizing ? 'bg-[var(--primary)]/20 animate-pulse' : 'bg-green-500/20'}`}>
                          {isOptimizing ? <Wand2 className="w-4 h-4 text-[var(--primary)]" /> : <Check className="w-4 h-4 text-green-400" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isOptimizing ? 'text-[var(--primary)]' : 'text-green-400'}`}>
                            {isOptimizing ? 'Optimisation de la requête...' : 'Requête optimisée'}
                          </p>
                          {currentCriteria && !isOptimizing && (
                            <p className="text-xs text-white/50 mt-0.5">
                              "{currentCriteria.keywords}"
                              {currentCriteria.priceMax && ` • Max ${currentCriteria.priceMax}€`}
                              {currentCriteria.shippable && ' • Livrable'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Étape 2: Recherche */}
                      {!isOptimizing && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                            <Search className="w-4 h-4 text-white/60" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white/80">
                              {searchPhase === 'analyzing' ? 'Analyse IA des résultats...' : 'Recherche en cours...'}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {["LeBonCoin", "Vinted", "Back Market"].map((site, i) => (
                                <motion.span
                                  key={site}
                                  initial={{ opacity: 0.3 }}
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{ delay: i * 0.3, duration: 1, repeat: Infinity }}
                                  className="text-[10px] text-white/40 px-2 py-0.5 bg-white/5 rounded"
                                >
                                  {site}
                                </motion.span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Briefing Pré-Chasse */}
                      <LoadingBriefing briefing={currentBriefing} searchPhase={searchPhase === 'optimizing' ? 'optimizing' : searchPhase === 'searching' ? 'searching' : 'analyzing'} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error state */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Examples */}
              {!isSearching && !error && (
                <div className="mt-6 space-y-3">
                  <p className="text-xs text-white/40 uppercase tracking-wide">
                    Exemples de recherche
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "iPhone 13",
                      "MacBook Pro",
                      "PS5",
                      "Nintendo Switch",
                      "AirPods Pro"
                    ].map((example) => (
                      <motion.button
                        key={example}
                        onClick={() => handleExampleClick(example)}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="tag-hover px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white/60"
                      >
                        {example}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Settings button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-center"
          >
            <motion.button
              onClick={() => setShowSetup(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-xs text-white/40 hover:text-white/60 transition-all inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              <Settings className="w-3 h-3" />
              Configurer l'extension
            </motion.button>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            {[
              { icon: Zap, text: "3 sites en parallèle", color: "var(--primary)", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.2)" },
              { icon: Shield, text: "Détection arnaques", color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)" },
              { icon: Sparkles, text: "Score de pertinence", color: "#eab308", bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)" },
            ].map((feature, i) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 transition-all cursor-default"
                style={{
                  background: feature.bg,
                  border: `1px solid ${feature.border}`,
                }}
              >
                <feature.icon className="w-4 h-4" style={{ color: feature.color }} />
                {feature.text}
              </motion.div>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-center text-xs text-white/40"
          >
            Un projet{" "}
            <a
              href="https://facile-ia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors font-medium"
            >
              Facile-IA
            </a>
          </motion.div>
        </div>
      </div>

      {/* Modal upgrade quand quota épuisé */}
      {quota && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          quota={quota}
          onBuyBoost={handleBuyBoost}
          onBuyPremium={handleBuyPremium}
          isLoading={isUpgrading}
        />
      )}
    </main>
  );
}
