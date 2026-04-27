"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import type { RecipeResult } from "@/app/api/find-recipes/route";
import FridgeView from "@/app/components/FridgeView";
import {
  saveRecipe,
  removeRecipe,
  isRecipeSaved,
} from "@/lib/saved-recipes";

// Cuisine areas available in TheMealDB
const CUISINE_OPTIONS = [
  "American", "British", "Canadian", "Chinese", "Croatian", "Dutch",
  "Egyptian", "Filipino", "French", "Greek", "Indian", "Irish", "Italian",
  "Jamaican", "Japanese", "Kenyan", "Malaysian", "Mexican", "Moroccan",
  "Nigerian", "Polish", "Portuguese", "Russian", "Spanish", "Thai",
  "Tunisian", "Turkish", "Ukrainian", "Uruguayan", "Vietnamese",
];

// ---------------------------------------------------------------------------
// Food animation
// ---------------------------------------------------------------------------

const FOOD_SCENES = [
  { main: "🥗", parts: ["🥬", "🍅", "🥕"] },
  { main: "🍔", parts: ["🥩", "🧀", "🥬"] },
  { main: "🍝", parts: ["🍅", "🧄", "🌿"] },
  { main: "🌮", parts: ["🌽", "🥑", "🧅"] },
];

function FoodAnimation({ tick }: { tick: number }) {
  const scene = FOOD_SCENES[tick % FOOD_SCENES.length];
  return (
    <div
      key={tick}
      className="relative flex items-end justify-center h-24 w-32 mx-auto"
      style={{ animation: "fade-scene 0.4s ease" }}
    >
      {/* Falling ingredients */}
      {scene.parts.map((part, i) => (
        <span
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${16 + i * 26}%`,
            top: 0,
            animation: `fall-in 0.5s ease forwards`,
            animationDelay: `${i * 0.18}s`,
            opacity: 0,
          }}
        >
          {part}
        </span>
      ))}
      {/* Main dish */}
      <span className="text-6xl leading-none">{scene.main}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress card
// ---------------------------------------------------------------------------

function ProgressCard({
  steps,
  stepIndex,
}: {
  steps: string[];
  stepIndex: number;
}) {
  const sceneTick = Math.floor(stepIndex / 2);
  const progress = Math.min((stepIndex + 1) / steps.length, 1);

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 mb-8 flex flex-col items-center gap-4">
      <FoodAnimation tick={sceneTick} />
      <p
        key={stepIndex}
        className="text-amber-800 text-sm font-medium text-center"
        style={{ animation: "fade-scene 0.35s ease" }}
      >
        {steps[stepIndex]}
      </p>
      <div className="w-full bg-amber-100 rounded-full h-2">
        <div
          className="bg-amber-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<RecipeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "fridge">("home");
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); }, []);

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

    // Build informed progress steps from actual request
    const steps: string[] = [
      ...ingredients.map((i) => `Searching for meals with ${i}…`),
      ...(cuisine ? [`Filtering by ${cuisine} cuisine…`] : []),
      "Comparing results…",
      "Looking up recipe details…",
      "Almost there…",
    ];

    setLoading(true);
    setError(null);
    setResult(null);
    setProgressSteps(steps);
    setStepIndex(0);

    // Advance steps on a timer; hold the last step until done
    const msPerStep = Math.min(7000, Math.floor(55000 / steps.length));
    let current = 0;
    stepTimerRef.current = setInterval(() => {
      current += 1;
      if (current < steps.length - 1) {
        setStepIndex(current);
      } else {
        setStepIndex(steps.length - 1);
        clearInterval(stepTimerRef.current!);
      }
    }, msPerStep);

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
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      setLoading(false);
    }
  };

  return (
    <>
    <main className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="relative text-center mb-10">
        <h1 className="text-4xl font-bold text-amber-800 mb-2">🍽️ Recipe Picker</h1>
        <p className="text-amber-700 text-lg">
          Tell us what you have, we&apos;ll find something delicious
        </p>
        {/* Fridge link */}
        <button
          type="button"
          onClick={() => setView("fridge")}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-3xl hover:scale-110 transition-transform"
          aria-label="My saved recipes"
          title="My Recipe Fridge"
        >
          🧊
        </button>
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
        <div className="relative">
          <div
            className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-2 pr-8 min-h-[52px] focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 cursor-text"
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
          {ingredients.length > 0 && (
            <button
              type="button"
              onClick={() => setIngredients([])}
              aria-label="Clear all ingredients"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 leading-none"
            >
              ✕
            </button>
          )}
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
            <option key={c} value={c}>{c}</option>
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
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Finding recipes…
            </span>
          ) : (
            "Find Recipes"
          )}
        </button>
      </div>

      {/* Progress card */}
      {loading && progressSteps.length > 0 && (
        <ProgressCard steps={progressSteps} stepIndex={stepIndex} />
      )}

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
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/chef-robot.png"
                alt="Chef robot"
                className="w-20 h-20 flex-shrink-0 object-contain"
              />
              <div className="relative bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
                <span
                  aria-hidden
                  style={{
                    position: "absolute", left: -9, top: "50%",
                    transform: "translateY(-50%)", width: 0, height: 0,
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    borderRight: "9px solid #fde68a",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute", left: -7, top: "50%",
                    transform: "translateY(-50%)", width: 0, height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderRight: "8px solid #fffbeb",
                  }}
                />
                {renderBold(result.summary)}
              </div>
            </div>
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

    {/* Fridge overlay — fixed, always mounted, slides in/out from the right */}
    <div
      className="fixed inset-0 z-40 overflow-hidden transition-transform duration-300 ease-in-out"
      style={{ transform: view === "fridge" ? "translateX(0)" : "translateX(100%)" }}
    >
      <FridgeView key={view} onBack={() => setView("home")} />
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBold(text: string) {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ---------------------------------------------------------------------------
// Recipe card
// ---------------------------------------------------------------------------

type Recipe = RecipeResult["recipes"][number];

function PinButton({ recipe }: { recipe: Recipe }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(isRecipeSaved(recipe.name));
  }, [recipe.name]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinned) {
      removeRecipe(recipe.name);
      setPinned(false);
    } else {
      saveRecipe(recipe);
      setPinned(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={pinned ? "Unpin recipe" : "Pin recipe"}
      className="absolute top-3 right-3 text-xl transition-transform hover:scale-125"
      title={pinned ? "Remove from fridge" : "Pin to fridge"}
    >
      {pinned ? "📌" : (
        <span className="opacity-40 hover:opacity-80 transition-opacity">📌</span>
      )}
    </button>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [expanded, setExpanded] = useState(false);

  const shortInstructions =
    recipe.instructions.length > 300
      ? recipe.instructions.slice(0, 300) + "…"
      : recipe.instructions;

  return (
    <div className="relative bg-white rounded-2xl shadow-md overflow-hidden">
      <PinButton recipe={recipe} />
      <div className="flex flex-col sm:flex-row">
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
          <div className="pr-8">
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

          {/* Instructions */}
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

          {/* YouTube */}
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
