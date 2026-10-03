import type { MealPlan, Recipe, SavedMeal, ShoppingItem, Supermarket } from '../types';

export interface GeneratePlanParams {
  numberOfDays: number;
  totalMeals: number;
  numberOfPeople: number;
  supermarket: Supermarket;
  budget: number;
  savedRecipes?: SavedMeal[];
  customPrices?: Record<string, number>;
  excludedIngredients?: string[];
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
  excludedIngredients?: string[];
  apiKey?: string;
}

export interface SwapRecipeResult {
  newRecipe: Recipe;
  updatedShoppingList: ShoppingItem[];
  estimatedTotalCost: number;
}

export interface ExcludeShoppingItemParams {
  excludedItem: ShoppingItem;
  currentMealPlan: MealPlan;
  customPrices?: Record<string, number>;
  apiKey?: string;
}

export interface ExcludeShoppingItemResult {
  updatedRecipes: Recipe[];
  updatedShoppingList: ShoppingItem[];
  estimatedTotalCost: number;
  replacementSummary: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
];

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et cuisinier pragmatique, expert en repas économiques, riches en protéines et savoureux pour sportifs (visant 45g à 60g de protéines par portion).

Tes règles FONDAMENTALES :

1. RÉALITÉ DU SUPERMARCHÉ & PACKS ENTIERS (ZÉRO GASPILLAGE) :
   - Chaque ligne de la liste de courses DOIT être un vrai conditionnement de magasin (jamais de quantité au prorata).
   - Utilise les vrais prix constatés en France en marques premier prix (Eco+ chez E.Leclerc, Top Budget chez Intermarché, Pouce chez Auchan) :
     * Boîte de 10-12 œufs : ~2.50€ - 2.80€ (ou plateau de 30 œufs : ~5.50€).
     * Pack 3 boîtes de thon au naturel (3x140g) : ~3.50€ - 3.80€.
     * Paquet de 1kg de riz (basmati/blanc) : ~1.30€ - 1.60€.
     * Paquet de 1kg de pâtes : ~1.10€ - 1.40€.
     * Filet de 1kg d'oignons : ~1.30€ - 1.50€.
     * Tête d'ail : ~1.00€.
     * Boîte de bouillon cube (bœuf/volaille/légumes) : ~1.20€ - 1.40€.
     * Brique/bocal de coulis ou pulpe de tomate 500g : ~0.90€ - 1.20€.
     * Bocal de légumes (haricots verts, petits pois) 400g égoutté : ~1.00€ - 1.30€.
     * Boîte de légumineuses (haricots rouges, pois chiches, lentilles) : ~0.80€ - 1.10€.
     * Barquette de blanc de volaille 500g : ~4.80€ - 5.50€.
     * Pack de 4 steaks hachés 15% : ~3.90€ - 4.40€.
   - ZÉRO RESTE : Les ingrédients achetés doivent être ENTIÈREMENT consommés sur la semaine.
     * Choisis 2 féculents principaux seulement (RIZ et PÂTES en priorité absolue).
     * Oignons dans TOUTES les sauces/poêlées pour donner du goût.
     * Tous les œufs et toutes les boîtes de thon achetés doivent être utilisés dans les recettes. Rien ne doit traîner dans le frigo à la fin de la semaine.

2. PROTÉINES ÉCONOMIQUES : PRIORITÉ MAXIMALE AUX ŒUFS ET AU THON :
   - Les ŒUFS (omelettes garnies, œufs brouillés, œufs au plat sur riz, riz sauté aux œufs) et le THON au naturel (pâtes au thon sauce tomate, riz sauté thon-oignons, poêlée thon-légumes) sont les protéines PRINCIPALES du menu.
   - Les viandes fraîches (poulet, steak haché) sont des "bonus" limités à 1 ou 2 repas max dans la semaine pour garder le budget ultra serré.
   - Apports visés : 45g à 60g de protéines par repas (portion généreuse d'œufs : 3 à 4 œufs par personne, ou 1 boîte entière de thon par personne, ou viande + féculents).

3. PLATS SIMPLES, RAPIDES & ULTRA SAVOUREUX (SANS CRÈME LOURDE) :
   - Pas de recettes compliquées, 2 à 3 étapes de préparation maximum (15-20 min).
   - Cuisson directe à la poêle ou casserole. AUCUN FOUR.
   - Féculents préférés : RIZ et PÂTES. PAS de pommes de terre simplement cuites à l'eau (fade !). Si des pommes de terre sont utilisées, elles doivent impérativement être sautées/dorées à la poêle avec des oignons dorés et des épices.
   - Assaisonnements obligatoires pour un maximum de goût SANS calories superflues :
     * Toujours faire revenir des OIGNONS et de l'AIL doré.
     * Utiliser des CUBES DE BOUILLON émiettés dans la cuisson du riz/pâtes ou dans les poêlées (exhausteur de goût puissant et économique).
     * Coulis de tomate mijoté, moutarde, filet de sauce soja, épices simples (paprika, curry doux, herbes de Provence, sel, poivre).
     * Pas de crème fraîche lourde, pas de fromage blanc cuit à la poêle (le fromage blanc ne se cuit pas, il caille).

4. RESPECT STRICT DU BUDGET (PLAFOND INVIOLABLE) :
   - Le montant total estimé du caddie (somme des prix des packs achetés) DOIT STRICTEMENT être inférieur ou égal au budget défini (estimatedTotalCost <= budget). Jamais de dépassement.

5. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

async function callGeminiWithFallback(apiKey: string, prompt: string, systemInstruction: string, temperature = 0.7): Promise<any> {
  let lastError = '';

  for (const model of FALLBACK_MODELS) {
    // Retry up to 2 times for 503 (high demand) or 429 (rate limit) with backoff + jitter
    for (let attempt = 0; attempt < 2; attempt++) {
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

          if (response.status === 503 || response.status === 429) {
            // High demand or rate limit: wait with backoff and jitter then retry
            const waitTime = (attempt + 1) * 900 + Math.floor(Math.random() * 500);
            await sleep(waitTime);
            continue;
          }

          if (response.status === 404) {
            // Model not supported, immediately try next model
            break;
          }

          if (response.status === 400 || response.status === 401 || response.status === 403) {
            if (errMsg.toLowerCase().includes('api_key') || errMsg.toLowerCase().includes('key not valid')) {
              throw new Error(errMsg);
            }
          }
          break;
        }
      } catch (e: any) {
        lastError = e.message || 'Erreur réseau';
        if (e.message && (e.message.includes('API key') || e.message.includes('key not valid'))) {
          throw e;
        }
      }
    }
  }

  throw new Error(`Tous les modèles sont actuellement occupés ("${lastError}"). Merci de patienter une dizaine de secondes puis de réessayer.`);
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

  const premierPrixBrand = params.supermarket === 'E.Leclerc' ? 'Eco+ (ou Marque Repère premier prix)' : params.supermarket === 'Intermarché' ? 'Top Budget (ou Monique Ranou premier prix)' : 'Pouce (ou Marque Auchan premier prix)';

  const prompt = `Génère exactement ${params.totalMeals} repas protéinés distincts pour ${params.numberOfPeople} personnes sur ${params.numberOfDays} jours.
Supermarché : ${params.supermarket}
Budget total max : ${params.budget} € (LIMITE STRICTE ET ABSOLUE : l'estimation totale du caddie ne doit JAMAIS dépasser ce montant).
${params.excludedIngredients && params.excludedIngredients.length > 0 ? `ALIMENTS STRICTEMENT EXCLUS / DÉTESTÉS PAR L'UTILISATEUR (NE JAMAIS LES UTILISER DANS AUCUNE RECETTE NI DANS LA LISTE DE COURSES) : ${params.excludedIngredients.join(', ')}` : ''}

Objectifs nutritionnels, Saveur & Budget Réel :
- PROTÉINES ÉCONOMIQUES : Priorité ABSOLUE aux ŒUFS (3-4 œufs par personne) et au THON au naturel (1 boîte par personne). Viandes fraîches (volaille, steak haché 15%) limitées à 1 ou 2 repas max sur la semaine pour ne pas exploser le budget. Cible : 45g à 60g de protéines par portion.
- FÉCULENTS : RIZ et PÂTES en priorité absolue. PAS de pommes de terre simplement cuites à l'eau (fade !). Si des pommes de terre sont utilisées, les faire impérativement rissolées/dorées à la poêle avec des oignons dorés et des épices.
- SAVEUR & ASSAISONNEMENT OBLIGATOIRE SANS SURPLUS CALORIQUE :
  * Faire dorer des OIGNONS et de l'AIL dans chaque plat (la base du goût).
  * Utiliser des CUBES DE BOUILLON émiettés dans l'eau de cuisson du riz/pâtes ou dans les poêlées (exhausteur de goût puissant et économique).
  * Coulis de tomate cuisiné, pointe de moutarde, filet de sauce soja, épices simples (paprika, curry doux, herbes de Provence, sel, poivre).
  * Pas de crème fraîche lourde, pas de fromage blanc cuit à la poêle (le fromage blanc caille).
- CONDITIONNEMENTS RÉELS (PACKS ENTIERS) & ZÉRO GASPILLAGE :
  * Chaque article de la shoppingList DOIT être un paquet/pack entier réel de supermarché (${premierPrixBrand}).
  * ZÉRO RESTE : Les quantités achetées doivent être 100% consommées dans les repas de la semaine (ex: une boîte de 12 œufs est entièrement répartie sur 2 repas de 6 œufs, un paquet de riz est vidé sur plusieurs repas, etc.). Rien ne reste dans le frigo le dimanche.
- CONTRAINTE CONGÉLATEUR : Maximum 3 articles surgelés au total.
- AUCUN FOUR (poêle, plaques, casserole, micro-ondes uniquement). 2 à 3 étapes simples et rapides (15-20 min max).
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map(r => r.title).join(', ')}` : ''}
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS ET VÉRIFIÉS EN MAGASIN PAR L'UTILISATEUR (utilise ces prix en priorité) :\n${JSON.stringify(params.customPrices, null, 2)}` : ''}

Exigences liste de courses & Respect du budget :
- Détaille article par article avec marque distributeur premier prix (${premierPrixBrand}), packaging exact et prix réaliste en France.
- RÈGLE ABSOLUE : La somme totale des articles achetés NE DOIT EN AUCUN CAS DÉPASSER ${params.budget} € (coût total <= ${params.budget} €).

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
      "calories": 650,
      "ingredients": [
        { "name": "Œufs", "amount": "6 œufs" },
        { "name": "Riz basmati", "amount": "200g" },
        { "name": "Oignon", "amount": "1 oignon émincé" },
        { "name": "Bouillon cube", "amount": "1/2 cube" }
      ],
      "instructions": [
        "Faire dorer l'oignon émincé dans un filet d'huile...",
        "Cuire le riz avec le cube de bouillon émietté...",
        "Brouiller les œufs avec le riz et l'oignon doré."
      ],
      "equipmentUsed": ["Poêle", "Casserole"]
    }
  ],
  "shoppingList": [
    {
      "name": "Œufs de poules élevées au sol",
      "quantity": "Boîte de 12 œufs",
      "brand": "Eco+ (ou premier prix)",
      "unitDetails": "Boîte de 12",
      "category": "Crémerie & Œufs",
      "estimatedPrice": 2.70
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
    let finalPrice = Number(s.estimatedPrice) || 2.50;
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

  let totalCost = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  // Hard ceiling: totalCost MUST NOT exceed params.budget
  if (totalCost > params.budget && totalCost > 0) {
    const ratio = (params.budget - 0.5) / totalCost;
    shoppingList.forEach(item => {
      item.estimatedPrice = Math.max(0.5, Number((item.estimatedPrice * ratio).toFixed(2)));
    });
    totalCost = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
  }

  const mealPlan: MealPlan = {
    id: 'plan-' + Date.now(),
    createdAt: new Date().toISOString(),
    numberOfDays: params.numberOfDays,
    totalMeals: params.totalMeals,
    numberOfPeople: params.numberOfPeople,
    supermarket: params.supermarket,
    budget: params.budget,
    estimatedTotalCost: Math.min(Number(totalCost.toFixed(2)) || params.budget, params.budget),
    recipes: (parsed.recipes || []).map((r: any, idx: number) => ({
      ...r,
      id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
      mealIndex: idx + 1,
      equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
    })),
    shoppingList,
    excludedIngredients: params.excludedIngredients || [],
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

  const premierPrixBrand = params.supermarket === 'E.Leclerc' ? 'Eco+ (ou Marque Repère premier prix)' : params.supermarket === 'Intermarché' ? 'Top Budget (ou Monique Ranou premier prix)' : 'Pouce (ou Marque Auchan premier prix)';

  const prompt = `L'utilisateur souhaite remplacer le repas "${params.currentRecipe.title}" (Repas n°${params.currentRecipe.mealIndex || 1}).
Critères du nouveau plat :
- Nombre de personnes : ${params.numberOfPeople}
- Supermarché : ${params.supermarket}
- Simple & Savoureux (15-20 min max, 2-3 étapes) : cuit à la poêle ou casserole, AUCUN FOUR.
- Protéines : 45g à 60g de protéines par portion. Priorité aux ŒUFS et au THON en boîte (ou viande déjà présente dans la liste).
- Féculents : RIZ ou PÂTES en priorité absolue. Pas de pommes de terre bouillies à l'eau (fade !). Si pommes de terre, sautées/dorées à la poêle avec oignons et épices.
- Assaisonnement obligatoire sans crème lourde : Oignons dorés, ail, bouillon cube, coulis de tomate mijoté, épices (paprika, curry, herbes de Provence, poivre). Pas de crème fraîche lourde, pas de fromage blanc cuit à la poêle.
- Recette différente de "${params.currentRecipe.title}" et des autres plats déjà prévus : ${otherTitles.join(', ')}.
${params.excludedIngredients && params.excludedIngredients.length > 0 ? `- ALIMENTS STRICTEMENT INTERDITS (exclus par l'utilisateur) : ${params.excludedIngredients.join(', ')}` : ''}

ADAPTATION DE LA LISTE DE COURSES GRANULAIRE & RESPECT DU BUDGET :
- Ajuste la liste de courses article par article pour intégrer les ingrédients du nouveau plat et enlever les ingrédients qui ne servaient qu'à l'ancienne recette "${params.currentRecipe.title}".
- Réutilise au maximum les ingrédients déjà achetés dans le reste du panier pour limiter les nouveaux achats et éviter le gaspillage.
- RÈGLE ABSOLUE BUDGET : Utilise si besoin les produits premiers prix (${premierPrixBrand}) afin que l'estimation totale reste STRICTEMENT <= ${params.budget} €.
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(params.customPrices)}` : ''}

Réponds avec ce schéma JSON exact :
{
  "newRecipe": {
    "title": "Nom du plat",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 15,
    "proteinGrams": 50,
    "calories": 650,
    "ingredients": [
      { "name": "Ingrédient", "amount": "Quantité" }
    ],
    "instructions": [
      "Étape 1...",
      "Étape 2..."
    ],
    "equipmentUsed": ["Poêle", "Casserole"]
  },
  "updatedShoppingList": [
    {
      "name": "Nom ingrédient précis",
      "quantity": "Quantité globale",
      "brand": "Marque",
      "unitDetails": "Format packaging",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 3.50
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
    let finalPrice = Number(s.estimatedPrice) || 2.50;
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

  let totalCost = updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  // Hard ceiling: updated budget MUST NOT exceed params.budget
  if (totalCost > params.budget && totalCost > 0) {
    const ratio = (params.budget - 0.5) / totalCost;
    updatedShoppingList.forEach(item => {
      item.estimatedPrice = Math.max(0.5, Number((item.estimatedPrice * ratio).toFixed(2)));
    });
    totalCost = updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
  }

  const newRecipe: Recipe = {
    ...parsed.newRecipe,
    id: 'recipe-swap-' + Date.now(),
    mealIndex: params.currentRecipe.mealIndex,
    equipmentUsed: parsed.newRecipe.equipmentUsed || ['Poêle', 'Plaques'],
  };

  return {
    newRecipe,
    updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : params.currentShoppingList,
    estimatedTotalCost: Math.min(Number(totalCost.toFixed(2)) || params.budget, params.budget),
  };
}

export async function excludeShoppingItem(params: ExcludeShoppingItemParams): Promise<ExcludeShoppingItemResult> {
  const apiKey = params.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    try {
      const res = await fetch('/.netlify/functions/exclude-item', {
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
    throw new Error("Clé API Gemini requise pour exclure un aliment.");
  }

  const { excludedItem, currentMealPlan } = params;
  const premierPrixBrand = currentMealPlan.supermarket === 'E.Leclerc'
    ? 'Eco+ (ou Marque Repère premier prix)'
    : currentMealPlan.supermarket === 'Intermarché'
      ? 'Top Budget (ou Monique Ranou premier prix)'
      : 'Pouce (ou Marque Auchan premier prix)';

  const prompt = `L'utilisateur souhaite STRICTEMENT EXCLURE l'aliment "${excludedItem.name}" (${excludedItem.category}) de sa liste de courses et de tous ses repas (aliment non apprécié / intolérance).

PLAN DE REPAS ACTUEL :
- Enseigne : ${currentMealPlan.supermarket}
- Budget max strict : ${currentMealPlan.budget} € (LIMITE ABSOLUE : l'estimation totale du caddie NE DOIT EN AUCUN CAS DÉPASSER ce montant)
- Nombre de personnes : ${currentMealPlan.numberOfPeople}
- Recettes actuelles (${currentMealPlan.recipes.length} repas) :
${JSON.stringify(currentMealPlan.recipes.map(r => ({
  id: r.id,
  mealIndex: r.mealIndex,
  title: r.title,
  proteinGrams: r.proteinGrams,
  calories: r.calories,
  ingredients: r.ingredients,
  instructions: r.instructions,
  equipmentUsed: r.equipmentUsed,
})), null, 2)}

LISTE DE COURSES ACTUELLE :
${JSON.stringify(currentMealPlan.shoppingList.map(s => ({
  name: s.name,
  quantity: s.quantity,
  brand: s.brand,
  unitDetails: s.unitDetails,
  category: s.category,
  estimatedPrice: s.estimatedPrice,
})), null, 2)}

OBJECTIFS OBLIGATOIRES :
1. SUPPRIMER COMPLÈTEMENT "${excludedItem.name}" du caddie et de TOUTES les recettes qui en contenaient.
2. TROUVER UN REMPLAÇANT ADAPTÉ : Choisir un produit équivalent de la même famille nutritionnelle (ex: si légume exclu, remplacer par un autre légume volumineux comme courgettes, haricots verts, carottes ; si viande/poisson, remplacer par œufs, thon, volaille ; si féculent, remplacer par riz ou pâtes).
3. ADAPTER LES RECETTES IMPACTÉES : Modifier les recettes concernées pour intégrer ce substitut, ajuster le titre si nécessaire, la liste des ingrédients et les étapes de préparation. Les recettes qui ne contenaient pas "${excludedItem.name}" DOIVENT RESTER STRICTEMENT IDENTIQUES. Repas simples (2-3 étapes, 15-20 min), priorité riz/pâtes, œufs/thon, oignons, bouillon cube, 45-60g protéines, sans four ni crème lourde.
4. METTRE À JOUR LA LISTE DE COURSES :
   - Retirer "${excludedItem.name}".
   - Ajouter le produit de remplacement en précisant la marque (${premierPrixBrand}), le conditionnement exact et le prix unitaire.
   - GARANTIR LE RESPECT DU BUDGET : Utiliser les produits premiers prix (${premierPrixBrand}) pour s'assurer que le coût total estimé reste STRICTEMENT inférieur ou égal à ${currentMealPlan.budget} €.
   - CONTRAINTE CONGÉLATEUR : Conserver au MAXIMUM 3 articles surgelés au total dans toute la liste de courses.
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(params.customPrices)}` : ''}

Réponds avec ce schéma JSON exact :
{
  "replacementSummary": "Explication claire en 1 phrase (ex: 'Brocoli remplacé par des courgettes dans le Repas 2 et le Repas 4')",
  "recipes": [
    ... liste complète des ${currentMealPlan.recipes.length} recettes (les recettes non impactées conservent leur id et leur contenu exact, les recettes impactées sont adaptées avec 45-60g prot, 600-700 kcal, sans four)
  ],
  "updatedShoppingList": [
    {
      "name": "Nom ingrédient précis",
      "quantity": "Quantité globale",
      "brand": "Marque",
      "unitDetails": "Format packaging",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 3.50
    }
  ],
  "estimatedTotalCost": nombre (STRICTEMENT <= ${currentMealPlan.budget})
}`;

  const parsed = await callGeminiWithFallback(apiKey, prompt, SYSTEM_INSTRUCTION, 0.7);

  const customMap = params.customPrices || {};
  const checkedMap = new Map<string, boolean>();
  currentMealPlan.shoppingList.forEach(item => {
    checkedMap.set(item.name.toLowerCase().trim(), item.checked);
  });

  const updatedShoppingList: ShoppingItem[] = (parsed.updatedShoppingList || []).map((s: any, idx: number) => {
    const normName = s.name?.toLowerCase()?.trim() || '';
    let finalPrice = Number(s.estimatedPrice) || 2.50;
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

  let totalCost = updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  // Hard ceiling: updated budget MUST NOT exceed currentMealPlan.budget
  if (totalCost > currentMealPlan.budget && totalCost > 0) {
    const ratio = (currentMealPlan.budget - 0.5) / totalCost;
    updatedShoppingList.forEach(item => {
      item.estimatedPrice = Math.max(0.5, Number((item.estimatedPrice * ratio).toFixed(2)));
    });
    totalCost = updatedShoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
  }

  const updatedRecipes: Recipe[] = (parsed.recipes || []).map((r: any, idx: number) => ({
    ...r,
    id: r.id || currentMealPlan.recipes[idx]?.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
    mealIndex: r.mealIndex || idx + 1,
    equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
  }));

  return {
    updatedRecipes: updatedRecipes.length > 0 ? updatedRecipes : currentMealPlan.recipes,
    updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : currentMealPlan.shoppingList,
    estimatedTotalCost: Math.min(Number(totalCost.toFixed(2)) || currentMealPlan.budget, currentMealPlan.budget),
    replacementSummary: parsed.replacementSummary || `"${excludedItem.name}" a été remplacé avec succès.`,
  };
}

