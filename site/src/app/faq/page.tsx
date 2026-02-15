import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ - OKAZ',
  description: 'Questions fréquentes sur OKAZ, le comparateur de petites annonces intelligent.',
};

const faqs = [
  {
    question: "Comment fonctionne OKAZ ?",
    answer: "OKAZ compare simultanément 5 sites de petites annonces (LeBonCoin, Vinted, Back Market, Amazon, eBay) en une seule recherche. Notre IA analyse chaque annonce, attribue un score de confiance et vous recommande la meilleure affaire.",
  },
  {
    question: "Pourquoi faut-il installer une extension Chrome ?",
    answer: "L'extension Chrome est le moteur de recherche d'OKAZ. Elle effectue les recherches directement depuis votre navigateur, ce qui garantit des résultats fiables sans blocage. Sans extension, les sites de petites annonces détectent et bloquent les requêtes automatiques.",
  },
  {
    question: "Comment installer l'extension ?",
    answer: "Rendez-vous sur le Chrome Web Store, recherchez \"OKAZ\" et cliquez sur \"Ajouter à Chrome\". L'extension s'installe en un clic. Ensuite, allez sur okaz-ia.fr et lancez votre première recherche.",
  },
  {
    question: "Quels sites sont comparés ?",
    answer: "OKAZ compare actuellement 5 plateformes : LeBonCoin (occasion locale et nationale), Vinted (mode et vêtements), Back Market (tech reconditionné), Amazon (neuf et seconde main) et eBay (enchères et achat immédiat).",
  },
  {
    question: "Comment fonctionne le score ?",
    answer: "Chaque annonce reçoit un score de 1 à 10 calculé par notre IA. Le score combine la pertinence de l'annonce par rapport à votre recherche (80%) et le rapport qualité-prix (20%). Les annonces en dessous de 3/10 sont automatiquement masquées car jugées hors-sujet.",
  },
  {
    question: "C'est quoi \"LA recommandation\" ?",
    answer: "C'est l'annonce que notre IA considère comme la meilleure affaire parmi tous les résultats. Elle est mise en avant avec une carte dorée en haut des résultats, avec une explication de pourquoi c'est un bon choix.",
  },
  {
    question: "C'est quoi le bandeau \"Et en neuf ?\" ?",
    answer: "Quand vous cherchez un produit d'occasion, OKAZ vous indique aussi le prix du neuf sur Amazon pour que vous puissiez comparer. Si l'écart de prix est faible, il peut être plus intéressant d'acheter neuf avec garantie.",
  },
  {
    question: "Est-ce que mes données sont en sécurité ?",
    answer: "Oui. OKAZ ne collecte pas votre historique de navigation ni vos mots de passe. L'extension ne lit que les pages de résultats des 5 sites comparés. Vos requêtes de recherche sont envoyées à l'IA pour optimisation mais ne sont pas stockées. Consultez notre politique de confidentialité pour plus de détails.",
  },
  {
    question: "OKAZ est-il gratuit ?",
    answer: "Oui, OKAZ propose 5 recherches gratuites par jour. Pour un usage plus intensif, vous pouvez acheter un Boost (+20 recherches) ou passer au plan Premium (recherches illimitées, abonnement mensuel).",
  },
  {
    question: "Comment annuler mon abonnement Premium ?",
    answer: "Cliquez sur le bouton \"Gérer\" dans le compteur de recherches en bas de page, ou contactez-nous à contact@okaz-ia.fr. Vous serez redirigé vers le portail Stripe où vous pourrez annuler en un clic. Votre accès Premium reste actif jusqu'à la fin de la période payée.",
  },
  {
    question: "Pourquoi certains résultats sont masqués ?",
    answer: "Notre IA filtre automatiquement les annonces dont le score de confiance est inférieur à 30%. Ce sont des résultats jugés hors-sujet (par exemple, une coque d'iPhone quand vous cherchez un iPhone). Le nombre d'annonces filtrées est indiqué sous les résultats.",
  },
  {
    question: "Est-ce qu'OKAZ touche une commission ?",
    answer: "Certains liens (Amazon, Back Market) contiennent des identifiants d'affiliation. Si vous achetez via ces liens, OKAZ perçoit une petite commission sans surcoût pour vous. Le classement des résultats n'est jamais influencé par l'affiliation : la meilleure affaire reste la meilleure affaire.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-inter)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a
          href="/"
          className="inline-block mb-8 text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
        >
          &larr; Retour à OKAZ
        </a>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-4">
          Questions fréquentes
        </h1>

        <p className="text-[var(--text-secondary)] mb-12">
          Tout ce que vous devez savoir sur OKAZ.
        </p>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group card card-hover p-0 overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-[var(--text-primary)] font-medium select-none list-none [&::-webkit-details-marker]:hidden">
                <span className="pr-4">{faq.question}</span>
                <span className="shrink-0 text-[var(--text-tertiary)] transition-transform duration-300 group-open:rotate-45 text-xl leading-none">
                  +
                </span>
              </summary>
              <div className="px-6 pb-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-16 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--separator)] text-center">
          <p className="text-[var(--text-secondary)] mb-2">
            Vous avez une autre question ?
          </p>
          <a
            href="mailto:contact@okaz-ia.fr"
            className="text-[var(--accent)] hover:underline font-medium"
          >
            contact@okaz-ia.fr
          </a>
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--separator)] text-center text-xs text-[var(--text-tertiary)]">
          Un projet{' '}
          <a href="https://facile-ia.fr" className="text-[var(--accent)] hover:underline">Facile-IA</a>
        </div>
      </div>
    </div>
  );
}
