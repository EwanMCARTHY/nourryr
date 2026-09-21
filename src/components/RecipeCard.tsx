import React, { useState } from 'react';
import type { Recipe } from '../types';
import { Clock, Dumbbell, Flame, Bookmark, BookmarkCheck, RefreshCw, ChefHat } from 'lucide-react';

interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onToggleSave: (recipe: Recipe) => Promise<void>;
  onSwap: (recipe: Recipe) => Promise<void>;
  isSaved: boolean;
  isSwapping: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onSelect,
  onToggleSave,
  onSwap,
  isSaved,
  isSwapping,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onToggleSave(recipe);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSwapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwap(recipe);
  };

  return (
    <div
      onClick={() => onSelect(recipe)}
      className="group relative rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-4 shadow-lg hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
    >
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            Jour {recipe.dayIndex}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400">
            {recipe.mealType}
          </span>
        </div>

        {/* Protein Badge */}
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
          <Dumbbell className="w-3 h-3" />
          <span>{recipe.proteinGrams}g prot</span>
        </div>
      </div>

      {/* Recipe Title & Description */}
      <h3 className="text-base font-bold text-white tracking-tight leading-snug group-hover:text-emerald-300 transition-colors">
        {recipe.title}
      </h3>
      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
        {recipe.description}
      </p>

      {/* Meta indicators */}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>{recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</span>
        </div>
        {recipe.calories > 0 && (
          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500/80" />
            <span>~{recipe.calories} kcal</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <ChefHat className="w-3.5 h-3.5 text-emerald-400/80" />
          <span className="text-zinc-300">
            {recipe.equipmentUsed?.join(', ') || 'Poêle'}
          </span>
        </div>
      </div>

      {/* Bottom actions bar */}
      <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-400 group-hover:underline flex items-center gap-1">
          Voir la recette →
        </span>

        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {/* Swap button */}
          <button
            type="button"
            disabled={isSwapping}
            onClick={handleSwapClick}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all text-xs flex items-center gap-1 disabled:opacity-40"
            title="Remplacer cette recette"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSwapping ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="text-[11px]">{isSwapping ? 'Changement...' : 'Changer'}</span>
          </button>

          {/* Save / Favorite button */}
          <button
            type="button"
            onClick={handleSaveClick}
            className={`p-2 rounded-xl transition-all active:scale-95 text-xs flex items-center gap-1 ${
              isSaved || saveSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title={isSaved ? 'Recette enregistrée' : 'Enregistrer dans les favoris'}
          >
            {isSaved || saveSuccess ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">Enregistré</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span className="text-[11px]">Enregistrer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
