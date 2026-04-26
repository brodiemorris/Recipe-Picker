"use client";

import { useState, KeyboardEvent } from "react";
import type { RecipeResult } from "@/app/api/find-recipes/route";

// Cuisine areas available in TheMealDB
const CUISINE_OPTIONS = [
  "American",
  "British",
  "Canadian",
  "Chinese",
  "Croatian",
  "Dutch",
  "Egyptian",
  "Filipino",
  "French",
  "Greek",
  "Indian",
  "Irish",
  "Italian",
  "Jamaican",
  "Japanese",
  "Kenyan",
  "Malaysian",
  "Mexican",
  "Moroccan",
  "Nigerian",
  "Polish",
  "Portuguese",
  "Russian",
  "Spanish",
  "Thai",
  "Tunisian",
  "Turkish",
  "Ukrainian",
  "Uruguayan",
  "Vietnamese",
];

export default function Home() {
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecipeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add a tag from the current input
  const addIngredient = () => {
    const trimmed = ingredientInput.trim();
    if (trimmed && !ingredients.includes(trimmed.toLowerCase())) {
      setIngredients((prev) => [...prev, trimmed.toLowerCase()]);
    }
    setIngredientInput("");
  };

  const handleIngredientKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient();
    } else if (e.key === "Backspace" && ingredientInput === "") {
      setIngredients((prev) => prev.slice(0, -1));
    }
  };

  const removeIngredient = (tag: string) => {
    setIngredients((prev) => prev.filter((i) => i !== tag));
  };

  const handleSubmit = async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/find-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, cuisine: cuisine || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setResult(data as RecipeResult);
      }
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-amber-800 mb-2">🍽️ Recipe Picker</h1>
        <p className="text-amber-700 text-lg">
          Tell us what you have, we&apos;ll find something delicious
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
        {/* Ingredients */}
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Ingredients <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Type an ingredient and press{" "}
          <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> or{" "}
          <kbd className="bg-gray-100 px-1 rounded">,</kbd> to add it
        </p>
        <div
          className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-2 min-h-[52px] focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 cursor-text"
          onClick={() => document.getElementById("ingredient-input")?.focus()}
        >
          {ingredients.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeIngredient(tag)}
                className="text-amber-600 hover:text-amber-900 leading-none ml-0.5"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="ingredient-input"
            type="text"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyDown={handleIngredientKeyDown}
            onBlur={addIngredient}
            placeholder={ingredients.length === 0 ? "e.g. chicken, garlic, lemon..." : ""}
            className="flex-1 min-w-[140px] outline-none text-sm text-gray-800 bg-transparent placeholder-gray-400"
          />
        </div>

        {/* Cuisine */}
        <label
          htmlFor="cuisine"
          className="block text-sm font-semibold text-gray-700 mt-5 mb-1"
        >
          Cuisine Preference{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select
          id="cuisine"
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
        >
          <option value="">No preference</option>
          {CUISINE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || ingredients.length === 0}
          className="mt-6 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Finding recipes…
            </span>
          ) : (
            "Find Recipes"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {result.summary && (
            <p className="text-amber-800 text-sm mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {result.summary}
            </p>
          )}

          {result.recipes.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              No recipes found for those ingredients. Try different ones!
            </div>
          ) : (
            <div className="space-y-6">
              {result.recipes.map((recipe, idx) => (
                <RecipeCard key={idx} recipe={recipe} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Recipe card component
// ---------------------------------------------------------------------------

type Recipe = RecipeResult["recipes"][number];

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [expanded, setExpanded] = useState(false);

  const shortInstructions =
    recipe.instructions.length > 300
      ? recipe.instructions.slice(0, 300) + "…"
      : recipe.instructions;

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        {recipe.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.thumbnail}
            alt={recipe.name}
            className="w-full sm:w-48 h-48 object-cover flex-shrink-0"
          />
        )}

        <div className="p-5 flex flex-col gap-2 flex-1">
          {/* Title + badges */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{recipe.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {recipe.area && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {recipe.area}
                </span>
              )}
              {recipe.category && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {recipe.category}
                </span>
              )}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Ingredients
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {recipe.ingredients.join(" · ")}
            </p>
          </div>

          {/* Instructions (collapsible) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Instructions
            </p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {expanded ? recipe.instructions : shortInstructions}
            </p>
            {recipe.instructions.length > 300 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-amber-600 hover:text-amber-800 text-xs mt-1 font-medium"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

          {/* YouTube link */}
          {recipe.youtubeUrl && (
            <a
              href={recipe.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium mt-auto"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
              </svg>
              Watch on YouTube
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
