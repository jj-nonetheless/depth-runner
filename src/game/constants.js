// The playfield is a 160x120 pixel C64-style screen, scaled up with CSS.
export const W = 160;
export const H = 120;
export const SURF = 22;
export const BED = H - 8;

export const P = {
  sky: '#352879', sea: '#40318D', deep: '#2A1F6B', bed: '#68372B',
  sub: '#B8C76F', subd: '#588D43', ship: '#9F9F9F', shipd: '#444444',
  boat: '#E08070', boatd: '#8B3A3A', chg: '#000000', tor: '#FFFFFF',
  boom: '#C3B15F', red: '#9A6759', txt: '#FFFFFF', dark: '#14102E',
  def: '#6CD2E6', dim: '#7869C4',
};

export const SUB = ['....##......', '...####.....', '.##########.', '############', '.##########.'];
export const SHIP = ['.......#........', '......###.......', '..############..', '################', '.##############.', '..############..'];
export const BOAT = ['.....#..........', '....###...#.....', '..###########...', '################', '.##############.', '..############..'];

// Power-ups: colour is the category (cyan defence, orange weapon, yellow speed), the letter says which one.
export const GLYPH = {
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  C: ['###', '#..', '#..', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
};

export const PU = {
  shield: { g: 'S', c: '#6CD2E6', name: 'SHIELD' },
  twin: { g: 'T', c: '#F0A040', name: 'TWIN TORPS', dur: 600 },
  rapid: { g: 'R', c: '#F0E060', name: 'RAPID FIRE', dur: 600 },
  life: { g: '+', c: '#B8C76F', name: 'EXTRA SUB' },
  armor: { g: 'A', c: '#6CD2E6', name: 'ARMOR' },
  cluster: { g: 'C', c: '#F0A040', name: 'CLUSTER', dur: 600 },
  reload: { g: 'R', c: '#F0E060', name: 'FAST RELOAD', dur: 600 },
};

export const SHIP_TABLE = [['armor', 30], ['cluster', 35], ['reload', 35]];
