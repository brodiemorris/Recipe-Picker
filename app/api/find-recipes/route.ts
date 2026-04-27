import { NextRequest, NextResponse } from "next/server";
import { Subconscious, zodToJsonSchema, parseAnswer } from "subconscious";
import {
  prefilterRecipes,
  lookupRecipe,
  type FullMealDetails,
} from "@/lib/recipe-prefilter";

export const maxDuration = 300;
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// What the agent returns — just IDs + summary. Avoids the agent re-emitting kilobytes
// of recipe data it already saw in the prompt, which was the dominant latency source.
const PickerSchema = z.object({
  pickedIds: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe(
      "Meal IDs (idMeal) of chosen recipes (1-6). Use IDs from CANDIDATES, or IDs you discovered via lookupRecipe. Quality over quantity — 1-2 great picks are better than 5-6 mediocre ones. Do not pad to fill the max."
    ),
  summary: z
    .string()
    .describe(
      "Brief explanation of the picks (2-3 sentences). Mention any substitutions or missed ingredients."
    ),
});

type PickerResult = z.infer<typeof PickerSchema>;

// What the frontend expects — full recipe details. Built server-side from the picks.
type RecipeShape = {
  name: string;
  area: string;
  category: string;
  thumbnail: string;
  ingredients: string[];
  instructions: string;
  youtubeUrl?: string;
};

export type RecipeResult = {
  recipes: RecipeShape[];
  summary: string;
};

function toRecipeShape(m: FullMealDetails): RecipeShape {
  return {
    name: m.name,
    area: m.area,
    category: m.category,
    thumbnail: m.thumbnail,
    ingredients: m.ingredients,
    instructions: m.instructions,
    youtubeUrl: m.youtubeUrl ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { ingredients, cuisine } = (await req.json()) as {
      ingredients: string[];
      cuisine?: string;
    };

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "At least one ingredient is required" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (!baseUrl) {
      return NextResponse.json(
        { error: "BASE_URL is not configured" },
        { status: 500 }
      );
    }

    // Run the deterministic prefilter first: resolve ingredients (with singular/plural,
    // fuzzy matching, and synonym fallback), search TheMealDB in parallel, intersect,
    // and fetch full details for the top candidates. Replaces what the agent used to do
    // sequentially via tool calls.
    const { candidates, substitutions, missed } = await prefilterRecipes(
      ingredients,
      cuisine
    );

    const ingredientList = ingredients.join(", ");
    const cuisineLine = cuisine
      ? `Cuisine preference: ${cuisine}.`
      : "No cuisine preference.";

    const subsLine = substitutions.length
      ? `\n\nIngredient substitutions made during search:\n${substitutions
          .map((s) => `- "${s.user}" → "${s.used}" (${s.reason})`)
          .join("\n")}\n\nMention these substitutions briefly in your summary so the user understands what we matched.`
      : "";

    const missedLine = missed.length
      ? `\n\nWe could NOT find any recipes for: ${missed
          .join(", ")}. Mention this in your summary too.`
      : "";

    // Trim candidates to fields the agent needs for the pick. Each candidate is
    // annotated with its objective match score so the agent can immediately see
    // which candidates are strong without recomputing or calling lookupRecipe.
    const totalIngredients = ingredients.length;
    const cuisineLabel = cuisine ?? null;
    const candidatesForPrompt = candidates.map((c) => ({
      id: c.recipe.id,
      name: c.recipe.name,
      match: `${c.ingMatches}/${totalIngredients} ingredients matched${
        cuisineLabel
          ? c.inCuisine
            ? `, in ${cuisineLabel}`
            : `, NOT in ${cuisineLabel}`
          : ""
      }`,
      area: c.recipe.area,
      category: c.recipe.category,
      ingredients: c.recipe.ingredients,
    }));
    const candidatesBlock = candidates.length
      ? `\n\nCANDIDATES (${candidates.length} pre-matched recipes, sorted by match score):\n${JSON.stringify(
          candidatesForPrompt,
          null,
          2
        )}`
      : "\n\nNo candidate recipes were found by the prefilter.";

    const instructions = `You are a recipe-finding agent. The user has these ingredients: ${ingredientList}.
${cuisineLine}

We've pre-searched TheMealDB and gathered candidate recipes below as a starting point.${subsLine}${missedLine}

Each candidate has a "match" field showing its objective score (e.g. "3/3 ingredients matched, in Italian"). Use this to judge candidate strength quickly — you do NOT need to call lookupRecipe to verify candidates; their full ingredient lists are already shown.

You have three tools available:
- **filterByIngredient(ingredient)** — find more recipes containing a specific ingredient.
- **filterByArea(area)** — find more recipes from a cuisine.
- **lookupRecipe(mealId)** — fetch full details for a recipe ID you discovered via the other tools (candidates already include full ingredient lists).

When to call tools:
- **DO** call tools if the candidate set has real gaps. Examples: a missed ingredient has obvious related/broader terms the prefilter wouldn't have tried (e.g. "kombu" → "seaweed" / "kelp"); the requested cuisine is barely represented in candidates; the strongest candidate matches only 1 of several user ingredients.
- **DON'T** call tools just to broaden a candidate set that already covers the user's request well. If you have candidates with strong match scores in the right cuisine, just pick from them. Each tool call adds noticeable latency.

The prefilter has already tried each user ingredient as-typed, with plural/singular variants, fuzzy spelling matches, and a small synonym map of common cooking aliases. It does NOT try semantically related terms — that's where filterByIngredient adds genuine value.

Stay within the criteria the user gave you (ingredient overlap and cuisine). Don't filter further on dimensions the user didn't ask about — recipe complexity, "starring" vs supporting ingredients, skill level, or weeknight-vs-weekend appropriateness. Those are out of scope.

Your task:
1. Pick 1 to 6 recipes that genuinely fit the user's stated request. **Quality matters more than quantity — 1-2 great picks are better than 5-6 mediocre ones. Do not pad.**
2. Prefer recipes with higher match scores.
3. Write a brief summary (2-3 sentences) explaining your picks. Mention any substitutions or missed ingredients.${candidatesBlock}`;

    const tools = [
      {
        type: "function" as const,
        name: "filterByIngredient",
        description:
          "Search for meals that contain a specific ingredient. Pass the ingredient name in the 'ingredient' field. Returns a list of matching meals with their IDs and thumbnails. Call once per ingredient.",
        url: `${baseUrl}/api/tools/filter-by-ingredient`,
        method: "POST" as const,
        timeout: 15,
        parameters: {
          type: "object",
          properties: {
            ingredient: {
              type: "string",
              description: "The ingredient name to filter by (e.g. 'chicken', 'garlic', 'rice')",
            },
          },
          required: ["ingredient"],
          additionalProperties: false,
        },
      },
      {
        type: "function" as const,
        name: "filterByArea",
        description:
          "Search for meals from a specific cuisine area. Pass the cuisine name in the 'area' field. Returns a list of matching meals with their IDs and thumbnails.",
        url: `${baseUrl}/api/tools/filter-by-area`,
        method: "POST" as const,
        timeout: 15,
        parameters: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description: "The cuisine area to filter by (e.g. 'Italian', 'Japanese', 'American')",
            },
          },
          required: ["area"],
          additionalProperties: false,
        },
      },
      {
        type: "function" as const,
        name: "lookupRecipe",
        description:
          "Look up the full details of a meal by its ID. Pass the meal ID in the 'mealId' field. Returns the full recipe including name, area, category, instructions, ingredients, thumbnail, and YouTube URL.",
        url: `${baseUrl}/api/tools/lookup-recipe`,
        method: "POST" as const,
        timeout: 15,
        parameters: {
          type: "object",
          properties: {
            mealId: {
              type: "string",
              description: "The meal ID to look up (e.g. '52772')",
            },
          },
          required: ["mealId"],
          additionalProperties: false,
        },
      },
    ];

    const client = new Subconscious({
      apiKey: process.env.SUBCONSCIOUS_API_KEY!,
    });

    const run = await client.run({
      engine: "tim-claude",
      input: {
        instructions,
        tools,
        answerFormat: zodToJsonSchema(PickerSchema, "RecipePicks"),
      },
      options: { awaitCompletion: true },
    });

    if (run.status !== "succeeded") {
      return NextResponse.json(
        { error: run.error?.message ?? "Agent run did not succeed" },
        { status: 500 }
      );
    }

    const picker = parseAnswer(run.result?.answer) as PickerResult;

    // Resolve picked IDs back to full recipe data: from the prefilter cache when
    // possible, otherwise fetch (covers the rare case where the agent recovered with
    // tool calls and picked an ID we hadn't pre-fetched).
    const candidateMap = new Map(candidates.map((c) => [c.recipe.id, c.recipe]));
    const resolvedRecipes = await Promise.all(
      picker.pickedIds.map(async (id) => {
        const cached = candidateMap.get(id);
        if (cached) return cached;
        return lookupRecipe(id);
      })
    );
    const recipes = resolvedRecipes
      .filter((r): r is FullMealDetails => r !== null)
      .map(toRecipeShape);

    const result: RecipeResult = { recipes, summary: picker.summary };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[find-recipes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
