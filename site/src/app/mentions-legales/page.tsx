import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales - OKAZ',
  description: 'Mentions légales du comparateur OKAZ',
};

export default function MentionsLegalesPage() {
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
          Mentions légales
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Conformément à l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique.
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. Éditeur du site</h2>
            <ul className="space-y-2">
              <li><strong>Nom du service</strong> : OKAZ</li>
              <li><strong>Édité par</strong> : Facile-IA</li>
              <li><strong>Responsable de la publication</strong> : Thibault Van Dorsselaere</li>
              <li><strong>Adresse email</strong> : <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a></li>
              <li><strong>Site web</strong> : <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Hébergement</h2>
            <ul className="space-y-2">
              <li><strong>Hébergeur</strong> : Vercel Inc.</li>
              <li><strong>Adresse</strong> : 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</li>
              <li><strong>Site web</strong> : <a href="https://vercel.com" className="text-[var(--accent)] hover:underline" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. Nom de domaine</h2>
            <ul className="space-y-2">
              <li><strong>Registrar</strong> : OVH SAS</li>
              <li><strong>Adresse</strong> : 2 rue Kellermann, 59100 Roubaix, France</li>
              <li><strong>Domaine</strong> : okaz-ia.fr</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu du site okaz-ia.fr (textes, graphismes, images, logo, icônes, logiciels) est la propriété de Facile-IA ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
            </p>
            <p className="mt-2">
              Toute reproduction, représentation, modification ou exploitation non autorisée de tout ou partie du site est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Liens d&apos;affiliation</h2>
            <p>
              OKAZ participe à des programmes d&apos;affiliation avec Amazon et Awin (Back Market, Rakuten, Fnac). Certains liens présents sur le site peuvent générer une commission en cas d&apos;achat, sans surcoût pour l&apos;utilisateur. Le classement des résultats est basé uniquement sur la pertinence et le score IA, indépendamment de l&apos;affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Données personnelles</h2>
            <p>
              Pour toute information relative à la collecte et au traitement de vos données personnelles, veuillez consulter notre{' '}
              <a href="/privacy" className="text-[var(--accent)] hover:underline">politique de confidentialité</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Limitation de responsabilité</h2>
            <p>
              OKAZ est un comparateur de petites annonces. Les annonces affichées proviennent de sites tiers (LeBonCoin, Vinted, Back Market, Amazon, eBay). OKAZ ne contrôle ni le contenu ni la véracité de ces annonces et ne peut être tenu responsable des transactions effectuées sur ces plateformes.
            </p>
            <p className="mt-2">
              Les scores et recommandations IA sont fournis à titre indicatif et ne constituent pas un conseil d&apos;achat.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Contact</h2>
            <p>
              Pour toute question concernant le site, contactez-nous à{' '}
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
