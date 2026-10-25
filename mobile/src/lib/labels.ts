/** Norske visningsnavn. Verdiene i databasen og API-et er alltid de engelske kodene. */
export const MUSCLE_LABELS: Record<string, string> = {
  CHEST: 'Bryst',
  LATS: 'Latissimus',
  UPPER_BACK: 'Øvre rygg',
  LOWER_BACK: 'Korsrygg',
  TRAPS: 'Trapezius',
  SHOULDERS: 'Skuldre',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  FOREARMS: 'Underarmer',
  ABS: 'Mage',
  OBLIQUES: 'Skrå magemuskler',
  QUADS: 'Lårforside',
  HAMSTRINGS: 'Hamstrings',
  GLUTES: 'Sete',
  CALVES: 'Legger',
  ADDUCTORS: 'Adduktorer',
  ABDUCTORS: 'Abduktorer',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  BARBELL: 'Stang',
  DUMBBELL: 'Manualer',
  MACHINE: 'Maskin',
  CABLE: 'Kabel',
  BODYWEIGHT: 'Kroppsvekt',
  KETTLEBELL: 'Kettlebell',
  BAND: 'Strikk',
  SMITH_MACHINE: 'Smithmaskin',
  EZ_BAR: 'EZ-stang',
  OTHER: 'Annet',
};

/** Muskelgrupper som vises som filtre i øvelsesvalget, i en naturlig rekkefølge. */
export const MUSCLE_FILTERS = [
  'CHEST',
  'UPPER_BACK',
  'LATS',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'ABS',
] as const;

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  WEIGHT_REPS: 'Vekt & reps',
  BODYWEIGHT_REPS: 'Kun reps',
  WEIGHTED_BODYWEIGHT: 'Kroppsvekt + ekstra vekt',
  ASSISTED_BODYWEIGHT: 'Assistert kroppsvekt',
  DURATION: 'Tid',
  DISTANCE_DURATION: 'Distanse & tid',
};
