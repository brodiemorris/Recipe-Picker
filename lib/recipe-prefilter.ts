import { resolveIngredient } from "./ingredient-resolver";

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";
const TOP_N = 10;

export type FullMealDetails = {
  id: string;
  name: string;
  category: string;
  area: string;
  instructions: string;
  thumbnail: string;
  youtubeUrl: string | null;
  ingredients: string[];
};

export type ScoredCandidate = {
  recipe: FullMealDetails;
  ingMatches: number;
  inCuisine: boolean;
};

export type Substitution = {
  user: string;
  used: string;
  reason: string;
};

export type PrefilterResult = {
  candidates: ScoredCandidate[];
  substitutions: Substitution[];
  missed: string[];
};

type Meal = { idMeal: string };
type LookupResponse = { meals: Array<Record<string, string | null>> | null };

async function filterByIngredient(name: string): Promise<string[]> {
  const res = await fetch(
    `${MEALDB_BASE}/filter.php?i=${encodeURIComponent(name)}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { meals: Meal[] | null };
  return (data.meals ?? []).map((m) => m.idMeal);
}

async function filterByArea(area: string): Promise<string[]> {
  const res = await fetch(
    `${MEALDB_BASE}/filter.php?a=${encodeURIComponent(area)}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { meals: Meal[] | null };
  return (data.meals ?? []).map((m) => m.idMeal);
}

export async function lookupRecipe(id: string): Promise<FullMealDetails | null> {
  const res = await fetch(
    `${MEALDB_BASE}/lookup.php?i=${encodeURIComponent(id)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as LookupResponse;
  const meal = data.meals?.[0];
  if (!meal) return null;

  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      ingredients.push(
        measure?.trim() ? `${measure.trim()} ${name.trim()}` : name.trim()
      );
    }
  }

  return {
    id: meal.idMeal as string,
    name: meal.strMeal as string,
    category: (meal.strCategory ?? "") as string,
    area: (meal.strArea ?? "") as string,
    instructions: (meal.strInstructions ?? "") as string,
    thumbnail: (meal.strMealThumb ?? "") as string,
    youtubeUrl: (meal.strYoutube as string) || null,
    ingredients,
  };
}

export async function prefilterRecipes(
  ingredients: string[],
  cuisine: string | undefined
): Promise<PrefilterResult> {
  // 1. Resolve every input
  const resolved = await Promise.all(ingredients.map(resolveIngredient));

  const substitutions: Substitution[] = [];
  const missed: string[] = [];
  for (const r of resolved) {
    if (r.resolved.length === 0) {
      missed.push(r.original);
    } else if (r.substituted && r.reason) {
      substitutions.push({
        user: r.original,
        used: r.resolved[0],
        reason: r.reason,
      });
    }
  }

  // 2. Fire all TheMealDB calls in parallel.
  // For each user input, gather meal IDs that match ANY of its alternates.
  const ingredientHitsPromise = Promise.all(
    resolved.map(async (r): Promise<Set<string>> => {
      if (r.resolved.length === 0) return new Set();
      const lists = await Promise.all(r.resolved.map(filterByIngredient));
      const ids = new Set<string>();
      for (const list of lists) {
        for (const id of list) ids.add(id);
      }
      return ids;
    })
  );

  const cuisineIdsPromise: Promise<Set<string> | null> = cuisine
    ? filterByArea(cuisine).then((ids) => new Set(ids))
    : Promise.resolve(null);

  const [ingredientHits, cuisineIds] = await Promise.all([
    ingredientHitsPromise,
    cuisineIdsPromise,
  ]);

  // 3. Score every meal: ingMatches * 10 + cuisineBonus.
  // 10x weight on ingredient matches makes cuisine a strict tie-breaker, never a primary
  // sort key — a 3-ingredient match in any cuisine beats a 2-ingredient match in the
  // requested cuisine.
  const scores = new Map<string, { ingMatches: number; inCuisine: boolean }>();
  for (const ids of ingredientHits) {
    for (const id of ids) {
      const cur = scores.get(id) ?? { ingMatches: 0, inCuisine: false };
      cur.ingMatches += 1;
      scores.set(id, cur);
    }
  }
  if (cuisineIds) {
    for (const id of cuisineIds) {
      const cur = scores.get(id) ?? { ingMatches: 0, inCuisine: false };
      cur.inCuisine = true;
      scores.set(id, cur);
    }
  }

  if (scores.size === 0) {
    return { candidates: [], substitutions, missed };
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => {
    const sa = a[1].ingMatches * 10 + (a[1].inCuisine ? 1 : 0);
    const sb = b[1].ingMatches * 10 + (b[1].inCuisine ? 1 : 0);
    return sb - sa;
  });

  const topEntries = sorted.slice(0, TOP_N);
  const topIds = topEntries.map(([id]) => id);

  // Note if cuisine was requested but the top candidates aren't from that cuisine
  if (cuisine && !topEntries.some(([, s]) => s.inCuisine && s.ingMatches > 0)) {
    substitutions.push({
      user: cuisine,
      used: "(any cuisine)",
      reason: `no ${cuisine} recipes matched the requested ingredients; showing best matches regardless of cuisine`,
    });
  }

  // 4. Lookup full details in parallel, then attach scores
  const detailsRaw = await Promise.all(topIds.map(lookupRecipe));
  const candidates: ScoredCandidate[] = [];
  for (let i = 0; i < detailsRaw.length; i++) {
    const detail = detailsRaw[i];
    if (!detail) continue;
    const score = topEntries[i][1];
    candidates.push({
      recipe: detail,
      ingMatches: score.ingMatches,
      inCuisine: score.inCuisine,
    });
  }

  return { candidates, substitutions, missed };
}
