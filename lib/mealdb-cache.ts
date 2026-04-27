const MEALDB_LIST_URL = "https://www.themealdb.com/api/json/v1/1/list.php?i=list";

let cached: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

type IngredientListResponse = {
  meals: Array<{ strIngredient: string }>;
};

export async function getIngredients(): Promise<Set<string>> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(MEALDB_LIST_URL);
    if (!res.ok) {
      inflight = null;
      throw new Error(`Failed to fetch TheMealDB ingredient list: ${res.status}`);
    }
    const data = (await res.json()) as IngredientListResponse;
    const set = new Set(data.meals.map((m) => m.strIngredient));
    cached = set;
    inflight = null;
    return set;
  })();

  return inflight;
}

export function hasIngredient(set: Set<string>, name: string): string | null {
  if (set.has(name)) return name;
  const lower = name.toLowerCase();
  for (const ing of set) {
    if (ing.toLowerCase() === lower) return ing;
  }
  return null;
}
