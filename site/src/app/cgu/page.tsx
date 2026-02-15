import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Conditions g\u00e9n\u00e9rales d'utilisation - OKAZ",
  description: "Conditions g\u00e9n\u00e9rales d'utilisation du comparateur OKAZ",
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-inter)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a
          href="/"
          className="inline-block mb-8 text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
        >
          &larr; Retour \u00e0 OKAZ
        </a>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-8">
          Conditions g\u00e9n\u00e9rales d&apos;utilisation
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Derni\u00e8re mise \u00e0 jour : 15 f\u00e9vrier 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. Objet</h2>
            <p>
              Les pr\u00e9sentes conditions g\u00e9n\u00e9rales d&apos;utilisation (CGU) r\u00e9gissent l&apos;acc\u00e8s et l&apos;utilisation du service OKAZ, accessible via le site <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a> et l&apos;extension Chrome associ\u00e9e. En utilisant OKAZ, vous acceptez les pr\u00e9sentes CGU dans leur int\u00e9gralit\u00e9.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Description du service</h2>
            <p className="mb-3">
              OKAZ est un comparateur de petites annonces qui permet de rechercher simultan\u00e9ment sur plusieurs plateformes (LeBonCoin, Vinted, Back Market, Amazon, eBay). Le service utilise l&apos;intelligence artificielle (Gemini) pour :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Optimiser les requ\u00eates de recherche</li>
              <li>Analyser la pertinence des r\u00e9sultats</li>
              <li>Attribuer un score de confiance \u00e0 chaque annonce</li>
              <li>Recommander les meilleures affaires</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. Extension Chrome</h2>
            <p>
              L&apos;utilisation d&apos;OKAZ n\u00e9cessite l&apos;installation de l&apos;extension Chrome OKAZ. Cette extension effectue les recherches sur les sites de petites annonces directement depuis votre navigateur. Sans l&apos;extension, le service ne peut pas fonctionner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Comptes et acc\u00e8s</h2>
            <p className="mb-3">OKAZ propose trois niveaux d&apos;acc\u00e8s :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Gratuit</strong> : 5 recherches par jour, r\u00e9initialis\u00e9es quotidiennement.</li>
              <li><strong>Boost</strong> : +20 recherches suppl\u00e9mentaires (achat unique).</li>
              <li><strong>Premium</strong> : recherches illimit\u00e9es (abonnement mensuel).</li>
            </ul>
            <p className="mt-3">
              L&apos;authentification se fait par magic link envoy\u00e9 \u00e0 votre adresse email. Vous \u00eates responsable de la confidentialit\u00e9 de votre acc\u00e8s email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Paiements et abonnements</h2>
            <p className="mb-3">
              Les paiements sont trait\u00e9s de mani\u00e8re s\u00e9curis\u00e9e par Stripe. OKAZ ne stocke aucune donn\u00e9e bancaire.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Le <strong>Boost</strong> est un achat unique, non remboursable une fois les recherches utilis\u00e9es.</li>
              <li>L&apos;abonnement <strong>Premium</strong> est mensuel et peut \u00eatre annul\u00e9 \u00e0 tout moment via le portail Stripe. L&apos;acc\u00e8s Premium reste actif jusqu&apos;\u00e0 la fin de la p\u00e9riode pay\u00e9e.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Limitation de responsabilit\u00e9</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>OKAZ est un <strong>comparateur</strong>, pas une place de march\u00e9. Les transactions s&apos;effectuent directement sur les sites tiers (LeBonCoin, Vinted, etc.).</li>
              <li>Les scores et recommandations IA sont fournis <strong>\u00e0 titre indicatif</strong> et ne constituent pas un conseil d&apos;achat.</li>
              <li>OKAZ ne garantit pas l&apos;exactitude, la disponibilit\u00e9 ou l&apos;actualit\u00e9 des annonces affich\u00e9es.</li>
              <li>OKAZ ne peut \u00eatre tenu responsable des transactions r\u00e9alis\u00e9es sur les plateformes tierces.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Liens d&apos;affiliation</h2>
            <p>
              Certains liens pr\u00e9sents dans les r\u00e9sultats contiennent des identifiants d&apos;affiliation (Amazon Partenaires, Awin). En cas d&apos;achat via ces liens, OKAZ per\u00e7oit une commission sans surco\u00fbt pour vous. Le classement des r\u00e9sultats est bas\u00e9 uniquement sur la pertinence et le score IA, ind\u00e9pendamment de toute affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Propri\u00e9t\u00e9 intellectuelle</h2>
            <p>
              Le service OKAZ, son code, son design et son logo sont la propri\u00e9t\u00e9 de Facile-IA. Toute reproduction non autoris\u00e9e est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">9. Utilisation acceptable</h2>
            <p className="mb-3">Il est interdit de :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Utiliser le service de mani\u00e8re automatis\u00e9e (bots, scripts) au-del\u00e0 de l&apos;usage normal.</li>
              <li>Tenter de contourner les limitations de quota.</li>
              <li>Modifier, d\u00e9compiler ou r\u00e9tro-ing\u00e9nierer l&apos;extension Chrome.</li>
              <li>Utiliser le service \u00e0 des fins ill\u00e9gales.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">10. Modification des CGU</h2>
            <p>
              OKAZ se r\u00e9serve le droit de modifier les pr\u00e9sentes CGU \u00e0 tout moment. Les utilisateurs seront inform\u00e9s des changements significatifs par email ou via le site. L&apos;utilisation continu\u00e9e du service apr\u00e8s modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">11. Droit applicable</h2>
            <p>
              Les pr\u00e9sentes CGU sont r\u00e9gies par le droit fran\u00e7ais. En cas de litige, les tribunaux fran\u00e7ais sont seuls comp\u00e9tents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">12. Contact</h2>
            <p>
              Pour toute question relative aux pr\u00e9sentes CGU, contactez-nous \u00e0{' '}
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
