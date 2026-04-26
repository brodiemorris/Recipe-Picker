import { NextRequest, NextResponse } from "next/server";
import { Subconscious, zodToJsonSchema, parseAnswer } from "subconscious";

export const maxDuration = 300;
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema for structured Subconscious response
// ---------------------------------------------------------------------------

const RecipeSchema = z.object({
  recipes: z.array(
    z.object({
      name: z.string(),
      area: z.string(),
      category: z.string(),
      thumbnail: z.string(),
      ingredients: z.array(z.string()),
      instructions: z.string(),
      youtubeUrl: z.string().optional(),
    })
  ),
  summary: z.string().describe("Brief explanation of why these recipes were chosen"),
});

export type RecipeResult = z.infer<typeof RecipeSchema>;

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

    const ingredientList = ingredients.join(", ");
    const cuisineLine = cuisine
      ? `The user prefers ${cuisine} cuisine.`
      : "The user has no cuisine preference.";

    const instructions = `You are a helpful recipe-finding assistant. Use the tools available to search TheMealDB and find great recipes.

The user has these ingredients available: ${ingredientList}.
${cuisineLine}

Your task:
1. Call filterByIngredient once for each ingredient the user provided. Pass the ingredient name in the "ingredient" field.
2. ${cuisine ? `Call filterByArea with area="${cuisine}" to find meals from that cuisine.` : "Skip filterByArea since there is no cuisine preference."}
3. Look at the meal IDs returned — meals appearing across multiple ingredient searches are the best matches.
4. Call lookupRecipe for the top 3-4 most promising meal IDs.
5. Return the best 2-4 recipes that use the most of the available ingredients.

Always look up full recipe details before returning results.`;

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
        answerFormat: zodToJsonSchema(RecipeSchema, "RecipeResults"),
      },
      options: { awaitCompletion: true },
    });

    if (run.status !== "succeeded") {
      return NextResponse.json(
        { error: run.error?.message ?? "Agent run did not succeed" },
        { status: 500 }
      );
    }

    const result = parseAnswer(run.result?.answer) as RecipeResult;
    return NextResponse.json(result);
  } catch (err) {
    console.error("[find-recipes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
