import type { MealPlan, Recipe, SavedMeal, ShoppingItem, Supermarket } from '../types';

export interface GeneratePlanParams {
  numberOfDays: number;
  totalMeals: number;
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  savedRecipes?: SavedMeal[];
  apiKey?: string;
}

export interface SwapRecipeParams {
  currentRecipe: Recipe;
  allRecipes: Recipe[];
  currentShoppingList: ShoppingItem[];
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  apiKey?: string;
}

export interface SwapRecipeResult {
  newRecipe: Recipe;
  updatedShoppingList: ShoppingItem[];
  estimatedTotalCost: number;
}

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 160g à 185g de protéines par jour).

Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MASSE MUSCULAIRE) : Chaque repas doit fournir STRICTEMENT entre 45g et 65g de protéines réelles par portion (portions généreuses de volaille 200-250g, bœuf haché 5%, thon, œufs, skyr, etc.).
2. ÉQUIPEMENT DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : aucun gratin, quiche, rôti ou plat au four).
3. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché). Optimise l'achat d'ingrédients de base partagés entre plusieurs repas pour éviter le gaspillage.
4. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse de recette, pas de mention Déjeuner/Dîner. Va droit à l'essentiel : titre clair, ingrédients, étapes courtes.
5. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

export async function generateMealPlan(params: GeneratePlanParams): Promise<MealPlan> {
  const apiKey = params.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  // Check if Netlify function is available, else fallback to direct Gemini API
  if (!apiKey) {
    try {
      const res = await fetch('/.netlify/functions/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fall through to direct API error
    }
    throw new Error("Clé API Gemini manquante. Renseigne ta clé API dans les paramètres ⚙️.");
  }

  const prompt = `Génère exactement ${params.totalMeals} repas protéinés distincts pour ${params.numberOfPeople} personnes sur ${params.numberOfDays} jours.
Supermarché : ${params.supermarket}
Budget total max : ${params.budget} €
Objectif : 45g à 65g de protéines par portion.
Pas de four (uniquement poêle, plaques, casserole, micro-ondes).
Pas de texte de description pour les repas.
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map(r => r.title).join(', ')}` : ''}

Réponds avec ce schéma JSON exact :
{
  "estimatedTotalCost": nombre (estimation en euros chez ${params.supermarket}),
  "recipes": [
    {
      "id": "r1",
      "mealIndex": 1,
      "title": "Nom précis du plat",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 15,
      "proteinGrams": 52,
      "calories": 700,
      "ingredients": [
        { "name": "Escalope de dinde", "amount": "450g" }
      ],
      "instructions": [
        "Étape 1...",
        "Étape 2..."
      ],
      "equipmentUsed": ["Poêle", "Plaques"]
    }
  ],
  "shoppingList": [
    {
      "id": "s1",
      "name": "Blancs de dinde (format familial)",
      "quantity": "1.2 kg",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 14.50
    }
  ]
}

Les catégories autorisées pour la shoppingList sont STRICTEMENT :
"Boucherie & Poissonnerie", "Crémerie & Œufs", "Fruits & Légumes", "Épicerie & Féculents", "Condiments & Autres".`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Erreur API Gemini (${response.status})`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Réponse vide de l'IA. Réessaie avec des paramètres légèrement différents.");
  }

  const parsed = JSON.parse(rawText);

  const mealPlan: MealPlan = {
    id: 'plan-' + Date.now(),
    createdAt: new Date().toISOString(),
    numberOfDays: params.numberOfDays,
    totalMeals: params.totalMeals,
    numberOfPeople: params.numberOfPeople,
    supermarket: params.supermarket,
    budget: params.budget,
    estimatedTotalCost: parsed.estimatedTotalCost || params.budget,
    recipes: (parsed.recipes || []).map((r: any, idx: number) => ({
      ...r,
      id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
      mealIndex: idx + 1,
      equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
    })),
    shoppingList: (parsed.shoppingList || []).map((s: any, idx: number) => ({
      ...s,
      id: s.id || 'shop-' + (idx + 1) + '-' + Date.now(),
      checked: false,
    })),
  };

  return mealPlan;
}

export async function swapRecipe(params: SwapRecipeParams): Promise<SwapRecipeResult> {
  const apiKey = params.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    try {
      const res = await fetch('/.netlify/functions/swap-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fall through
    }
    throw new Error("Clé API Gemini requise pour régénérer la recette.");
  }

  const otherTitles = params.allRecipes
    .filter(r => r.id !== params.currentRecipe.id)
    .map(r => r.title);

  const prompt = `L'utilisateur souhaite remplacer le repas "${params.currentRecipe.title}" (Repas n°${params.currentRecipe.mealIndex || 1}).
Critères du nouveau plat :
- Nombre de personnes : ${params.numberOfPeople}
- Supermarché : ${params.supermarket}
- Riche en protéines : 45g à 65g de protéines par portion (musculation 84 kg).
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de "${params.currentRecipe.title}" et différente des autres plats déjà prévus : ${otherTitles.join(', ')}.

ADAPTATION DE LA LISTE DE COURSES :
- Ajuste la liste de courses globale pour intégrer les ingrédients du nouveau plat et enlever les ingrédients qui ne servaient qu'à l'ancienne recette "${params.currentRecipe.title}".
- Essaie en priorité de réutiliser des ingrédients déjà achetés dans le reste du panier pour respecter le budget max de ${params.budget} €.

Réponds avec ce schéma JSON exact :
{
  "newRecipe": {
    "title": "Nom du plat",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 15,
    "proteinGrams": 52,
    "calories": 700,
    "ingredients": [
      { "name": "Ingrédient", "amount": "Quantité" }
    ],
    "instructions": [
      "Étape 1...",
      "Étape 2..."
    ],
    "equipmentUsed": ["Poêle", "Plaques"]
  },
  "updatedShoppingList": [
    {
      "name": "Nom ingrédient",
      "quantity": "Quantité globale",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 12.00
    }
  ],
  "estimatedTotalCost": nombre
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Erreur lors du remplacement (${response.status})`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rawText);

  // Preserve checked state from current shopping list if items still match
  const checkedMap = new Map<string, boolean>();
  params.currentShoppingList.forEach(item => {
    checkedMap.set(item.name.toLowerCase().trim(), item.checked);
  });

  const updatedShoppingList: ShoppingItem[] = (parsed.updatedShoppingList || []).map((s: any, idx: number) => {
    const isChecked = checkedMap.get(s.name?.toLowerCase()?.trim()) || false;
    return {
      id: 'shop-' + (idx + 1) + '-' + Date.now(),
      name: s.name,
      quantity: s.quantity,
      category: s.category || 'Épicerie & Féculents',
      checked: isChecked,
      estimatedPrice: s.estimatedPrice,
    };
  });

  const newRecipe: Recipe = {
    ...parsed.newRecipe,
    id: 'recipe-swap-' + Date.now(),
    mealIndex: params.currentRecipe.mealIndex,
    equipmentUsed: parsed.newRecipe.equipmentUsed || ['Poêle', 'Plaques'],
  };

  return {
    newRecipe,
    updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : params.currentShoppingList,
    estimatedTotalCost: parsed.estimatedTotalCost || params.budget,
  };
}
