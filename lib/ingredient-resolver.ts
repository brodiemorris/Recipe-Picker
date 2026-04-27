import { getIngredients } from "./mealdb-cache";

export type ResolveResult = {
  original: string;
  resolved: string[];
  substituted: boolean;
  reason?: string;
};

const SYNONYMS: Record<string, string[]> = {
  // ===== Cheeses =====
  cheddar: ["Cheddar Cheese", "Cheese"],
  mozzarella: ["Mozzarella", "Mozzarella Balls", "Cheese"],
  parmesan: ["Parmesan", "Parmesan Cheese", "Parmigiano-reggiano", "Cheese"],
  parmigiano: ["Parmigiano-reggiano", "Parmesan", "Cheese"],
  feta: ["Feta", "Cubed Feta Cheese", "Cheese"],
  gouda: ["Gouda Cheese", "Cheese"],
  brie: ["Brie", "Cheese"],
  stilton: ["Stilton Cheese", "Cheese"],
  pecorino: ["Pecorino", "Cheese"],
  ricotta: ["Ricotta", "Cheese"],
  mascarpone: ["Mascarpone", "Cheese"],
  gruyere: ["Gruyère", "Cheese"],
  "gruyère": ["Gruyère", "Cheese"],
  "monterey jack": ["Monterey Jack Cheese", "Shredded Monterey Jack Cheese", "Cheese"],
  colby: ["Colby Jack Cheese", "Cheese"],
  "colby jack": ["Colby Jack Cheese", "Cheese"],
  "goat cheese": ["Goats Cheese", "Cheese"],
  "goats cheese": ["Goats Cheese", "Cheese"],

  // ===== Meat cuts =====
  ribeye: ["Beef Fillet", "Beef"],
  "rib eye": ["Beef Fillet", "Beef"],
  sirloin: ["Beef Fillet", "Beef"],
  steak: ["Beef Fillet", "Beef Brisket", "Beef"],
  "ground beef": ["Lean Minced Beef", "Minced Beef", "Beef"],
  "minced beef": ["Lean Minced Beef", "Minced Beef", "Beef"],
  brisket: ["Beef Brisket", "Beef"],
  "ground pork": ["Minced Pork", "Pork"],
  "minced pork": ["Minced Pork", "Pork"],
  "ground lamb": ["Lamb Mince", "Lamb"],
  "minced lamb": ["Lamb Mince", "Lamb"],
  "ground turkey": ["Turkey Mince"],
  "minced turkey": ["Turkey Mince"],
  "chicken thigh": ["Chicken Thighs", "Chicken"],
  "chicken thighs": ["Chicken Thighs", "Chicken"],
  "chicken breast": ["Chicken Breast", "Chicken Breasts", "Chicken"],
  "chicken breasts": ["Chicken Breasts", "Chicken Breast", "Chicken"],
  "chicken leg": ["Chicken Legs", "Chicken"],
  "chicken legs": ["Chicken Legs", "Chicken"],
  "duck leg": ["Duck Legs", "Duck"],
  "duck legs": ["Duck Legs", "Duck"],
  "lamb leg": ["Lamb Leg", "Lamb"],
  "lamb shoulder": ["Lamb Shoulder", "Lamb"],
  "lamb chop": ["Lamb Loin Chops", "Lamb"],
  "lamb chops": ["Lamb Loin Chops", "Lamb"],

  // ===== Seafood =====
  shrimp: ["Prawns", "King Prawns", "Tiger Prawns"],
  shrimps: ["Prawns", "King Prawns", "Tiger Prawns"],
  prawn: ["Prawns", "King Prawns"],
  sardine: ["Pilchards"],
  sardines: ["Pilchards"],
  "white fish": ["White Fish", "White Fish Fillets", "Cod", "Haddock"],

  // ===== Peppers / chilis =====
  "bell pepper": ["Red Pepper", "Yellow Pepper", "Green Pepper"],
  "bell peppers": ["Red Pepper", "Yellow Pepper", "Green Pepper"],
  capsicum: ["Red Pepper", "Yellow Pepper", "Green Pepper"],
  habanero: ["Red Chilli", "Green Chilli", "Chilli"],
  serrano: ["Green Chilli", "Chilli"],
  poblano: ["Green Chilli", "Chilli"],
  "scotch bonnet": ["Red Chilli", "Chilli"],
  chili: ["Chilli", "Red Chilli"],
  "chili flakes": ["Red Chilli Flakes", "Red Pepper Flakes"],
  "chilli flakes": ["Red Chilli Flakes", "Red Pepper Flakes"],

  // ===== Onions =====
  scallion: ["Spring Onions"],
  scallions: ["Spring Onions"],
  "green onion": ["Spring Onions"],
  "green onions": ["Spring Onions"],
  "yellow onion": ["Onions", "Onion"],
  "white onion": ["Onions", "Onion"],
  shallot: ["Shallots", "Challots"],

  // ===== UK / US translations =====
  eggplant: ["Aubergine", "Egg Plants"],
  eggplants: ["Aubergine", "Egg Plants"],
  aubergine: ["Aubergine", "Egg Plants"],
  zucchini: ["Zucchini", "Courgettes"],
  zucchinis: ["Zucchini", "Courgettes"],
  courgette: ["Courgettes", "Zucchini"],
  courgettes: ["Courgettes", "Zucchini"],
  cilantro: ["Cilantro", "Coriander"],
  coriander: ["Coriander", "Cilantro"],
  garbanzo: ["Chickpeas"],
  garbanzos: ["Chickpeas"],
  "garbanzo beans": ["Chickpeas"],
  arugula: ["Rocket"],
  rocket: ["Rocket"],

  // ===== Pasta =====
  pasta: ["Spaghetti", "Penne Rigate", "Macaroni", "Tagliatelle", "Fettuccine"],
  noodles: ["Rice Noodles", "Udon Noodles", "Vermicelli Pasta"],
  linguine: ["Linguine Pasta"],
  pappardelle: ["Pappardelle Pasta"],
  vermicelli: ["Vermicelli Pasta", "Rice Vermicelli"],

  // ===== Rice =====
  "white rice": ["Rice"],
  "long grain rice": ["Rice", "Basmati Rice"],
  jasmine: ["Jasmine Rice", "Rice"],
  basmati: ["Basmati Rice", "Rice"],

  // ===== Beans / lentils =====
  "kidney beans": ["Kidney Beans"],
  "black beans": ["Pinto Beans"],
  "white beans": ["Cannellini Beans", "Haricot Beans", "Butter Beans"],
  "red lentils": ["Green Red Lentils", "Lentils"],
  "yellow lentils": ["Toor Dal", "Lentils"],

  // ===== Sugar / flour =====
  "powdered sugar": ["Icing Sugar"],
  "confectioners sugar": ["Icing Sugar"],
  "confectioner's sugar": ["Icing Sugar"],
  "all purpose flour": ["Plain Flour", "Flour"],
  "all-purpose flour": ["Plain Flour", "Flour"],
  "ap flour": ["Plain Flour", "Flour"],
  "self rising flour": ["Self-raising Flour"],
  "self-rising flour": ["Self-raising Flour"],

  // ===== Misc =====
  tortilla: ["Tortillas", "Flour Tortilla", "Corn Tortillas"],
  "italian parsley": ["Parsley", "Chopped Parsley", "Freshly Chopped Parsley"],
  "flat leaf parsley": ["Parsley", "Chopped Parsley"],
  "flat-leaf parsley": ["Parsley", "Chopped Parsley"],
};

const QUANTITY_PREFIX_RE =
  /^\s*\d+(?:[\.\/]\d+)?\s*(?:lb|lbs|pound|pounds|oz|ounce|ounces|kg|g|gram|grams|cup|cups|tbsp|tbsps|tablespoon|tablespoons|tsp|tsps|teaspoon|teaspoons|ml|l|liter|liters|litre|litres|clove|cloves|piece|pieces|slice|slices|stick|sticks|can|cans|jar|jars|pack|packs|bunch|bunches|head|heads)?\s+/i;

// False friends — DB ingredients that word-contain a user term but aren't actually
// that ingredient. e.g. "egg" word-matches "Egg Plants" but eggplant isn't egg.
const FALSE_FRIENDS: Record<string, Set<string>> = {
  egg: new Set(["Egg Plants", "Egg Rolls"]),
  eggs: new Set(["Egg Plants", "Egg Rolls"]),
  butter: new Set(["Butter Beans"]),
};

function normalize(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(QUANTITY_PREFIX_RE, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLowerIndex(set: Set<string>): Map<string, string> {
  const idx = new Map<string, string>();
  for (const ing of set) idx.set(ing.toLowerCase(), ing);
  return idx;
}

// Word-boundary containment match. "basil" -> ["Basil", "Basil Leaves", "Fresh Basil"].
// This is what makes the user's input cover related-name ingredients in TheMealDB's
// taxonomy without requiring per-term synonym map entries.
function findWordContaining(term: string, set: Set<string>): string[] {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  const blocked = FALSE_FRIENDS[term] ?? new Set<string>();
  const out: string[] = [];
  for (const ing of set) {
    if (blocked.has(ing)) continue;
    if (re.test(ing)) out.push(ing);
  }
  return out;
}

function pluralVariants(s: string): string[] {
  const v: string[] = [];
  // Singular -> plural
  if (s.endsWith("y") && s.length > 1 && !"aeiou".includes(s[s.length - 2])) {
    v.push(s.slice(0, -1) + "ies");
  } else if (/(s|x|z|ch|sh)$/.test(s)) {
    v.push(s + "es");
  } else {
    v.push(s + "s");
  }
  // Plural -> singular
  if (s.endsWith("ies") && s.length > 3) {
    v.push(s.slice(0, -3) + "y");
  } else if (s.endsWith("es") && s.length > 2) {
    v.push(s.slice(0, -2));
  } else if (s.endsWith("s") && s.length > 1) {
    v.push(s.slice(0, -1));
  }
  return v;
}

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > max) return max + 1;
  }
  return dp[a.length][b.length];
}

function fuzzyMatch(s: string, idx: Map<string, string>): string | null {
  const max = s.length <= 5 ? 1 : 2;
  let best: { name: string; dist: number } | null = null;
  for (const [lower, original] of idx) {
    const d = levenshtein(s, lower, max);
    if (d <= max && (!best || d < best.dist)) {
      best = { name: original, dist: d };
      if (d === 0) break;
    }
  }
  return best ? best.name : null;
}

export async function resolveIngredient(input: string): Promise<ResolveResult> {
  const original = input.trim();
  const ingredientSet = await getIngredients();
  const idx = buildLowerIndex(ingredientSet);

  const norm = normalize(input);
  if (!norm) {
    return { original, resolved: [], substituted: false };
  }

  // Tier 1: word-boundary containment against the live ingredient list, including
  // plural/singular variants. Catches the "basil" -> "Basil Leaves" case (separate
  // entries in TheMealDB's taxonomy) without requiring a synonym map entry per pair.
  const matched = new Set<string>();
  for (const m of findWordContaining(norm, ingredientSet)) matched.add(m);
  for (const variant of pluralVariants(norm)) {
    for (const m of findWordContaining(variant, ingredientSet)) matched.add(m);
  }
  // Also check the lowercase index for an exact match — covers cases where the term
  // contains characters the regex can't easily handle (e.g. accents).
  const direct = idx.get(norm);
  if (direct) matched.add(direct);
  if (matched.size > 0) {
    return { original, resolved: Array.from(matched), substituted: false };
  }

  // Tier 2: fuzzy match
  const fuzzy = fuzzyMatch(norm, idx);
  if (fuzzy) {
    return {
      original,
      resolved: [fuzzy],
      substituted: false,
    };
  }

  // Tier 3: static synonym map — only keep alternates that exist in the live list
  const aliases = SYNONYMS[norm];
  if (aliases) {
    const valid: string[] = [];
    for (const alt of aliases) {
      if (ingredientSet.has(alt)) valid.push(alt);
    }
    if (valid.length > 0) {
      return {
        original,
        resolved: valid,
        substituted: true,
        reason: `no exact match for "${original}"; broadened to ${valid
          .map((v) => `"${v}"`)
          .join(" / ")}`,
      };
    }
  }

  return { original, resolved: [], substituted: false };
}
