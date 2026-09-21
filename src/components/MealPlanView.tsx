import React, { useState } from 'react';
import type { MealPlan, Recipe, SavedMeal } from '../types';
import { RecipeCard } from './RecipeCard';
import { RecipeModal } from './RecipeModal';
import { ShoppingListView } from './ShoppingListView';
import { Utensils, ShoppingCart, Dumbbell } from 'lucide-react';

interface MealPlanViewProps {
  plan: MealPlan;
  savedRecipes: SavedMeal[];
  onToggleSave: (recipe: Recipe) => Promise<void>;
  onSwapRecipe: (recipe: Recipe) => Promise<void>;
  onToggleShoppingItem: (id: string) => void;
  onResetShoppingChecks: () => void;
  swappingRecipeId: string | null;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  plan,
  savedRecipes,
  onToggleSave,
  onSwapRecipe,
  onToggleShoppingItem,
  onResetShoppingChecks,
  swappingRecipeId,
}) => {
  const [activeTab, setActiveTab] = useState<'meals' | 'shopping'>('meals');
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Compute stats
  const totalProteinsAvg = plan.recipes.length > 0
    ? Math.round(plan.recipes.reduce((sum, r) => sum + r.proteinGrams, 0) / plan.recipes.length)
    : 45;

  const checkedItemsCount = plan.shoppingList.filter(i => i.checked).length;

  const filteredRecipes = selectedDay === 'all'
    ? plan.recipes
    : plan.recipes.filter(r => r.dayIndex === selectedDay);

  const isMealSaved = (recipe: Recipe) => {
    return savedRecipes.some(
      s => s.id === recipe.id || s.title.toLowerCase() === recipe.title.toLowerCase()
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Segmented Tab Switcher */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('meals')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'meals'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-emerald-400" />
          <span>Recettes ({plan.recipes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shopping')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'shopping'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
          <span>Courses ({checkedItemsCount}/{plan.shoppingList.length})</span>
        </button>
      </div>

      {/* Tab 1: Meals */}
      {activeTab === 'meals' && (
        <div className="space-y-4 pb-12">
          {/* Plan Info Pill */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">
                {plan.recipes.length} repas • {plan.numberOfDays} jours • {plan.numberOfPeople} pers.
              </span>
              <span className="text-zinc-400">({plan.supermarket})</span>
            </div>

            <div className="flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <Dumbbell className="w-3.5 h-3.5" />
              <span>~{totalProteinsAvg}g prot/repas</span>
            </div>
          </div>

          {/* Days Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedDay === 'all'
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
              }`}
            >
              Tous ({plan.recipes.length})
            </button>
            {Array.from({ length: plan.numberOfDays }, (_, i) => i + 1).map(day => (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedDay === day
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                Jour {day}
              </button>
            ))}
          </div>

          {/* Recipe cards list */}
          <div className="space-y-3">
            {filteredRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onSelect={r => setSelectedRecipe(r)}
                onToggleSave={onToggleSave}
                onSwap={onSwapRecipe}
                isSaved={isMealSaved(recipe)}
                isSwapping={swappingRecipeId === recipe.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Shopping List */}
      {activeTab === 'shopping' && (
        <ShoppingListView
          items={plan.shoppingList}
          onToggleItem={onToggleShoppingItem}
          supermarket={plan.supermarket}
          budget={plan.budget}
          estimatedCost={plan.estimatedTotalCost}
          onResetAllChecks={onResetShoppingChecks}
        />
      )}

      {/* Full Recipe Modal */}
      <RecipeModal
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onToggleSave={onToggleSave}
        onSwap={async r => {
          await onSwapRecipe(r);
          setSelectedRecipe(null);
        }}
        isSaved={selectedRecipe ? isMealSaved(selectedRecipe) : false}
        isSwapping={selectedRecipe ? swappingRecipeId === selectedRecipe.id : false}
        numberOfPeople={plan.numberOfPeople}
      />
    </div>
  );
};
