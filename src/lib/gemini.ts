import type { MealPlan, Recipe, SavedMeal, Supermarket } from '../types';

export interface GeneratePlanParams {
  numberOfDays: number;
  totalMeals: number;
  mealsPerDay?: number;
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  savedRecipes?: SavedMeal[];
  apiKey?: string;
}

export interface SwapRecipeParams {
  currentRecipe: Recipe;
  numberOfPeople: number;
  supermarket: Supermarket;
  otherRecipeTitles: string[];
  apiKey?: string;
}

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 160g à 185g de protéines par jour).

Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MASSE MUSCULAIRE) : Chaque repas doit fournir STRICTEMENT entre 45g et 65g de protéines réelles par portion.
   - Utilise des portions généreuses de protéines nobles : blancs de poulet/dinde (200g-250g/portion), bœuf haché 5%, thon au naturel (boîte entière), œufs entiers + blancs d'œufs, skyr 0%, fromage blanc, lentilles/haricots rouges en complément.
2. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : pas de cuisson au four, pas de gratins, pas de tartes ou rôtis).
3. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché). Optimise l'achat d'ingrédients de base partagés entre plusieurs repas pour éviter le gaspillage et respecter le budget.
4. VARIÉTÉ ET GOÛT : Des repas savoureux, assaisonnés avec des épices simples (curry, paprika, ail, herbes de Provence, sauce soja...), rapides et pratiques pour le quotidien.
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
      // Netlify function not responding, fall through to client API key error
    }
    throw new Error("Clé API Gemini manquante. Renseigne ta clé API gratuite dans les paramètres de l'application.");
  }

  const prompt = `Génère exactement ${params.totalMeals} repas protéinés répartis sur ${params.numberOfDays} jours avec les critères suivants :
- Nombre de jours : ${params.numberOfDays} jours
- Nombre TOTAL de repas à cuisiner : ${params.totalMeals} repas (répartis logiquement sur les jours 1 à ${params.numberOfDays}, Déjeuner ou Dîner)
- Nombre de personnes : ${params.numberOfPeople} mangeurs
- Objectif protéines : 45g à 65g de protéines par portion (athlète 84 kg)
- Supermarché : ${params.supermarket}
- Budget total max : ${params.budget} €
${params.savedRecipes && params.savedRecipes.length > 0 ? `- Recettes favorites des utilisateurs (à réutiliser ou favoriser en priorité) : ${params.savedRecipes.map(r => r.title).join(', ')}` : ''}

Réponds avec ce schéma JSON exact (contenant exactement ${params.totalMeals} objets dans "recipes") :
{
  "estimatedTotalCost": nombre (estimation réaliste en euros du caddie total chez ${params.supermarket}),
  "recipes": [
    {
      "id": "r1",
      "dayIndex": 1,
      "mealType": "Déjeuner",
      "title": "Nom de la recette",
      "description": "Brève description alléchante",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 15,
      "proteinGrams": 52,
      "calories": 700,
      "ingredients": [
        { "name": "Escalope de poulet", "amount": "450g (pour 2 pers)" }
      ],
      "instructions": [
        "Couper le poulet en dés...",
        "Faire dorer à la poêle avec un filet d'huile d'olive..."
      ],
      "equipmentUsed": ["Poêle", "Plaques"]
    }
  ],
  "shoppingList": [
    {
      "id": "s1",
      "name": "Blancs de poulet (format familial)",
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
    mealsPerDay: Math.ceil(params.totalMeals / params.numberOfDays),
    numberOfPeople: params.numberOfPeople,
    supermarket: params.supermarket,
    budget: params.budget,
    estimatedTotalCost: parsed.estimatedTotalCost || params.budget,
    recipes: (parsed.recipes || []).map((r: any, idx: number) => ({
      ...r,
      id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
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

export async function swapRecipe(params: SwapRecipeParams): Promise<Recipe> {
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

  const prompt = `Génère UNE SEULE nouvelle recette de remplacement pour un ${params.currentRecipe.mealType}, jour ${params.currentRecipe.dayIndex}.
Critères :
- Nombre de personnes : ${params.numberOfPeople}
- Supermarché : ${params.supermarket}
- Riche en protéines : 45g à 65g de protéines par portion (profil musculation 84 kg).
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de : ${params.currentRecipe.title} et des autres repas déjà prévus : ${params.otherRecipeTitles.join(', ')}.

Réponds avec ce schéma JSON exact pour UNE seule recette :
{
  "title": "Nom du plat",
  "description": "Courte description",
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

  return {
    ...parsed,
    id: 'recipe-swap-' + Date.now(),
    dayIndex: params.currentRecipe.dayIndex,
    mealType: params.currentRecipe.mealType,
    equipmentUsed: parsed.equipmentUsed || ['Poêle', 'Plaques'],
  };
}
