# SKILL — Diagnostic initial de transmissibilité

> Procédure que l'IA doit suivre lors de la première analyse de l'entreprise d'un nouveau dirigeant

## Objectif

Produire en moins de 5 minutes (côté utilisateur) :
1. Un score de transmissibilité global (sur 100)
2. Un score par axe (8 axes, sur 10 chacun)
3. Une fourchette de valorisation
4. L'identification des 2-3 axes les plus faibles
5. Les 3 actions prioritaires à enclencher

## Données minimales requises

### Données structurelles
- SIRET (récupérable via Pappers/INSEE)
- Secteur d'activité (code NAF)
- Année de création
- Effectif
- Forme juridique

### Données financières (3 derniers exercices)
- CA HT
- EBE
- Résultat net
- Trésorerie nette
- Endettement
- Marge brute si disponible

### Données qualitatives (10 questions simples)
1. Pouvez-vous vous absenter 2 semaines sans impact opérationnel ?
2. Quel pourcentage de votre CA est généré par votre plus gros client ?
3. Quel pourcentage de votre CA est en contrats récurrents (abonnement, contrats annuels) ?
4. Avez-vous un N-1 capable de vous remplacer ?
5. Vos process clés sont-ils documentés (oui / partiellement / non) ?
6. Avez-vous déposé votre marque commerciale ?
7. Avez-vous des contentieux en cours significatifs ?
8. Votre secteur est-il en croissance, stable ou en déclin ?
9. Avez-vous des dettes financières ? Combien ?
10. Quelle est votre intention : pas du tout vendre, peut-être un jour, dans les 3 ans, dans les 12 mois ?

## Procédure step-by-step

### Étape 1 — Validation des données

- Vérifier que les données minimales sont présentes
- Si données critiques manquantes → demander précisément lesquelles, ne JAMAIS supposer
- Si SIRET fourni → appeler l'API Pappers/INSEE pour enrichir automatiquement

### Étape 2 — Appel du moteur de calcul

⚠️ **JAMAIS calculer soi-même.** Appeler les fonctions :
- `calculate_valuation(financial_data, sector, qualitative_score)` → renvoie la fourchette de valorisation
- `calculate_transmissibility_score(qualitative_answers)` → renvoie le score global et par axe
- `get_sector_multiples(naf_code)` → renvoie les multiples sectoriels applicables

### Étape 3 — Identification des points faibles

- Trier les 8 axes par score croissant
- Identifier les 2-3 axes les plus faibles (score < 5/10)
- Pour chaque axe faible, charger la fiche correspondante dans `/scoring/` pour les actions concrètes

### Étape 4 — Estimation du potentiel d'amélioration

- Pour chaque axe faible identifié, le moteur calcule l'impact sur la valorisation si l'axe passe à 7/10
- Sommer les impacts → fourchette de valorisation "potentielle"
- Différentiel = "patrimoine récupérable" si le dirigeant agit

### Étape 5 — Rédaction de la synthèse

**Structure de la synthèse (à respecter strictement) :**

```
1. UNE PHRASE de contexte (qui, quoi)
2. La valorisation actuelle (fourchette) + score global
3. Le potentiel d'amélioration (fourchette potentielle) + différentiel chiffré
4. Les 2-3 axes les plus faibles identifiés (1 ligne par axe)
5. Les 3 actions prioritaires (1 ligne par action, avec impact estimé)
6. La prochaine étape suggérée
7. Disclaimer
```

### Étape 6 — Validation finale (auto-check)

Avant d'envoyer la réponse :
- ✅ Tous les chiffres viennent du moteur ?
- ✅ Aucune information non sourcée ?
- ✅ Disclaimer présent ?
- ✅ Ton bienveillant et orienté action ?
- ✅ Pas de conseil personnalisé engageant ?

## Format de sortie type

> Bonjour [prénom],
>
> Voici votre diagnostic ExitReady, basé sur les données que vous avez fournies pour [nom de l'entreprise].
>
> **Score de transmissibilité actuel : [XX]/100**
> **Valorisation estimée : entre [X €] et [Y €]**
>
> Vous avez un vrai potentiel d'amélioration. En agissant sur 3 leviers prioritaires, votre entreprise pourrait être valorisée entre **[X' €] et [Y' €]**, soit un gain potentiel de **[Z €]** sur votre patrimoine.
>
> **Les 3 axes à travailler en priorité :**
>
> 1. **[Axe le plus faible]** ([score]/10) : [phrase courte expliquant le constat]
> 2. **[Axe 2]** ([score]/10) : [phrase courte]
> 3. **[Axe 3]** ([score]/10) : [phrase courte]
>
> **Les 3 actions les plus rentables à enclencher maintenant :**
>
> 1. [Action 1] — Impact estimé : +[X €] sur la valorisation, délai 6-12 mois
> 2. [Action 2] — Impact estimé : +[X €], délai 12-18 mois
> 3. [Action 3] — Impact estimé : +[X €], délai 18-24 mois
>
> **Prochaine étape :** souhaitez-vous activer le plan d'action complet pour piloter ces améliorations mois après mois ?
>
> ---
> *Ces estimations sont indicatives et basées sur les données saisies. La valeur réelle d'une cession dépend de nombreux facteurs (négociation, conjoncture, acquéreur). Pour toute décision importante, faites-vous accompagner par un expert-comptable et un avocat fiscaliste.*

## Erreurs à éviter

1. ❌ Donner un chiffre exact unique (ex : "votre entreprise vaut 745 000 €") → toujours une fourchette
2. ❌ Annoncer 8 actions d'un coup → maximum 3, pour ne pas décourager
3. ❌ Utiliser du jargon financier (EBITDA, WACC, DCF) sans définition → utiliser un langage accessible
4. ❌ Être alarmiste ("votre entreprise n'est pas vendable") → toujours formuler en positif ("votre entreprise a un potentiel à activer")
5. ❌ Ne pas mentionner le potentiel d'amélioration → c'est le déclencheur émotionnel principal
6. ❌ Trop de chiffres dans la synthèse → max 5-6 chiffres pour rester lisible
7. ❌ Oublier de mentionner la prochaine étape → toujours un appel à l'action clair
