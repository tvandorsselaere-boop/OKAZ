import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions l\u00e9gales - OKAZ',
  description: 'Mentions l\u00e9gales du comparateur OKAZ',
};

export default function MentionsLegalesPage() {
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
          Mentions l\u00e9gales
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Conform\u00e9ment \u00e0 l&apos;article 6 de la loi n\u00b0 2004-575 du 21 juin 2004 pour la confiance dans l&apos;\u00e9conomie num\u00e9rique.
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. \u00c9diteur du site</h2>
            <ul className="space-y-2">
              <li><strong>Nom du service</strong> : OKAZ</li>
              <li><strong>\u00c9dit\u00e9 par</strong> : Facile-IA</li>
              <li><strong>Responsable de la publication</strong> : Thibault Van Dorsselaere</li>
              <li><strong>Adresse email</strong> : <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a></li>
              <li><strong>Site web</strong> : <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. H\u00e9bergement</h2>
            <ul className="space-y-2">
              <li><strong>H\u00e9bergeur</strong> : Vercel Inc.</li>
              <li><strong>Adresse</strong> : 440 N Barranca Ave #4133, Covina, CA 91723, \u00c9tats-Unis</li>
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
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Propri\u00e9t\u00e9 intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu du site okaz-ia.fr (textes, graphismes, images, logo, ic\u00f4nes, logiciels) est la propri\u00e9t\u00e9 de Facile-IA ou de ses partenaires et est prot\u00e9g\u00e9 par les lois fran\u00e7aises et internationales relatives \u00e0 la propri\u00e9t\u00e9 intellectuelle.
            </p>
            <p className="mt-2">
              Toute reproduction, repr\u00e9sentation, modification ou exploitation non autoris\u00e9e de tout ou partie du site est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Liens d&apos;affiliation</h2>
            <p>
              OKAZ participe \u00e0 des programmes d&apos;affiliation avec Amazon et Awin (Back Market, Rakuten, Fnac). Certains liens pr\u00e9sents sur le site peuvent g\u00e9n\u00e9rer une commission en cas d&apos;achat, sans surco\u00fbt pour l&apos;utilisateur. Le classement des r\u00e9sultats est bas\u00e9 uniquement sur la pertinence et le score IA, ind\u00e9pendamment de l&apos;affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Donn\u00e9es personnelles</h2>
            <p>
              Pour toute information relative \u00e0 la collecte et au traitement de vos donn\u00e9es personnelles, veuillez consulter notre{' '}
              <a href="/privacy" className="text-[var(--accent)] hover:underline">politique de confidentialit\u00e9</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Limitation de responsabilit\u00e9</h2>
            <p>
              OKAZ est un comparateur de petites annonces. Les annonces affich\u00e9es proviennent de sites tiers (LeBonCoin, Vinted, Back Market, Amazon, eBay). OKAZ ne contr\u00f4le ni le contenu ni la v\u00e9racit\u00e9 de ces annonces et ne peut \u00eatre tenu responsable des transactions effectu\u00e9es sur ces plateformes.
            </p>
            <p className="mt-2">
              Les scores et recommandations IA sont fournis \u00e0 titre indicatif et ne constituent pas un conseil d&apos;achat.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Contact</h2>
            <p>
              Pour toute question concernant le site, contactez-nous \u00e0{' '}
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
