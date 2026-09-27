// Build flag for the marketing showcase (`VITE_SHOWCASE=1 vite build`): the demo practice moves to
// invented towns and streets with (555) phone numbers, and the map uses an unlabeled basemap, so no
// real place names appear in the tour video or screenshots. Coordinates stay real so routing works.
export const SHOWCASE = import.meta.env.VITE_SHOWCASE === '1';

export const AREA_CODE = SHOWCASE ? '555' : '512';

const TOWNS: Record<string, string> = {
  'Cedar Park': 'Cedarbrook',
  Leander: 'Linden Vale',
  'Round Rock': 'Stonebridge',
  Georgetown: 'Harrow Hill',
  Pflugerville: 'Willow Flats',
  Austin: 'Northgate',
  'Brushy Creek': 'Bramble Creek',
  'Liberty Hill': 'Lantern Hill',
  Hutto: 'Hollis Ridge',
  'Avery Ranch': 'Aspen Ranch',
  Jollyville: 'Juniper Heights',
};

const STREET_A = ['Juniper', 'Maple', 'Sage', 'Willow', 'Cypress', 'Hawthorn', 'Aspen', 'Birch', 'Laurel', 'Meadow', 'Briar', 'Quail', 'Heron', 'Sparrow', 'Foxglove', 'Pecan', 'Magnolia', 'Holly', 'Clover', 'Thistle', 'Bramble', 'Wren', 'Larkspur', 'Primrose', 'Sorrel', 'Tupelo'];
const STREET_B = ['Drive', 'Lane', 'Court', 'Way', 'Trail', 'Bend', 'Circle', 'Loop', 'Run', 'Path'];

export const showcaseTown = (city: string) => TOWNS[city] ?? 'Cedarbrook';
export const showcaseStreet = (i: number) => `${STREET_A[i % STREET_A.length]} ${STREET_B[(i * 7 + Math.floor(i / STREET_A.length)) % STREET_B.length]}`;
