import React, { useState } from 'react';
import type { MealPlan, Recipe, SavedMeal } from '../types';
import { RecipeCard } from './RecipeCard';
import { RecipeModal } from './RecipeModal';
import { ShoppingListView } from './ShoppingListView';
import { Utensils, ShoppingCart, Dumbbell, Trash2 } from 'lucide-react';

interface MealPlanViewProps {
  plan: MealPlan;
  savedRecipes: SavedMeal[];
  onToggleSave: (recipe: Recipe) => Promise<void>;
  onSwapRecipe: (recipe: Recipe) => Promise<void>;
  onToggleShoppingItem: (id: string) => void;
  onUpdateItemPrice: (itemId: string, newPrice: number) => void;
  onResetShoppingChecks: () => void;
  onDeletePlan: () => void;
  swappingRecipeId: string | null;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  plan,
  savedRecipes,
  onToggleSave,
  onSwapRecipe,
  onToggleShoppingItem,
  onUpdateItemPrice,
  onResetShoppingChecks,
  onDeletePlan,
  swappingRecipeId,
}) => {
  const [activeTab, setActiveTab] = useState<'meals' | 'shopping'>('meals');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Compute stats
  const totalProteinsAvg = plan.recipes.length > 0
    ? Math.round(plan.recipes.reduce((sum, r) => sum + r.proteinGrams, 0) / plan.recipes.length)
    : 52;

  const checkedItemsCount = plan.shoppingList.filter(i => i.checked).length;

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

      {/* Plan Header Summary & Reset */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-white">
            {plan.recipes.length} repas • {plan.numberOfPeople} pers.
          </span>
          <span className="text-zinc-400">({plan.supermarket})</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <Dumbbell className="w-3.5 h-3.5" />
            <span>~{totalProteinsAvg}g prot</span>
          </div>

          <button
            type="button"
            onClick={onDeletePlan}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 active:scale-95 transition-all"
            title="Supprimer ce programme"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab 1: Meals */}
      {activeTab === 'meals' && (
        <div className="space-y-3 pb-12">
          {plan.recipes.map((recipe, idx) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={idx}
              onSelect={r => setSelectedRecipe(r)}
              onToggleSave={onToggleSave}
              onSwap={onSwapRecipe}
              isSaved={isMealSaved(recipe)}
              isSwapping={swappingRecipeId === recipe.id}
            />
          ))}

          {/* Delete plan button at bottom */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={onDeletePlan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-400 hover:bg-zinc-900/80 transition-colors border border-transparent hover:border-zinc-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer ce programme et en créer un nouveau</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Shopping List */}
      {activeTab === 'shopping' && (
        <ShoppingListView
          items={plan.shoppingList}
          onToggleItem={onToggleShoppingItem}
          onUpdatePrice={onUpdateItemPrice}
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
