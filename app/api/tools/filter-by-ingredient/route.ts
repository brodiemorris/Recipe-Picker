import { NextRequest, NextResponse } from "next/server";

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

export async function POST(req: NextRequest) {
  try {
    // Subconscious wraps parameters under a "parameters" key in the body
    const body = await req.json();
    const ingredient = body?.parameters?.ingredient;

    if (!ingredient || typeof ingredient !== "string") {
      return NextResponse.json(
        { error: "ingredient is required and must be a string" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${MEALDB_BASE}/filter.php?i=${encodeURIComponent(ingredient.trim())}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from TheMealDB" },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      meals: data.meals ?? [],
    });
  } catch (err) {
    console.error("[filter-by-ingredient]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
