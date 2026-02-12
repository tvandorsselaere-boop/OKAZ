// OKAZ - Politique de confidentialité
// Requis pour le Chrome Web Store

export const metadata = {
  title: 'Politique de confidentialité - OKAZ',
  description: 'Politique de confidentialité du comparateur OKAZ',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f8fafc] font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a
          href="/"
          className="inline-block mb-8 text-sm text-[#94a3b8] hover:text-[#6366f1] transition-colors"
        >
          &larr; Retour a OKAZ
        </a>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-8">
          Politique de confidentialite
        </h1>

        <p className="text-sm text-[#64748b] mb-12">
          Derniere mise a jour : 12 fevrier 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed text-[#cbd5e1]">
          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">1. Editeur</h2>
            <p>
              OKAZ est un service edite par Facile-IA.<br />
              Site web : <a href="https://okaz-ia.fr" className="text-[#6366f1] hover:underline">okaz-ia.fr</a><br />
              Contact : <a href="mailto:contact@okaz-ia.fr" className="text-[#6366f1] hover:underline">contact@okaz-ia.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">2. Donnees collectees</h2>
            <p className="mb-3">OKAZ collecte uniquement les donnees necessaires au fonctionnement du service :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Adresse email</strong> : pour l&apos;authentification via magic link et la gestion de votre compte.</li>
              <li><strong>Identifiant d&apos;extension</strong> (UUID) : identifiant technique anonyme genere par l&apos;extension Chrome, utilise pour le suivi des quotas.</li>
              <li><strong>Requetes de recherche</strong> : les termes recherches sont envoyes a l&apos;API Gemini (Google) pour optimisation et analyse. Ils ne sont pas stockes de maniere permanente.</li>
              <li><strong>Geolocalisation approximative</strong> : si vous l&apos;activez, votre position est utilisee localement pour filtrer les resultats par proximite. Elle n&apos;est pas envoyee a nos serveurs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">3. Donnees NON collectees</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nous ne collectons <strong>pas</strong> votre historique de navigation.</li>
              <li>Nous ne collectons <strong>pas</strong> vos mots de passe ou identifiants sur d&apos;autres sites.</li>
              <li>Nous ne collectons <strong>pas</strong> de donnees personnelles a des fins publicitaires.</li>
              <li>L&apos;extension ne lit le contenu des pages que sur les sites de petites annonces (LeBonCoin, Vinted, Back Market, Amazon) et uniquement pour extraire les resultats de recherche.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">4. Extension Chrome</h2>
            <p className="mb-3">L&apos;extension OKAZ :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Ouvre des onglets temporaires sur les sites de petites annonces pour effectuer vos recherches. Ces onglets sont fermes automatiquement apres la collecte des resultats.</li>
              <li>Communique uniquement avec le site okaz-ia.fr via le protocole <code className="text-[#8b5cf6]">externally_connectable</code>.</li>
              <li>Stocke localement (dans chrome.storage) : votre UUID, votre token d&apos;authentification et vos preferences de quota.</li>
              <li>Ne transmet aucune donnee a des tiers autres que Google (API Gemini) pour l&apos;analyse IA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">5. Services tiers</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase</strong> (base de donnees) : stocke les comptes utilisateurs et les quotas. Heberge en Europe.</li>
              <li><strong>Stripe</strong> (paiement) : traite les paiements de maniere securisee. Nous ne stockons pas vos donnees bancaires.</li>
              <li><strong>Google Gemini</strong> (IA) : analyse vos requetes de recherche pour optimiser les resultats. Soumis a la politique de confidentialite de Google.</li>
              <li><strong>Resend</strong> (email) : envoie les emails de connexion et de confirmation.</li>
              <li><strong>Vercel</strong> (hebergement) : heberge le site web.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">6. Cookies</h2>
            <p>
              OKAZ n&apos;utilise pas de cookies de tracking. Seuls des cookies techniques sont utilises pour le fonctionnement de l&apos;authentification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">7. Liens d&apos;affiliation</h2>
            <p>
              Certains liens vers des produits peuvent contenir des identifiants d&apos;affiliation (Amazon, Awin). Cela nous permet de percevoir une commission si vous effectuez un achat, sans cout supplementaire pour vous. Le classement des resultats n&apos;est pas influence par l&apos;affiliation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">8. Vos droits</h2>
            <p className="mb-3">
              Conformement au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Droit d&apos;acces a vos donnees</li>
              <li>Droit de rectification</li>
              <li>Droit a l&apos;effacement (droit a l&apos;oubli)</li>
              <li>Droit a la portabilite</li>
              <li>Droit d&apos;opposition</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous a{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[#6366f1] hover:underline">contact@okaz-ia.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">9. Suppression de compte</h2>
            <p>
              Vous pouvez demander la suppression de votre compte et de toutes vos donnees en nous ecrivant a{' '}
              <a href="mailto:contact@okaz-ia.fr" className="text-[#6366f1] hover:underline">contact@okaz-ia.fr</a>.
              La suppression sera effective sous 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f8fafc] mb-3">10. Modifications</h2>
            <p>
              Cette politique peut etre mise a jour. En cas de changement significatif, nous vous en informerons par email ou via le site.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-center text-xs text-[#64748b]">
          Un projet{' '}
          <a href="https://facile-ia.fr" className="text-[#6366f1] hover:underline">Facile-IA</a>
        </div>
      </div>
    </div>
  );
}
