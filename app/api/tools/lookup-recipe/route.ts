import { NextRequest, NextResponse } from "next/server";

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

export async function POST(req: NextRequest) {
  try {
    // Subconscious wraps parameters under a "parameters" key in the body
    const body = await req.json();
    const mealId = body?.parameters?.mealId;

    if (!mealId || typeof mealId !== "string") {
      return NextResponse.json(
        { error: "mealId is required and must be a string" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${MEALDB_BASE}/lookup.php?i=${encodeURIComponent(mealId.trim())}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from TheMealDB" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const meal = data.meals?.[0] ?? null;

    if (!meal) {
      return NextResponse.json({ meal: null });
    }

    // Extract ingredient list (TheMealDB uses strIngredient1..20 + strMeasure1..20)
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const name = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (name && name.trim()) {
        ingredients.push(measure?.trim() ? `${measure.trim()} ${name.trim()}` : name.trim());
      }
    }

    return NextResponse.json({
      meal: {
        id: meal.idMeal,
        name: meal.strMeal,
        category: meal.strCategory,
        area: meal.strArea,
        instructions: meal.strInstructions,
        thumbnail: meal.strMealThumb,
        youtubeUrl: meal.strYoutube ?? null,
        ingredients,
      },
    });
  } catch (err) {
    console.error("[lookup-recipe]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
