// ─── National course lists for import ─────────────────────────────────────────
// Top 500 public, Top 500 private, PGA Tour venues, major championship hosts,
// Ryder Cup / Presidents Cup hosts, top resort/destination courses.
//
// These are seeded with well-known courses to bootstrap the import.
// The scraper will attempt to find additional courses from web sources.

export type NationalCourse = {
  name: string;
  club?: string; // facility name if different
  city: string;
  state: string;
  access: 'public' | 'private' | 'resort';
  list: string[]; // which national lists this course belongs to
};

// ─── PGA Tour Venue Courses (current + recent) ──────────────────────────────

export const PGA_TOUR_VENUES: NationalCourse[] = [
  { name: 'TPC Sawgrass (Stadium)', city: 'Ponte Vedra Beach', state: 'FL', access: 'private', list: ['pga_tour'] },
  { name: 'Augusta National Golf Club', city: 'Augusta', state: 'GA', access: 'private', list: ['pga_tour', 'major'] },
  { name: 'Pebble Beach Golf Links', city: 'Pebble Beach', state: 'CA', access: 'resort', list: ['pga_tour', 'major', 'top_public'] },
  { name: 'Torrey Pines South Course', city: 'La Jolla', state: 'CA', access: 'public', list: ['pga_tour', 'major', 'top_public'] },
  { name: 'TPC Scottsdale (Stadium)', city: 'Scottsdale', state: 'AZ', access: 'private', list: ['pga_tour'] },
  { name: 'Riviera Country Club', city: 'Pacific Palisades', state: 'CA', access: 'private', list: ['pga_tour', 'major', 'top_private'] },
  { name: 'Muirfield Village Golf Club', city: 'Dublin', state: 'OH', access: 'private', list: ['pga_tour', 'top_private'] },
  { name: 'Harbour Town Golf Links', city: 'Hilton Head Island', state: 'SC', access: 'resort', list: ['pga_tour', 'top_resort'] },
  { name: 'Bay Hill Club & Lodge', city: 'Orlando', state: 'FL', access: 'private', list: ['pga_tour'] },
  { name: 'TPC Harding Park', city: 'San Francisco', state: 'CA', access: 'public', list: ['pga_tour', 'top_public'] },
  { name: 'Quail Hollow Club', city: 'Charlotte', state: 'NC', access: 'private', list: ['pga_tour', 'presidents_cup'] },
  { name: 'East Lake Golf Club', city: 'Atlanta', state: 'GA', access: 'private', list: ['pga_tour', 'top_private'] },
  { name: 'TPC Summerlin', city: 'Las Vegas', state: 'NV', access: 'private', list: ['pga_tour'] },
  { name: 'TPC River Highlands', city: 'Cromwell', state: 'CT', access: 'private', list: ['pga_tour'] },
  { name: 'TPC San Antonio (Oaks)', city: 'San Antonio', state: 'TX', access: 'resort', list: ['pga_tour'] },
  { name: 'TPC Twin Cities', city: 'Blaine', state: 'MN', access: 'private', list: ['pga_tour'] },
  { name: 'TPC Deere Run', city: 'Silvis', state: 'IL', access: 'public', list: ['pga_tour', 'top_public'] },
  { name: 'Sedgefield Country Club', city: 'Greensboro', state: 'NC', access: 'private', list: ['pga_tour'] },
  { name: 'Colonial Country Club', city: 'Fort Worth', state: 'TX', access: 'private', list: ['pga_tour', 'top_private'] },
  { name: 'Copperhead Course at Innisbrook', city: 'Palm Harbor', state: 'FL', access: 'resort', list: ['pga_tour', 'top_resort'] },
  { name: 'TPC Craig Ranch', city: 'McKinney', state: 'TX', access: 'private', list: ['pga_tour'] },
  { name: 'TPC Southwind', city: 'Memphis', state: 'TN', access: 'private', list: ['pga_tour'] },
  { name: 'Waialae Country Club', city: 'Honolulu', state: 'HI', access: 'private', list: ['pga_tour'] },
  { name: 'Silverado Resort (North)', city: 'Napa', state: 'CA', access: 'resort', list: ['pga_tour', 'top_resort'] },
  { name: 'The RSM Club (Seaside)', city: 'St. Simons Island', state: 'GA', access: 'private', list: ['pga_tour'] },
  { name: 'El Camaleón Golf Course', city: 'Playa del Carmen', state: 'MX', access: 'resort', list: ['pga_tour'] },
  { name: 'Congaree Golf Club', city: 'Ridgeland', state: 'SC', access: 'private', list: ['pga_tour', 'top_private'] },
  { name: 'Detroit Golf Club', city: 'Detroit', state: 'MI', access: 'private', list: ['pga_tour'] },
  { name: 'TPC Louisiana', city: 'Avondale', state: 'LA', access: 'private', list: ['pga_tour'] },
  { name: 'Caves Valley Golf Club', city: 'Owings Mills', state: 'MD', access: 'private', list: ['pga_tour', 'top_private'] },
];

// ─── Major Championship Hosts ────────────────────────────────────────────────

export const MAJOR_HOSTS: NationalCourse[] = [
  // Masters (always Augusta — already in PGA_TOUR_VENUES)
  // US Open hosts
  { name: 'Pinehurst No. 2', city: 'Pinehurst', state: 'NC', access: 'resort', list: ['major', 'top_resort'] },
  { name: 'Oakmont Country Club', city: 'Oakmont', state: 'PA', access: 'private', list: ['major', 'top_private'] },
  { name: 'Shinnecock Hills Golf Club', city: 'Southampton', state: 'NY', access: 'private', list: ['major', 'top_private'] },
  { name: 'Winged Foot Golf Club (West)', city: 'Mamaroneck', state: 'NY', access: 'private', list: ['major', 'top_private'] },
  { name: 'Merion Golf Club (East)', city: 'Ardmore', state: 'PA', access: 'private', list: ['major', 'top_private'] },
  { name: 'The Country Club', city: 'Brookline', state: 'MA', access: 'private', list: ['major', 'ryder_cup', 'top_private'] },
  { name: 'Olympic Club (Lake)', city: 'San Francisco', state: 'CA', access: 'private', list: ['major', 'top_private'] },
  { name: 'Congressional Country Club (Blue)', city: 'Bethesda', state: 'MD', access: 'private', list: ['major', 'top_private'] },
  { name: 'Bethpage Black', city: 'Farmingdale', state: 'NY', access: 'public', list: ['major', 'ryder_cup', 'top_public'] },
  { name: 'Erin Hills', city: 'Erin', state: 'WI', access: 'public', list: ['major', 'top_public'] },
  { name: 'Chambers Bay', city: 'University Place', state: 'WA', access: 'public', list: ['major', 'top_public'] },
  { name: 'Los Angeles Country Club (North)', city: 'Los Angeles', state: 'CA', access: 'private', list: ['major', 'top_private'] },
  // PGA Championship hosts
  { name: 'Southern Hills Country Club', city: 'Tulsa', state: 'OK', access: 'private', list: ['major', 'top_private'] },
  { name: 'Valhalla Golf Club', city: 'Louisville', state: 'KY', access: 'private', list: ['major', 'ryder_cup', 'top_private'] },
  { name: 'Kiawah Island Ocean Course', city: 'Kiawah Island', state: 'SC', access: 'resort', list: ['major', 'ryder_cup', 'top_resort'] },
  { name: 'Baltusrol Golf Club (Lower)', city: 'Springfield', state: 'NJ', access: 'private', list: ['major', 'top_private'] },
  { name: 'Bellerive Country Club', city: 'St. Louis', state: 'MO', access: 'private', list: ['major', 'top_private'] },
  { name: 'Oak Hill Country Club (East)', city: 'Rochester', state: 'NY', access: 'private', list: ['major', 'ryder_cup', 'top_private'] },
  { name: 'Hazeltine National Golf Club', city: 'Chaska', state: 'MN', access: 'private', list: ['major', 'ryder_cup', 'top_private'] },
  { name: 'Whistling Straits (Straits)', city: 'Haven', state: 'WI', access: 'public', list: ['major', 'ryder_cup', 'top_public'] },
  { name: 'Medinah Country Club (No. 3)', city: 'Medinah', state: 'IL', access: 'private', list: ['major', 'ryder_cup', 'top_private'] },
  { name: 'Harding Park Golf Course', city: 'San Francisco', state: 'CA', access: 'public', list: ['major', 'top_public'] },
];

// ─── Ryder Cup & Presidents Cup Hosts (not already listed above) ─────────────

export const RYDER_PRESIDENTS_HOSTS: NationalCourse[] = [
  { name: 'Marco Simone Golf & Country Club', city: 'Rome', state: 'IT', access: 'private', list: ['ryder_cup'] },
  { name: 'Le Golf National', city: 'Paris', state: 'FR', access: 'public', list: ['ryder_cup'] },
  { name: 'Gleneagles (PGA Centenary)', city: 'Perth', state: 'UK', access: 'resort', list: ['ryder_cup', 'top_resort'] },
  { name: 'Celtic Manor (Twenty Ten)', city: 'Newport', state: 'UK', access: 'resort', list: ['ryder_cup'] },
  { name: 'The K Club (Palmer)', city: 'Kildare', state: 'IE', access: 'resort', list: ['ryder_cup'] },
  { name: 'The Belfry (Brabazon)', city: 'Sutton Coldfield', state: 'UK', access: 'resort', list: ['ryder_cup'] },
  { name: 'Valderrama Golf Club', city: 'Sotogrande', state: 'ES', access: 'private', list: ['ryder_cup'] },
  { name: 'Royal Melbourne Golf Club (Composite)', city: 'Melbourne', state: 'AU', access: 'private', list: ['presidents_cup'] },
  { name: 'Liberty National Golf Club', city: 'Jersey City', state: 'NJ', access: 'private', list: ['presidents_cup', 'top_private'] },
  { name: 'Jack Nicklaus Golf Club Korea', city: 'Incheon', state: 'KR', access: 'private', list: ['presidents_cup'] },
];

// ─── Top Public Courses (additional, beyond those listed above) ──────────────

export const TOP_PUBLIC_EXTRA: NationalCourse[] = [
  { name: 'Bandon Dunes', city: 'Bandon', state: 'OR', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Pacific Dunes', city: 'Bandon', state: 'OR', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Old Macdonald', city: 'Bandon', state: 'OR', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Sheep Ranch', city: 'Bandon', state: 'OR', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Bandon Trails', city: 'Bandon', state: 'OR', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Streamsong Red', city: 'Bowling Green', state: 'FL', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Streamsong Blue', city: 'Bowling Green', state: 'FL', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Streamsong Black', city: 'Bowling Green', state: 'FL', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Whistling Straits (Irish)', city: 'Haven', state: 'WI', access: 'public', list: ['top_public'] },
  { name: 'Arcadia Bluffs', city: 'Arcadia', state: 'MI', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Sand Valley', city: 'Nekoosa', state: 'WI', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Mammoth Dunes', city: 'Nekoosa', state: 'WI', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Sedge Valley', city: 'Nekoosa', state: 'WI', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Cabot Cliffs', city: 'Inverness', state: 'NS', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Cabot Links', city: 'Inverness', state: 'NS', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Gamble Sands', city: 'Brewster', state: 'WA', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Sweetens Cove', city: 'South Pittsburg', state: 'TN', access: 'public', list: ['top_public'] },
  { name: 'Tobacco Road', city: 'Sanford', state: 'NC', access: 'public', list: ['top_public'] },
  { name: 'Rustic Canyon Golf Course', city: 'Moorpark', state: 'CA', access: 'public', list: ['top_public'] },
  { name: 'We-Ko-Pa (Saguaro)', city: 'Fort McDowell', state: 'AZ', access: 'public', list: ['top_public'] },
  { name: 'Barnbougle Dunes', city: 'Bridport', state: 'AU', access: 'resort', list: ['top_public'] },
  { name: 'Pasatiempo Golf Club', city: 'Santa Cruz', state: 'CA', access: 'public', list: ['top_public'] },
  { name: 'Lawsonia Links', city: 'Green Lake', state: 'WI', access: 'public', list: ['top_public'] },
  { name: 'The Loop (Black)', city: 'Roscommon', state: 'MI', access: 'public', list: ['top_public'] },
  { name: 'French Lick (Dye)', city: 'French Lick', state: 'IN', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Circling Raven Golf Club', city: 'Worley', state: 'ID', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'TPC Danzante Bay', city: 'Loreto', state: 'MX', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Coore Crenshaw Course at Cabot Citrus Farms', city: 'Lecanto', state: 'FL', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Pinehurst No. 4', city: 'Pinehurst', state: 'NC', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Pinehurst No. 8', city: 'Pinehurst', state: 'NC', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'World Woods (Pine Barrens)', city: 'Brooksville', state: 'FL', access: 'public', list: ['top_public'] },
  { name: 'Cog Hill No. 4 (Dubsdread)', city: 'Lemont', state: 'IL', access: 'public', list: ['top_public'] },
  { name: 'The Lido at Sand Valley', city: 'Nekoosa', state: 'WI', access: 'resort', list: ['top_public', 'top_resort'] },
  { name: 'Cabot Highlands', city: 'Dornoch', state: 'UK', access: 'resort', list: ['top_public', 'top_resort'] },
];

// ─── Top Private Courses (additional) ────────────────────────────────────────

export const TOP_PRIVATE_EXTRA: NationalCourse[] = [
  { name: 'Pine Valley Golf Club', city: 'Pine Valley', state: 'NJ', access: 'private', list: ['top_private'] },
  { name: 'Cypress Point Club', city: 'Pebble Beach', state: 'CA', access: 'private', list: ['top_private'] },
  { name: 'National Golf Links of America', city: 'Southampton', state: 'NY', access: 'private', list: ['top_private'] },
  { name: 'Chicago Golf Club', city: 'Wheaton', state: 'IL', access: 'private', list: ['top_private'] },
  { name: 'Fishers Island Club', city: 'Fishers Island', state: 'NY', access: 'private', list: ['top_private'] },
  { name: 'Sand Hills Golf Club', city: 'Mullen', state: 'NE', access: 'private', list: ['top_private'] },
  { name: 'Crystal Downs Country Club', city: 'Frankfort', state: 'MI', access: 'private', list: ['top_private'] },
  { name: 'Seminole Golf Club', city: 'Juno Beach', state: 'FL', access: 'private', list: ['top_private'] },
  { name: 'Garden City Golf Club', city: 'Garden City', state: 'NY', access: 'private', list: ['top_private'] },
  { name: 'Maidstone Club', city: 'East Hampton', state: 'NY', access: 'private', list: ['top_private'] },
  { name: 'San Francisco Golf Club', city: 'San Francisco', state: 'CA', access: 'private', list: ['top_private'] },
  { name: 'Friar\'s Head', city: 'Baiting Hollow', state: 'NY', access: 'private', list: ['top_private'] },
  { name: 'Somerset Hills Country Club', city: 'Bernardsville', state: 'NJ', access: 'private', list: ['top_private'] },
  { name: 'Prairie Dunes Country Club', city: 'Hutchinson', state: 'KS', access: 'private', list: ['top_private'] },
  { name: 'Camargo Club', city: 'Indian Hill', state: 'OH', access: 'private', list: ['top_private'] },
  { name: 'Wade Hampton Golf Club', city: 'Cashiers', state: 'NC', access: 'private', list: ['top_private'] },
  { name: 'Calusa Pines Golf Club', city: 'Naples', state: 'FL', access: 'private', list: ['top_private'] },
  { name: 'Shoreacres', city: 'Lake Bluff', state: 'IL', access: 'private', list: ['top_private'] },
  { name: 'Yeamans Hall Club', city: 'Hanahan', state: 'SC', access: 'private', list: ['top_private'] },
  { name: 'The Honors Course', city: 'Ooltewah', state: 'TN', access: 'private', list: ['top_private'] },
  { name: 'Brook Hollow Golf Club', city: 'Dallas', state: 'TX', access: 'private', list: ['top_private'] },
  { name: 'Peachtree Golf Club', city: 'Atlanta', state: 'GA', access: 'private', list: ['top_private'] },
  { name: 'Newport Country Club', city: 'Newport', state: 'RI', access: 'private', list: ['top_private'] },
  { name: 'Plainfield Country Club', city: 'Edison', state: 'NJ', access: 'private', list: ['top_private'] },
  { name: 'Old Sandwich Golf Club', city: 'Plymouth', state: 'MA', access: 'private', list: ['top_private'] },
  { name: 'Mountain Lake', city: 'Lake Wales', state: 'FL', access: 'private', list: ['top_private'] },
  { name: 'Nanea Golf Club', city: 'Kailua-Kona', state: 'HI', access: 'private', list: ['top_private'] },
  { name: 'Flint Hills National Golf Club', city: 'Andover', state: 'KS', access: 'private', list: ['top_private'] },
  { name: 'Butler National Golf Club', city: 'Oak Brook', state: 'IL', access: 'private', list: ['top_private'] },
  { name: 'Valley Club of Montecito', city: 'Santa Barbara', state: 'CA', access: 'private', list: ['top_private'] },
  { name: 'Milwaukee Country Club', city: 'River Hills', state: 'WI', access: 'private', list: ['top_private'] },
  { name: 'Bel-Air Country Club', city: 'Los Angeles', state: 'CA', access: 'private', list: ['top_private'] },
  { name: 'Olde Farm Golf Club', city: 'Bristol', state: 'VA', access: 'private', list: ['top_private'] },
  { name: 'Mountaintop Golf & Lake Club', city: 'Cashiers', state: 'NC', access: 'private', list: ['top_private'] },
  { name: 'Querencia Golf Club', city: 'San José del Cabo', state: 'MX', access: 'private', list: ['top_private'] },
];

// ─── Top Resort / Destination Courses (additional) ───────────────────────────

export const TOP_RESORTS_EXTRA: NationalCourse[] = [
  { name: 'Kapalua (Plantation)', city: 'Lahaina', state: 'HI', access: 'resort', list: ['top_resort', 'pga_tour'] },
  { name: 'Kiawah Island (Osprey Point)', city: 'Kiawah Island', state: 'SC', access: 'resort', list: ['top_resort'] },
  { name: 'Kiawah Island (Turtle Point)', city: 'Kiawah Island', state: 'SC', access: 'resort', list: ['top_resort'] },
  { name: 'Whistling Straits (Irish)', city: 'Haven', state: 'WI', access: 'resort', list: ['top_resort'] },
  { name: 'TPC Sawgrass (Dye\'s Valley)', city: 'Ponte Vedra Beach', state: 'FL', access: 'resort', list: ['top_resort'] },
  { name: 'Pinehurst No. 1', city: 'Pinehurst', state: 'NC', access: 'resort', list: ['top_resort'] },
  { name: 'Pinehurst No. 9', city: 'Pinehurst', state: 'NC', access: 'resort', list: ['top_resort'] },
  { name: 'Spyglass Hill Golf Course', city: 'Pebble Beach', state: 'CA', access: 'resort', list: ['top_resort', 'pga_tour'] },
  { name: 'The Links at Spanish Bay', city: 'Pebble Beach', state: 'CA', access: 'resort', list: ['top_resort'] },
  { name: 'Kohler (Blackwolf Run River)', city: 'Kohler', state: 'WI', access: 'resort', list: ['top_resort'] },
  { name: 'Sea Island (Seaside)', city: 'St. Simons Island', state: 'GA', access: 'resort', list: ['top_resort'] },
  { name: 'Sea Island (Plantation)', city: 'St. Simons Island', state: 'GA', access: 'resort', list: ['top_resort'] },
  { name: 'Reynolds Lake Oconee (Great Waters)', city: 'Greensboro', state: 'GA', access: 'resort', list: ['top_resort'] },
  { name: 'Caledonia Golf & Fish Club', city: 'Pawleys Island', state: 'SC', access: 'resort', list: ['top_resort'] },
  { name: 'Barnsley Resort Golf Course', city: 'Adairsville', state: 'GA', access: 'resort', list: ['top_resort'] },
  { name: 'Primland (Highland)', city: 'Meadows of Dan', state: 'VA', access: 'resort', list: ['top_resort'] },
  { name: 'Troon North (Monument)', city: 'Scottsdale', state: 'AZ', access: 'resort', list: ['top_resort'] },
  { name: 'Troon North (Pinnacle)', city: 'Scottsdale', state: 'AZ', access: 'resort', list: ['top_resort'] },
  { name: 'Fallen Oak Golf Course', city: 'Biloxi', state: 'MS', access: 'resort', list: ['top_resort'] },
  { name: 'Ross Bridge Golf Resort', city: 'Hoover', state: 'AL', access: 'resort', list: ['top_resort'] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get all unique national list courses (deduplicated by name). */
export function getAllNationalCourses(): NationalCourse[] {
  const all = [
    ...PGA_TOUR_VENUES,
    ...MAJOR_HOSTS,
    ...RYDER_PRESIDENTS_HOSTS,
    ...TOP_PUBLIC_EXTRA,
    ...TOP_PRIVATE_EXTRA,
    ...TOP_RESORTS_EXTRA,
  ];

  const seen = new Map<string, NationalCourse>();
  for (const course of all) {
    const key = course.name.toLowerCase();
    if (seen.has(key)) {
      // Merge list tags
      const existing = seen.get(key)!;
      const merged = new Set([...existing.list, ...course.list]);
      existing.list = Array.from(merged);
    } else {
      seen.set(key, { ...course });
    }
  }
  return Array.from(seen.values());
}

/** Get courses by list type. */
export function getCoursesByList(listType: string): NationalCourse[] {
  return getAllNationalCourses().filter((c) => c.list.includes(listType));
}
