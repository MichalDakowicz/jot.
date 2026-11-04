/**
 * First-run content, lifted from the design canvas so a fresh account
 * lands on the same notebooks, notes, links and timetable as the mockup.
 */
export type SeedNotebook = {
  key: string;
  name: string;
  code: string;
  prof: string;
  tint: number;
};

export type SeedNote = {
  nb: string;
  title: string;
  body: string;
  tags: string[];
  /** Hours in the past, so "edited 2h ago" reads like the design. */
  agoHours: number;
};

export type SeedClass = {
  nb: string;
  weekdays: number[];
  starts_at: string;
  room: string;
};

export const SEED_NOTEBOOKS: SeedNotebook[] = [
  { key: 'chem', name: 'Organic Chemistry', code: 'CHM-241', prof: 'Dr. Nowak', tint: 0 },
  { key: 'linalg', name: 'Linear Algebra', code: 'MAT-118', prof: 'Prof. Adamska', tint: 1 },
  { key: 'hist', name: 'Modern Europe', code: 'HIS-203', prof: 'Dr. Vogel', tint: 2 },
  { key: 'bio', name: 'Cell Biology', code: 'BIO-150', prof: 'Dr. Reyes', tint: 3 },
  { key: 'ethics', name: 'Ethics in AI', code: 'PHI-330', prof: 'Prof. Lindqvist', tint: 4 },
];

const lines = (...l: string[]) => l.join('\n');

export const SEED_NOTES: SeedNote[] = [
  {
    nb: 'chem',
    title: 'Alkene addition reactions',
    agoHours: 2,
    body: lines(
      'Electrophilic addition across the C=C double bond. The **pi bond is the nucleophile**: it attacks the electrophile and a carbocation forms.',
      '',
      '## The three steps',
      '1. The pi bond attacks the H of HBr',
      '2. A carbocation forms on the more substituted carbon',
      '3. Bromide attacks the carbocation',
      '',
      "> Regiochemistry follows @Markovnikov's rule -- the hydrogen lands on the carbon that already has more hydrogens.",
      '',
      '`HBr + CH2=CH-CH3 -> CH3-CHBr-CH3`',
      '',
      '### To do before Thursday',
      '- [x] Draw all four mechanisms from memory',
      '- [ ] Problems 4.11 to 4.28',
      '- [ ] Ask Nowak about ==anti-Markovnikov== radical addition',
      '',
      'Stereochemistry of the bromination step is in @Lab 3: fractional distillation, near the bottom.',
    ),
    tags: ['mechanisms', 'exam'],
  },
  {
    nb: 'chem',
    title: "Markovnikov's rule",
    agoHours: 26,
    body: lines(
      'The rule in one line: *the richer carbon gets richer*. Hydrogen adds to the carbon bearing the greater number of hydrogens, so the halide ends up on the more substituted carbon.',
      '',
      '## Why',
      'The intermediate carbocation is stabilised by hyperconjugation and by the inductive donation of neighbouring alkyl groups, so the pathway through the ==more stable cation== wins.',
      '',
      '- Tertiary cation, most stable',
      '- Secondary cation',
      '- Primary cation, effectively never forms',
      '',
      'Worked examples live in @Alkene addition reactions.',
    ),
    tags: ['mechanisms'],
  },
  {
    nb: 'chem',
    title: 'Lab 3: fractional distillation',
    agoHours: 96,
    body: lines(
      '## Setup',
      'Round-bottom flask, Vigreux column, thermometer bulb level with the side arm. Grease every joint.',
      '',
      '1. Heat slowly to 78 C, collect the ethanol fraction',
      '2. Discard the intermediate',
      '3. Second fraction at 100 C is water',
      '',
      '> Do not distil to dryness. Peroxides concentrate in the residue.',
      '',
      '- [x] Pre-lab calculation signed off',
      '- [ ] Write up percent recovery',
      '',
      'Theory recap in @Alkene addition reactions.',
    ),
    tags: ['lab'],
  },
  {
    nb: 'linalg',
    title: 'Eigenvalues and eigenvectors',
    agoHours: 5,
    body: lines(
      'An eigenvector of A is a non-zero v with `A v = lambda v`. The scalar lambda is its eigenvalue: the matrix only stretches v, it never turns it.',
      '',
      '## Finding them',
      '1. Solve `det(A - lambda I) = 0` for the characteristic polynomial',
      '2. For each root, solve `(A - lambda I) v = 0`',
      '3. Normalise if you need an orthonormal basis',
      '',
      '> Geometric multiplicity is at most algebraic multiplicity. When they differ the matrix is **not diagonalisable**.',
      '',
      'Diagonalising is just a well-chosen @Change of basis, so re-read that first.',
      '',
      '- [ ] Prove that symmetric matrices have real eigenvalues',
      '- [ ] Exam 2019 question 3',
    ),
    tags: ['proofs', 'exam'],
  },
  {
    nb: 'linalg',
    title: 'Change of basis',
    agoHours: 72,
    body: lines(
      'A vector does not change; its coordinates do. If P holds the new basis vectors as columns then `[v]_new = P^-1 [v]_old`.',
      '',
      '## The similarity form',
      '`B = P^-1 A P` describes the same linear map read in the new basis. Everything basis-independent survives it: trace, determinant, rank, the eigenvalues.',
      '',
      '- Columns of P are the new basis written in old coordinates',
      '- P is invertible because a basis is independent',
      '',
      'This is the machinery behind @Eigenvalues and eigenvectors.',
    ),
    tags: ['proofs'],
  },
  {
    nb: 'hist',
    title: 'The Congress of Vienna',
    agoHours: 168,
    body: lines(
      "Metternich's settlement of 1814 to 1815 rebuilt Europe around **balance, legitimacy and compensation**.",
      '',
      '## What it produced',
      '- A German Confederation of 39 states, deliberately loose',
      "- Buffer states on France's borders",
      '- Congress diplomacy, the habit of meeting rather than fighting',
      '',
      '> The order held for a generation, then cracked. See @1848: the springtime of peoples.',
      '',
      'Essay line: the settlement was durable precisely because it was unambitious.',
    ),
    tags: ['seminar'],
  },
  {
    nb: 'hist',
    title: '1848: the springtime of peoples',
    agoHours: 170,
    body: lines(
      'Revolutions in Palermo, Paris, Vienna, Berlin, Milan, Budapest inside four months. Liberal demands and national demands arrived together, then pulled apart.',
      '',
      '## Why they failed',
      '1. Liberals feared the crowd more than the crown',
      '2. National claims collided with one another',
      '3. Armies stayed loyal',
      '',
      'The order they attacked was built at @The Congress of Vienna.',
      '',
      '- [ ] Read the Hobsbawm chapter',
      '- [ ] Draft the essay opening',
    ),
    tags: ['essay', 'seminar'],
  },
  {
    nb: 'bio',
    title: 'Mitochondria and ATP synthesis',
    agoHours: 120,
    body: lines(
      'Oxidative phosphorylation, four complexes and a turbine.',
      '',
      '## Chain',
      '1. NADH gives electrons to complex I',
      '2. Protons are pumped into the intermembrane space',
      '3. The gradient drives ATP synthase',
      '',
      '> Roughly 30 ATP per glucose. Textbooks quoting 36 to 38 are using older stoichiometry.',
      '',
      '`NADH + H+ + 1/2 O2 -> NAD+ + H2O`',
      '',
      '- [x] Label the cristae diagram',
      '- [ ] Uncoupling agents, one paragraph',
    ),
    tags: ['exam'],
  },
  {
    nb: 'ethics',
    title: 'Seminar: algorithmic fairness',
    agoHours: 144,
    body: lines(
      'Three definitions of fairness that cannot all hold at once: demographic parity, equal opportunity, calibration.',
      '',
      '## The impossibility result',
      'Unless base rates are equal across groups, no classifier satisfies calibration and equal false-positive rates together. **The choice is political, not technical.**',
      '',
      '- Whose error matters more, the false positive or the false negative?',
      '- Who audits the training data?',
      '- Which harms are not measurable at all?',
      '',
      "> Lindqvist's framing: fairness is a *contested* concept, so pick one and defend it in writing.",
      '',
      '- [ ] Position paper, 1200 words',
      '- [ ] Find one deployed counter-example',
    ),
    tags: ['essay', 'seminar'],
  },
];

/** Mon-Fri timetable, so Today has something to show on any weekday. */
export const SEED_CLASSES: SeedClass[] = [
  { nb: 'chem', weekdays: [1, 2, 4], starts_at: '09:00:00', room: 'Lab B' },
  { nb: 'linalg', weekdays: [1, 2, 3, 5], starts_at: '11:30:00', room: 'C-14' },
  { nb: 'ethics', weekdays: [2, 4], starts_at: '15:00:00', room: 'Seminar 2' },
  { nb: 'bio', weekdays: [3, 5], starts_at: '08:30:00', room: 'A-201' },
  { nb: 'hist', weekdays: [1, 3, 4], starts_at: '13:15:00', room: 'H-7' },
  { nb: 'chem', weekdays: [0, 6], starts_at: '10:00:00', room: 'Study room' },
];

export const ONBOARDING = [
  {
    step: 'One of three',
    title: 'A notebook for every subject',
    body: 'Notes live in the notebook they belong to. Nothing else to file, no folders to invent.',
    cta: 'Next',
  },
  {
    step: 'Two of three',
    title: 'Markdown that sets as you type',
    body: 'Headings, lists, checkboxes and quotes take their shape the moment you leave the line. Tap any line to see its source again.',
    cta: 'Next',
  },
  {
    step: 'Three of three',
    title: 'Type @ to tie two notes together',
    body: 'A mention becomes a link both ways, and every link shows up on the map.',
    cta: 'Start taking notes',
  },
] as const;
