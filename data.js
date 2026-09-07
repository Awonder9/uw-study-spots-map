// UW–Madison Study Spots dataset
// Coordinates are geocoded (via OpenStreetMap/Nominatim) to building-level precision —
// accurate enough to place a pin correctly, but always confirm exact room/floor via
// the building directory.

export const CATEGORY_META = {
  "Library":           { color: "#C5050C", icon: "fa-solid fa-book",              label: "Library" },
  "Student Union":      { color: "#E0A82E", icon: "fa-solid fa-people-roof",       label: "Student Union" },
  "Academic Building":  { color: "#3D6C8A", icon: "fa-solid fa-building-columns",  label: "Academic Building" },
  "Outdoor":            { color: "#4C8C5B", icon: "fa-solid fa-tree",              label: "Outdoor" },
  "Dining Hall":        { color: "#C97A3D", icon: "fa-solid fa-utensils",          label: "Dining Hall" },
  "Coffee Shop":        { color: "#6B4226", icon: "fa-solid fa-mug-hot",           label: "Coffee Shop" }
};

// Curated filter chips (subset of all tags, chosen for usefulness)
export const FILTER_TAGS = [
  "Quiet", "Chill", "Social", "Lively",
  "University", "Off-Campus",
  "Group-Friendly", "Solo-Friendly",
  "Food & Coffee", "Late Hours", "Lake View", "Hidden Gem"
];

export const STUDY_SPOTS = [
  {
    id: "college-library",
    name: "College Library",
    category: "Library",
    affiliation: "University",
    address: "600 N Park St, Madison, WI 53706",
    lat: 43.076685, lng: -89.401313,
    description: "The busiest library on campus and a favorite for undergrads — open late into the night with a mix of group rooms, comfy chairs, and quiet floors depending on what mode you're in.",
    tags: ["University", "Library", "Social", "Group-Friendly", "Late Hours", "Food & Coffee"]
  },
  {
    id: "memorial-library",
    name: "Memorial Library",
    category: "Library",
    affiliation: "University",
    address: "728 State St, Madison, WI 53706",
    lat: 43.075027, lng: -89.399918,
    description: "UW's main research library — tall stacks, individual carrels, and a serious, hushed atmosphere that's ideal when you actually need to focus.",
    tags: ["University", "Library", "Quiet", "Solo-Friendly"]
  },
  {
    id: "steenbock-library",
    name: "Steenbock Library",
    category: "Library",
    affiliation: "University",
    address: "550 Babcock Dr, Madison, WI 53706",
    lat: 43.076104, lng: -89.413372,
    description: "Tucked into the Ag campus near the dairy plant, Steenbock serves life-sciences students but welcomes anyone chasing a quiet table without the College Library crowds.",
    tags: ["University", "Library", "Quiet", "Hidden Gem", "Solo-Friendly"]
  },
  {
    id: "wendt-library",
    name: "Wendt Commons Library",
    category: "Library",
    affiliation: "University",
    address: "215 N Randall Ave, Madison, WI 53706",
    lat: 43.071509, lng: -89.408633,
    description: "The engineering library and study commons — bright, modern, and stocked with computer labs and free printing, popular with STEM students grinding through problem sets.",
    tags: ["University", "Library", "Group-Friendly", "Late Hours"]
  },
  {
    id: "law-library",
    name: "Law Library Reading Room",
    category: "Library",
    affiliation: "University",
    address: "975 Lathrop Dr, Madison, WI 53706 (Law Building)",
    lat: 43.074595, lng: -89.402248,
    description: "A grand, wood-paneled reading room that feels more like a private study hall than a law library — one of campus's most underrated quiet spots.",
    tags: ["University", "Library", "Quiet", "Hidden Gem", "Solo-Friendly"]
  },
  {
    id: "business-library",
    name: "Business Library",
    category: "Library",
    affiliation: "University",
    address: "975 University Ave, Madison, WI 53706 (Grainger Hall)",
    lat: 43.072695, lng: -89.401563,
    description: "Sleek and modern — regularly cited by students as the nicest library on campus, with plenty of natural light and comfortable seating throughout Grainger Hall.",
    tags: ["University", "Library", "Chill", "Group-Friendly"]
  },
  {
    id: "merit-library",
    name: "MERIT Library",
    category: "Library",
    affiliation: "University",
    address: "225 N Mills St, Madison, WI 53706 (Teacher Education Building)",
    lat: 43.071285, lng: -89.403612,
    description: "The School of Education's library, known for bean bag chairs and a laid-back, low-traffic vibe that's great for an easy afternoon of reading.",
    tags: ["University", "Library", "Chill", "Hidden Gem"]
  },
  {
    id: "kohler-art-library",
    name: "Kohler Art Library",
    category: "Library",
    affiliation: "University",
    address: "800 University Ave, Madison, WI 53706 (Elvehjem Building)",
    lat: 43.073964, lng: -89.399423,
    description: "A calm, art-focused collection inside the Chazen Museum complex — great light, gallery-adjacent quiet, and rarely crowded.",
    tags: ["University", "Library", "Quiet", "Hidden Gem"]
  },
  {
    id: "ebling-library",
    name: "Ebling Library",
    category: "Library",
    affiliation: "University",
    address: "750 Highland Ave, Madison, WI 53705 (Health Sciences Learning Center)",
    lat: 43.07775, lng: -89.429789,
    description: "The library for med, pharmacy, and nursing students out on the health sciences campus — modern facilities and long hours during exam season.",
    tags: ["University", "Library", "Quiet", "Late Hours", "Group-Friendly"]
  },
  {
    id: "robinson-map-library",
    name: "Robinson Map Library",
    category: "Library",
    affiliation: "University",
    address: "550 N Park St, Madison, WI 53706 (Science Hall)",
    lat: 43.07588, lng: -89.401061,
    description: "A small, quaint collection inside historic Science Hall — a genuinely quiet, out-of-the-way corner of campus that few students know about.",
    tags: ["University", "Library", "Quiet", "Hidden Gem", "Solo-Friendly"]
  },
  {
    id: "limnology-library",
    name: "Limnology Library",
    category: "Library",
    affiliation: "University",
    address: "680 N Park St, Madison, WI 53706",
    lat: 43.077257, lng: -89.402966,
    description: "A tiny specialized library near the lake that's almost always empty — as close to guaranteed silence as campus gets.",
    tags: ["University", "Library", "Quiet", "Hidden Gem", "Solo-Friendly", "Lake View"]
  },
  {
    id: "social-work-library",
    name: "Social Work Library",
    category: "Library",
    affiliation: "University",
    address: "1350 University Ave, Madison, WI 53706",
    lat: 43.074204, lng: -89.408208,
    description: "A welcoming, inclusive space with plenty of computers and printing — smaller and calmer than the big central libraries.",
    tags: ["University", "Library", "Chill"]
  },
  {
    id: "journalism-reading-room",
    name: "Journalism Reading Room",
    category: "Library",
    affiliation: "University",
    address: "821 University Ave, Madison, WI 53706 (Vilas Hall)",
    lat: 43.072674, lng: -89.399822,
    description: "A bright reading room with newer Mac workstations, tucked inside the Communication Arts building near Park Street.",
    tags: ["University", "Library", "Quiet"]
  },
  {
    id: "memorial-union-terrace",
    name: "Memorial Union Terrace",
    category: "Outdoor",
    affiliation: "University",
    address: "800 Langdon St, Madison, WI 53706",
    lat: 43.07652, lng: -89.4003,
    description: "Campus's most iconic spot, period — sunburst chairs, brats, live music, and a straight-on view of Lake Mendota. The best \"study\" spot for anyone who works better outside with a little background buzz.",
    tags: ["University", "Outdoor", "Social", "Lake View", "Food & Coffee"]
  },
  {
    id: "hamel-browsing-library",
    name: "Hamel Family Browsing Library",
    category: "Student Union",
    affiliation: "University",
    address: "800 Langdon St, Madison, WI 53706 (Memorial Union, 2nd floor)",
    lat: 43.07652, lng: -89.4003,
    description: "A quiet, plush reading room on the Union's second floor — genuinely silent, with generous seating that rarely fills up.",
    tags: ["University", "Student Union", "Quiet", "Solo-Friendly", "Hidden Gem"]
  },
  {
    id: "lakefront-lounge",
    name: "Lakefront Lounge",
    category: "Student Union",
    affiliation: "University",
    address: "800 Langdon St, Madison, WI 53706 (Memorial Union, main floor)",
    lat: 43.07652, lng: -89.4003,
    description: "A recently renovated lounge with big lake-facing windows, built for collaborative work and easy conversation over coffee.",
    tags: ["University", "Student Union", "Social", "Lake View", "Food & Coffee"]
  },
  {
    id: "shannon-sunset-lounge",
    name: "Shannon Sunset Lounge",
    category: "Student Union",
    affiliation: "University",
    address: "800 Langdon St, Madison, WI 53706 (Memorial Union, west end)",
    lat: 43.07652, lng: -89.4003,
    description: "Cozy armchairs, a fireplace, and near-panoramic lake views make this one of the Union's most relaxing corners for slow reading.",
    tags: ["University", "Student Union", "Chill", "Lake View", "Hidden Gem"]
  },
  {
    id: "union-study-pods",
    name: "Memorial Union Study Pods",
    category: "Student Union",
    affiliation: "University",
    address: "800 Langdon St, Madison, WI 53706 (near Gekas Commons)",
    lat: 43.07652, lng: -89.4003,
    description: "Individual pod seating with outlets right next to Peet's Coffee — solo-focused and easy to duck in and out of between classes.",
    tags: ["University", "Student Union", "Quiet", "Solo-Friendly", "Food & Coffee"]
  },
  {
    id: "prairie-fire-lounge",
    name: "Prairie Fire Lounge",
    category: "Student Union",
    affiliation: "University",
    address: "1308 W Dayton St, Madison, WI 53715 (Union South)",
    lat: 43.072211, lng: -89.408637,
    description: "A quiet study lounge with soft music and nature-inspired décor — Union South's answer to a calm study room, with coffee and tapas close by.",
    tags: ["University", "Student Union", "Quiet", "Chill", "Food & Coffee"]
  },
  {
    id: "the-sett",
    name: "The Sett & Sett Balcony",
    category: "Student Union",
    affiliation: "University",
    address: "1308 W Dayton St, Madison, WI 53715 (Union South)",
    lat: 43.072211, lng: -89.408637,
    description: "A lively food-hall-style space with a second-floor balcony that has outlets and charging ports — good for group work when you want food within reach.",
    tags: ["University", "Student Union", "Social", "Lively", "Group-Friendly", "Food & Coffee"]
  },
  {
    id: "cs-6th-floor",
    name: "Computer Sciences 6th Floor Lounge",
    category: "Academic Building",
    affiliation: "University",
    address: "1210 W Dayton St, Madison, WI 53706",
    lat: 43.071559, lng: -89.406707,
    description: "A low-key top-floor lounge with a surprisingly pleasant vibe — a solid, under-the-radar spot away from the busier lower floors.",
    tags: ["University", "Academic Building", "Quiet", "Hidden Gem"]
  },
  {
    id: "cs-patio",
    name: "Computer Sciences Patio",
    category: "Outdoor",
    affiliation: "University",
    address: "1210 W Dayton St, Madison, WI 53706",
    lat: 43.071559, lng: -89.406707,
    description: "A tiered outdoor patio with multiple seating levels — a solid pick for a laptop session on a warm afternoon between CS classes.",
    tags: ["University", "Outdoor", "Chill", "Hidden Gem"]
  },
  {
    id: "chemistry-upper-floors",
    name: "Chemistry Building — 7th & 8th Floor",
    category: "Academic Building",
    affiliation: "University",
    address: "1101 University Ave, Madison, WI 53706",
    lat: 43.072717, lng: -89.404565,
    description: "High-floor window seating with some of the best campus views around — students rate the 8th floor as the slightly better of the two.",
    tags: ["University", "Academic Building", "Quiet", "Hidden Gem", "Solo-Friendly"]
  },
  {
    id: "education-5th-floor",
    name: "Education Building — 5th Floor",
    category: "Academic Building",
    affiliation: "University",
    address: "1000 Observatory Dr, Madison, WI 53706",
    lat: 43.07584, lng: -89.402291,
    description: "Standing desks and modern study pods give this floor a startup-office feel — modern, uncrowded, and easy to find a spot.",
    tags: ["University", "Academic Building", "Quiet", "Chill", "Hidden Gem"]
  },
  {
    id: "biochem-301",
    name: "Biochemistry Room 301",
    category: "Academic Building",
    affiliation: "University",
    address: "433 Babcock Dr, Madison, WI 53706",
    lat: 43.074137, lng: -89.412024,
    description: "Configurable breakout rooms make this a solid pick for small group study sessions on the Ag-campus side of things.",
    tags: ["University", "Academic Building", "Group-Friendly", "Hidden Gem"]
  },
  {
    id: "biochem-kitchen",
    name: "Biochemistry 4th Floor Kitchen",
    category: "Academic Building",
    affiliation: "University",
    address: "433 Babcock Dr, Madison, WI 53706",
    lat: 43.074137, lng: -89.412024,
    description: "A social, kitchen-adjacent lounge with good views — livelier than most academic-building spots, good for a study break with friends.",
    tags: ["University", "Academic Building", "Social", "Lively"]
  },
  {
    id: "soils-258",
    name: "Soils Building, Room 258",
    category: "Academic Building",
    affiliation: "University",
    address: "1525 Observatory Dr, Madison, WI 53706",
    lat: 43.076476, lng: -89.411294,
    description: "A genuinely cute room lined with plants and bookshelves — one of the more charming, least-known corners of the Ag campus.",
    tags: ["University", "Academic Building", "Chill", "Hidden Gem"]
  },
  {
    id: "badger-market",
    name: "Microbial Sciences Badger Market",
    category: "Academic Building",
    affiliation: "University",
    address: "1550 Linden Dr, Madison, WI 53706",
    lat: 43.075872, lng: -89.412266,
    description: "Open café-style seating with food service on hand, making it an easy stop for anyone studying on the west side of the Ag campus.",
    tags: ["University", "Academic Building", "Social", "Food & Coffee"]
  },
  {
    id: "engineering-computer-labs",
    name: "Engineering Hall Computer Labs",
    category: "Academic Building",
    affiliation: "University",
    address: "1415 Engineering Dr, Madison, WI 53706",
    lat: 43.071766, lng: -89.410288,
    description: "Well-equipped computer labs with free printing — a dependable, no-frills option for engineering students needing lab software.",
    tags: ["University", "Academic Building", "Group-Friendly"]
  },
  {
    id: "wid",
    name: "Wisconsin Institute for Discovery",
    category: "Academic Building",
    affiliation: "University",
    address: "330 N Orchard St, Madison, WI 53715",
    lat: 43.072818, lng: -89.408067,
    description: "An airy, glass-walled atrium built for interdisciplinary collaboration — modern furniture, tall ceilings, and a research-hub energy.",
    tags: ["University", "Academic Building", "Chill", "Group-Friendly", "Hidden Gem"]
  },
  {
    id: "university-club",
    name: "University Club",
    category: "Student Union",
    affiliation: "University",
    address: "803 State St, Madison, WI 53706",
    lat: 43.074856, lng: -89.399809,
    description: "A two-floor space with games alongside study seating — an easygoing option right at the base of Bascom Hill.",
    tags: ["University", "Chill", "Social", "Hidden Gem"]
  },
  {
    id: "geo-sciences-picnic",
    name: "Geological Sciences Picnic Tables",
    category: "Outdoor",
    affiliation: "University",
    address: "1215 W Dayton St, Madison, WI 53706 (Weeks Hall)",
    lat: 43.070526, lng: -89.405939,
    description: "Simple picnic tables outside Weeks Hall — unglamorous but pleasant on a nice day, and rarely busy.",
    tags: ["University", "Outdoor", "Quiet", "Hidden Gem"]
  },
  {
    id: "energy-institute-patio",
    name: "Energy Institute Patio",
    category: "Outdoor",
    affiliation: "University",
    address: "1552 University Ave, Madison, WI 53726",
    lat: 43.073735, lng: -89.414038,
    description: "A sunny patio that turns into one of the best warm-weather hangouts on the engineering side of campus.",
    tags: ["University", "Outdoor", "Social", "Hidden Gem"]
  },
  {
    id: "greenhouse-benches",
    name: "D.C. Smith Greenhouse Benches",
    category: "Outdoor",
    affiliation: "University",
    address: "465 Babcock Dr, Madison, WI 53706",
    lat: 43.074806, lng: -89.412501,
    description: "Benches tucked next to the botany greenhouses — fresh air, plants, and about as peaceful as campus gets.",
    tags: ["University", "Outdoor", "Quiet", "Chill", "Hidden Gem"]
  },
  {
    id: "library-mall",
    name: "Library Mall",
    category: "Outdoor",
    affiliation: "University",
    address: "State St & N Park St, Madison, WI 53703",
    lat: 43.07529, lng: -89.399068,
    description: "The plaza where State Street meets campus — food carts, people-watching, and enough energy to make studying feel social.",
    tags: ["University", "Outdoor", "Social", "Lively", "Food & Coffee"]
  },
  {
    id: "lakeshore-path",
    name: "Lakeshore Path / Class of 1918 Marsh",
    category: "Outdoor",
    affiliation: "University",
    address: "Lakeshore Path, Madison, WI 53706 (near Memorial Union)",
    lat: 43.077108, lng: -89.400473,
    description: "A wooded, waterside trail a short walk from the Union — the closest thing to nature-immersion studying you'll find on campus.",
    tags: ["University", "Outdoor", "Quiet", "Chill", "Lake View", "Hidden Gem"]
  },
  {
    id: "gordon-dining",
    name: "Gordon Dining & Event Center",
    category: "Dining Hall",
    affiliation: "University",
    address: "770 W Dayton St, Madison, WI 53715",
    lat: 43.071152, lng: -89.39838,
    description: "A dining hall with generous open seating on the upper floors — a favorite for students who like to study with food always in reach.",
    tags: ["University", "Dining Hall", "Social", "Food & Coffee", "Late Hours"]
  },
  {
    id: "colectivo-state",
    name: "Colectivo Coffee — State Street",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "583 State St, Madison, WI 53703",
    lat: 43.074668, lng: -89.395589,
    description: "A colorful, buzzing café a short walk from campus with strong espresso and enough space to camp out for a few hours.",
    tags: ["Off-Campus", "Coffee Shop", "Social", "Food & Coffee"]
  },
  {
    id: "michelangelos",
    name: "Michelangelo's Coffee House",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "114 State St, Madison, WI 53703",
    lat: 43.074902, lng: -89.387222,
    description: "A State Street institution near the Capitol with an eclectic, artsy interior and a loyal late-night crowd.",
    tags: ["Off-Campus", "Coffee Shop", "Social", "Late Hours", "Food & Coffee"]
  },
  {
    id: "fair-trade",
    name: "Fair Trade Coffee House",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "418 State St, Madison, WI 53703",
    lat: 43.074994, lng: -89.392048,
    description: "A cozy, community-minded café on State Street known for good sandwiches and bakery items alongside its coffee.",
    tags: ["Off-Campus", "Coffee Shop", "Chill", "Food & Coffee"]
  },
  {
    id: "indie-coffee",
    name: "Indie Coffee",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "1225 Regent St, Madison, WI 53715",
    lat: 43.067566, lng: -89.406563,
    description: "A neighborhood coffee shop near Camp Randall with a relaxed, local feel — a nice break from the campus-core crowds.",
    tags: ["Off-Campus", "Coffee Shop", "Chill", "Food & Coffee"]
  },
  {
    id: "evp-coffee",
    name: "EVP Coffee — University Row",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "741 University Row, Madison, WI 53705",
    lat: 43.076138, lng: -89.469167,
    description: "A spacious west-campus coffee shop with plenty of tables, popular with grad students and staff from nearby research buildings.",
    tags: ["Off-Campus", "Coffee Shop", "Chill", "Food & Coffee"]
  },
  {
    id: "barriques-monroe",
    name: "Barriques — Monroe Street",
    category: "Coffee Shop",
    affiliation: "Off-Campus",
    address: "1825 Monroe St, Madison, WI 53711",
    lat: 43.064948, lng: -89.416601,
    description: "A wine-shop-meets-café in the Monroe Street neighborhood, with a full breakfast and lunch menu and a warm, neighborhood feel.",
    tags: ["Off-Campus", "Coffee Shop", "Social", "Food & Coffee"]
  },
  {
    id: "upper-house",
    name: "Upper House",
    category: "Student Union",
    affiliation: "Off-Campus",
    address: "365 East Campus Mall, Madison, WI 53715",
    lat: 43.072793, lng: -89.398925,
    description: "A strikingly designed lounge right on East Campus Mall — circular tables, booths, and reservable private study rooms, run by a Christian study center but open to all students. Open weekdays 9am–5pm only, so plan around it.",
    tags: ["Off-Campus", "Student Union", "Quiet", "Chill", "Group-Friendly", "Hidden Gem", "Food & Coffee"]
  },
  {
    id: "historical-society-library",
    name: "Wisconsin Historical Society Library",
    category: "Library",
    affiliation: "Off-Campus",
    address: "816 State St, Madison, WI 53706",
    lat: 43.075405, lng: -89.400069,
    description: "A serious, no-talking research library right next door to Memorial Library — marble halls and an almost reverent hush make it one of the strictest quiet spaces near campus.",
    tags: ["Off-Campus", "Library", "Quiet", "Hidden Gem", "Solo-Friendly"]
  },
  {
    id: "babcock-dairy-store",
    name: "Babcock Dairy Store",
    category: "Coffee Shop",
    affiliation: "University",
    address: "1605 Linden Dr, Madison, WI 53706 (Babcock Hall)",
    lat: 43.074792, lng: -89.413673,
    description: "A low-key café inside UW's own dairy plant near the Bakke Rec Center — better known for ice cream, but a genuinely quiet, off-the-radar coffee break most students never discover.",
    tags: ["University", "Coffee Shop", "Chill", "Hidden Gem", "Food & Coffee"]
  },
  {
    id: "st-francis-house",
    name: "St. Francis House",
    category: "Student Union",
    affiliation: "Off-Campus",
    address: "1011 University Ave, Madison, WI 53715",
    lat: 43.073221, lng: -89.402702,
    description: "An Episcopal student center on University Avenue with a dedicated study room — big tables, leather chairs, and soft background music, open to students of any faith or none.",
    tags: ["Off-Campus", "Quiet", "Chill", "Hidden Gem"]
  }
];
