export type SavedRecipe = {
  name: string;
  area: string;
  category: string;
  thumbnail: string;
  ingredients: string[];
  instructions: string;
  youtubeUrl?: string;
};

export type FridgePosition = { xPct: number; yPct: number; rot: number };

const KEY = "saved-recipes";
const POSITIONS_KEY = "fridge-positions";

export function getSavedRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRecipe(recipe: SavedRecipe): void {
  const existing = getSavedRecipes();
  if (!existing.some((r) => r.name === recipe.name)) {
    localStorage.setItem(KEY, JSON.stringify([...existing, recipe]));
  }
}

export function removeRecipe(name: string): void {
  const existing = getSavedRecipes();
  localStorage.setItem(
    KEY,
    JSON.stringify(existing.filter((r) => r.name !== name))
  );
  clearFridgePosition(name);
}

export function isRecipeSaved(name: string): boolean {
  return getSavedRecipes().some((r) => r.name === name);
}

export function getFridgePositions(): Record<string, FridgePosition> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function setFridgePosition(name: string, pos: FridgePosition): void {
  const all = getFridgePositions();
  all[name] = pos;
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(all));
}

export function clearFridgePosition(name: string): void {
  const all = getFridgePositions();
  if (name in all) {
    delete all[name];
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(all));
  }
}
