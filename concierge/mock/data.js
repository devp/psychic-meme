// Made-up everything. Nothing outside mock/ imports this; mock/service.js turns
// it into the shapes in lib/types.js.
//
// Collections carry flat tags. Galleries and the concierge are both just
// questions asked of those tags, so adding a collection is one line here.

/** @type {import("../lib/types.js").Config} */
export const CONFIG = {
  brand: "Mockza",
  prompt: "Play music for",
  refinePrompt: "Pick a flavor",
  collectionNoun: "stations",
  searchPlaceholder: "Search",
  notice: {
    text: "for share-worthy fake music, invented bands, and playlists nobody made.",
    linkText: "Mockza Daily",
    href: "#/browse/moods",
  },
};

/**
 * [id, title, description, tags]
 * @type {[string, string, string, string][]}
 */
export const COLLECTIONS = [
  ["sunrise-acoustic", "Sunrise Acoustic", "Gentle strums for easing into the day.", "folk mellow waking coffee 10s"],
  ["blue-sky-indie-pop", "Blue Sky Indie Pop", "Handclaps, glockenspiels and no clouds at all.", "indie happy waking commute walking 10s"],
  ["coffeehouse-corner", "Coffeehouse Corner", "The table by the window, a refill, and a guitar.", "folk cozy coffee reading 00s"],
  ["bossa-for-breakfast", "Bossa for Breakfast", "Nylon strings and soft percussion with your toast.", "world mellow coffee cooking 60s"],
  ["windows-down", "Windows Down", "Big choruses for an open road and one free arm.", "rock energetic commute 80s"],
  ["morning-commute-mix", "Morning Commute Mix", "Something to hum on the 7 train.", "pop happy commute hits now"],
  ["new-wave-commute", "New Wave Commute", "Synths, skinny ties and a brisk walk to the platform.", "pop energetic commute work-fun 80s"],
  ["lift-heavy-hip-hop", "Lift Heavy Hip-Hop", "One more rep. Then one more.", "hiphop energetic workout 00s"],
  ["electro-cardio", "Electro Cardio", "128 beats a minute, same as you in a moment.", "electronic energetic workout party 10s"],
  ["runners-high-rock", "Runner's High Rock", "Guitars that keep pace past mile three.", "rock energetic workout 90s"],
  ["arena-rock-anthems", "Arena Rock Anthems", "Lighters up. Treadmill optional.", "rock energetic workout commute 80s"],
  ["deep-focus-ambient", "Deep Focus Ambient", "Slow weather for getting something done.", "ambient focused focus coding 10s"],
  ["classical-for-studying", "Classical for Studying", "Strings and keys that stay out of your way.", "classical focused focus reading"],
  ["lo-fi-beats-no-lyrics", "Lo-Fi Beats, No Lyrics", "Dusty drums, warm keys, nobody talking.", "hiphop focused mellow focus coding now"],
  ["post-rock-productivity", "Post-Rock Productivity", "Ten-minute crescendos for ten-minute tasks.", "rock focused moody focus 00s"],
  ["office-party-classics", "Office Party Classics", "The songs everybody in the row knows.", "pop happy work-fun party 80s"],
  ["motown-at-your-desk", "Motown at Your Desk", "Tambourines make spreadsheets go faster.", "soul happy work-fun cooking 60s"],
  ["funk-break", "Funk Break", "Bass lines for the three o'clock slump.", "soul energetic work-fun housework 70s"],
  ["fresh-this-week", "Fresh This Week", "Pop that didn't exist last Friday.", "pop happy new now"],
  ["indie-just-landed", "Indie Just Landed", "New bands, new records, first listens.", "indie dreamy new now"],
  ["new-beats-on-the-block", "New Beats on the Block", "This week in hip-hop and its neighbors.", "hiphop electronic energetic new now"],
  ["todays-chart-toppers", "Today's Chart Toppers", "What everyone else is playing right now.", "pop energetic hits party now"],
  ["hits-of-the-2010s", "Hits of the 2010s", "The decade that just happened, in order of loudness.", "pop happy hits party 10s"],
  ["90s-radio-rewind", "90s Radio Rewind", "Call in your request; lines are open.", "pop happy hits housework 90s"],
  ["kitchen-swing", "Kitchen Swing", "Horns to chop onions by.", "jazz happy cooking dinner"],
  ["italian-dinner-table", "Italian Dinner Table", "Mandolins, red sauce, a second helping.", "world cozy cooking dinner 60s"],
  ["dinner-party-jazz", "Dinner Party Jazz", "Quiet enough to talk over, good enough to notice.", "jazz cozy dinner 60s"],
  ["sofa-soul", "Sofa Soul", "Slow jams for a horizontal evening.", "soul mellow unwinding dinner 70s"],
  ["rainy-day-indie", "Rainy Day Indie", "Minor keys and a window to look out of.", "indie moody unwinding reading 00s"],
  ["sunset-chillwave", "Sunset Chillwave", "Hazy synths for the golden hour.", "electronic dreamy unwinding walking 10s"],
  ["page-turner-piano", "Page-Turner Piano", "Solo piano, one more chapter.", "classical mellow reading bedtime"],
  ["saturday-night-disco", "Saturday Night Disco", "Four on the floor and a mirror ball.", "soul festive party 70s"],
  ["house-party-starter", "House Party Starter", "For the first hour, before anyone dances.", "electronic festive energetic party 10s"],
  ["throwback-hip-hop-jam", "Throwback Hip-Hop Jam", "Boom-bap from the back of the bus.", "hiphop festive party housework 90s"],
  ["lullabies-for-grown-ups", "Lullabies for Grown-Ups", "Quiet folk for a long day's end.", "folk dreamy mellow bedtime"],
  ["sleepy-synths", "Sleepy Synths", "Pads that drift off before you do.", "ambient dreamy bedtime stargazing 10s"],
  ["midnight-jazz-club", "Midnight Jazz Club", "Last set, low lights, brushed snare.", "jazz moody stargazing unwinding 60s"],
  ["terminal-velocity", "Terminal Velocity", "Synthwave for a green cursor and a deadline.", "electronic focused energetic coding 80s"],
  ["stargazer-shoegaze", "Stargazer Shoegaze", "Guitars like weather, vocals like fog.", "indie dreamy stargazing 90s"],
  ["spring-cleaning-pop", "Spring Cleaning Pop", "Sing into the mop handle.", "pop energetic housework 00s"],
  ["trail-mix-folk", "Trail Mix Folk", "Banjos, boots and a thermos.", "folk happy walking 70s"],
  ["sidewalk-soul", "Sidewalk Soul", "A strut for the long way around the block.", "soul happy walking coffee 70s"],
  ["fireside-holiday", "Fireside Holiday", "Crooners, sleigh bells and a blanket.", "holiday cozy festive"],
  ["jingle-jazz", "Jingle Jazz", "The carols, but they swing.", "holiday jazz festive happy"],
  ["snow-day-classical", "Snow Day Classical", "Choirs and strings for a white morning.", "holiday classical cozy mellow"],
];

/**
 * The concierge's tiles. `id` doubles as the activity tag on collections.
 * Refinements are [title, tags to favor]; the service finds the collections.
 * @type {{ id: string, title: string, icon: string, refinements: [string, string][] }[]}
 */
export const SITUATIONS = [
  { id: "holiday", title: "Holiday Cheer", icon: "tree", refinements: [["Swinging Carols", "jazz festive"], ["By the Fire", "cozy festive"], ["Choirs & Strings", "classical"]] },
  { id: "new", title: "Brand New Music", icon: "sparkle", refinements: [["New Pop", "pop"], ["New Indie", "indie"], ["New Beats", "hiphop"]] },
  { id: "waking", title: "Waking Up Happy", icon: "sun", refinements: [["Sunny Indie", "indie happy"], ["Gentle Acoustic", "folk mellow"], ["Upbeat Pop", "pop happy"]] },
  { id: "coffee", title: "Drinking Coffee", icon: "cup", refinements: [["Coffeehouse Folk", "folk cozy"], ["Bossa Nova", "world mellow"], ["Easygoing Soul", "soul happy"]] },
  { id: "focus", title: "Focusing (No Lyrics)", icon: "monitor", refinements: [["Ambient", "ambient"], ["Classical", "classical"], ["Instrumental Beats", "hiphop"]] },
  { id: "work-fun", title: "Having Fun at Work", icon: "party", refinements: [["Motown & Oldies", "60s soul"], ["Funk", "70s soul"], ["80s Pop", "80s pop"]] },
  { id: "hits", title: "Today's Biggest Hits", icon: "trophy", refinements: [["Right Now", "now"], ["The 2010s", "10s"], ["The 90s", "90s"]] },
  { id: "workout", title: "Working Out", icon: "dumbbell", refinements: [["Hip-Hop", "hiphop"], ["Electronic", "electronic"], ["Rock", "rock"]] },
  { id: "commute", title: "Getting Somewhere", icon: "car", refinements: [["Windows-Down Rock", "rock"], ["Pop Radio", "pop happy"], ["New Wave", "80s pop"]] },
  { id: "walking", title: "Taking a Walk", icon: "leaf", refinements: [["Bright Indie", "indie"], ["Folk & Banjos", "folk"], ["Soul Strut", "soul"]] },
  { id: "housework", title: "Tidying Up at Home", icon: "home", refinements: [["Sing-Along Pop", "pop"], ["Funk & Soul", "soul"], ["90s Hip-Hop", "hiphop 90s"]] },
  { id: "cooking", title: "Cooking", icon: "pot", refinements: [["Swing & Jazz", "jazz"], ["Around the World", "world"], ["Soul Kitchen", "soul"]] },
  { id: "dinner", title: "Eating Dinner", icon: "cutlery", refinements: [["Dinner Party Jazz", "jazz cozy"], ["Trattoria", "world cozy"], ["Mellow Soul", "soul mellow"]] },
  { id: "unwinding", title: "Unwinding", icon: "sofa", refinements: [["Rainy Indie", "indie moody"], ["Chillwave", "electronic dreamy"], ["Slow Soul", "soul mellow"]] },
  { id: "reading", title: "Reading", icon: "book", refinements: [["Solo Piano", "classical"], ["Coffeehouse Folk", "folk cozy"], ["Rainy Indie", "indie moody"]] },
  { id: "party", title: "Getting the Party Started", icon: "discoball", refinements: [["Disco", "70s festive"], ["House", "electronic festive"], ["Hip-Hop Throwbacks", "hiphop festive"]] },
  { id: "bedtime", title: "Bedtime", icon: "moon", refinements: [["Sleepy Synths", "ambient dreamy"], ["Quiet Folk", "folk dreamy"], ["Solo Piano", "classical mellow"]] },
  { id: "coding", title: "Late Night Coding", icon: "terminal", refinements: [["Synthwave", "electronic 80s"], ["Lo-Fi Beats", "hiphop mellow"], ["Ambient", "ambient"]] },
  { id: "stargazing", title: "Stargazing", icon: "star", refinements: [["Shoegaze", "indie dreamy"], ["After-Hours Jazz", "jazz moody"], ["Drifting Synths", "ambient"]] },
];

/** Which situations the concierge offers, by period, in order. */
export const LINEUPS = /** @type {Record<string, string[]>} */ ({
  "morning": ["waking", "coffee", "workout", "commute", "new", "walking"],
  "late-morning": ["coffee", "focus", "work-fun", "new", "workout", "walking"],
  "afternoon": ["new", "focus", "work-fun", "hits", "workout", "walking"],
  "evening": ["cooking", "dinner", "unwinding", "workout", "hits", "new"],
  "night": ["unwinding", "party", "reading", "bedtime", "hits", "coding"],
  "late-night": ["bedtime", "coding", "stargazing", "unwinding", "reading", "new"],
});

/** On Saturday and Sunday these give way: weekday situation -> weekend one. */
export const WEEKEND_SWAPS = /** @type {Record<string, string>} */ ({
  "commute": "housework",
  "focus": "housework",
  "work-fun": "reading",
});

/**
 * Browse. Categories are [tag, title]; a category holds every collection with
 * that tag.
 * @type {{ id: string, title: string, categories: [string, string][] }[]}
 */
export const GALLERIES = [
  { id: "activities", title: "Activities", categories: SITUATIONS.map((s) => [s.id, s.title]) },
  {
    id: "genres",
    title: "Genres",
    categories: [
      ["ambient", "Ambient"], ["classical", "Classical"], ["electronic", "Electronic"], ["folk", "Folk"],
      ["hiphop", "Hip-Hop"], ["holiday", "Holiday"], ["indie", "Indie"], ["jazz", "Jazz"],
      ["pop", "Pop"], ["rock", "Rock"], ["soul", "Soul & Funk"], ["world", "World"],
    ],
  },
  {
    id: "moods",
    title: "Moods",
    categories: [
      ["cozy", "Cozy"], ["dreamy", "Dreamy"], ["energetic", "Energetic"], ["festive", "Festive"],
      ["focused", "Focused"], ["happy", "Happy"], ["mellow", "Mellow"], ["moody", "Moody"],
    ],
  },
  {
    id: "decades",
    title: "Decades",
    categories: [["60s", "The 60s"], ["70s", "The 70s"], ["80s", "The 80s"], ["90s", "The 90s"], ["00s", "The 2000s"], ["10s", "The 2010s"], ["now", "Right Now"]],
  },
];

// Raw material for invented items: "<adjective> <noun>" by "The <plural>s".
export const WORDS = {
  adjectives: ["Velvet", "Paper", "Neon", "Quiet", "Golden", "Borrowed", "Electric", "Slow", "Second-Hand", "Little", "Northern", "Lucky", "Midnight", "Plastic", "Honest", "Wandering", "Crooked", "Tangerine", "Sunday", "Invisible"],
  nouns: ["Parade", "Telephone", "Avenue", "Umbrella", "Lighthouse", "Satellite", "Garden", "Elevator", "Postcard", "River", "Pigeon", "Carousel", "Bicycle", "Subway", "Staircase", "Lantern", "Harbor", "Pizza", "Kite", "Rooftop"],
  bands: ["The Pizza Rats", "Seven Train Local", "Laundry Day", "The Roosevelt Avenues", "Soft Pretzel", "Bodega Cat", "The Fire Escapes", "Walk-Up Fifth Floor", "Alternate Side Parking", "The Halal Carts", "Stoop Sale", "Express to Flushing"],
};
