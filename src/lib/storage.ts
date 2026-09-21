import type { MealPlan, SavedMeal } from '../types';
import { getSupabaseClient } from './supabase';

const LOCAL_PLAN_KEY = 'nourryr_active_plan';
const LOCAL_FAVORITES_KEY = 'nourryr_saved_favorites';

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
