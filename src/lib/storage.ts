import type { MealPlan, SavedMeal } from '../types';
import { getSupabaseClient } from './supabase';

const LOCAL_PLAN_KEY = 'nourryr_active_plan';
const LOCAL_FAVORITES_KEY = 'nourryr_saved_favorites';
const LOCAL_PRICES_KEY = 'nourryr_custom_prices';
const LOCAL_EXCLUDED_KEY = 'nourryr_excluded_ingredients';

export async function fetchCurrentPlan(): Promise<MealPlan | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nourryr_plan')
        .select('data')
        .eq('id', 'shared_active_plan')
        .maybeSingle();

      if (!error && data?.data) {
        localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(data.data));
        return data.data as MealPlan;
      }
    } catch (e) {
      console.warn('Supabase fetch plan error, fallback to local', e);
    }
  }

  const local = localStorage.getItem(LOCAL_PLAN_KEY);
  return local ? JSON.parse(local) : null;
}

export async function saveCurrentPlan(plan: MealPlan | null): Promise<void> {
  if (plan) {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
  } else {
    localStorage.removeItem(LOCAL_PLAN_KEY);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      if (plan) {
        await supabase
          .from('nourryr_plan')
          .upsert({ id: 'shared_active_plan', data: plan, updated_at: new Date().toISOString() });
      } else {
        await supabase
          .from('nourryr_plan')
          .delete()
          .eq('id', 'shared_active_plan');
      }
    } catch (e) {
      console.warn('Supabase save plan error', e);
    }
  }
}

export async function fetchSavedMeals(): Promise<SavedMeal[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nourryr_favorites')
        .select('data')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const list = data.map(row => row.data as SavedMeal);
        localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn('Supabase fetch favorites error, fallback to local', e);
    }
  }

  const local = localStorage.getItem(LOCAL_FAVORITES_KEY);
  return local ? JSON.parse(local) : [];
}

export async function addSavedMeal(meal: SavedMeal): Promise<void> {
  const current = await fetchSavedMeals();
  if (current.some(m => m.id === meal.id || m.title.toLowerCase() === meal.title.toLowerCase())) {
    return; // already saved
  }

  const updated = [meal, ...current];
  localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('nourryr_favorites')
        .upsert({ id: meal.id, data: meal, created_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Supabase add favorite error', e);
    }
  }
}

export async function removeSavedMeal(mealId: string): Promise<void> {
  const current = await fetchSavedMeals();
  const updated = current.filter(m => m.id !== mealId);
  localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('nourryr_favorites')
        .delete()
        .eq('id', mealId);
    } catch (e) {
      console.warn('Supabase remove favorite error', e);
    }
  }
}

export async function fetchCustomPrices(): Promise<Record<string, number>> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nourryr_plan')
        .select('data')
        .eq('id', 'shared_custom_prices')
        .maybeSingle();

      if (!error && data?.data) {
        localStorage.setItem(LOCAL_PRICES_KEY, JSON.stringify(data.data));
        return data.data as Record<string, number>;
      }
    } catch (e) {
      console.warn('Supabase fetch custom prices error', e);
    }
  }

  const local = localStorage.getItem(LOCAL_PRICES_KEY);
  return local ? JSON.parse(local) : {};
}

export async function saveCustomPrice(itemName: string, price: number): Promise<void> {
  const current = await fetchCustomPrices();
  const normalizedKey = itemName.toLowerCase().trim();
  const updated = { ...current, [normalizedKey]: price };
  localStorage.setItem(LOCAL_PRICES_KEY, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('nourryr_plan')
        .upsert({ id: 'shared_custom_prices', data: updated, updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Supabase save custom prices error', e);
    }
  }
}

export async function fetchExcludedIngredients(): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nourryr_plan')
        .select('data')
        .eq('id', 'shared_excluded_ingredients')
        .maybeSingle();

      if (!error && Array.isArray(data?.data)) {
        localStorage.setItem(LOCAL_EXCLUDED_KEY, JSON.stringify(data.data));
        return data.data as string[];
      }
    } catch (e) {
      console.warn('Supabase fetch excluded ingredients error', e);
    }
  }

  const local = localStorage.getItem(LOCAL_EXCLUDED_KEY);
  return local ? JSON.parse(local) : [];
}

export async function addExcludedIngredient(ingredient: string): Promise<string[]> {
  const current = await fetchExcludedIngredients();
  const trimmed = ingredient.trim();
  const normalized = trimmed.toLowerCase();
  if (current.some(i => i.toLowerCase() === normalized)) return current;
  const updated = [...current, trimmed];
  localStorage.setItem(LOCAL_EXCLUDED_KEY, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('nourryr_plan')
        .upsert({ id: 'shared_excluded_ingredients', data: updated, updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Supabase save excluded ingredients error', e);
    }
  }
  return updated;
}

export async function removeExcludedIngredient(ingredient: string): Promise<string[]> {
  const current = await fetchExcludedIngredients();
  const normalized = ingredient.trim().toLowerCase();
  const updated = current.filter(i => i.toLowerCase() !== normalized);
  localStorage.setItem(LOCAL_EXCLUDED_KEY, JSON.stringify(updated));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('nourryr_plan')
        .upsert({ id: 'shared_excluded_ingredients', data: updated, updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Supabase remove excluded ingredient error', e);
    }
  }
  return updated;
}

