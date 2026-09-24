import { useState, useEffect, useCallback } from 'react';
import type { MealPlan, Recipe, SavedMeal, Supermarket, ShoppingItem } from './types';
import { Header } from './components/Header';
import { GeneratorForm } from './components/GeneratorForm';
import { MealPlanView } from './components/MealPlanView';
import { SavedMealsDrawer } from './components/SavedMealsDrawer';
import { RecipeModal } from './components/RecipeModal';
import { SettingsModal } from './components/SettingsModal';
import { generateMealPlan, swapRecipe, excludeShoppingItem } from './lib/gemini';
import {
  fetchCurrentPlan,
  saveCurrentPlan,
  fetchSavedMeals,
  addSavedMeal,
  removeSavedMeal,
  fetchCustomPrices,
  saveCustomPrice,
  fetchExcludedIngredients,
  addExcludedIngredient,
  removeExcludedIngredient,
} from './lib/storage';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function App() {
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [swappingRecipeId, setSwappingRecipeId] = useState<string | null>(null);
  const [excludingItemId, setExcludingItemId] = useState<string | null>(null);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectedSavedRecipe, setInspectedSavedRecipe] = useState<Recipe | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check API key presence
  const checkApiKey = useCallback(async () => {
    const key = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (key) {
      setHasApiKey(true);
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/check-config');
      if (res.ok) {
        const data = await res.json();
        if (data.hasApiKey) {
          setHasApiKey(true);
          return;
        }
      }
    } catch {
      // Local dev without netlify functions
    }
    setHasApiKey(false);
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [plan, favorites, excluded] = await Promise.all([
        fetchCurrentPlan(),
        fetchSavedMeals(),
        fetchExcludedIngredients(),
      ]);
      if (plan) setActivePlan(plan);
      if (favorites) setSavedMeals(favorites);
      if (excluded) setExcludedIngredients(excluded);
    } catch (e) {
      console.error('Error loading data', e);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
    loadData();

    // Auto refresh when tab regains focus (useful when roommate updates list)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [checkApiKey, loadData]);

  // Handle plan generation
  const handleGenerate = async (params: {
    numberOfDays: number;
    totalMeals: number;
    numberOfPeople: number;
    supermarket: Supermarket;
    budget: number;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const apiKey = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
      const customPrices = await fetchCustomPrices();
      const plan = await generateMealPlan({
        ...params,
        savedRecipes: savedMeals,
        excludedIngredients,
        customPrices,
        apiKey,
      });

      setActivePlan(plan);
      await saveCurrentPlan(plan);
    } catch (err: any) {
      console.error('Generation error', err);
      setErrorMessage(err.message || 'Une erreur est survenue lors de la génération.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle saving a recipe into favorites
  const handleToggleSave = async (recipe: Recipe) => {
    const existing = savedMeals.find(
      s => s.id === recipe.id || s.title.toLowerCase() === recipe.title.toLowerCase()
    );

    if (existing) {
      await removeSavedMeal(existing.id);
      setSavedMeals(prev => prev.filter(m => m.id !== existing.id));
    } else {
      const newSaved: SavedMeal = {
        id: recipe.id,
        title: recipe.title,
        proteinGrams: recipe.proteinGrams,
        calories: recipe.calories,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        savedAt: new Date().toISOString(),
      };
      await addSavedMeal(newSaved);
      setSavedMeals(prev => [newSaved, ...prev]);
    }
  };

  // Swap a single recipe (and adapt shopping list)
  const handleSwapRecipe = async (recipe: Recipe) => {
    if (!activePlan) return;
    setSwappingRecipeId(recipe.id);
    setErrorMessage(null);

    try {
      const apiKey = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
      const customPrices = await fetchCustomPrices();

      const result = await swapRecipe({
        currentRecipe: recipe,
        allRecipes: activePlan.recipes,
        currentShoppingList: activePlan.shoppingList,
        numberOfPeople: activePlan.numberOfPeople,
        supermarket: activePlan.supermarket,
        budget: activePlan.budget,
        excludedIngredients: activePlan.excludedIngredients || excludedIngredients,
        customPrices,
        apiKey,
      });

      const updatedRecipes = activePlan.recipes.map(r =>
        r.id === recipe.id ? result.newRecipe : r
      );

      const updatedPlan: MealPlan = {
        ...activePlan,
        recipes: updatedRecipes,
        shoppingList: result.updatedShoppingList,
        estimatedTotalCost: result.estimatedTotalCost,
      };

      setActivePlan(updatedPlan);
      await saveCurrentPlan(updatedPlan);
    } catch (err: any) {
      console.error('Swap error', err);
      setErrorMessage(err.message || 'Impossible de remplacer la recette.');
    } finally {
      setSwappingRecipeId(null);
    }
  };

  // Exclude an item from the shopping list and adapt affected recipes
  const handleExcludeShoppingItem = async (item: ShoppingItem) => {
    if (!activePlan) return;
    setExcludingItemId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const apiKey = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
      const customPrices = await fetchCustomPrices();

      const result = await excludeShoppingItem({
        excludedItem: item,
        currentMealPlan: activePlan,
        customPrices,
        apiKey,
      });

      const updatedExcluded = Array.from(new Set([...excludedIngredients, item.name]));
      setExcludedIngredients(updatedExcluded);
      await addExcludedIngredient(item.name);

      const updatedPlan: MealPlan = {
        ...activePlan,
        recipes: result.updatedRecipes,
        shoppingList: result.updatedShoppingList,
        estimatedTotalCost: result.estimatedTotalCost,
        excludedIngredients: updatedExcluded,
      };

      setActivePlan(updatedPlan);
      await saveCurrentPlan(updatedPlan);
      setSuccessMessage(result.replacementSummary || `"${item.name}" exclu et remplacé.`);
    } catch (err: any) {
      console.error('Exclude error', err);
      setErrorMessage(err.message || "Impossible d'exclure cet aliment.");
    } finally {
      setExcludingItemId(null);
    }
  };

  // Restore a previously excluded ingredient
  const handleRestoreExcluded = async (ingredient: string) => {
    try {
      await removeExcludedIngredient(ingredient);
      const updatedExcluded = excludedIngredients.filter(i => i.toLowerCase() !== ingredient.toLowerCase());
      setExcludedIngredients(updatedExcluded);

      if (activePlan) {
        const updatedPlan: MealPlan = {
          ...activePlan,
          excludedIngredients: updatedExcluded,
        };
        setActivePlan(updatedPlan);
        await saveCurrentPlan(updatedPlan);
      }
      setSuccessMessage(`"${ingredient}" a été retiré des aliments exclus.`);
    } catch (err: any) {
      console.error('Restore excluded error', err);
      setErrorMessage("Erreur lors de la réactivation de l'ingrédient.");
    }
  };

  // Update item price in shopping list and sync to custom prices database
  const handleUpdateItemPrice = async (itemId: string, newPrice: number) => {
    if (!activePlan) return;

    let targetItemName = '';
    const updatedShoppingList = activePlan.shoppingList.map(item => {
      if (item.id === itemId) {
        targetItemName = item.name;
        return {
          ...item,
          estimatedPrice: newPrice,
          isUserPrice: true,
        };
      }
      return item;
    });

    const newEstimatedTotal = Number(
      updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0).toFixed(2)
    );

    const updatedPlan: MealPlan = {
      ...activePlan,
      shoppingList: updatedShoppingList,
      estimatedTotalCost: newEstimatedTotal,
    };

    setActivePlan(updatedPlan);
    await saveCurrentPlan(updatedPlan);

    if (targetItemName) {
      await saveCustomPrice(targetItemName, newPrice);
    }
  };

  // Shopping item checkbox toggle
  const handleToggleShoppingItem = async (itemId: string) => {
    if (!activePlan) return;

    const updatedList = activePlan.shoppingList.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    const updatedPlan: MealPlan = {
      ...activePlan,
      shoppingList: updatedList,
    };

    setActivePlan(updatedPlan);
    await saveCurrentPlan(updatedPlan);
  };

  // Reset all shopping checkboxes
  const handleResetShoppingChecks = async () => {
    if (!activePlan) return;

    const updatedList = activePlan.shoppingList.map(item => ({
      ...item,
      checked: false,
    }));

    const updatedPlan: MealPlan = {
      ...activePlan,
      shoppingList: updatedList,
    };

    setActivePlan(updatedPlan);
    await saveCurrentPlan(updatedPlan);
  };

  // Reset / Delete entire plan
  const handleResetPlan = async () => {
    if (window.confirm('Supprimer ce programme ? Tu pourras en générer un nouveau immédiatement.')) {
      setActivePlan(null);
      await saveCurrentPlan(null);
    }
  };

  // Remove saved meal from drawer
  const handleRemoveSavedMeal = async (id: string) => {
    await removeSavedMeal(id);
    setSavedMeals(prev => prev.filter(m => m.id !== id));
  };

  // Inspect saved meal as RecipeModal
  const handleInspectSavedMeal = (saved: SavedMeal) => {
    const asRecipe: Recipe = {
      id: saved.id,
      title: saved.title,
      prepTimeMinutes: saved.prepTimeMinutes,
      cookTimeMinutes: saved.cookTimeMinutes,
      proteinGrams: saved.proteinGrams,
      calories: saved.calories || 700,
      ingredients: saved.ingredients,
      instructions: saved.instructions,
      equipmentUsed: ['Poêle', 'Plaques'],
      isSaved: true,
    };
    setInspectedSavedRecipe(asRecipe);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header */}
      <Header
        hasActivePlan={!!activePlan}
        savedCount={savedMeals.length}
        onOpenSaved={() => setIsSavedDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetPlan={handleResetPlan}
        hasApiKey={hasApiKey}
      />

      {/* Main Container (Mobile Max Width) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4">
        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 font-bold px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Success Alert if any */}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* View Switch: Generator Form OR Active Meal Plan */}
        {!activePlan ? (
          <GeneratorForm
            onGenerate={handleGenerate}
            isLoading={isLoading}
            savedRecipes={savedMeals}
            onOpenSettings={() => setIsSettingsOpen(true)}
            hasApiKey={hasApiKey}
          />
        ) : (
          <MealPlanView
            plan={activePlan}
            savedRecipes={savedMeals}
            onToggleSave={handleToggleSave}
            onSwapRecipe={handleSwapRecipe}
            onToggleShoppingItem={handleToggleShoppingItem}
            onUpdateItemPrice={handleUpdateItemPrice}
            onExcludeShoppingItem={handleExcludeShoppingItem}
            excludingItemId={excludingItemId}
            excludedIngredients={excludedIngredients}
            onRestoreExcluded={handleRestoreExcluded}
            onResetShoppingChecks={handleResetShoppingChecks}
            onDeletePlan={handleResetPlan}
            swappingRecipeId={swappingRecipeId}
          />
        )}
      </main>

      {/* Saved Meals Drawer */}
      <SavedMealsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedMeals={savedMeals}
        onRemoveMeal={handleRemoveSavedMeal}
        onInspectMeal={handleInspectSavedMeal}
      />

      {/* Recipe Modal when inspecting a saved meal */}
      {inspectedSavedRecipe && (
        <RecipeModal
          recipe={inspectedSavedRecipe}
          onClose={() => setInspectedSavedRecipe(null)}
          onToggleSave={handleToggleSave}
          onSwap={async () => {}}
          isSaved={true}
          isSwapping={false}
          numberOfPeople={activePlan?.numberOfPeople || 2}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={checkApiKey}
      />
    </div>
  );
}

export default App;
