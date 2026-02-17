import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité - OKAZ',
  description: 'Politique de confidentialité du comparateur OKAZ',
};

export default function PrivacyPage() {
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
          Politique de confidentialité
        </h1>

        <p className="text-sm text-[var(--text-tertiary)] mb-12">
          Dernière mise à jour : 17 février 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. Éditeur</h2>
            <p>
              OKAZ est un service édité par Facile-IA.<br />
              Site web : <a href="https://okaz-ia.fr" className="text-[var(--accent)] hover:underline">okaz-ia.fr</a><br />
              Contact : <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Données collectées</h2>
            <p className="mb-3">OKAZ collecte uniquement les données nécessaires au fonctionnement du service :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Adresse email</strong> : pour l&apos;authentification via magic link et la gestion de votre compte.</li>
              <li><strong>Identifiant d&apos;extension</strong> (UUID) : identifiant technique anonyme généré par l&apos;extension Chrome, utilisé pour le suivi des quotas.</li>
              <li><strong>Requêtes de recherche</strong> : les termes recherchés sont envoyés à l&apos;API Gemini (Google) pour optimisation et analyse. Ils ne sont pas stockés de manière permanente.</li>
              <li><strong>Géolocalisation approximative</strong> : si vous l&apos;activez, votre position est utilisée localement pour filtrer les résultats par proximité. Elle n&apos;est pas envoyée à nos serveurs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. Données NON collectées</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nous ne collectons <strong>pas</strong> votre historique de navigation.</li>
              <li>Nous ne collectons <strong>pas</strong> vos mots de passe ou identifiants sur d&apos;autres sites.</li>
              <li>Nous ne collectons <strong>pas</strong> de données personnelles à des fins publicitaires.</li>
              <li>L&apos;extension ne lit le contenu des pages que sur les sites de petites annonces (LeBonCoin, Vinted, Back Market, Amazon, eBay) et uniquement pour extraire les résultats de recherche.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Extension Chrome</h2>
            <p className="mb-3">L&apos;extension OKAZ :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Ouvre des onglets temporaires sur les sites de petites annonces pour effectuer vos recherches. Ces onglets sont fermés automatiquement après la collecte des résultats.</li>
              <li>Communique uniquement avec le site okaz-ia.fr via le protocole <code className="text-[var(--accent-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-sm">externally_connectable</code>.</li>
              <li>Stocke localement (dans chrome.storage) : votre UUID, votre token d&apos;authentification et vos préférences.</li>
              <li>Ne transmet aucune donnée à des tiers autres que Google (API Gemini) pour l&apos;analyse IA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Services tiers</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase</strong> (base de données) : stocke les comptes utilisateurs et les quotas. Hébergé en Europe.</li>
              <li><strong>Stripe</strong> (paiement) : traite les paiements de manière sécurisée. Nous ne stockons pas vos données bancaires.</li>
              <li><strong>Google Gemini</strong> (IA) : analyse vos requêtes de recherche pour optimiser les résultats. Soumis à la politique de confidentialité de Google.</li>
              <li><strong>Resend</strong> (email) : envoie les emails de connexion et de confirmation.</li>
              <li><strong>Vercel</strong> (hébergement) : héberge le site web.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">6. Cookies</h2>
            <p>
              OKAZ n&apos;utilise pas de cookies de tracking. Seuls des cookies techniques sont utilisés pour le fonctionnement de l&apos;authentification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">7. Liens d&apos;affiliation</h2>
            <p>
              Certains liens vers des produits peuvent contenir des identifiants d&apos;affiliation (Amazon, Awin). Cela nous permet de percevoir une commission si vous effectuez un achat, sans coût supplémentaire pour vous. Le classement des résultats n&apos;est pas influencé par l&apos;affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">8. Vos droits (RGPD)</h2>
            <p className="mb-3">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Droit d&apos;accès à vos données personnelles</li>
              <li>Droit de rectification</li>
              <li>Droit à l&apos;effacement (droit à l&apos;oubli)</li>
              <li>Droit à la portabilité</li>
              <li>Droit d&apos;opposition au traitement</li>
              <li>Droit à la limitation du traitement</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">9. Suppression de compte</h2>
            <p>
              Vous pouvez demander la suppression de votre compte et de toutes vos données en nous écrivant à{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[var(--accent)] hover:underline">contact@okaz-ia.fr</a>.
              La suppression sera effective sous 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">10. Rétention des données</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Requêtes de recherche</strong> : non stockées par OKAZ. Envoyées à Google Gemini pour analyse en temps réel, puis supprimées de notre mémoire.</li>
              <li><strong>Images uploadées</strong> : envoyées à Google Gemini pour analyse visuelle, non stockées par OKAZ.</li>
              <li><strong>Comptes utilisateurs</strong> : conservés jusqu&apos;à demande de suppression par l&apos;utilisateur.</li>
              <li><strong>Tokens d&apos;authentification (magic links)</strong> : expirés et supprimés automatiquement après 15 minutes.</li>
              <li><strong>Tokens JWT révoqués</strong> : supprimés automatiquement après expiration (7 jours).</li>
              <li><strong>Données de paiement</strong> : les reçus Stripe sont conservés 7 ans conformément aux obligations comptables françaises. OKAZ ne stocke pas vos coordonnées bancaires.</li>
              <li><strong>Quotas de recherche</strong> : compteurs journaliers, réinitialisés chaque jour. Aucun historique de recherche conservé.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">11. Sous-traitants (Art. 28 RGPD)</h2>
            <p className="mb-3">OKAZ fait appel aux sous-traitants suivants pour le traitement des données :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Google Cloud (Gemini API)</strong> : analyse IA des requêtes et résultats. Données traitées conformément au Data Processing Addendum de Google Cloud.</li>
              <li><strong>Supabase</strong> : base de données hébergée en Europe (région EU). Standard DPA.</li>
              <li><strong>Stripe</strong> : traitement des paiements. Certifié PCI-DSS. Standard DPA.</li>
              <li><strong>Resend</strong> : envoi d&apos;emails transactionnels (magic links, confirmations). Standard DPA.</li>
              <li><strong>Vercel</strong> : hébergement du site web. Standard DPA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">12. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. En cas de changement significatif, nous vous en informerons par email ou via le site.
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
