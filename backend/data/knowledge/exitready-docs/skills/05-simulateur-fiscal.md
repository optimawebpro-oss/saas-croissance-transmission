# SKILL — Simulateur fiscal de cession

> Procédure pour produire des simulations comparées de la fiscalité d'une cession selon différents scénarios.

## Objectif

Aider le dirigeant à visualiser l'impact fiscal de différentes stratégies de cession, pour faire un choix éclairé **AVANT** de prendre des décisions structurantes.

**Règle absolue :** ce simulateur produit des estimations indicatives. Il ne se substitue PAS à une analyse personnalisée par un avocat fiscaliste et un expert-comptable.

## Données nécessaires

### Données obligatoires
- Prix de cession envisagé (ou fourchette)
- Prix d'acquisition / valeur d'apport des titres
- Date d'acquisition des titres
- Pourcentage de détention par le cédant
- Forme juridique de la société cible
- CA, EBE, total bilan de la société (pour vérifier qualification PME européenne)
- Effectif

### Données pour activer les optimisations
- Âge du dirigeant (pour départ retraite ou réduction 50 % donation)
- Durée d'exercice de la fonction de direction
- Intention concernant la retraite (oui/non, dans les 2 ans ?)
- TMI du foyer (tranche marginale d'imposition)
- Revenu fiscal de référence (pour CEHR)
- Projet post-cession (réinvestissement professionnel ? rente patrimoniale ? retraite ?)

## Scénarios à comparer (toujours présenter 3-4 scénarios)

### Scénario 1 — Cession directe au PFU (référence)

**Hypothèses :**
- Cession directe par la personne physique
- Imposition au PFU 31,4 % (12,8 % IR + 18,6 % PS)
- Aucune optimisation appliquée

**Calculs (à demander au moteur, pas à faire à la main) :**
- Plus-value brute = Prix de cession − Prix d'acquisition
- IR = Plus-value × 12,8 % (+ CEHR si applicable)
- PS = Plus-value × 18,6 %
- Net après impôt = Prix de cession − Total impôts

### Scénario 2 — Cession avec abattement départ retraite (si applicable)

**Conditions à vérifier (toutes cumulatives) :**
- Détention ≥ 25 % depuis 5 ans
- Direction effective rémunérée > 50 % des revenus depuis 5 ans
- PME au sens européen (< 250 salariés, CA < 50 M€ ou bilan < 43 M€, non détenue > 25 % par grande entreprise)
- Cessation des fonctions
- Départ retraite dans les 24 mois avant ou après cession
- Cession à un tiers (pas à un membre famille)

**Hypothèses si conditions remplies :**
- Abattement fixe de 500 000 € sur l'assiette IR uniquement
- PS toujours dus sur l'assiette pleine

**Calculs :**
- Plus-value brute = Prix − Acquisition
- Assiette IR = max(0 ; Plus-value − 500 000)
- IR = Assiette IR × 12,8 % (+ CEHR si applicable)
- PS = Plus-value × 18,6 % (sur assiette pleine)

### Scénario 3 — Apport-cession via holding (article 150-0 B ter)

**Conditions à vérifier :**
- Apport possible 12 mois minimum avant la cession (pour éviter abus de droit)
- Holding contrôlée par le cédant
- Holding soumise à l'IS

**Hypothèses (régime LF 2026, cession après 21/02/2026) :**
- **Cas 3a :** holding conserve les titres > 3 ans avant cession → report total maintenu sans contrainte de remploi
- **Cas 3b :** holding cède les titres dans les 3 ans → report maintenu si 70 % réinvesti dans 36 mois, conservation 5 ans

**Pour le simulateur :**
- Imposition immédiate : 0 € (au moment de l'apport-cession)
- Capital disponible pour réinvestissement : 100 % du prix de cession
- Contrainte : 70 % à réinvestir dans activité éligible

**Important :** ne PAS présenter l'apport-cession comme un "gain fiscal" net — c'est un **report** d'imposition, pas une exonération. La plus-value reste due tant que les titres de la holding ne sont pas cédés.

### Scénario 4 — Donation préalable avec Pacte Dutreil (si transmission familiale)

**Conditions à vérifier :**
- Transmission à enfants ou famille
- Engagement collectif 2 ans préalable possible (ou Dutreil réputé acquis)
- Engagement individuel 6 ans (LF 2026)
- Société opérationnelle (pas patrimoniale)
- Direction de l'un des bénéficiaires pendant 3 ans

**Hypothèses :**
- Exonération 75 % de la valeur (uniquement actifs opérationnels depuis LF 2026)
- Cumul possible avec abattement parent-enfant 100 k€/parent
- Cumul possible avec réduction 50 % si donation pleine propriété avant 70 ans

**Cas typique :**
- Donation, pas cession → pas de plus-value imposable
- Mais droits de mutation à titre gratuit (DMTG) à calculer
- Les enfants peuvent ensuite céder (en respectant l'engagement de conservation)

## Format de présentation des scénarios

**Toujours en tableau comparatif :**

| Scénario | Imposition immédiate | Net disponible immédiat | Contraintes / Avantages |
|---|---|---|---|
| Cession PFU | [X €] | [Y €] | Aucune contrainte / le plus simple |
| Cession + abattement 500 k€ | [X' €] | [Y' €] | Doit partir en retraite |
| Apport-cession (cession < 3 ans) | 0 € | [Y'' €] (mais 70 % à réinvestir) | Réinvestissement obligatoire 70 % sous 36 mois |
| Apport-cession (cession > 3 ans) | 0 € | [Y''' €] | Conservation préalable 3 ans dans holding |
| Donation Dutreil + cession | Droits de donation [Z €] | Reçu par les héritiers | Engagement 8 ans, transmission familiale |

**Toujours conclure par :**
1. **Quel scénario semble le plus avantageux dans le profil saisi**
2. **Quelles conditions devraient être validées** avec un professionnel
3. **L'horizon de décision** (certains scénarios doivent être structurés 12-24 mois en amont)

## Règles strictes du simulateur

### À FAIRE

✅ Toujours présenter au moins 3 scénarios
✅ Toujours afficher les hypothèses utilisées
✅ Toujours mentionner les conditions à valider
✅ Toujours présenter le résultat en fourchette si l'incertitude est élevée
✅ Toujours rappeler que c'est indicatif
✅ Toujours suggérer le rendez-vous avec un avocat fiscaliste avant toute décision

### À NE JAMAIS FAIRE

❌ Recommander UN scénario comme "le meilleur" (présenter les avantages/inconvénients de chacun)
❌ Garantir un montant exact d'impôt à payer
❌ Suggérer une optimisation "limite" ou agressive
❌ Calculer soi-même (toujours via moteur)
❌ Ignorer un scénario plausible (transparence sur les options)
❌ Promettre une "économie" sans rappeler les contraintes
❌ Sous-estimer la CEHR/CDHR pour les hauts revenus

## Cas particuliers à signaler

### Plus-value très élevée (> 1 M€)

- Activation potentielle de la **CEHR** (3-4 %)
- Activation potentielle de la **CDHR** (mécanisme d'imposition minimale 20 %)
- L'apport-cession peut devenir particulièrement intéressant
- **Toujours** orienter vers un avocat fiscaliste

### Dirigeant proche de la retraite (60+ ans)

- Mettre en avant l'**abattement 500 k€** si conditions remplies
- Vérifier les conditions strictes (cessation totale des fonctions, etc.)
- Anticiper le départ retraite dans les 24 mois

### Dirigeant jeune (< 50 ans) sans projet retraite

- Apport-cession souvent plus pertinent (réinvestissement productif)
- Abattement retraite non applicable
- Optique de bâtir une holding patrimoniale

### Société non éligible PME au sens européen

- Abattement 500 k€ **NON applicable**
- Vérifier la détention par d'autres entités (> 25 % par un groupe = perte d'éligibilité)
- Multiples sectoriels souvent différents (mid-cap)

### Cession partielle vs totale

- Abattement 500 k€ : conditions strictes (cession de tous les titres ou intégralité droits de vote)
- Conséquences différentes sur la fiscalité et la gouvernance post-opération

## Disclaimer obligatoire (toujours inclus)

> Les simulations fournies sont des estimations indicatives basées sur les règles fiscales applicables à la date de la simulation et sur les données saisies. La fiscalité réelle d'une cession dépend de nombreux paramètres personnels (situation patrimoniale globale, autres revenus, contributions exceptionnelles, conventions internationales si résidence à l'étranger) qui ne sont pas exhaustivement modélisés. Toute opération de cession doit obligatoirement faire l'objet d'une analyse personnalisée par un avocat fiscaliste et un expert-comptable AVANT toute décision structurante. ExitReady ne fournit pas de conseil fiscal personnalisé.

## Format de présentation type

> # Simulation fiscale de votre cession
>
> **Hypothèses retenues :**
> - Prix de cession : 2 000 000 €
> - Prix d'acquisition : 50 000 €
> - Plus-value brute : 1 950 000 €
> - Détention : 100 % depuis 12 ans
> - Âge : 62 ans
> - Direction effective : 12 ans
> - PME au sens européen : Oui
>
> **Comparaison de 4 scénarios :**
>
> [Tableau comparatif]
>
> **Synthèse :**
>
> Dans votre situation, deux scénarios méritent une analyse approfondie :
>
> 1. **Cession + abattement départ retraite** : économie d'environ 64 000 € d'IR par rapport à la cession sèche. Conditionnée à votre départ effectif en retraite dans les 24 mois.
>
> 2. **Apport-cession via holding** : pas d'imposition immédiate, capital intégralement réinvestissable (avec contrainte de 70 % en activité éligible sous 36 mois). À structurer 12-18 mois avant la cession.
>
> Ces deux options ne sont pas exclusives mutuellement dans tous les cas (mais ne se cumulent pas sur la même opération directement).
>
> **Prochaine étape recommandée :** prenez rendez-vous avec votre expert-comptable et un avocat fiscaliste pour valider l'éligibilité et choisir le scénario adapté à votre projet de vie post-cession.
>
> *[Disclaimer obligatoire]*
