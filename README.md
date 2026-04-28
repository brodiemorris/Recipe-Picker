# Recipe Finder

Find recipes from ingredients you have, powered by a Subconscious agent.

**Live demo:** [https://recipe-picker-phi.vercel.app](https://recipe-picker-phi.vercel.app)

## What it does

You type ingredients you've got, like `mozzarella, basil, garlic`, optionally pick a cuisine, and the app returns a handful of recipes you can actually make. Recipes you like can be pinned to a "fridge" view that persists in your browser, with magnet-style drag positioning.

Recipes come from [TheMealDB](https://www.themealdb.com/), a free public API of crowd-sourced recipes. Everything around it (the search pipeline, the agent integration, the UI) was built for this project.

## How the search works

The pipeline is a hybrid: a deterministic backend handles the mechanical work, and a Subconscious agent does the judgment.

```
ingredients ─► [ ingredient resolver ] ─► [ parallel filter + score ] ─► [ Subconscious agent ] ─► picks
                plurals/typos/synonyms     intersect, rank by overlap     ranks, explains, recovers
```

1. **Deterministic prefilter** ([`lib/recipe-prefilter.ts`](lib/recipe-prefilter.ts)). Resolves each ingredient via a 3-tier resolver, fires all TheMealDB filter calls in parallel, intersects the results, and scores candidates by ingredient overlap and cuisine match.
2. **Agent ranking** ([`app/api/find-recipes/route.ts`](app/api/find-recipes/route.ts)). The top candidates, the user's original input, and any substitution notes are passed to the agent. The agent picks 1 to 6 recipes, explains its choices, and is free to call the same tools the prefilter used if the candidate set has gaps it wants to fill.

This split keeps the agent in the driver's seat for judgment, ranking, and recovery (the things it's actually good at), while parallelism on the deterministic side carries most of the wall-clock load.

### Other notable bits

- **Ingredient resolver** ([`lib/ingredient-resolver.ts`](lib/ingredient-resolver.ts)). Three tiers in order: word-boundary containment match against TheMealDB's live ingredient list (handles `basil` matching both `Basil` and `Basil Leaves`), Levenshtein fuzzy match (handles typos like `mozarela`), and a hand-curated synonym map of about 100 entries (handles UK/US splits like `eggplant` ↔ `Aubergine` and meat-cut generalizations like `ribeye` ↔ `Beef Fillet`).
- **MealDB cache** ([`lib/mealdb-cache.ts`](lib/mealdb-cache.ts)). Promise-singleton in-memory cache of TheMealDB's ingredient list, fetched once per cold start.
- **Mock mode**. Adding `?mock=true` to the home page URL bypasses the agent entirely and renders the top prefilter candidates. Useful for exercising the UI without consuming Subconscious tokens.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- TypeScript
- Tailwind CSS
- [Subconscious](https://subconscious.dev) (`tim-claude` engine) for the agent layer
- [TheMealDB](https://www.themealdb.com/) for recipe data
- Vercel for hosting

## Local setup

1. Install Node.js 20+.
2. Clone and install:
   ```bash
   git clone <repo-url>
   cd Recipe-Picker
   npm install
   ```
3. Create `.env.local` at the repo root:
   ```
   SUBCONSCIOUS_API_KEY=<your key from https://subconscious.dev/platform>
   BASE_URL=http://localhost:3000
   ```
   `BASE_URL` tells the `find-recipes` route where its own tool endpoints live. On Vercel it falls back to `VERCEL_URL`, so you don't need to set it in production.
4. Run the dev server:
   ```bash
   npm run dev
   ```
   The app runs on http://localhost:3000.

To exercise the UI without burning agent tokens, visit http://localhost:3000/?mock=true.

## Project structure

```
app/
  page.tsx                   # main UI: ingredient input, results, mock-mode toggle
  layout.tsx                 # root layout + page metadata
  saved/page.tsx             # /saved route for the fridge view
  components/
    FridgeView.tsx           # saved-recipes view with drag-and-drop
  api/
    find-recipes/route.ts    # prefilter → agent pipeline orchestrator
    tools/                   # thin wrappers around TheMealDB (used by the agent)
      filter-by-ingredient/
      filter-by-area/
      lookup-recipe/
lib/
  ingredient-resolver.ts     # 3-tier resolver: normalize → fuzzy → synonyms
  recipe-prefilter.ts        # parallel filter + intersect + score
  mealdb-cache.ts            # cached TheMealDB ingredient list
  saved-recipes.ts           # localStorage helpers for the fridge
```
