import React from 'react';
import type { SavedMeal } from '../types';
import { X, Bookmark, Trash2, Dumbbell, Clock, Sparkles, ChevronRight } from 'lucide-react';

interface SavedMealsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedMeals: SavedMeal[];
  onRemoveMeal: (id: string) => Promise<void>;
  onInspectMeal: (meal: SavedMeal) => void;
}

export const SavedMealsDrawer: React.FC<SavedMealsDrawerProps> = ({
  isOpen,
  onClose,
  savedMeals,
  onRemoveMeal,
  onInspectMeal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Repas Favoris ({savedMeals.length})
              </h2>
              <p className="text-[11px] text-zinc-400">
                Priorisés dans les prochaines générations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3">
          {savedMeals.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-300">Aucun repas enregistré</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                  Clique sur "Enregistrer" sur une fiche recette pour l'ajouter à vos favoris de coloc. Elle sera reproposée plus souvent !
                </p>
              </div>
            </div>
          ) : (
            savedMeals.map(meal => (
              <div
                key={meal.id}
                onClick={() => onInspectMeal(meal)}
                className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all flex items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {meal.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" />
                      {meal.proteinGrams}g prot
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {meal.prepTimeMinutes + meal.cookTimeMinutes}m
                    </span>
                    <span>{meal.ingredients.length} ingrédients</span>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onRemoveMeal(meal.id)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 active:scale-95 transition-all"
                    title="Supprimer des favoris"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        {savedMeals.length > 0 && (
          <div className="p-3 border-t border-zinc-800 bg-zinc-950 text-center text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gemini s'inspirera de ces {savedMeals.length} recettes pour tes prochains menus</span>
          </div>
        )}
      </div>
    </div>
  );
};
