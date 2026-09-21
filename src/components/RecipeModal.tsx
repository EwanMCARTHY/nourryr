import React, { useState } from 'react';
import type { Recipe } from '../types';
import { X, Clock, Dumbbell, Flame, ChefHat, Check, Bookmark, BookmarkCheck, RefreshCw, Users } from 'lucide-react';

interface RecipeModalProps {
  recipe: Recipe | null;
  onClose: () => void;
  onToggleSave: (recipe: Recipe) => Promise<void>;
  onSwap: (recipe: Recipe) => Promise<void>;
  isSaved: boolean;
  isSwapping: boolean;
  numberOfPeople: number;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  onClose,
  onToggleSave,
  onSwap,
  isSaved,
  isSwapping,
  numberOfPeople,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  if (!recipe) return null;

  const toggleStep = (idx: number) => {
    setCheckedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Jour {recipe.dayIndex} • {recipe.mealType}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Title and description */}
          <div>
            <h2 className="text-xl font-black text-white tracking-tight leading-tight">
              {recipe.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {recipe.description}
            </p>
          </div>

          {/* Macros & Info Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-center">
              <span className="text-[10px] text-zinc-400 block font-medium">Protéines</span>
              <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                <Dumbbell className="w-3.5 h-3.5" />
                {recipe.proteinGrams}g
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-center">
              <span className="text-[10px] text-zinc-400 block font-medium">Énergie</span>
              <span className="text-sm font-black text-amber-400 flex items-center justify-center gap-0.5 mt-0.5">
                <Flame className="w-3.5 h-3.5" />
                {recipe.calories || '~600'} kcal
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-center">
              <span className="text-[10px] text-zinc-400 block font-medium">Temps</span>
              <span className="text-sm font-bold text-zinc-200 flex items-center justify-center gap-0.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                {recipe.prepTimeMinutes + recipe.cookTimeMinutes}m
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-center">
              <span className="text-[10px] text-zinc-400 block font-medium">Portions</span>
              <span className="text-sm font-bold text-zinc-200 flex items-center justify-center gap-0.5 mt-0.5">
                <Users className="w-3.5 h-3.5" />
                {numberOfPeople}
              </span>
            </div>
          </div>

          {/* Equipment alert */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <ChefHat className="w-4 h-4 text-emerald-400" />
              <span>Matériel requis :</span>
            </div>
            <span className="font-semibold text-emerald-400">
              {recipe.equipmentUsed?.join(' • ') || 'Poêle • Plaques'} (Zéro four)
            </span>
          </div>

          {/* Ingredients Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Ingrédients ({numberOfPeople} {numberOfPeople > 1 ? 'personnes' : 'personne'})
              </h3>
              <span className="text-[11px] text-zinc-500 font-medium">
                Quantités pour vos repas
              </span>
            </div>

            <div className="space-y-1.5">
              {recipe.ingredients.map((ing, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs"
                >
                  <span className="text-zinc-200 font-medium">{ing.name}</span>
                  <span className="font-bold text-emerald-400 px-2 py-0.5 rounded bg-zinc-800">
                    {ing.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-step Instructions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Préparation pas à pas
              </h3>
              <span className="text-[11px] text-zinc-500">Coche au fur et à mesure</span>
            </div>

            <div className="space-y-2.5">
              {recipe.instructions.map((step, idx) => {
                const isDone = checkedSteps[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => toggleStep(idx)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isDone
                        ? 'bg-zinc-900/40 border-emerald-900/40 text-zinc-500 line-through'
                        : 'bg-zinc-900/70 border-zinc-800/80 text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-colors ${
                        isDone
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                    </div>
                    <p className="text-xs leading-relaxed">{step}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/95 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleSave(recipe)}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              isSaved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700/60'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                <span>Favori enregistré</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>Ajouter aux favoris</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSwapping}
            onClick={() => onSwap(recipe)}
            className="py-3 px-4 rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isSwapping ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSwapping ? 'Remplacement...' : 'Remplacer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
