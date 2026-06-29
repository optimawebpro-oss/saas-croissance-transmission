# Base de connaissances ExitReady — RAG pour Mistral

> Base documentaire destinée à être indexée dans un système RAG (Retrieval-Augmented Generation) pour alimenter l'IA d'ExitReady, le SaaS de pilotage de la valeur d'entreprise et de préparation à la transmission.

## Public cible de ces documents

**Ces documents sont écrits POUR être lus par un LLM (Mistral)**, pas par un humain final. Chaque document est donc :
- Explicite et structuré (titres clairs, listes, tableaux)
- Sans ambiguïté de vocabulaire
- Auto-suffisant (chaque fiche peut être comprise sans contexte externe)
- Daté pour permettre la détection de péremption

## Arborescence

| Dossier | Contenu | Fréquence de mise à jour |
|---|---|---|
| `/reglementation` | Fiches fiscales et juridiques (Dutreil, apport-cession, plus-values, etc.) | À chaque loi de finances (annuel minimum) |
| `/methodologie` | Méthodes de valorisation, multiples sectoriels | Annuel + dès nouvelles données marché |
| `/scoring` | Les 8 axes de scoring de transmissibilité | Stable (révision annuelle) |
| `/glossaire` | Lexique, définitions, FAQ dirigeants | Trimestriel |
| `/skills` | Procédures de raisonnement par tâche IA | Au fil de l'amélioration produit |
| `/ton-et-disclaimers` | Charte de communication, mentions légales | Stable |
| `/cas-types` | Exemples illustratifs (fictifs ou anonymisés réels) | Continu |

## Règles d'or pour l'IA qui consomme ces documents

1. **JAMAIS de calcul de valorisation par l'IA elle-même** — le chiffre doit toujours venir du moteur de calcul interne d'ExitReady (function calling).
2. **TOUJOURS citer la source légale** quand un dispositif fiscal est mentionné (article du CGI, date d'application).
3. **TOUJOURS indiquer la date de validité de l'information** quand elle est susceptible de changer.
4. **JAMAIS de conseil juridique, fiscal ou financier personnalisé** — toujours rediriger vers un professionnel (expert-comptable, avocat fiscaliste) pour la validation.
5. **TOUJOURS appliquer les disclaimers** définis dans `/ton-et-disclaimers/disclaimers-obligatoires.md`.

## Cutoff des informations

Toutes les informations fiscales et juridiques de cette base sont à jour de la **Loi de finances pour 2026** (loi n° 2026-103 du 19 février 2026), entrée en vigueur le 21 février 2026.

Pour toute information susceptible d'évolution depuis cette date, l'IA doit déclencher un appel à l'API Légifrance pour vérification.

## Sources primaires utilisées

- Legifrance.gouv.fr (textes de loi)
- BOFiP (Bulletin Officiel des Finances Publiques)
- Service-Public.fr (Entreprendre)
- impots.gouv.fr
- BPI France (Le Lab, études transmission)
- Loi n° 2026-103 du 19 février 2026 de finances pour 2026
