# JeuDeMarin — Tractopolis

Simulation 3D dans le navigateur : trois terrains (ferme, chantier, ville), un seul geste qui les relie. Monte dans un engin, conduis, descends à pied, nage. Implémentation basée sur les *Brand Guidelines v2* (Claude Design) : palette, typographie, HUD, ton éditorial et grille de vitesses y sont repris fidèlement.

## Lancer le projet

```bash
npm install
npm run dev       # serveur de dev (Vite)
npm run build     # build de prod dans dist/
npm run typecheck
```

## Ce qui est implémenté

- **Boucle de jeu complète** : écran titre (choix du terrain) → chargement → conduite → sortie à pied (`F`) → marche → entrée dans l'eau sans transition → nage → remontée à pied → réembarquement (`E`).
- **Trois terrains** côte à côte (ferme / chantier / ville), chacun avec sa couleur et des accessoires low-poly de décor.
- **HUD fidèle aux maquettes** : bandeau de zone, badge de mode (un seul signal actif à la fois — ambre/vert/bleu), compteur de vitesse avec clignotants, CTA contextuel, boutons tactiles (gauche/warnings/phares/droite), jauge de souffle en nage.
- **Boîte de vitesses** à 3 niveaux (`G` pour changer de mode) : auto par défaut, séquentiel clavier (`A`/`Q`), grille virtuelle 6+R (touches `1`-`6`/`0`).
- **Support volant & pédales** silencieux via la Gamepad API : détection au premier mouvement, bandeau + calibration en 3 étapes, HUD tactile qui s'efface quand le volant est branché, retour au clavier sans blocage à la débranche.
- **Vitrine d'engins** (`E` près du kiosque en ville) : catalogue de véhicules — citadine, pick-up, tracteur, camions (benne/plateau), remorques (basse/à bétail), rouleau compresseur, pelleteuse — échangeable instantanément, sans économie ni prix (hors périmètre des guidelines).
- **Ton éditorial** : tous les messages in-game viennent de `src/content/copy.ts`, repris des guidelines (règle des 5 mots, tutoiement).

## Ce qui est volontairement absent (hors périmètre des guidelines)

Noyade, oxygène létal, permis de conduire, amendes, économie complexe, arbre de compétences.

## Ce qui reste à faire

Le bundle de design ne contenait que des maquettes HUD/UI (HTML/CSS), pas d'assets 3D : les véhicules, personnages et décors sont des géométries low-poly de substitution (boîtes, cylindres) construites dans `src/world/VehicleMeshFactory.ts` et `src/world/Terrain.ts`, à remplacer par de vrais modèles/textures. Idées de suite, listées dans les guidelines : bateau/jet-ski, ponts vers l'eau, irrigation, photo & partage.

## Architecture

```
src/
  core/       état de jeu, entrées clavier, volant/pédales (Gamepad API), contrôleurs
  world/      scène Three.js, terrains, véhicules, personnage, eau, boutique
  ui/         HUD DOM (calqué sur les maquettes), écrans titre/chargement, boutique
  content/    tous les textes du jeu (ton éditorial)
  styles/     tokens de marque (couleurs, polices) + styles du HUD
```

## Commandes clavier

| Touche | Action |
| --- | --- |
| Flèches | Avancer/reculer, tourner (conduite, marche, nage) |
| `F` | Sortir du véhicule / sortir de l'eau |
| `E` | Remonter dans le véhicule / interagir (boutique) |
| `Maj` | Courir (marche) |
| `Espace` | Plonger (nage) |
| `[` / `]` | Clignotant gauche / droite |
| `\` | Warnings |
| `L` | Phares |
| `B` | Gyrophare |
| `G` | Changer de mode de boîte (auto → séquentiel → grille H) |
| `A` / `Q` | Monter / descendre un rapport (boîte séquentielle) |
| `1`-`6`, `0` | Sélection directe (grille H, `0` = marche arrière) |
