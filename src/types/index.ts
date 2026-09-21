export type Supermarket = 'E.Leclerc' | 'Auchan' | 'Intermarché';

export type GroceryCategory =
  | 'Boucherie & Poissonnerie'
  | 'Crémerie & Œufs'
  | 'Fruits & Légumes'
  | 'Épicerie & Féculents'
  | 'Condiments & Autres';

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface Recipe {
  id: string;
  mealIndex?: number;
  title: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  proteinGrams: number;
  calories: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  equipmentUsed: string[];
  isSaved?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  brand?: string; // Ex: 'Marque Repère (Ronsard / Rustica)'
  unitDetails?: string; // Ex: 'Barquette 500g'
  category: GroceryCategory;
  checked: boolean;
  estimatedPrice: number;
  isUserPrice?: boolean; // Vrai si le prix a été modifié par l'utilisateur
}

export interface MealPlan {
  id: string;
  createdAt: string;
  numberOfDays: number;
  totalMeals: number;
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  estimatedTotalCost: number;
  recipes: Recipe[];
  shoppingList: ShoppingItem[];
}

export interface SavedMeal {
  id: string;
  title: string;
  proteinGrams: number;
  calories?: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  savedAt: string;
}

export interface AppConfig {
  geminiApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}
