import type { MealPlan, Recipe, SavedMeal, ShoppingItem, Supermarket } from '../types';

export interface GeneratePlanParams {
  numberOfDays: number;
  totalMeals: number;
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  savedRecipes?: SavedMeal[];
  customPrices?: Record<string, number>;
  apiKey?: string;
}

export interface SwapRecipeParams {
  currentRecipe: Recipe;
  allRecipes: Recipe[];
  currentShoppingList: ShoppingItem[];
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  customPrices?: Record<string, number>;
  apiKey?: string;
}

export interface SwapRecipeResult {
  newRecipe: Recipe;
  updatedShoppingList: ShoppingItem[];
  estimatedTotalCost: number;
}

const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 160g à 185g de protéines par jour).

Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MASSE MUSCULAIRE) : Chaque repas doit fournir STRICTEMENT entre 45g et 65g de protéines réelles par portion (portions généreuses de volaille 200-250g, bœuf haché 5%, thon, œufs, skyr, etc.).
2. SATIÉTÉ MAXIMALE & ZÉRO SURPLUS CALORIQUE (VOLUME EATING) :
   - Calories maîtrisées : STRICTEMENT entre 600 et 750 kcal par portion (aucun repas au-dessus de 750 kcal pour éliminer tout risque de surplus calorique ou de prise de gras).
   - Grand volume alimentaire : chaque repas doit impérativement comporter une part abondante de légumes riches en fibres et en eau (200g à 300g par personne : brocolis, courgettes, haricots verts, épinards, poivrons, carottes, champignons, concassé de tomates...).
   - Féculents à fort indice de satiété : pommes de terre (aliment n°1 de la satiété), riz basmati/complet, lentilles, pois chiches, pâtes complètes, flocons d'avoine.
   - Limitation stricte des graisses cachées : 1 c. à café d'huile max par portion pour la cuisson. Lier les sauces avec du skyr, fromage blanc 0% ou coulis de tomate sans sucre. Assaisonner avec épices, herbes, ail, oignon, citron.
3. ÉQUIPEMENT DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : aucun gratin, quiche, rôti ou plat au four).
4. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché).
5. LISTE DE COURSES GRANULAIRE ET ULTRA DÉTAILLÉE :
   - Évite les regroupements vagues : détaille élément par élément pour qu'on sache exactement quoi prendre en rayon.
   - Mentionne la marque typique du magasin (ex: Marque Repère/Eco+ chez E.Leclerc, Monique Ranou/Pâturages chez Intermarché, Marque Auchan/Pouce chez Auchan).
   - Prrecise le conditionnement précis (ex: "Barquette 4x100g", "Bocal 400g", "Paquet 1kg", "Boîte de 10 œufs").
   - Donne un prix unitaire réaliste en euros pour ce produit précis.
6. SOBRIÉTÉ : Pas de description verbeuse de repas, pas de mention Déjeuner/Dîner. Va droit à l'essentiel : titre clair, ingrédients, étapes courtes.
7. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

async function callGeminiWithFallback(apiKey: string, prompt: string, systemInstruction: string, temperature = 0.7): Promise<any> {
  let lastError = '';

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return JSON.parse(rawText);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Status ${response.status}`;
        lastError = errMsg;
        if (response.status === 503 || response.status === 429 || response.status === 404) {
          continue;
        }
        throw new Error(errMsg);
      }
    } catch (e: any) {
      lastError = e.message || 'Erreur réseau';
    }
  }

  throw new Error(`Tous les modèles sont actuellement occupés : ${lastError}`);
}

export async function generateMealPlan(params: GeneratePlanParams): Promise<MealPlan> {
  const apiKey = params.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

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
      // Fall through
    }
    throw new Error("Clé API Gemini manquante. Renseigne ta clé API dans les paramètres ⚙️.");
  }

  const prompt = `Génère exactement ${params.totalMeals} repas protéinés distincts pour ${params.numberOfPeople} personnes sur ${params.numberOfDays} jours.
Supermarché : ${params.supermarket}
Budget total max : ${params.budget} €
Objectifs nutritionnels & Satiété :
- 45g à 65g de protéines réelles par portion (athlète 84 kg).
- Satiété maximale & zéro surplus calorique : chaque repas doit apporter STRICTEMENT entre 600 et 750 kcal par portion (jamais au-dessus de 750 kcal pour éliminer tout risque de surplus).
- Volume alimentaire élevé : chaque plat DOIT intégrer une généreuse portion de légumes rassasiants riches en fibres et eau (200g-300g par personne : brocolis, courgettes, haricots, champignons, épinards, sauce tomate nature...) et des féculents à fort pouvoir de satiété (pommes de terre, riz complet/basmati, lentilles...).
- Matières grasses de cuisson strictement limitées (1 c. à café d'huile par personne), sans crème grasse (lier au skyr ou coulis de tomate).
Pas de four (uniquement poêle, plaques, casserole, micro-ondes).
Pas de texte de description pour les repas.
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map(r => r.title).join(', ')}` : ''}
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS ET VÉRIFIÉS EN MAGASIN PAR L'UTILISATEUR (utilise ces prix en priorité) :\n${JSON.stringify(params.customPrices, null, 2)}` : ''}

Exigences liste de courses :
Détaille article par article sans regrouper de manière vague. Précise le nom, la marque de distributeur (${params.supermarket}), le format/packaging exact et le prix unitaire réaliste.

Réponds avec ce schéma JSON exact :
{
  "estimatedTotalCost": nombre,
  "recipes": [
    {
      "id": "r1",
      "mealIndex": 1,
      "title": "Nom précis du plat",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 15,
      "proteinGrams": 52,
      "calories": 680,
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
      "name": "Filets de dinde",
      "quantity": "2 barquettes de 500g",
      "brand": "Marque Repère (Ronsard)",
      "unitDetails": "Barquette 500g",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 7.40
    }
  ]
}

Les catégories autorisées pour la shoppingList sont STRICTEMENT :
"Boucherie & Poissonnerie", "Crémerie & Œufs", "Fruits & Légumes", "Épicerie & Féculents", "Condiments & Autres".`;

  const parsed = await callGeminiWithFallback(apiKey, prompt, SYSTEM_INSTRUCTION, 0.7);

  // Apply custom prices if user previously taught us a real in-store price
  const customMap = params.customPrices || {};

  const shoppingList: ShoppingItem[] = (parsed.shoppingList || []).map((s: any, idx: number) => {
    const normName = s.name?.toLowerCase()?.trim() || '';
    let finalPrice = Number(s.estimatedPrice) || 3.0;
    let isUserPrice = false;

    for (const [knownName, knownPrice] of Object.entries(customMap)) {
      if (normName.includes(knownName) || knownName.includes(normName)) {
        finalPrice = knownPrice;
        isUserPrice = true;
        break;
      }
    }

    return {
      id: s.id || 'shop-' + (idx + 1) + '-' + Date.now(),
      name: s.name,
      quantity: s.quantity,
      brand: s.brand,
      unitDetails: s.unitDetails,
      category: s.category || 'Épicerie & Féculents',
      checked: false,
      estimatedPrice: Number(finalPrice.toFixed(2)),
      isUserPrice,
    };
  });

  const totalCost = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  const mealPlan: MealPlan = {
    id: 'plan-' + Date.now(),
    createdAt: new Date().toISOString(),
    numberOfDays: params.numberOfDays,
    totalMeals: params.totalMeals,
    numberOfPeople: params.numberOfPeople,
    supermarket: params.supermarket,
    budget: params.budget,
    estimatedTotalCost: Number(totalCost.toFixed(2)) || parsed.estimatedTotalCost || params.budget,
    recipes: (parsed.recipes || []).map((r: any, idx: number) => ({
      ...r,
      id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
      mealIndex: idx + 1,
      equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
    })),
    shoppingList,
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
- Satiété maximale & zéro surplus calorique : calibrer STRICTEMENT entre 600 et 750 kcal par portion (jamais au-dessus de 750 kcal). Intégrer une belle portion de légumes rassasiants riches en fibres et eau (200g-300g) et féculents à haute satiété (pommes de terre, riz complet, lentilles...), sans excès de matières grasses.
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de "${params.currentRecipe.title}" et différente des autres plats déjà prévus : ${otherTitles.join(', ')}.

ADAPTATION DE LA LISTE DE COURSES GRANULAIRE :
- Ajuste la liste de courses article par article pour intégrer les ingrédients du nouveau plat et enlever les ingrédients qui ne servaient qu'à l'ancienne recette "${params.currentRecipe.title}".
- Détaille article par article avec marque distributeur (${params.supermarket}), conditionnement et prix unitaire réaliste.
- Essaie en priorité de réutiliser des ingrédients déjà achetés dans le reste du panier pour respecter le budget max de ${params.budget} €.
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(params.customPrices)}` : ''}

Réponds avec ce schéma JSON exact :
{
  "newRecipe": {
    "title": "Nom du plat",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 15,
    "proteinGrams": 52,
    "calories": 680,
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
      "name": "Nom ingrédient précis",
      "quantity": "Quantité globale",
      "brand": "Marque",
      "unitDetails": "Format packaging",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 7.50
    }
  ],
  "estimatedTotalCost": nombre
}`;

  const parsed = await callGeminiWithFallback(apiKey, prompt, SYSTEM_INSTRUCTION, 0.8);

  const customMap = params.customPrices || {};
  const checkedMap = new Map<string, boolean>();
  params.currentShoppingList.forEach(item => {
    checkedMap.set(item.name.toLowerCase().trim(), item.checked);
  });

  const updatedShoppingList: ShoppingItem[] = (parsed.updatedShoppingList || []).map((s: any, idx: number) => {
    const normName = s.name?.toLowerCase()?.trim() || '';
    let finalPrice = Number(s.estimatedPrice) || 3.0;
    let isUserPrice = false;

    for (const [knownName, knownPrice] of Object.entries(customMap)) {
      if (normName.includes(knownName) || knownName.includes(normName)) {
        finalPrice = knownPrice;
        isUserPrice = true;
        break;
      }
    }

    const isChecked = checkedMap.get(normName) || false;
    return {
      id: 'shop-' + (idx + 1) + '-' + Date.now(),
      name: s.name,
      quantity: s.quantity,
      brand: s.brand,
      unitDetails: s.unitDetails,
      category: s.category || 'Épicerie & Féculents',
      checked: isChecked,
      estimatedPrice: Number(finalPrice.toFixed(2)),
      isUserPrice,
    };
  });

  const totalCost = updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  const newRecipe: Recipe = {
    ...parsed.newRecipe,
    id: 'recipe-swap-' + Date.now(),
    mealIndex: params.currentRecipe.mealIndex,
    equipmentUsed: parsed.newRecipe.equipmentUsed || ['Poêle', 'Plaques'],
  };

  return {
    newRecipe,
    updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : params.currentShoppingList,
    estimatedTotalCost: Number(totalCost.toFixed(2)) || parsed.estimatedTotalCost || params.budget,
  };
}
