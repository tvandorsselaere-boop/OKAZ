"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Shield, ArrowLeft, ExternalLink, AlertTriangle, Settings, Check, Wand2, TrendingDown, Lightbulb, BadgeCheck, ShoppingBag, X, MapPin, Navigation, Camera, MessageCircle, Monitor, Mail, Copy, CheckCircle, Sun, Moon, Award, Handshake, Target, Package, ListFilter, ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

import { UpgradeModal, SearchCounter } from "@/components/ui/upgrade-modal";
import { analyzeResults, sortResults, findBestScoreResult, findBestLocalResult } from "@/lib/scoring";
import { wrapAffiliateLink } from "@/lib/affiliate";
import { NewProductBanner } from "@/components/NewProductBanner";
import { AdSidebar } from "@/components/ads/AdSidebar";
import type { AnalyzedResult, CategorizedResults, SearchResult, SortOption } from "@/lib/scoring";
import { useGeolocation } from "@/hooks/useGeolocation";
import { geocodeLocation, calculateDistance, formatDistance, reverseGeocodeLocal } from "@/lib/geo";

// Interface pour le quota
interface QuotaStatus {
  isPremium: boolean;
  planType: string;
  planUntil?: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  boostCredits: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  totalRemaining: number;
}

// Extension ID - will be loaded from localStorage or env
const EXTENSION_ID_KEY = 'okaz_extension_id';

interface ExtensionResponse {
  success: boolean;
  results?: SearchResult[];
  amazonNewResults?: SearchResult[];
  version?: string;
  error?: string;
}

type SearchSite = 'leboncoin' | 'vinted' | 'backmarket' | 'amazon';

interface SearchCriteria {
  keywords: string;
  keywordsBM?: string;
  priceMin?: number;
  priceMax?: number;
  shippable?: boolean;
  ownerType?: 'private' | 'pro' | 'all';
  category?: string;
  sites?: SearchSite[];
  excludeAccessories?: boolean;
  acceptedModels?: string[];
  originalQuery: string;
}

// Briefing Pré-Chasse
interface SearchBriefing {
  newProductPrice?: {
    price: number;
    label: string;
  };
  marketPriceRange?: {
    min: number;
    max: number;
    median?: number;
    count?: number;
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

// v0.5.0 - Contexte visuel extrait de l'image
interface VisualContext {
  color?: string;
  size?: string;
  condition?: string;
  variant?: string;
}

interface OptimizeResponse {
  success: boolean;
  criteria: SearchCriteria;
  briefing?: SearchBriefing;
  visualContext?: VisualContext;
  optimizedUrl: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
}

// LA recommandation - Le TOP PICK identifié par Gemini
interface TopPick {
  id: string;
  confidence: 'high' | 'medium' | 'low';
  headline: string;
  reason: string;
  highlights: string[];
}

// Recommandation produit neuf ("Et en neuf ?")
interface NewRecommendation {
  productName: string;
  estimatedPrice?: number;
  reason: string;
  searchQuery: string;
  amazonUrl?: string;
  isRealPrice?: boolean;
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
    if (score >= 80) return "bg-[var(--score-high)]";
    if (score >= 50) return "bg-[var(--score-medium)]";
    return "bg-[var(--score-low)]";
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
  const getConfidenceStyle = () => {
    if (confidence >= 90) return { bg: 'bg-[var(--score-high)]/10', text: 'text-[var(--score-high)]', label: 'Excellent' };
    if (confidence >= 70) return { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', label: 'Bon' };
    if (confidence >= 50) return { bg: 'bg-[var(--score-medium)]/10', text: 'text-[var(--score-medium)]', label: 'Moyen' };
    return { bg: 'bg-[var(--score-low)]/10', text: 'text-[var(--score-low)]', label: 'Faible' };
  };

  const style = getConfidenceStyle();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] ${style.bg} ${style.text}`} title={matchDetails || `Confiance: ${confidence}%`}>
      <span>{confidence}%</span>
    </div>
  );
}

// Composant "LA recommandation" - Carte dorée unique
function TopRecommendation({ result, topPick }: { result: AnalyzedResult; topPick: TopPick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6"
    >
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-5 rounded-2xl bg-[var(--card-bg)] border-2 border-[var(--accent)]/30 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-200 group relative overflow-hidden"
      >
        {/* Badge "Mon choix" */}
        <div className="absolute top-0 right-0 bg-[var(--accent)] text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
          Mon choix
        </div>

        {/* Header avec headline */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <Award className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <span className="text-[var(--accent)] font-semibold text-sm">{topPick.headline}</span>
        </div>

        {/* Contenu principal */}
        <div className="flex gap-4">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] ring-2 ring-[var(--accent)]/20">
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
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
              {result.title}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                {result.price > 0 ? `${result.price.toLocaleString('fr-FR')} €` : 'Prix non indiqué'}
              </span>
              {result.analysis.dealType === 'good' && (
                <span className="px-2 py-1 text-xs font-bold bg-[var(--score-high)]/10 text-[var(--score-high)] rounded-full">
                  {result.analysis.badges.find(b => b.text.includes('%'))?.text || 'Bon prix'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Raison de la recommandation */}
        <div className="mt-4 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--separator)]">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            &ldquo;{topPick.reason}&rdquo;
          </p>
        </div>

        {/* Points forts */}
        {topPick.highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {topPick.highlights.map((highlight, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[var(--accent)]/10 text-[var(--accent)] rounded-full"
              >
                <Check className="w-3 h-3" />
                {highlight}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-end mt-4 text-[var(--accent)] text-sm font-medium">
          Voir l&apos;annonce
          <ExternalLink className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </a>
    </motion.div>
  );
}

function ResultCard({ result, index = 0, showLocalBadge = false }: { result: AnalyzedResult; index?: number; showLocalBadge?: boolean }) {
  const gemini = result.geminiAnalysis;
  const dealType = gemini?.dealType || result.analysis.dealType;
  const isLocal = (result as AnalyzedResult & { isLocal?: boolean }).isLocal;

  const dealClass = dealType === 'excellent' || dealType === 'good'
    ? 'bg-[var(--score-high)]/10 text-[var(--score-high)]'
    : dealType === 'overpriced' || dealType === 'suspicious'
    ? 'bg-[var(--score-low)]/10 text-[var(--score-low)]'
    : dealType === 'fair'
    ? 'bg-[var(--score-medium)]/10 text-[var(--score-medium)]'
    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--separator)] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow duration-200 group cursor-pointer">
          <div className="flex gap-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
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
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 py-0.5 text-[10px] text-white text-center font-medium"
                style={{ backgroundColor: result.siteColor }}
              >
                {result.site}
              </div>
              {isLocal && showLocalBadge && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[var(--score-high)] text-white text-[8px] font-bold rounded">
                  LOCAL
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                  {result.title}
                </h3>
                <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-all flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {result.price > 0 ? `${result.price.toLocaleString('fr-FR')} €` : 'Prix non indiqué'}
                </span>
                <ScoreBadge score={result.score} />
                {gemini?.confidence !== undefined && (
                  <ConfidenceIndicator confidence={gemini.confidence} matchDetails={gemini.matchDetails} />
                )}
              </div>
            </div>
          </div>

          {gemini?.matchDetails && gemini.confidence !== undefined && gemini.confidence < 70 && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-[var(--score-medium)]/5 border border-[var(--score-medium)]/10 text-[11px] text-[var(--score-medium)]">
              {gemini.matchDetails}
            </div>
          )}

          {(gemini?.explanation || result.analysis.dealText) && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${dealClass}`}>
              <span>{gemini?.explanation || result.analysis.dealText}</span>
            </div>
          )}

          {((gemini?.redFlags?.length ?? 0) > 0 || result.analysis.badges.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {gemini?.redFlags?.map((flag, i) => (
                <span
                  key={`rf-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[var(--score-low)]/10 text-[var(--score-low)]"
                >
                  <Shield className="w-3 h-3" />
                  {flag}
                </span>
              ))}
              {result.analysis.badges.map((badge, i) => (
                <span
                  key={`b-${i}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${
                    badge.type === 'positive'
                      ? 'bg-[var(--score-high)]/10 text-[var(--score-high)]'
                      : badge.type === 'warning'
                      ? 'bg-[var(--score-medium)]/10 text-[var(--score-medium)]'
                      : 'bg-[var(--score-low)]/10 text-[var(--score-low)]'
                  }`}
                >
                  {badge.type === 'danger' && <Shield className="w-3 h-3" />}
                  {badge.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </a>
    </motion.div>
  );
}

// ============================================================================
// COMPOSANTS v0.5.0 - RÉSULTATS SIMPLIFIÉS
// ============================================================================

// Carte mise en avant pour les top choices
function TopChoiceCard({
  result,
  type,
  userLocation
}: {
  result: AnalyzedResult;
  type: 'score' | 'local';
  userLocation?: { lat: number; lng: number }
}) {
  const distance = (result as AnalyzedResult & { distance?: number | null }).distance;
  const gemini = result.geminiAnalysis;
  const dealType = gemini?.dealType || result.analysis.dealType;

  const borderColor = type === 'score' ? 'border-[var(--accent)]/30 hover:border-[var(--accent)]/50' : 'border-[var(--score-high)]/30 hover:border-[var(--score-high)]/50';
  const accentText = type === 'score' ? 'text-[var(--accent)]' : 'text-[var(--score-high)]';
  const label = type === 'score' ? 'MEILLEUR SCORE' : 'MEILLEUR LOCAL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: type === 'score' ? 0 : 0.1 }}
    >
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-4 rounded-2xl bg-[var(--card-bg)] border-2 ${borderColor} shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all group h-full`}
      >
        <div className={`flex items-center gap-2 mb-3 ${accentText}`}>
          {type === 'score' ? <Award className="w-4 h-4" /> : <Handshake className="w-4 h-4" />}
          <span className="text-xs font-bold tracking-wide">{label}</span>
        </div>

        <div className="flex gap-3">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
            {result.image ? (
              <img
                src={result.image}
                alt={result.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-[var(--text-tertiary)]" />
              </div>
            )}
            <div
              className="absolute bottom-0 left-0 right-0 py-0.5 text-[9px] text-white text-center font-medium"
              style={{ backgroundColor: result.siteColor }}
            >
              {result.site}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
              {result.title}
            </h4>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xl font-bold text-[var(--text-primary)]">
                {result.price > 0 ? `${result.price.toLocaleString('fr-FR')} €` : 'Prix ?'}
              </span>
              <ScoreBadge score={result.score} />
            </div>

            <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] ${accentText}`}>
              {type === 'score' ? (
                <>
                  {dealType === 'excellent' && <><TrendingDown className="w-3 h-3" />Excellente affaire</>}
                  {dealType === 'good' && <><TrendingDown className="w-3 h-3" />Bon prix</>}
                  {dealType === 'fair' && <>Prix correct</>}
                  {!['excellent', 'good', 'fair'].includes(dealType || '') && <>Score eleve</>}
                </>
              ) : (
                <>
                  <MapPin className="w-3 h-3" />
                  {distance !== null && distance !== undefined
                    ? formatDistance(distance)
                    : result.location || 'Localisation non precisee'}
                </>
              )}
            </div>
          </div>
        </div>

        {gemini?.redFlags && gemini.redFlags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {gemini.redFlags.slice(0, 2).map((flag, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[9px] bg-[var(--score-low)]/10 text-[var(--score-low)] rounded">
                {flag}
              </span>
            ))}
          </div>
        )}
      </a>
    </motion.div>
  );
}

// Les 2 top choices côte à côte
function TopChoices({
  bestScore,
  bestLocal,
  userLocation
}: {
  bestScore: AnalyzedResult | null;
  bestLocal: AnalyzedResult | null;
  userLocation?: { lat: number; lng: number }
}) {
  // Si même résultat pour les deux, n'afficher qu'une seule carte
  const isSameResult = bestScore && bestLocal && bestScore.id === bestLocal.id;

  if (!bestScore && !bestLocal) return null;

  return (
    <div className="mb-6">
      <div className={`grid ${isSameResult || (!bestScore || !bestLocal) ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4`}>
        {bestScore && (
          <TopChoiceCard result={bestScore} type="score" userLocation={userLocation} />
        )}
        {bestLocal && !isSameResult && (
          <TopChoiceCard result={bestLocal} type="local" userLocation={userLocation} />
        )}
      </div>
    </div>
  );
}

// Barre de tri
function SortBar({
  currentSort,
  onSortChange,
  hasGeoloc
}: {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  hasGeoloc: boolean
}) {
  const options: { value: SortOption; label: string; icon?: React.ReactNode }[] = [
    { value: 'score', label: 'Score' },
    { value: 'price_asc', label: 'Prix ↑' },
    { value: 'price_desc', label: 'Prix ↓' },
  ];

  if (hasGeoloc) {
    options.push({ value: 'distance', label: 'Distance' });
  }

  return (
    <div className="flex items-center gap-1 text-xs bg-[var(--bg-secondary)] rounded-full p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onSortChange(opt.value)}
          className={`px-3 py-1.5 rounded-full transition-all ${
            currentSort === opt.value
              ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm font-medium'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Section "Plus de résultats" repliable
function MoreResultsSection({
  results,
  excludeIds,
  userLocation
}: {
  results: AnalyzedResult[];
  excludeIds: string[];
  userLocation?: { lat: number; lng: number }
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('score');

  // Exclure les top picks
  const otherResults = results.filter(r => !excludeIds.includes(r.id));

  if (otherResults.length === 0) return null;

  // Calculer les distances si géoloc active (nécessaire pour tri par distance)
  const resultsWithDistance = userLocation
    ? otherResults.map(result => {
        if (!result.location) {
          // Si isLocal, assigner une distance par défaut (15km)
          if (result.isLocal) return { ...result, distance: 15 };
          return { ...result, distance: null as number | null };
        }
        const coords = geocodeLocation(result.location);
        if (!coords) {
          if (result.isLocal) return { ...result, distance: 15 };
          return { ...result, distance: null as number | null };
        }
        const distance = calculateDistance(userLocation, coords.coords);
        return { ...result, distance };
      })
    : otherResults;

  // Trier les résultats
  const sortedResults = sortResults(resultsWithDistance, sortBy, userLocation);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="mt-6"
    >
      {/* Header cliquable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Plus de resultats
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">({otherResults.length})</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
        </motion.div>
      </button>

      {/* Contenu repliable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Barre de tri */}
            <div className="py-3">
              <SortBar
                currentSort={sortBy}
                onSortChange={setSortBy}
                hasGeoloc={!!userLocation}
              />
            </div>

            {/* Liste des résultats */}
            <div className="space-y-3">
              {sortedResults.map((result, index) => (
                <ResultCard key={result.id} result={result} index={index} showLocalBadge={!!userLocation} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        <Handshake className="w-4 h-4 text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Main propre
          <span className="text-[var(--text-tertiary)] font-normal ml-2">({results.length})</span>
        </h3>
      </div>

      {/* Meilleur deal main propre - Carte mise en avant */}
      {bestDeal && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <a
            href={bestDeal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-2xl bg-[var(--card-bg)] border-2 border-[var(--score-high)]/30 hover:border-[var(--score-high)]/50 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all group relative overflow-hidden"
          >
            {/* Badge "Meilleur deal" */}
            <div className="absolute top-0 right-0 bg-[var(--score-high)] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> MEILLEUR DEAL</span>
            </div>

            <div className="flex gap-4">
              <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] ring-2 ring-[var(--score-high)]/20">
                {bestDeal.image ? (
                  <img
                    src={bestDeal.image}
                    alt={bestDeal.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
                  </div>
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 py-0.5 text-[10px] text-white text-center font-medium"
                  style={{ backgroundColor: bestDeal.siteColor }}
                >
                  {bestDeal.site}
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-2">
                <h4 className="text-base font-semibold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                  {bestDeal.title}
                </h4>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    {bestDeal.price > 0 ? `${bestDeal.price.toLocaleString('fr-FR')} €` : 'Prix sur demande'}
                  </span>
                  <ScoreBadge score={bestDeal.score} />
                </div>

                {/* Infos localisation */}
                <div className="flex items-center gap-2 mt-2 text-xs text-[var(--score-high)]">
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

              <ExternalLink className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 mt-2" />
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
              {userLocation && result.distance !== null && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] rounded-full flex items-center gap-1 border border-[var(--accent)]/20">
                  <MapPin className="w-3 h-3" />
                  {formatDistance(result.distance)}
                </div>
              )}
              {(result as AnalyzedResult & { isLocal?: boolean }).isLocal && (
                <div className="absolute top-4 left-4 px-2 py-1 bg-[var(--score-high)]/10 text-[var(--score-high)] text-[10px] rounded-full flex items-center gap-1 border border-[var(--score-high)]/20">
                  <Navigation className="w-3 h-3" />
                  Pres de vous
                </div>
              )}
              {!userLocation && result.location && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[10px] rounded-full border border-[var(--separator)]">
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

function SearchResults({ data, onBack }: { data: { query: string; categorized: CategorizedResults; totalResults: number; duration: number; criteria?: SearchCriteria; topPick?: TopPick; userLocation?: { lat: number; lng: number }; newRecommendation?: NewRecommendation | null; briefing?: SearchBriefing | null }; onBack: () => void }) {
  const { categorized, totalResults, duration, query, criteria, topPick, userLocation, newRecommendation, briefing } = data;
  const { results } = categorized;

  // v0.5.0 - Nouveau layout simplifié avec 2 top choices
  // Trouver le meilleur score et le meilleur local (différent du meilleur score)
  const bestScore = findBestScoreResult(results);
  let bestLocal = findBestLocalResult(results, userLocation);
  // Si le meilleur local est le même que le meilleur score, chercher le 2ème meilleur local
  if (bestLocal && bestScore && bestLocal.id === bestScore.id) {
    const otherLocals = results.filter(r => r.id !== bestScore.id);
    bestLocal = findBestLocalResult(otherLocals, userLocation);
  }

  // IDs à exclure de la section "Plus de résultats"
  const excludeIds: string[] = [];
  if (bestScore) excludeIds.push(bestScore.id);
  if (bestLocal && bestLocal.id !== bestScore?.id) excludeIds.push(bestLocal.id);

  const wasOptimized = criteria && criteria.keywords !== criteria.originalQuery;


  return (
    <div>
      {/* Résultats - pleine largeur */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">OKAZ</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)] space-y-2"
        >
          <div>
            <div className="text-sm text-[var(--text-secondary)]">Recherche :</div>
            <div className="text-[var(--text-primary)] font-medium">{query}</div>
          </div>

          {wasOptimized && criteria && (
            <div className="pt-2 border-t border-[var(--separator)]">
              <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
                <Wand2 className="w-3 h-3" />
                Optimise par IA
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded text-[var(--text-secondary)]">
                  {criteria.keywords}
                </span>
                {criteria.priceMax && (
                  <span className="text-xs bg-[var(--score-high)]/10 px-2 py-0.5 rounded text-[var(--score-high)]">
                    Max {criteria.priceMax}€
                  </span>
                )}
                {criteria.priceMin && (
                  <span className="text-xs bg-[var(--accent)]/10 px-2 py-0.5 rounded text-[var(--accent)]">
                    Min {criteria.priceMin}€
                  </span>
                )}
                {criteria.shippable && (
                  <span className="text-xs bg-[var(--accent)]/10 px-2 py-0.5 rounded text-[var(--accent)]">
                    Livrable
                  </span>
                )}
                {criteria.ownerType === 'private' && (
                  <span className="text-xs bg-[var(--score-medium)]/10 px-2 py-0.5 rounded text-[var(--score-medium)]">
                    Particulier
                  </span>
                )}
                {criteria.category && (
                  <span className="text-xs bg-[var(--accent)]/10 px-2 py-0.5 rounded text-[var(--accent)]">
                    {criteria.category}
                  </span>
                )}
              </div>
              {criteria.sites && criteria.sites.length < 3 && (
                <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-tertiary)]">
                  <span>Sites:</span>
                  {criteria.sites.map(site => (
                    <span key={site} className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
                      {site === 'leboncoin' ? 'LBC' : site === 'vinted' ? 'Vinted' : 'BackMarket'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-[var(--text-tertiary)]">
            {totalResults} resultat{totalResults > 1 ? 's' : ''} en {(duration / 1000).toFixed(1)}s
          </div>
        </motion.div>

        {/* Briefing prix — persistant sur la page de résultats */}
        {totalResults > 0 && briefing && (briefing.newProductPrice || briefing.marketPriceRange) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2"
          >
            {briefing.newProductPrice && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--score-high)]/10 border border-[var(--score-high)]/20">
                <ShoppingBag className="w-3.5 h-3.5 text-[var(--score-high)]" />
                <span className="text-xs text-[var(--score-high)] font-medium">Neuf : {briefing.newProductPrice.label}</span>
              </div>
            )}
            {briefing.marketPriceRange && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                <TrendingDown className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-xs text-[var(--accent)] font-medium">
                  Occasion : mediane {briefing.marketPriceRange.median}€
                  {briefing.marketPriceRange.count && (
                    <span className="text-[var(--accent)]/50 ml-1">({briefing.marketPriceRange.count} annonces)</span>
                  )}
                </span>
              </div>
            )}
            {briefing.warningPrice > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--score-low)]/10 border border-[var(--score-low)]/20">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--score-low)]" />
                <span className="text-xs text-[var(--score-low)] font-medium">{briefing.warningText}</span>
              </div>
            )}
          </motion.div>
        )}

        {totalResults === 0 && (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Aucun resultat trouve pour cette recherche</p>
          </div>
        )}

        {/* v0.5.0 - Top Choices: Meilleur Score + Meilleur Local */}
        {totalResults > 0 && (
          <TopChoices
            bestScore={bestScore}
            bestLocal={bestLocal}
            userLocation={userLocation}
          />
        )}

        {/* v0.5.0 - Section "Plus de résultats" repliable */}
        <MoreResultsSection
          results={results}
          excludeIds={excludeIds}
          userLocation={userLocation}
        />

        {/* Bandeau "Et en neuf ?" - Recommandation Gemini */}
        {newRecommendation && (
          <NewProductBanner
            productName={newRecommendation.productName}
            estimatedPrice={newRecommendation.estimatedPrice}
            reason={newRecommendation.reason}
            searchQuery={newRecommendation.searchQuery}
            amazonUrl={newRecommendation.amazonUrl}
            isRealPrice={newRecommendation.isRealPrice}
          />
        )}

        {/* Mention légale affiliation */}
        {totalResults > 0 && (
          <p className="mt-8 text-center text-[11px] text-[var(--text-tertiary)] leading-relaxed px-4">
            Certains liens sont affiliés : si vous achetez via ces liens, OKAZ touche
            une petite commission qui aide à couvrir les frais du service.
            L&apos;affiliation n&apos;affecte en rien le classement et le scoring des résultats.
          </p>
        )}
      </div>

    </div>
  );
}

// Composant Briefing Pré-Chasse - Affiché pendant le loading
function LoadingBriefing({ briefing, searchPhase }: { briefing: SearchBriefing | null; searchPhase: 'optimizing' | 'searching' | 'analyzing' }) {
  const [visibleCards, setVisibleCards] = useState(0);
  const hasStartedRef = useRef(false);

  // Afficher les cartes progressivement - ne jamais revenir en arrière
  useEffect(() => {
    if (!briefing || searchPhase === 'optimizing') {
      return;
    }

    // Si on a déjà commencé à afficher, ne pas reset
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    // Afficher carte 1 immédiatement quand la recherche commence
    setVisibleCards(1);

    // Carte 2 après 2 secondes
    const timer1 = setTimeout(() => setVisibleCards(2), 2000);

    // Carte 3 après 5 secondes
    const timer2 = setTimeout(() => setVisibleCards(3), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [briefing, searchPhase]);

  // Reset le ref quand le briefing change (nouvelle recherche)
  useEffect(() => {
    if (!briefing) {
      hasStartedRef.current = false;
      setVisibleCards(0);
    }
  }, [briefing]);

  if (!briefing || searchPhase === 'optimizing') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 mt-4"
    >
      {/* Carte 1: Prix neuf */}
      {visibleCards >= 1 && briefing.newProductPrice && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--score-high)]/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4 h-4 text-[var(--score-high)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--score-high)]">Prix neuf</p>
              <p className="text-[var(--text-primary)] font-semibold">{briefing.newProductPrice.label}</p>
              {briefing.warningText && (
                <p className="text-xs text-[var(--score-low)] mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {briefing.warningText}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Carte 2: Tips contextuels */}
      {visibleCards >= 2 && briefing.tips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--score-medium)]/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-[var(--score-medium)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--score-medium)]">Conseil</p>
              <ul className="mt-1 space-y-1">
                {briefing.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-[var(--text-primary)] flex items-start gap-2">
                    <span className="text-[var(--score-medium)]">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Carte 3: Prix du marché occasion */}
      {visibleCards >= 3 && briefing.marketPriceRange && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--accent)]">Prix du marche occasion</p>
              <p className="text-[var(--text-primary)] font-semibold">{briefing.marketPriceRange.label}</p>
              {briefing.marketPriceRange.count && (
                <p className="text-xs text-[var(--accent)]/60 mt-1 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  Base sur {briefing.marketPriceRange.count} annonces reelles
                </p>
              )}
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
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
          <Settings className="w-8 h-8 text-[var(--accent)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Configuration requise</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Connectez l&apos;extension Chrome pour utiliser OKAZ
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            ID de l&apos;extension Chrome
          </label>
          <input
            type="text"
            value={extensionId}
            onChange={(e) => setExtensionId(e.target.value)}
            placeholder="Ex: abcdefghijklmnopqrstuvwxyz123456"
            className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--separator)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          />
        </div>

        <div className="text-xs text-[var(--text-tertiary)] space-y-1">
          <p>Pour trouver l&apos;ID :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Ouvrez <code className="bg-[var(--bg-tertiary)] px-1 rounded">chrome://extensions</code></li>
            <li>Activez le &quot;Mode developpeur&quot;</li>
            <li>Trouvez &quot;OKAZ&quot; et copiez l&apos;ID</li>
          </ol>
        </div>

        {testResult === 'error' && (
          <div className="p-3 bg-[var(--score-low)]/10 border border-[var(--score-low)]/20 rounded-xl text-[var(--score-low)] text-sm">
            Connexion echouee. Verifiez que l&apos;extension est installee et l&apos;ID est correct.
          </div>
        )}

        {testResult === 'success' && (
          <div className="p-3 bg-[var(--score-high)]/10 border border-[var(--score-high)]/20 rounded-xl text-[var(--score-high)] text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Extension connectee avec succes !
          </div>
        )}

        <button
          onClick={testConnection}
          disabled={!extensionId.trim() || testing}
          className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium transition-all"
        >
          {testing ? 'Test en cours...' : 'Tester la connexion'}
        </button>
      </div>
    </div>
  );
}

// Detection mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
        || (window.innerWidth < 768 && 'ontouchstart' in window);
      setIsMobile(mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// Page mobile : explique le produit + redirige vers desktop
function MobileLanding() {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState('');

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://okaz-ia.fr';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silencieux */ }
  };

  const handleSendEmail = () => {
    if (!email || !email.includes('@')) return;
    const subject = encodeURIComponent('OKAZ - Lien pour ton ordinateur');
    const body = encodeURIComponent(`Ouvre ce lien sur ton PC pour utiliser OKAZ :\n\n${siteUrl}\n\nTu auras besoin de l'extension Chrome pour commencer.`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    setEmailSent(true);
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <div className="container mx-auto px-6 py-12 max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">OKAZ</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-10">
            Comparateur intelligent de petites annonces
          </p>

          {/* Explication */}
          <GlassCard variant="bordered" className="p-6 text-left mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Disponible sur ordinateur</h2>
                <p className="text-xs text-[var(--text-secondary)]">Extension Chrome requise</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
              OKAZ utilise une extension Chrome pour comparer les prix sur LeBonCoin, Vinted, Back Market et Amazon en temps reel. Cette technologie necessite un navigateur desktop.
            </p>

            {/* Comment ca marche */}
            <div className="space-y-3 mb-5">
              {[
                { icon: '1', text: 'Installe l\'extension Chrome sur ton PC' },
                { icon: '2', text: 'Decris ce que tu cherches ou uploade une photo' },
                { icon: '3', text: 'L\'IA compare les prix et te trouve la meilleure affaire' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.icon}
                  </span>
                  <p className="text-sm text-[var(--text-primary)]">{step.text}</p>
                </div>
              ))}
            </div>

            {/* Sites compares */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--separator)]">
              {[
                { name: "leboncoin", color: "#FF6E14" },
                { name: "Vinted", color: "#09B1BA" },
                { name: "Back Market", color: "#4D3DF7" },
                { name: "Amazon", color: "#DAA520" },
              ].map((site) => (
                <span key={site.name} className="text-xs font-semibold opacity-70" style={{ color: site.color }}>
                  {site.name}
                </span>
              ))}
            </div>
          </GlassCard>

          {/* Actions */}
          <GlassCard variant="bordered" className="p-5 mb-6">
            <p className="text-xs text-[var(--text-secondary)] mb-4">Envoie-toi le lien pour ouvrir sur ton PC</p>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-all mb-3"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Lien copie !
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copier le lien
                </>
              )}
            </button>

            <div className="flex gap-2">
              <input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--separator)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleSendEmail}
                disabled={!email || emailSent}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--separator)] text-[var(--text-primary)] text-sm transition-all disabled:opacity-40"
              >
                {emailSent ? <Check className="w-4 h-4 text-[var(--score-high)]" /> : <Mail className="w-4 h-4" />}
              </button>
            </div>
          </GlassCard>

          {/* Footer */}
          <p className="text-xs text-[var(--text-tertiary)]">
            Un projet{' '}
            <a href="https://facile-ia.fr" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline transition-colors font-medium">
              Facile-IA
            </a>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function Home() {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchData, setSearchData] = useState<{ query: string; categorized: CategorizedResults; totalResults: number; duration: number; criteria?: SearchCriteria; topPick?: TopPick; userLocation?: { lat: number; lng: number }; newRecommendation?: NewRecommendation | null; briefing?: SearchBriefing | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [currentCriteria, setCurrentCriteria] = useState<SearchCriteria | null>(null);
  const [currentBriefing, setCurrentBriefing] = useState<SearchBriefing | null>(null);
  const [searchPhase, setSearchPhase] = useState<'idle' | 'optimizing' | 'searching' | 'analyzing'>('idle');

  // v0.5.0 - États pour recherche enrichie
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; name: string } | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [showReferenceInput, setShowReferenceInput] = useState(false);
  const [currentVisualContext, setCurrentVisualContext] = useState<VisualContext | null>(null);
  const [clarificationData, setClarificationData] = useState<{ question: string; options?: string[]; originalQuery: string; history: Array<{ question: string; answer: string }> } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Hook géolocalisation (doit être avant les effets qui l'utilisent)
  const { position, permissionState, isLoading: geoLoading, requestPermission } = useGeolocation({ enableHighAccuracy: true });

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

  // Auto-request position si géoloc activée mais position pas encore dispo (cache expiré)
  useEffect(() => {
    if (geolocEnabled && !position && permissionState === 'granted' && !geoLoading) {
      console.log('[OKAZ] Geoloc activée mais position null (cache expiré?), re-request...');
      requestPermission();
    }
  }, [geolocEnabled, position, permissionState, geoLoading, requestPermission]);

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

  // Gérer les retours d'auth (magic link) et de paiement (Stripe)
  // Auth via fragment hash (#auth=success&token=JWT), Stripe via query params
  useEffect(() => {
    if (!extensionConnected || !extensionId) return;

    const params = new URLSearchParams(window.location.search);

    // Retour magic link: #auth=success&token=JWT&email=xxx (fragment hash pour securite)
    const hash = window.location.hash;
    if (hash.includes('auth=success')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const token = hashParams.get('token');
      const email = hashParams.get('email');

      if (token && email) {
        console.log('[OKAZ] Auth magic link réussie pour:', email);
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId, {
          type: 'SAVE_AUTH',
          jwt: token,
          email,
          premiumUntil: null,
        }, () => {
          fetchQuotaFromExtension();
        });
      }

      // Nettoyer l'URL (hash inclus)
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Retour auth erreur: #auth=error&reason=xxx
    if (hash.includes('auth=error')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const reason = hashParams.get('reason');
      const messages: Record<string, string> = {
        invalid_token: 'Lien de connexion invalide',
        expired: 'Lien de connexion expiré (15 min)',
        already_used: 'Ce lien a déjà été utilisé',
        user_not_found: 'Compte introuvable',
        missing_token: 'Lien de connexion incomplet',
        server_error: 'Erreur serveur, réessayez',
      };
      setError(messages[reason || ''] || 'Erreur de connexion');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Retour Stripe boost: ?boost=success
    if (params.get('boost') === 'success') {
      console.log('[OKAZ] Achat boost réussi');
      setTimeout(() => {
        fetchQuotaFromExtension();
      }, 2000);

      window.history.replaceState({}, '', window.location.pathname);
    }

    // Retour Stripe premium: ?premium=success&email=xxx
    if (params.get('premium') === 'success') {
      const email = params.get('email');
      console.log('[OKAZ] Achat premium réussi pour:', email);
      setTimeout(() => {
        fetchQuotaFromExtension();
      }, 2000);

      window.history.replaceState({}, '', window.location.pathname);
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

  const handleBuyPlan = async (planType: 'pro' | 'premium') => {
    const email = window.prompt('Entrez votre email pour votre abonnement:');
    if (!email || !email.includes('@')) {
      return;
    }

    setIsUpgrading(true);
    try {
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
          uuid: uuidResponse?.uuid || '',
          planType,
        }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Erreur checkout');
      }
    } catch (err) {
      console.error('[OKAZ] Erreur achat plan:', err);
      setError('Erreur lors de la création du paiement');
      setShowUpgradeModal(false);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Gérer l'abonnement via Stripe Customer Portal
  const handleManageSubscription = async () => {
    try {
      // @ts-ignore
      const uuidResponse = await new Promise<{ success: boolean; uuid?: string }>((resolve) => {
        // @ts-ignore
        chrome.runtime.sendMessage(extensionId, { type: 'GET_UUID' }, resolve);
      });

      if (!uuidResponse?.uuid) return;

      const response = await fetch('/api/checkout/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuidResponse.uuid }),
      });

      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        console.error('[OKAZ] Portal error:', data.error);
      }
    } catch (err) {
      console.error('[OKAZ] Erreur portal:', err);
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
    setCurrentVisualContext(null);
    setSearchData(null); // Reset les résultats précédents
  };

  // v0.5.0 - Gestion de l'upload d'image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite: 4MB
    if (file.size > 4 * 1024 * 1024) {
      setError('Image trop grande (max 4MB)');
      return;
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      setError('Fichier non supporté (image uniquement)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]; // Enlever le préfixe data:image/xxx;base64,
      setUploadedImage({ base64, name: file.name });
      setError(null);
    };
    reader.onerror = () => {
      setError('Erreur lors de la lecture de l\'image');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSearch = async (searchQuery?: string, _unused?: undefined, clarificationHistory?: Array<{ question: string; answer: string }>) => {
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
    setClarificationData(null);
    setSearchPhase('optimizing');

    const startTime = Date.now();

    try {
      // Étape 1: Optimiser la requête via Gemini
      console.log('[OKAZ] ====== DÉBUT RECHERCHE ======');
      const t0 = Date.now();
      console.log('[OKAZ] 1. Optimisation Gemini en cours...');
      console.log('[OKAZ] Requête:', q);
      let criteria: SearchCriteria;
      let visualContext: VisualContext | undefined; // v0.5.0 - Contexte visuel pour l'analyse

      try {
        console.log('[OKAZ] 1a. Appel API /api/optimize...');
        // v0.5.0 - Inclure image et URL de référence si présents
        const optimizePayload: { query: string; imageBase64?: string; referenceUrl?: string; clarifications?: Array<{ question: string; answer: string }> } = {
          query: q.trim()
        };
        if (uploadedImage?.base64) {
          optimizePayload.imageBase64 = uploadedImage.base64;
          console.log('[OKAZ] 1a. Image incluse:', uploadedImage.name);
        }
        if (referenceUrl.trim()) {
          optimizePayload.referenceUrl = referenceUrl.trim();
          console.log('[OKAZ] 1a. URL de référence:', referenceUrl);
        }
        if (clarificationHistory && clarificationHistory.length > 0) {
          optimizePayload.clarifications = clarificationHistory;
          console.log('[OKAZ] 1a. Clarifications précédentes:', clarificationHistory.length);
        }

        const optimizeRes = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(optimizePayload),
        });
        console.log('[OKAZ] 1b. Réponse reçue, parsing JSON...');
        const optimizeData: OptimizeResponse = await optimizeRes.json();
        console.log('[OKAZ] 1c. Données:', optimizeData);

        if (optimizeData.success && optimizeData.criteria) {
          // Intercepter si Gemini demande une clarification (max 2 rounds)
          const currentHistory = clarificationHistory || [];
          if (optimizeData.needsClarification && optimizeData.clarificationQuestion && currentHistory.length < 2) {
            console.log('[OKAZ] 1d. ⚠ Clarification demandée (round ' + (currentHistory.length + 1) + '/2):', optimizeData.clarificationQuestion);
            console.log('[OKAZ] 1d. Options:', optimizeData.clarificationOptions);
            setClarificationData({
              question: optimizeData.clarificationQuestion,
              options: optimizeData.clarificationOptions || undefined,
              originalQuery: q,
              history: currentHistory,
            });
            setIsSearching(false);
            setIsOptimizing(false);
            setSearchPhase('idle');
            return;
          }

          criteria = optimizeData.criteria;
          console.log('[OKAZ] 1d. ✓ Critères optimisés:', criteria);
          // Stocker le briefing s'il existe
          if (optimizeData.briefing) {
            console.log('[OKAZ] 1e. ✓ Briefing reçu:', optimizeData.briefing);
            setCurrentBriefing(optimizeData.briefing);
          }
          // v0.5.0 - Stocker le contexte visuel (couleur, taille...)
          if (optimizeData.visualContext) {
            console.log('[OKAZ] 1f. ✓ Contexte visuel:', optimizeData.visualContext);
            setCurrentVisualContext(optimizeData.visualContext);
            visualContext = optimizeData.visualContext; // Capture locale pour le callback
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

      const t1 = Date.now();
      console.log(`[OKAZ] ⏱ OPTIMIZE: ${((t1 - t0) / 1000).toFixed(1)}s`);
      console.log('[OKAZ] 2. Gemini terminé, critères finaux:', criteria);
      if (visualContext) {
        console.log('[OKAZ] 2a. Contexte visuel à passer à l\'analyse:', visualContext);
      }
      setCurrentCriteria(criteria);
      setIsOptimizing(false);
      setSearchPhase('searching');

      // Étape 2: Envoyer les critères à l'extension
      // Si géoloc activée mais position null (cache expiré, refresh en cours), attendre max 3s
      if (geolocEnabledRef.current && !positionRef.current) {
        console.log('[OKAZ] 2b. Géoloc activée mais position null, attente refresh (max 3s)...');
        await new Promise<void>((resolve) => {
          const start = Date.now();
          const interval = setInterval(() => {
            if (positionRef.current || Date.now() - start > 3000) {
              clearInterval(interval);
              if (positionRef.current) {
                console.log('[OKAZ] 2b. Position récupérée après', Date.now() - start, 'ms');
              } else {
                console.log('[OKAZ] 2b. Timeout 3s, recherche sans géoloc');
              }
              resolve();
            }
          }, 100);
        });
      }
      const userLoc = geolocEnabledRef.current && positionRef.current ? positionRef.current : undefined;
      const geoInfo = userLoc ? reverseGeocodeLocal(userLoc) : undefined;
      const searchCriteria = {
        ...criteria,
        userLocation: userLoc,
        userCityName: geoInfo?.cityName,
        userPostalCode: geoInfo?.postalCode
      };

      console.log('[OKAZ] 3. Envoi à l\'extension MAINTENANT...');
      console.log('[OKAZ] 3a. Keywords:', criteria.keywords);
      console.log('[OKAZ] 3b. PriceMax:', criteria.priceMax);
      console.log('[OKAZ] 3c. Shippable:', criteria.shippable);
      console.log('[OKAZ] 3d. UserLocation:', searchCriteria.userLocation ? `OUI (lat=${searchCriteria.userLocation.lat}, lng=${searchCriteria.userLocation.lng})` : 'NON');
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
          const t2 = Date.now();
          console.log(`[OKAZ] ⏱ SCRAPING: ${((t2 - t1) / 1000).toFixed(1)}s`);
          console.log('[OKAZ] 4. Résultats reçus de l\'extension:', response.results.length);

          // Extraire les résultats Amazon Neuf (séparés des résultats occasion)
          const amazonNewResults: SearchResult[] = response.amazonNewResults || [];
          if (amazonNewResults.length > 0) {
            console.log(`[OKAZ] 4. Amazon Neuf: ${amazonNewResults.length} résultats (prix ref)`);
          }

          // Debug: compter les résultats locaux avant dédup
          const localCount = response.results.filter((r: { isLocal?: boolean }) => r.isLocal).length;
          const nationalCount = response.results.filter((r: { isLocal?: boolean; site?: string }) => !r.isLocal && r.site === 'LeBonCoin').length;
          console.log(`[OKAZ] 4a. Avant dédup: ${localCount} locaux, ${nationalCount} nationaux LBC, ${response.results.length - localCount - nationalCount} autres`);

          // Dédupliquer par URL (les variantes de keywords retournent souvent les mêmes résultats)
          const seenUrls = new Set<string>();
          const uniqueResults = response.results.filter((r: { url?: string }) => {
            if (!r.url || seenUrls.has(r.url)) return false;
            seenUrls.add(r.url);
            return true;
          });
          const dedupCount = response.results.length - uniqueResults.length;
          if (dedupCount > 0) {
            console.log(`[OKAZ] 4b. Dédupliqué: ${dedupCount} doublons supprimés → ${uniqueResults.length} résultats uniques`);
          }

          // Analyser TOUS les résultats (test perf — pas de cap)
          const resultsForAnalysis = uniqueResults;
          console.log(`[OKAZ] 4c. Analyse de TOUS les ${uniqueResults.length} résultats (pas de cap)`);

          // Calculer les stats de prix réels à partir des résultats scrapés
          const scrapedPrices = uniqueResults.map((r: { price?: number }) => r.price || 0).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);
          let priceStats: { median: number; min: number; max: number; count: number } | null = null;
          if (scrapedPrices.length > 0) {
            const mid = Math.floor(scrapedPrices.length / 2);
            const median = scrapedPrices.length % 2 === 0
              ? Math.round((scrapedPrices[mid - 1] + scrapedPrices[mid]) / 2)
              : scrapedPrices[mid];
            priceStats = {
              median,
              min: scrapedPrices[0],
              max: scrapedPrices[scrapedPrices.length - 1],
              count: scrapedPrices.length,
            };
            console.log(`[OKAZ] 4d. Prix réels: médiane=${median}€, min=${priceStats.min}€, max=${priceStats.max}€ (${priceStats.count} annonces)`);
          }

          // Étape 3: Analyser les résultats avec Gemini
          const t3 = Date.now();
          console.log('[OKAZ] 5. Analyse Gemini des résultats...', resultsForAnalysis.length, 'résultats');
          setSearchPhase('analyzing');
          let geminiAnalysis: Record<string, { relevant?: boolean; confidence?: number; matchDetails?: string; correctedPrice?: number; marketPrice?: number; dealScore?: number; dealType?: string; explanation?: string; redFlags?: string[] }> = {};
          let topPick: TopPick | undefined;

          try {
            // v0.5.0 - Passer le contexte visuel + prix réels pour ajuster le scoring
            const analyzeRes = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: resultsForAnalysis, query: q, visualContext, priceStats }),
            });
            const analyzeData: AnalyzeResponse = await analyzeRes.json();

            console.log('[OKAZ] 5a. Réponse API analyze:', analyzeData);

            if (analyzeData.success && analyzeData.analyzed) {
              console.log('[OKAZ] 5b. ✓ Analyse Gemini terminée:', analyzeData.analyzed.length);
              // Créer un map id -> analyse
              analyzeData.analyzed.forEach((a) => {
                geminiAnalysis[a.id] = a;
                // Debug: afficher confidence et dealScore de chaque résultat
                console.log(`[OKAZ] Gemini analyse ${a.id}: confidence=${a.confidence}%, relevant=${a.relevant}, dealScore=${a.dealScore}, matchDetails="${a.matchDetails}"`);
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
          const t4 = Date.now();
          console.log(`[OKAZ] ⏱ ANALYZE: ${((t4 - t3) / 1000).toFixed(1)}s`);

          // Appliquer les corrections Gemini
          // 1. Filtrer si confidence < 30% (vraiment hors-sujet)
          // 2. Pondérer le score par la pertinence : scoreFinal = score × (confidence/100)
          const MIN_CONFIDENCE = 30; // Seuil minimum pour afficher

          // Debug: lister les IDs pour vérifier le matching
          console.log('[OKAZ] IDs extension:', uniqueResults.map((r: { id: string }) => r.id));
          console.log('[OKAZ] IDs Gemini:', Object.keys(geminiAnalysis));

          // Utiliser uniqueResults (dédupliqués) — seuls les résultats envoyés à Gemini ont une analyse
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const correctedResults = (uniqueResults as any[]).map((r: any) => {
            const analysis = geminiAnalysis[r.id];
            const confidence = analysis?.confidence ?? 50;

            if (!analysis) {
              console.warn(`[OKAZ] ⚠ Pas d'analyse Gemini pour ID: ${r.id} - "${r.title}"`);
            }

            // Filtrer : confidence < 30% = hors-sujet, on masque
            const isRelevant = confidence >= MIN_CONFIDENCE;

            // Score basé sur le dealScore Gemini (1-10 → 10-100)
            let finalScore: number;
            if (analysis?.dealScore) {
              finalScore = analysis.dealScore * 10;
            } else {
              finalScore = r.score || 50;
            }

            // Bonus/malus léger basé sur la confidence (±10 pts max)
            if (confidence >= 90) finalScore = Math.min(100, finalScore + 5);
            else if (confidence < 50) finalScore = Math.max(10, finalScore - 10);

            console.log(`[OKAZ] Résultat ${r.id}: confidence=${confidence}%, dealScore=${analysis?.dealScore || '-'}, finalScore=${finalScore} → ${isRelevant ? 'GARDÉ' : 'FILTRÉ'}`);

            return {
              ...r,
              url: wrapAffiliateLink(r.url),
              price: analysis?.correctedPrice || r.price,
              score: finalScore,
              geminiAnalysis: analysis,
              relevant: isRelevant
            };
          }).filter(r => r.relevant);

          // Garder uniquement les 30 meilleurs résultats (triés par score final)
          const MAX_DISPLAY = 30;
          const sortedResults = correctedResults.sort((a, b) => b.score - a.score);
          const topResults30 = sortedResults.slice(0, MAX_DISPLAY);
          if (correctedResults.length > MAX_DISPLAY) {
            console.log(`[OKAZ] 5d. Top ${MAX_DISPLAY} résultats gardés sur ${correctedResults.length} pertinents`);
          }

          const duration = Date.now() - startTime;
          const categorized = analyzeResults(topResults30, q);

          // Construire le briefing final avec les prix réels du marché
          const finalBriefing: SearchBriefing | null = currentBriefing ? {
            ...currentBriefing,
            ...(priceStats ? {
              marketPriceRange: {
                min: priceStats.min,
                max: priceStats.max,
                median: priceStats.median,
                count: priceStats.count,
                label: `${priceStats.min}-${priceStats.max}€ (médiane ${priceStats.median}€)`,
              },
            } : {}),
          } : priceStats ? {
            marketPriceRange: {
              min: priceStats.min,
              max: priceStats.max,
              median: priceStats.median,
              count: priceStats.count,
              label: `${priceStats.min}-${priceStats.max}€ (médiane ${priceStats.median}€)`,
            },
            warningPrice: 0,
            warningText: '',
            tips: [],
          } : null;

          // Construire la recommandation "Et en neuf ?" AVANT l'affichage
          // Priorité : données Amazon scrapées réelles > fallback Gemini (async)
          let initialNewRec: NewRecommendation | null = null;
          let displayBriefing = finalBriefing;

          const amazonNewWithPrice = amazonNewResults.filter((r: SearchResult) => r.price > 0);
          if (amazonNewWithPrice.length > 0 && correctedResults.length > 0) {
            // DONNÉES RÉELLES : filtrer par pertinence titre puis prendre le moins cher
            // Extraire les mots-clés significatifs de la requête (>= 2 chars, ignorer mots courants)
            const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'et', 'ou', 'pour', 'pas', 'sur', 'par', 'avec', 'dans', 'bon', 'etat', 'neuf', 'occasion', 'cher', 'prix', 'livrable']);
            const queryTerms = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .split(/[\s,;:!?.\-_/]+/)
              .filter(w => w.length >= 2 && !stopWords.has(w));

            // Scorer chaque résultat Amazon par correspondance avec la requête
            const scored = amazonNewWithPrice.map((r: SearchResult) => {
              const titleNorm = r.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const matchCount = queryTerms.filter(term => titleNorm.includes(term)).length;
              const matchRatio = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
              return { result: r, matchRatio, matchCount };
            });

            // Filtrer : garder ceux qui matchent au moins 75% des termes
            const relevant = scored.filter(s => s.matchRatio >= 0.75);
            // Si aucun résultat suffisamment pertinent, ne pas forcer un mauvais match → fallback Gemini
            if (relevant.length === 0) {
              console.log(`[OKAZ] 7. Aucun résultat Amazon ne matche >= 75% (meilleur: ${Math.round((scored[0]?.matchRatio || 0) * 100)}%), fallback Gemini`);
            }
            const candidates = relevant;

            if (candidates.length > 0) {
              // Parmi les candidats pertinents, prendre le moins cher
              candidates.sort((a, b) => {
                // D'abord par pertinence décroissante, puis par prix croissant
                if (a.matchRatio !== b.matchRatio) return b.matchRatio - a.matchRatio;
                return a.result.price - b.result.price;
              });
              const cheapestNew = candidates[0].result;
              console.log(`[OKAZ] 7. Prix neuf réel Amazon: ${cheapestNew.price}€ (match ${Math.round(candidates[0].matchRatio * 100)}%) — ${cheapestNew.title}`);

              initialNewRec = {
                productName: cheapestNew.title,
                estimatedPrice: cheapestNew.price,
                reason: `Prix réel constaté sur Amazon.fr — ${amazonNewWithPrice.length} offre${amazonNewWithPrice.length > 1 ? 's' : ''} neuve${amazonNewWithPrice.length > 1 ? 's' : ''} disponible${amazonNewWithPrice.length > 1 ? 's' : ''}`,
                searchQuery: q,
                amazonUrl: cheapestNew.url,
                isRealPrice: true,
              };

              // Intégrer le prix neuf dans le briefing
              if (displayBriefing) {
                displayBriefing = {
                  ...displayBriefing,
                  newProductPrice: {
                    price: cheapestNew.price,
                    label: `${cheapestNew.title.substring(0, 50)} — ${cheapestNew.price}€ neuf`,
                  },
                };
              }
            }
            // Si candidates vide, initialNewRec reste null → fallback Gemini ci-dessous
          }

          // FALLBACK GEMINI : si pas de données Amazon, attendre la recommandation AVANT affichage
          if (!initialNewRec && correctedResults.length > 0) {
            console.log('[OKAZ] 6. Pas de résultats Amazon Neuf, fallback Gemini (await)...');
            const prices = correctedResults.map(r => r.price).filter(p => p > 0);
            const priceMin = prices.length > 0 ? Math.min(...prices) : 0;
            const priceMax = prices.length > 0 ? Math.max(...prices) : 0;

            const topResults = correctedResults
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map(r => ({ title: r.title, price: r.price, site: r.site }));

            try {
              const recRes = await fetch('/api/recommend-new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, priceMin, priceMax, topResults }),
              });
              const recData = await recRes.json();
              if (recData.success && recData.recommendation?.hasRecommendation) {
                const rec = recData.recommendation;
                initialNewRec = rec;
                if (displayBriefing && rec.estimatedPrice) {
                  displayBriefing = {
                    ...displayBriefing,
                    newProductPrice: {
                      price: rec.estimatedPrice,
                      label: `${rec.productName} — ${rec.estimatedPrice}€ neuf`,
                    },
                  };
                }
                console.log('[OKAZ] 6a. Recommandation Gemini reçue:', rec.productName);
              }
            } catch (err) {
              console.error('[OKAZ] Erreur recommandation neuf:', err);
            }
          }

          const t5 = Date.now();
          console.log(`[OKAZ] ⏱ RECOMMEND: ${((t5 - t4) / 1000).toFixed(1)}s`);
          console.log(`[OKAZ] ⏱⏱ TOTAL: ${((t5 - t0) / 1000).toFixed(1)}s (optimize=${((t1-t0)/1000).toFixed(1)}s + scraping=${((t2-t1)/1000).toFixed(1)}s + analyze=${((t4-t3)/1000).toFixed(1)}s + recommend=${((t5-t4)/1000).toFixed(1)}s)`);
          console.log('[OKAZ] 7. Affichage des résultats');
          setSearchData({
            query: q,
            categorized,
            totalResults: topResults30.length,
            duration,
            criteria,
            topPick,
            userLocation: geolocEnabledRef.current && positionRef.current ? positionRef.current : undefined,
            newRecommendation: initialNewRec,
            briefing: displayBriefing,
          });

          // Mettre à jour le briefing courant avec le prix neuf si disponible
          if (displayBriefing) {
            setCurrentBriefing(displayBriefing);
          }
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

  // Clarification IA - réponse de l'utilisateur
  const handleClarificationAnswer = (answer: string) => {
    if (!clarificationData) return;
    const newHistory = [...clarificationData.history, { question: clarificationData.question, answer }];
    const originalQuery = clarificationData.originalQuery;
    setClarificationData(null);
    // Passer la query originale + historique des clarifications
    handleSearch(originalQuery, undefined, newHistory);
  };

  // Extraire les options de la question Gemini en chips cliquables
  const extractChipsFromQuestion = (question: string): string[] => {
    // Pattern "X ou Y ?" ou "X, Y ou Z ?"
    const ouMatch = question.match(/([^?]+)\s*\?/);
    if (!ouMatch) return [];
    const segment = ouMatch[1];
    // Split sur " ou " et ","
    const parts = segment.split(/\s+ou\s+/i);
    const chips: string[] = [];
    for (const part of parts) {
      const subParts = part.split(/\s*,\s*/);
      for (const sub of subParts) {
        const trimmed = sub.trim().replace(/^(un |une |le |la |les |du |des |l'|d')/i, '').trim();
        if (trimmed.length > 1 && trimmed.length < 40) {
          chips.push(trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
        }
      }
    }
    return chips.slice(0, 5);
  };

  // Mobile: ecran d'onboarding desktop-only
  if (isMobile) {
    return <MobileLanding />;
  }

  // Show results screen
  if (searchData) {
    return (
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <SearchResults data={searchData} onBack={handleBack} />
        </div>
      </main>
    );
  }

  // Show setup screen
  if (showSetup) {
    return (
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-16 max-w-md">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] text-center mb-8">OKAZ</h1>
            <GlassCard variant="bordered" className="p-6">
              <ExtensionSetup onSave={handleSaveExtensionId} />
            </GlassCard>
          </motion.div>
        </div>
      </main>
    );
  }

  // Show home/search screen
  // Theme toggle
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);
  const toggleTheme = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--separator)] shadow-sm hover:shadow-md transition-all"
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-[var(--text-secondary)]" /> : <Moon className="w-4 h-4 text-[var(--text-secondary)]" />}
        </button>
      </div>

      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className={`mx-auto transition-all duration-300 ${isSearching ? 'max-w-6xl' : 'max-w-2xl'}`}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
              OKAZ
            </h1>

            <p className="text-lg text-[var(--text-secondary)]">
              Trouvez la meilleure affaire en une recherche
            </p>
          </motion.div>

          {/* Search box - v0.5.0 Enrichi + Layout 2 colonnes pendant recherche */}
          <div className={`flex flex-col ${isSearching ? 'lg:flex-row' : ''} gap-6`}>
            {/* Colonne principale */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 min-w-0"
            >
              <div className="bg-[var(--card-bg)] border border-[var(--separator)] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow p-6 rounded-2xl">
              {isSearching ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <Search className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <p className="text-[var(--text-primary)] text-base truncate">{query}</p>
                  </div>
                  <button
                    onClick={() => handleSearch()}
                    className="p-3 rounded-xl bg-[var(--score-low)] hover:bg-[var(--score-low)]/90 transition-all flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                /* Form de recherche complète */
                <>
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                <div className="relative">
                  {/* Input file caché */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />

                  {/* Textarea */}
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Decrivez ce que vous cherchez...

Ex: MacBook Pro M2 a moins de 800€ pour coder,
main propre Paris ou livraison si garantie"
                    rows={3}
                    className="input-clean w-full px-5 py-4 pl-14 pr-20 text-base rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none resize-none"
                    onKeyDown={(e) => {
                      // Cmd/Ctrl + Enter pour lancer la recherche
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                  />

                  {/* Bouton Photo - intégré en bas à gauche */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className={`absolute left-3 bottom-3 z-10 p-2.5 rounded-xl transition-all ${
                      uploadedImage
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                    title={uploadedImage ? 'Photo ajoutee' : 'Ajouter une photo'}
                  >
                    <Camera className="w-5 h-5" />
                    {uploadedImage && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--accent)] rounded-full flex items-center justify-center">
                        <Check className="w-2 h-2 text-white" />
                      </span>
                    )}
                  </button>

                  {/* Bouton Recherche - en bas à droite */}
                  <button
                    type="submit"
                    disabled={!query.trim()}
                    className="absolute right-3 bottom-3 z-10 p-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-5 h-5 text-white" />
                  </button>
                </div>
              </form>

              {/* Options sous le textarea */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Preview image uploadée */}
                  {uploadedImage && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="flex items-center gap-1.5 px-2 py-1 bg-[var(--accent)]/10 rounded-lg border border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/15 transition-all text-xs"
                    >
                      <span className="truncate max-w-[80px]">{uploadedImage.name}</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  {/* Position */}
                  <button
                    type="button"
                    onClick={handleGeolocToggle}
                    disabled={geoLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      geolocEnabled && position
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                        : 'bg-[var(--bg-secondary)] border border-[var(--separator)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {geoLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Position</span>
                    {geolocEnabled && position && <Check className="w-3 h-3" />}
                  </button>

                  {geolocEnabled && permissionState === 'denied' && (
                    <span className="text-[10px] text-[var(--score-medium)] px-1.5 py-0.5 bg-[var(--score-medium)]/10 rounded border border-[var(--score-medium)]/20">
                      Refusee
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-[var(--text-tertiary)] hidden sm:block">
                  Cmd + Enter
                </span>
              </div>
                </>
              )}

              {/* Loading state - Layout 2 colonnes avec pub */}
              <AnimatePresence>
                {isSearching && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 space-y-4"
                  >
                        {/* Timeline de progression */}
                        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isOptimizing ? 'bg-[var(--accent)]/15' : 'bg-[var(--score-high)]/15'
                            }`}>
                              {isOptimizing ? (
                                <div className="w-2.5 h-2.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Check className="w-2.5 h-2.5 text-[var(--score-high)]" />
                              )}
                            </div>
                            <span className={`text-xs ${isOptimizing ? 'text-[var(--text-primary)]' : 'text-[var(--score-high)]'}`}>
                              IA
                            </span>
                          </div>

                          <div className={`h-0.5 w-8 ${!isOptimizing ? 'bg-[var(--score-high)]/30' : 'bg-[var(--separator)]'}`} />

                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isOptimizing ? 'bg-[var(--bg-tertiary)]' :
                              searchPhase === 'searching' ? 'bg-[var(--accent)]/15' : 'bg-[var(--score-high)]/15'
                            }`}>
                              {isOptimizing ? (
                                <Search className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                              ) : searchPhase === 'searching' ? (
                                <div className="w-2.5 h-2.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Check className="w-2.5 h-2.5 text-[var(--score-high)]" />
                              )}
                            </div>
                            <span className={`text-xs ${
                              isOptimizing ? 'text-[var(--text-tertiary)]' :
                              searchPhase === 'searching' ? 'text-[var(--text-primary)]' : 'text-[var(--score-high)]'
                            }`}>
                              Recherche
                            </span>
                          </div>

                          <div className={`h-0.5 w-8 ${searchPhase === 'analyzing' ? 'bg-[var(--accent)]/30' : 'bg-[var(--separator)]'}`} />

                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              searchPhase === 'analyzing' ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-tertiary)]'
                            }`}>
                              {searchPhase === 'analyzing' ? (
                                <div className="w-2.5 h-2.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Sparkles className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                              )}
                            </div>
                            <span className={`text-xs ${
                              searchPhase === 'analyzing' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                            }`}>
                              Analyse
                            </span>
                          </div>
                        </div>

                    {/* Briefing Pré-Chasse */}
                    <LoadingBriefing briefing={currentBriefing} searchPhase={searchPhase === 'optimizing' ? 'optimizing' : searchPhase === 'searching' ? 'searching' : 'analyzing'} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error state */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-4 bg-[var(--score-low)]/10 border border-[var(--score-low)]/20 rounded-2xl text-[var(--score-low)] text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Clarification IA */}
              <AnimatePresence>
                {clarificationData && !isSearching && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-6 p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-4 h-4 text-[var(--accent)]" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">OKAZ a une question</span>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
                      {clarificationData.question}
                    </p>

                    {(() => {
                      const options = clarificationData.options && clarificationData.options.length > 0
                        ? clarificationData.options
                        : extractChipsFromQuestion(clarificationData.question);
                      return options.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {options.map((option) => (
                            <button
                              key={option}
                              onClick={() => handleClarificationAnswer(option)}
                              className="px-4 py-2 text-sm bg-[var(--card-bg)] border border-[var(--separator)] rounded-xl text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as HTMLFormElement).elements.namedItem('clarification') as HTMLInputElement;
                        if (input.value.trim()) {
                          handleClarificationAnswer(input.value.trim());
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        name="clarification"
                        type="text"
                        placeholder="Ou precise ici..."
                        className="flex-1 px-3 py-2 text-sm bg-[var(--card-bg)] border border-[var(--separator)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-all"
                      >
                        OK
                      </button>
                    </form>

                    <button
                      onClick={() => {
                        const history = clarificationData.history;
                        const originalQ = clarificationData.originalQuery;
                        setClarificationData(null);
                        handleSearch(originalQ, undefined, history);
                      }}
                      className="mt-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      Chercher quand meme sans preciser
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini-tuto - remplace les exemples */}
              {!isSearching && !error && !clarificationData && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-6 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)]"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <Lightbulb className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Plus tu donnes de contexte, meilleurs sont les resultats</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {['Budget', 'Usage', 'Taille', 'Livraison', 'Etat'].map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-tertiary)] border border-[var(--separator)] rounded-full text-[var(--text-tertiary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] italic">
                    Ex : &quot;MacBook Pro M2 a moins de 800€ pour coder, bon etat, livrable&quot;
                  </p>
                </motion.div>
              )}
            </div>
            </motion.div>

            {/* Colonne droite: Pubs contextuelles (visible pendant recherche) */}
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="hidden lg:block w-[480px] flex-shrink-0"
              >
                <AdSidebar
                  keywords={currentCriteria?.keywords?.split(" ") || []}
                  phase="loading"
                />
              </motion.div>
            )}
          </div>

          {/* Status bar - Extension connectée (en bas) ou Configuration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex items-center justify-center gap-3"
          >
            {extensionConnected ? (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--score-high)]/10 border border-[var(--score-high)]/20 text-xs text-[var(--score-high)]">
                  <Check className="w-3 h-3" />
                  Extension connectee
                </div>
                {quota && (
                  <SearchCounter
                    remaining={quota.totalRemaining}
                    total={quota.dailyLimit}
                    planType={quota.planType}
                    monthlyRemaining={quota.monthlyRemaining}
                    monthlyLimit={quota.monthlyLimit}
                    onManageSubscription={quota.isPremium ? handleManageSubscription : undefined}
                  />
                )}
              </>
            ) : (
              <button
                onClick={() => setShowSetup(true)}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-all inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-[var(--bg-secondary)]"
              >
                <Settings className="w-3 h-3" />
                Configurer l&apos;extension
              </button>
            )}
          </motion.div>

          {/* Sites comparés */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-wrap justify-center items-center gap-6"
          >
            {[
              { name: "leboncoin", color: "#FF6E14", active: true },
              { name: "Vinted", color: "#09B1BA", active: true },
              { name: "Back Market", color: "#4D3DF7", active: true },
              { name: "Amazon", color: "#DAA520", active: true },
              { name: "Rakuten", color: "#BF0000", active: false },
              { name: "eBay", color: "#E53238", active: false },
              { name: "Fnac", color: "#E1A400", active: false },
            ].map((site, i) => (
              <motion.span
                key={site.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className={`text-sm font-semibold transition-opacity ${
                  site.active
                    ? 'opacity-60 hover:opacity-100'
                    : 'opacity-20'
                }`}
                style={{ color: site.active ? site.color : 'var(--text-tertiary)' }}
              >
                {site.name}
              </motion.span>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-center text-xs text-[var(--text-tertiary)]"
          >
            Un projet{" "}
            <a
              href="https://facile-ia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline transition-colors font-medium"
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
          onBuyPlan={handleBuyPlan}
          isLoading={isUpgrading}
        />
      )}
    </main>
  );
}
