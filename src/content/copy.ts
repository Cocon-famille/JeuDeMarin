// Ton éditorial — règle des 5 mots. Tutoiement, verbes d'action, zéro jargon.
export const copy = {
  brand: {
    name: "Tractopolis",
    baseline: "Monte dans tout ce qui roule.",
  },
  modeChange: {
    exitVehicle: "Sors de la voiture",
    pedestrianOn: "Mode piéton activé",
    backInVehicle: "Remonte dans le tracteur",
  },
  driving: {
    blinkerLeft: "Clignotant à gauche",
    blinkerRight: "Clignotant à droite",
    beacon: "Gyrophare allumé",
    bucketDown: "Godet baissé",
    niceParking: "Joli créneau",
  },
  terrain: {
    fieldReady: "Le champ est prêt",
    siteOpen: "Chantier ouvert",
    somethingShines: "Quelque chose brille par là",
    goFurther: "Va voir plus loin",
    goFurtherSub: "Va voir plus loin, personne ne t'attend.",
  },
  swim: {
    intoWater: "À l'eau",
    swimOn: "Mode nage activé",
    takeABreath: "Prends ta respiration",
    surfaceUp: "Remonte respirer",
    surfaceUpSub: "Il y a un tunnel juste en dessous.",
    carWaits: "Ta voiture t'attend au bord",
    exitWater: "Sors de l'eau",
  },
  wheel: {
    detected: "Volant détecté",
    detectedSub: "Tourne à fond une fois pour calibrer.",
    calibrated: "C'est bon, tu peux rouler.",
    stepTurn: "Tourne à gauche, puis à droite",
    stepGas: "Écrase l'accélérateur",
    stepBrake: "Puis le frein",
    backToKeyboard: "Retour au clavier",
  },
  gearbox: {
    engaged: (n: number | string) => `Passe la ${ordinal(n)}`,
    reverse: "Tu es en arrière",
    manualOn: "Boîte manuelle activée",
  },
  ui: {
    play: "Jouer",
    chooseTerrain: "Choisir un terrain",
    farm: "Ferme",
    site: "Chantier",
    city: "Ville",
    casualArcade: "Casual / arcade",
    loadingTitle: "On chauffe le moteur",
    loadingTip: "Astuce : les warnings servent surtout à faire joli.",
    reEnter: "Remonte à bord",
    run: "Courir",
    interact: "Interagir",
    dive: "Plonger",
    surface: "Surface",
    left: "Gauche",
    right: "Droite",
    warnings: "Warnings",
    headlights: "Phares",
  },
} as const;

function ordinal(n: number | string): string {
  const map: Record<number, string> = { 1: "première", 2: "deuxième", 3: "troisième", 4: "quatrième", 5: "cinquième", 6: "sixième" };
  return typeof n === "number" ? map[n] ?? `${n}e` : n;
}
