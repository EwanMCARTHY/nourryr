import { useState, useEffect, useCallback } from 'react';
import type { MealPlan, Recipe, SavedMeal, Supermarket } from './types';
import { Header } from './components/Header';
import { GeneratorForm } from './components/GeneratorForm';
import { MealPlanView } from './components/MealPlanView';
import { SavedMealsDrawer } from './components/SavedMealsDrawer';
import { RecipeModal } from './components/RecipeModal';
import { SettingsModal } from './components/SettingsModal';
import { generateMealPlan, swapRecipe } from './lib/gemini';
import {
  fetchCurrentPlan,
  saveCurrentPlan,
  fetchSavedMeals,
  addSavedMeal,
  removeSavedMeal,
} from './lib/storage';
import { AlertCircle } from 'lucide-react';

export function App() {
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [swappingRecipeId, setSwappingRecipeId] = useState<string | null>(null);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectedSavedRecipe, setInspectedSavedRecipe] = useState<Recipe | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check API key presence
  const checkApiKey = useCallback(() => {
    const key = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    setHasApiKey(!!key);
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [plan, favorites] = await Promise.all([
        fetchCurrentPlan(),
        fetchSavedMeals(),
      ]);
      if (plan) setActivePlan(plan);
      if (favorites) setSavedMeals(favorites);
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
    mealsPerDay: number;
    numberOfPeople: number;
    supermarket: Supermarket;
    budget: number;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const apiKey = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
      const plan = await generateMealPlan({
        ...params,
        savedRecipes: savedMeals,
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
        description: recipe.description,
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

  // Swap a single recipe
  const handleSwapRecipe = async (recipe: Recipe) => {
    if (!activePlan) return;
    setSwappingRecipeId(recipe.id);
    setErrorMessage(null);

    try {
      const apiKey = localStorage.getItem('nourryr_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
      const otherTitles = activePlan.recipes
        .filter(r => r.id !== recipe.id)
        .map(r => r.title);

      const newRecipe = await swapRecipe({
        currentRecipe: recipe,
        numberOfPeople: activePlan.numberOfPeople,
        supermarket: activePlan.supermarket,
        otherRecipeTitles: otherTitles,
        apiKey,
      });

      const updatedRecipes = activePlan.recipes.map(r =>
        r.id === recipe.id ? newRecipe : r
      );

      const updatedPlan: MealPlan = {
        ...activePlan,
        recipes: updatedRecipes,
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

  // Reset entire plan
  const handleResetPlan = async () => {
    if (window.confirm('Créer un nouveau programme ? Ton programme actuel sera réinitialisé.')) {
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
      dayIndex: 1,
      mealType: 'Déjeuner',
      title: saved.title,
      description: saved.description || '',
      prepTimeMinutes: saved.prepTimeMinutes,
      cookTimeMinutes: saved.cookTimeMinutes,
      proteinGrams: saved.proteinGrams,
      calories: saved.calories || 600,
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
            onResetShoppingChecks={handleResetShoppingChecks}
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
