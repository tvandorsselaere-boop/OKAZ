import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation - OKAZ",
  description: "Conditions générales d'utilisation du comparateur OKAZ",
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-inter)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a
          href="/"
          className="inline-block mb-8 text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
        >
          &larr; Retour à OKAZ
        </a>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-8">
          Conditions générales d&apos;utilisation
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Dernière mise à jour : 15 février 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. Objet</h2>
            <p>
              Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;utilisation du service OKAZ, accessible via le site <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a> et l&apos;extension Chrome associée. En utilisant OKAZ, vous acceptez les présentes CGU dans leur intégralité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Description du service</h2>
            <p className="mb-3">
              OKAZ est un comparateur de petites annonces qui permet de rechercher simultanément sur plusieurs plateformes (LeBonCoin, Vinted, Back Market, Amazon, eBay). Le service utilise l&apos;intelligence artificielle (Gemini) pour :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Optimiser les requêtes de recherche</li>
              <li>Analyser la pertinence des résultats</li>
              <li>Attribuer un score de confiance à chaque annonce</li>
              <li>Recommander les meilleures affaires</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. Extension Chrome</h2>
            <p>
              L&apos;utilisation d&apos;OKAZ nécessite l&apos;installation de l&apos;extension Chrome OKAZ. Cette extension effectue les recherches sur les sites de petites annonces directement depuis votre navigateur. Sans l&apos;extension, le service ne peut pas fonctionner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Comptes et accès</h2>
            <p className="mb-3">OKAZ propose trois niveaux d&apos;accès :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Gratuit</strong> : 5 recherches par jour, réinitialisées quotidiennement.</li>
              <li><strong>Boost</strong> : +20 recherches supplémentaires (achat unique).</li>
              <li><strong>Premium</strong> : recherches illimitées (abonnement mensuel).</li>
            </ul>
            <p className="mt-3">
              L&apos;authentification se fait par magic link envoyé à votre adresse email. Vous êtes responsable de la confidentialité de votre accès email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Paiements et abonnements</h2>
            <p className="mb-3">
              Les paiements sont traités de manière sécurisée par Stripe. OKAZ ne stocke aucune donnée bancaire.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Le <strong>Boost</strong> est un achat unique, non remboursable une fois les recherches utilisées.</li>
              <li>L&apos;abonnement <strong>Premium</strong> est mensuel et peut être annulé à tout moment via le portail Stripe. L&apos;accès Premium reste actif jusqu&apos;à la fin de la période payée.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Limitation de responsabilité</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>OKAZ est un <strong>comparateur</strong>, pas une place de marché. Les transactions s&apos;effectuent directement sur les sites tiers (LeBonCoin, Vinted, etc.).</li>
              <li>Les scores et recommandations IA sont fournis <strong>à titre indicatif</strong> et ne constituent pas un conseil d&apos;achat.</li>
              <li>OKAZ ne garantit pas l&apos;exactitude, la disponibilité ou l&apos;actualité des annonces affichées.</li>
              <li>OKAZ ne peut être tenu responsable des transactions réalisées sur les plateformes tierces.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Liens d&apos;affiliation</h2>
            <p>
              Certains liens présents dans les résultats contiennent des identifiants d&apos;affiliation (Amazon Partenaires, Awin). En cas d&apos;achat via ces liens, OKAZ perçoit une commission sans surcoût pour vous. Le classement des résultats est basé uniquement sur la pertinence et le score IA, indépendamment de toute affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Propriété intellectuelle</h2>
            <p>
              Le service OKAZ, son code, son design et son logo sont la propriété de Facile-IA. Toute reproduction non autorisée est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">9. Utilisation acceptable</h2>
            <p className="mb-3">Il est interdit de :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Utiliser le service de manière automatisée (bots, scripts) au-delà de l&apos;usage normal.</li>
              <li>Tenter de contourner les limitations de quota.</li>
              <li>Modifier, décompiler ou rétro-ingénierer l&apos;extension Chrome.</li>
              <li>Utiliser le service à des fins illégales.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">10. Modification des CGU</h2>
            <p>
              OKAZ se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des changements significatifs par email ou via le site. L&apos;utilisation continuée du service après modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">11. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige, les tribunaux français sont seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">12. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU, contactez-nous à{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--separator)] text-center text-xs text-[var(--text-tertiary)]">
          Un projet{' '}
          <a href="https://facile-ia.fr" className="text-[var(--accent)] hover:underline">Facile-IA</a>
        </div>
      </div>
    </div>
  );
}
