"use client";

import { useState, useEffect, useRef } from "react";
import {
  getSavedRecipes,
  removeRecipe,
  getFridgePositions,
  setFridgePosition,
  type SavedRecipe,
  type FridgePosition,
} from "@/lib/saved-recipes";

// Deterministic position + rotation from recipe name
function recipeLayout(name: string, index: number) {
  let hash = index * 2654435761;
  for (let i = 0; i < name.length; i++) {
    hash = (hash ^ name.charCodeAt(i)) * 2654435761;
    hash = hash >>> 0;
  }
  // Use unsigned shifts (>>>) so the modulo can't go negative.
  const top = 4 + (hash % 40);
  const left = 8 + ((hash >>> 8) % 60);
  const rotation = -10 + ((hash >>> 16) % 21);
  return { top, left, rotation };
}

const CARD_WIDTH = 176; // matches Tailwind w-44
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 32;
const DRAG_THRESHOLD = 5;

type CardLayout = { top: number; left: number; rotation: number };

const MAGNET_COLORS = [
  "bg-amber-400", "bg-red-400", "bg-teal-400", "bg-blue-400", "bg-purple-400",
];

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function RecipeModal({
  recipe,
  onClose,
  onUnpin,
}: {
  recipe: SavedRecipe;
  onClose: () => void;
  onUnpin: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {recipe.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-48 object-cover rounded-t-2xl" />
        )}
        <div className="p-5 flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {recipe.area && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{recipe.area}</span>
              )}
              {recipe.category && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{recipe.category}</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ingredients</p>
            <p className="text-sm text-gray-700 leading-relaxed">{recipe.ingredients.join(" · ")}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Instructions</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
          </div>
          {recipe.youtubeUrl && (
            <a
              href={recipe.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
              </svg>
              Watch on YouTube
            </a>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onUnpin}
              className="flex-1 bg-red-50 border border-red-200 text-red-600 text-sm font-medium py-2 rounded-xl hover:bg-red-100 transition-colors"
            >
              📌 Unpin from fridge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fridge card
// ---------------------------------------------------------------------------

function FridgeCard({
  recipe,
  index,
  layout,
  isDragging,
  containerRef,
  onClick,
  onDragStart,
  onDragMove,
  onDragCommit,
  onDragEnd,
}: {
  recipe: SavedRecipe;
  index: number;
  layout: CardLayout;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  onDragStart: (name: string) => void;
  onDragMove: (name: string, pos: FridgePosition) => void;
  onDragCommit: (name: string, pos: FridgePosition) => void;
  onDragEnd: () => void;
}) {
  const magnet = MAGNET_COLORS[index % MAGNET_COLORS.length];
  const downRef = useRef<{
    pointerX: number;
    pointerY: number;
    cardLeftPx: number;
    cardTopPx: number;
    moved: boolean;
    lastPos: FridgePosition | null;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.setPointerCapture(e.pointerId);
    downRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      cardLeftPx: card.offsetLeft,
      cardTopPx: card.offsetTop,
      moved: false,
      lastPos: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = downRef.current;
    if (!d) return;
    const dx = e.clientX - d.pointerX;
    const dy = e.clientY - d.pointerY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      d.moved = true;
      onDragStart(recipe.name);
    }
    if (!d.moved) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cardHeight = e.currentTarget.offsetHeight;
    const maxLeft = Math.max(rect.width - CARD_WIDTH - PAD_X, PAD_X);
    const maxTop = Math.max(rect.height - cardHeight - PAD_BOTTOM, PAD_TOP);
    const newLeft = Math.min(Math.max(d.cardLeftPx + dx, PAD_X), maxLeft);
    const newTop = Math.min(Math.max(d.cardTopPx + dy, PAD_TOP), maxTop);
    const pos: FridgePosition = {
      xPct: (newLeft / rect.width) * 100,
      yPct: (newTop / rect.height) * 100,
      rot: layout.rotation,
    };
    d.lastPos = pos;
    onDragMove(recipe.name, pos);
  };

  const handlePointerUp = () => {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    if (!d.moved) {
      onClick();
    } else {
      if (d.lastPos) onDragCommit(recipe.name, d.lastPos);
      onDragEnd();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="absolute w-44 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow text-left select-none"
      style={{
        top: `${layout.top}%`,
        left: `${layout.left}%`,
        transform: `rotate(${layout.rotation}deg)`,
        transformOrigin: "top center",
        zIndex: isDragging ? 30 : "auto",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
    >
      <div className="flex justify-center -mt-3 mb-1">
        <div className={`w-6 h-6 rounded-full ${magnet} shadow-md`} />
      </div>
      {recipe.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.thumbnail}
          alt={recipe.name}
          draggable={false}
          className="w-full h-24 object-cover rounded-t pointer-events-none"
        />
      )}
      <div className="p-2">
        <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2">{recipe.name}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {recipe.area && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full leading-none">
              {recipe.area}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FridgeView — used both inline (home page slider) and at /saved
// ---------------------------------------------------------------------------

export default function FridgeView({ onBack }: { onBack: () => void }) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [selected, setSelected] = useState<SavedRecipe | null>(null);
  const [positions, setPositions] = useState<Record<string, FridgePosition>>({});
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh list on every mount / when parent makes this view visible
  useEffect(() => {
    const recipes = getSavedRecipes();
    const stored = getFridgePositions();
    const valid = new Set(recipes.map((r) => r.name));
    const cleaned: Record<string, FridgePosition> = {};
    for (const [name, pos] of Object.entries(stored)) {
      if (valid.has(name)) cleaned[name] = pos;
    }
    setRecipes(recipes);
    setPositions(cleaned);
  }, []);

  const handleUnpin = (name: string) => {
    removeRecipe(name);
    setRecipes((prev) => prev.filter((r) => r.name !== name));
    setPositions((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSelected(null);
  };

  return (
    <>
      <div
        className="min-h-screen w-full flex flex-col"
        style={{
          background:
            "linear-gradient(160deg, #e9e9e9 0%, #f4f4f4 20%, #dcdcdc 45%, #efefef 70%, #e2e2e2 100%)",
        }}
      >
        <div className="flex items-center gap-3 px-5 py-4 bg-white/60 backdrop-blur-sm border-b border-white/80 shadow-sm">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 transition-colors text-xl"
            aria-label="Back to recipe picker"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-gray-800">My Recipe Fridge</h1>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-gray-700"
            aria-hidden="true"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="5" y1="11" x2="19" y2="11" />
            <line x1="8" y1="5" x2="8" y2="8" />
            <line x1="8" y1="14" x2="8" y2="17" />
          </svg>
        </div>

        <div ref={containerRef} className="relative flex-1" style={{ minHeight: "80vh" }}>
          {recipes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <span className="text-5xl">📌</span>
              <p className="text-sm">No saved recipes yet.</p>
              <p className="text-xs">Pin a recipe and it will appear here!</p>
            </div>
          ) : (
            recipes.map((recipe, i) => {
              const stored = positions[recipe.name];
              const layout: CardLayout = stored
                ? { top: stored.yPct, left: stored.xPct, rotation: stored.rot }
                : recipeLayout(recipe.name, i);
              return (
                <FridgeCard
                  key={recipe.name}
                  recipe={recipe}
                  index={i}
                  layout={layout}
                  isDragging={draggingName === recipe.name}
                  containerRef={containerRef}
                  onClick={() => setSelected(recipe)}
                  onDragStart={(name) => setDraggingName(name)}
                  onDragMove={(name, pos) =>
                    setPositions((prev) => ({ ...prev, [name]: pos }))
                  }
                  onDragCommit={(name, pos) => setFridgePosition(name, pos)}
                  onDragEnd={() => setDraggingName(null)}
                />
              );
            })
          )}
        </div>
      </div>

      {selected && (
        <RecipeModal
          recipe={selected}
          onClose={() => setSelected(null)}
          onUnpin={() => handleUnpin(selected.name)}
        />
      )}
    </>
  );
}
