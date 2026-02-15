import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialit\u00e9 - OKAZ',
  description: 'Politique de confidentialit\u00e9 du comparateur OKAZ',
};

export default function PrivacyPage() {
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
          Politique de confidentialit\u00e9
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Derni\u00e8re mise \u00e0 jour : 15 f\u00e9vrier 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. \u00c9diteur</h2>
            <p>
              OKAZ est un service \u00e9dit\u00e9 par Facile-IA.<br />
              Site web : <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a><br />
              Contact : <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Donn\u00e9es collect\u00e9es</h2>
            <p className="mb-3">OKAZ collecte uniquement les donn\u00e9es n\u00e9cessaires au fonctionnement du service :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Adresse email</strong> : pour l&apos;authentification via magic link et la gestion de votre compte.</li>
              <li><strong>Identifiant d&apos;extension</strong> (UUID) : identifiant technique anonyme g\u00e9n\u00e9r\u00e9 par l&apos;extension Chrome, utilis\u00e9 pour le suivi des quotas.</li>
              <li><strong>Requ\u00eates de recherche</strong> : les termes recherch\u00e9s sont envoy\u00e9s \u00e0 l&apos;API Gemini (Google) pour optimisation et analyse. Ils ne sont pas stock\u00e9s de mani\u00e8re permanente.</li>
              <li><strong>G\u00e9olocalisation approximative</strong> : si vous l&apos;activez, votre position est utilis\u00e9e localement pour filtrer les r\u00e9sultats par proximit\u00e9. Elle n&apos;est pas envoy\u00e9e \u00e0 nos serveurs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. Donn\u00e9es NON collect\u00e9es</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nous ne collectons <strong>pas</strong> votre historique de navigation.</li>
              <li>Nous ne collectons <strong>pas</strong> vos mots de passe ou identifiants sur d&apos;autres sites.</li>
              <li>Nous ne collectons <strong>pas</strong> de donn\u00e9es personnelles \u00e0 des fins publicitaires.</li>
              <li>L&apos;extension ne lit le contenu des pages que sur les sites de petites annonces (LeBonCoin, Vinted, Back Market, Amazon, eBay) et uniquement pour extraire les r\u00e9sultats de recherche.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Extension Chrome</h2>
            <p className="mb-3">L&apos;extension OKAZ :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Ouvre des onglets temporaires sur les sites de petites annonces pour effectuer vos recherches. Ces onglets sont ferm\u00e9s automatiquement apr\u00e8s la collecte des r\u00e9sultats.</li>
              <li>Communique uniquement avec le site okaz-ia.fr via le protocole <code className="text-[var(--accent-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-sm">externally_connectable</code>.</li>
              <li>Stocke localement (dans chrome.storage) : votre UUID, votre token d&apos;authentification et vos pr\u00e9f\u00e9rences.</li>
              <li>Ne transmet aucune donn\u00e9e \u00e0 des tiers autres que Google (API Gemini) pour l&apos;analyse IA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Services tiers</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase</strong> (base de donn\u00e9es) : stocke les comptes utilisateurs et les quotas. H\u00e9berg\u00e9 en Europe.</li>
              <li><strong>Stripe</strong> (paiement) : traite les paiements de mani\u00e8re s\u00e9curis\u00e9e. Nous ne stockons pas vos donn\u00e9es bancaires.</li>
              <li><strong>Google Gemini</strong> (IA) : analyse vos requ\u00eates de recherche pour optimiser les r\u00e9sultats. Soumis \u00e0 la politique de confidentialit\u00e9 de Google.</li>
              <li><strong>Resend</strong> (email) : envoie les emails de connexion et de confirmation.</li>
              <li><strong>Vercel</strong> (h\u00e9bergement) : h\u00e9berge le site web.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Cookies</h2>
            <p>
              OKAZ n&apos;utilise pas de cookies de tracking. Seuls des cookies techniques sont utilis\u00e9s pour le fonctionnement de l&apos;authentification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Liens d&apos;affiliation</h2>
            <p>
              Certains liens vers des produits peuvent contenir des identifiants d&apos;affiliation (Amazon, Awin). Cela nous permet de percevoir une commission si vous effectuez un achat, sans co\u00fbt suppl\u00e9mentaire pour vous. Le classement des r\u00e9sultats n&apos;est pas influenc\u00e9 par l&apos;affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Vos droits (RGPD)</h2>
            <p className="mb-3">
              Conform\u00e9ment au R\u00e8glement G\u00e9n\u00e9ral sur la Protection des Donn\u00e9es (RGPD), vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Droit d&apos;acc\u00e8s \u00e0 vos donn\u00e9es personnelles</li>
              <li>Droit de rectification</li>
              <li>Droit \u00e0 l&apos;effacement (droit \u00e0 l&apos;oubli)</li>
              <li>Droit \u00e0 la portabilit\u00e9</li>
              <li>Droit d&apos;opposition au traitement</li>
              <li>Droit \u00e0 la limitation du traitement</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous \u00e0{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">9. Suppression de compte</h2>
            <p>
              Vous pouvez demander la suppression de votre compte et de toutes vos donn\u00e9es en nous \u00e9crivant \u00e0{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>.
              La suppression sera effective sous 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">10. Modifications</h2>
            <p>
              Cette politique peut \u00eatre mise \u00e0 jour. En cas de changement significatif, nous vous en informerons par email ou via le site.
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
