# Méthodologie de valorisation d'entreprise — Cadre d'ExitReady

> **Date de mise à jour :** 28 juin 2026
> **Public :** IA d'ExitReady, pour expliquer/contextualiser les chiffres produits par le moteur de calcul interne

## Principe fondamental

**Le LLM (Mistral) ne calcule JAMAIS la valorisation lui-même.** Les chiffres sont produits par le moteur de calcul interne d'ExitReady, qui appelle des formules déterministes et utilise des bases de données de multiples sectoriels propriétaires.

Le rôle de l'IA est :
1. **D'expliquer** la méthode utilisée au dirigeant en langage simple
2. **De commenter** le résultat (pourquoi le chiffre est ce qu'il est)
3. **D'identifier** les leviers d'amélioration
4. **JAMAIS de calculer ni d'inventer un chiffre**

## Les 3 grandes familles de méthodes

### 1. Méthodes patrimoniales (basées sur la valeur des actifs)

**Principe :** la valeur de l'entreprise = somme de ses actifs nets (actifs − dettes), retraitée.

**Utilisée pour :**
- Entreprises industrielles avec beaucoup d'immobilisations
- Holdings patrimoniales
- Activités en perte ou en liquidation
- Sociétés immobilières

**Variante : ANR (Actif Net Réévalué)**
- Reprend la valeur comptable des actifs, mais en réévaluant chaque poste à sa valeur de marché
- Ajoute la valeur des actifs immatériels (marque, clientèle, savoir-faire) si elle peut être objectivée

**Limites :** ignore la rentabilité future, donc peu adaptée aux PME de services ou en croissance.

### 2. Méthodes de rendement (basées sur la rentabilité future)

#### 2.a. Multiples (la méthode la plus utilisée en pratique pour les PME)

**Principe :** appliquer un multiple sectoriel à un agrégat financier de l'entreprise (CA, EBE, EBITDA, RN).

**Formule générale :**
```
Valorisation = Multiple sectoriel × Agrégat financier
```

**Agrégats les plus utilisés :**

| Agrégat | Définition | Quand l'utiliser |
|---|---|---|
| **CA** (Chiffre d'Affaires) | Total des ventes HT | Entreprises avec marges très variables, jeunes, en hyper-croissance |
| **EBE** (Excédent Brut d'Exploitation) | CA − charges d'exploitation hors amortissements/financiers/exceptionnels | Standard pour PME françaises |
| **EBITDA** | Equivalent international de l'EBE (Earnings Before Interest, Taxes, Depreciation & Amortization) | Équivalent à l'EBE, plus utilisé dans les contextes anglo-saxons / fonds d'investissement |
| **REX** (Résultat d'Exploitation) | EBE − amortissements et provisions d'exploitation | Quand les amortissements sont structurels et significatifs |
| **RN** (Résultat Net) | Résultat final après IS | Rare, biaisé par les éléments financiers et fiscaux |

**Multiples sectoriels indicatifs (fourchettes 2025-2026, à actualiser via la base propriétaire ExitReady) :**

> ⚠️ Ces fourchettes sont des indications générales. Les multiples réels varient selon la taille, la croissance, la rentabilité, la concentration client, la zone géographique. Toujours appeler le moteur de calcul ExitReady pour obtenir le multiple précis applicable au profil de l'entreprise analysée.

| Secteur | Multiple EBE typique (PME) |
|---|---|
| SaaS / Tech récurrent | 6 - 12x (parfois plus si forte croissance) |
| E-commerce | 4 - 7x |
| Conseil B2B | 4 - 6x |
| Industrie manufacturière | 4 - 6x |
| Services aux entreprises | 4 - 6x |
| BTP / construction | 3 - 5x |
| Distribution / commerce de gros | 3 - 5x |
| Restauration / hôtellerie | 4 - 7x (fonction de l'emplacement) |
| Commerce de détail | 3 - 5x |
| Artisanat | 2 - 4x |
| Transport | 3 - 5x |

**Décotes et surcotes appliquées au multiple théorique :**

| Facteur | Impact sur le multiple |
|---|---|
| Forte concentration client (>30 % sur 1 client) | Décote de 15 à 30 % |
| Dépendance opérationnelle au dirigeant | Décote de 10 à 25 % |
| Absence de récurrence des revenus | Décote de 10 à 20 % |
| Documentation et process formalisés | Surcote de 5 à 10 % |
| N-1 management en place | Surcote de 5 à 15 % |
| Revenus récurrents (abonnement, contrats pluriannuels) | Surcote de 10 à 30 % |
| Croissance > 15 % par an stable | Surcote de 10 à 25 % |
| Marges supérieures à la médiane sectorielle | Surcote de 5 à 15 % |
| Position de leader sur niche défendable | Surcote de 10 à 25 % |

#### 2.b. DCF (Discounted Cash Flow / Flux de Trésorerie Actualisés)

**Principe :** valoriser l'entreprise comme la somme actualisée de ses flux de trésorerie futurs.

**Formule simplifiée :**
```
Valeur = Σ (Flux de trésorerie année n / (1 + taux d'actualisation)^n) + Valeur terminale
```

**Étapes :**
1. Prévoir les flux de trésorerie disponibles (FCF) sur 5 à 10 ans
2. Calculer la valeur terminale (méthode de Gordon-Shapiro : FCF × (1 + g) / (k - g), où g = croissance perpétuelle, k = taux d'actualisation)
3. Actualiser tous les flux au taux d'actualisation (WACC = coût moyen pondéré du capital)
4. Sommer pour obtenir la valeur d'entreprise (VE)
5. Déduire la dette nette pour obtenir la valeur des fonds propres (= ce que reçoit le vendeur)

**Limites pour les PME :**
- Exige des prévisions fiables à 5-10 ans (rare pour une PME)
- Très sensible aux hypothèses (un changement de 1 % sur le WACC = ±15 % de valorisation)
- Peu pertinent pour des entreprises de < 5 M€ de CA
- Pratique réservée aux PME structurées, en croissance, avec visibilité business

### 3. Méthodes comparatives (basées sur les transactions récentes)

**Principe :** observer le prix payé pour des entreprises similaires récemment cédées.

**Sources de données :**
- Bases propriétaires (Argos Index, Epsilon Research, BPCE, IBR)
- Transactions publiques (rapports d'AMF, presse spécialisée)
- Base propriétaire ExitReady (construite au fil des cessions accompagnées)

**C'est cette méthode qui devient le moat data d'ExitReady :** plus on accumule de transactions réelles via la plateforme, plus on a de comparables fiables, plus la valorisation devient précise et défendable.

## La méthode ExitReady (synthèse des trois)

**Étape 1 — Calcul du multiple théorique** : application du multiple sectoriel médian sur l'EBE retraité.

**Étape 2 — Application du scoring qualitatif** : ajustement du multiple selon le score de transmissibilité sur les 8 axes (voir dossier `/scoring`).

**Étape 3 — Croisement avec DCF simplifié** : si l'entreprise a > 5 M€ de CA et des prévisions exploitables, croisement avec un DCF pour valider la fourchette.

**Étape 4 — Confirmation par comparables** : si la base ExitReady contient des transactions sectorielles récentes, croisement supplémentaire.

**Étape 5 — Restitution sous forme de fourchette** : jamais un chiffre unique, toujours une fourchette basse/médiane/haute pour traduire l'incertitude inhérente.

## Retraitements indispensables avant valorisation

L'EBE comptable brut n'est jamais utilisé directement. Il faut le **retraiter** pour obtenir un "EBE normatif" représentatif de la rentabilité pérenne :

| Retraitement | Sens | Exemple |
|---|---|---|
| Rémunération dirigeant non normative | + ou − | Dirigeant qui se sur-rémunère → réintégrer l'écart avec un salaire de marché. Dirigeant qui se sous-rémunère → déduire le manque |
| Charges exceptionnelles non récurrentes | + | Frais de procès, déménagement, sinistre |
| Produits exceptionnels | − | Plus-value sur cession d'actif, subvention ponctuelle |
| Charges familiales / personnelles passées en frais | + | Véhicule personnel, dépenses privées |
| Loyer non normatif (immeuble détenu par le dirigeant) | + ou − | Aligner sur la valeur locative de marché |
| Actifs hors exploitation (trésorerie excédentaire, immeuble non utilisé) | À sortir de la valorisation | Valoriser séparément en ANR |

## Pièges classiques à éviter

1. **Valoriser sur l'EBE non retraité** : surévaluation ou sous-évaluation systématique
2. **Appliquer un multiple générique sans ajustement qualitatif** : ignore les forces et faiblesses spécifiques de l'entreprise
3. **Confondre valeur d'entreprise (VE) et valeur des titres** : VE = titres + dette nette. Le vendeur reçoit la valeur des titres.
4. **Annoncer un chiffre unique** : la valorisation est par essence une fourchette
5. **Confondre prix de vente espéré et valeur économique** : le prix réel dépend aussi du pouvoir de négociation, du nombre d'acquéreurs, du timing

## Disclaimer obligatoire à inclure dans toute réponse IA

> Les valorisations produites par ExitReady sont des estimations indicatives basées sur les méthodes financières standard et les multiples sectoriels disponibles. Le prix réel d'une cession dépend également de facteurs non modélisables : pouvoir de négociation, nombre d'acquéreurs intéressés, conjoncture économique, motivations du vendeur et de l'acquéreur, conditions de financement, structure du deal. Une valorisation rigoureuse doit toujours être confirmée par un expert-comptable et/ou un cabinet de cession avant toute décision.
