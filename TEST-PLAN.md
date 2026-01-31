# Programme de Test OKAZ

## 1. Recherche basique
- [ ] Rechercher "iPhone 13" → doit retourner des résultats LBC + Back Market (pas Vinted = catégorie tech)
- [ ] Rechercher "Nike Dunk" → doit retourner Vinted + LBC (pas Back Market = catégorie mode)
- [ ] Vérifier que le compteur passe de 5/5 à 4/5 après la recherche

## 2. Quota et limite
- [ ] Faire 5 recherches → compteur à 0/5
- [ ] 6ème recherche → modal "Upgrade" apparaît
- [ ] Vérifier les boutons "Pack Boost" et "Premium"

## 3. Paiement Stripe (mode test)
- [ ] Cliquer "Pack Boost" → redirection Stripe
- [ ] Carte test : `4242 4242 4242 4242` / date future / CVC quelconque
- [ ] Après paiement → retour sur OKAZ avec +10 crédits
- [ ] Vérifier dans Supabase : table `okaz_purchases` + `okaz_quotas`

## 4. Géolocalisation
- [ ] Activer "Ma position" → doit demander la permission
- [ ] Faire une recherche → section "Main propre" triée par distance

## 5. Gemini (optimisation)
- [ ] Rechercher "iPhone pas cher livrable" → vérifie que Gemini optimise en "iPhone" + filtres
- [ ] Vérifier le briefing pendant le loading (prix marché, tips)

## 6. Analyse résultats
- [ ] Vérifier les badges (score %, deal type)
- [ ] Vérifier le "Top Pick" (carte dorée)
- [ ] Cliquer un résultat → ouvre l'annonce originale

## 7. DB Supabase
```sql
-- Vérifier les tables
SELECT * FROM okaz_quotas ORDER BY created_at DESC LIMIT 5;
SELECT * FROM okaz_purchases ORDER BY created_at DESC LIMIT 5;
```

## 8. Webhook Stripe
- [ ] Dans Stripe Dashboard → Webhooks → vérifier les events reçus
- [ ] Statut "Succeeded" pour `checkout.session.completed`

---

## URLs utiles

| Service | URL |
|---------|-----|
| App | https://okaz-one.vercel.app |
| Vercel | https://vercel.com/tvandorsselaere-boop/okaz |
| Supabase | https://supabase.com/dashboard |
| Stripe | https://dashboard.stripe.com/test |
| GitHub | https://github.com/tvandorsselaere-boop/OKAZ |

---

## Tâches en attente

- [ ] Configurer Stripe webhook (si pas fait)
- [ ] Configurer Resend domaine personnalisé
- [ ] Tester Magic Link Premium
- [ ] Déployer sur domaine okaz.fr
