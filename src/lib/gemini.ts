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

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 170g à 195g de protéines par jour).

Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MUSCLE SEC) : Chaque repas doit fournir STRICTEMENT entre 55g et 75g de protéines réelles par portion (portions très généreuses : 220g à 280g de volaille, steak haché 5%, thon, colin/cabillaud, ou 3-4 œufs entiers + blancs, skyr 200g, complétés de légumineuses). Moyenne visée : ~60-65g de protéines par portion.
2. SATIÉTÉ MAXIMALE & ZÉRO SURPLUS CALORIQUE (VOLUME EATING) :
   - Calories maîtrisées : STRICTEMENT entre 650 et 800 kcal par portion (aucun repas au-dessus de 800 kcal afin d'éliminer tout risque de surplus calorique ou de prise de gras tout en accueillant les 55-75g de protéines).
   - Grand volume alimentaire : chaque repas doit impérativement comporter une part abondante de légumes riches en fibres et en eau (200g à 300g par personne : courgettes, haricots verts, brocolis, épinards, poivrons, carottes, champignons, concassé de tomates...).
   - Féculents à fort indice de satiété : pommes de terre (aliment n°1 de la satiété), riz basmati/complet, lentilles, pois chiches, pâtes complètes, flocons d'avoine.
   - Limitation stricte des graisses cachées : 1 c. à café d'huile max par portion pour la cuisson. Lier les sauces avec du skyr, fromage blanc 0% ou coulis de tomate sans sucre. Assaisonner avec épices, herbes, ail, oignon, citron.
3. ÉQUIPEMENT DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : aucun gratin, quiche, rôti ou plat au four).
4. CONTRAINTE CONGÉLATEUR STRICTE (PETIT CONGÉLATEUR) : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande, ex: 1 sachet de légumes surgelés et 1 ou 2 poissons/viandes surgelés max). Tout le reste DOIT IMPÉRATIVEMENT être frais, en conserves/bocaux (haricots verts en boîte, tomates pelées, lentilles, pois chiches, thon en boîte) ou épicerie sèche.
5. RESPECT STRICT DU BUDGET & PRODUITS PREMIERS PRIX :
   - Le budget total max indiqué est une LIMITE ABSOLUE INFRANCHISSABLE. Le coût total estimé ne doit JAMAIS le dépasser (estimatedTotalCost <= budget).
   - Pour garantir le respect du budget sans rogner sur les protéines, utilise en priorité les gammes premiers prix / hard discount de l'enseigne :
     * E.Leclerc : marque Eco+ (ou Marque Repère premier prix).
     * Intermarché : marque Top Budget (ou Monique Ranou / Pâturages premier prix).
     * Auchan : marque Pouce (ou Marque Auchan premier prix).
   - Optimise les ingrédients de base partagés entre plusieurs repas (ex: même sac de riz, filet de pommes de terre, boîte de 10/12 œufs, barquette familiale de volaille) pour faire baisser le coût par repas.
6. LISTE DE COURSES GRANULAIRE ET ULTRA DÉTAILLÉE :
   - Évite les regroupements vagues : détaille élément par élément pour qu'on sache exactement quoi prendre en rayon.
   - Mentionne la marque du magasin (ex: Eco+ / Marque Repère chez E.Leclerc, Top Budget / Monique Ranou chez Intermarché, Pouce / Marque Auchan chez Auchan).
   - Précise le conditionnement précis (ex: "Barquette 4x100g", "Bocal 400g", "Paquet 1kg", "Boîte de 10 œufs").
   - Donne un prix unitaire réaliste en euros pour ce produit précis.
7. SOBRIÉTÉ : Pas de description verbeuse de repas, pas de mention Déjeuner/Dîner. Va droit à l'essentiel : titre clair, ingrédients, étapes courtes.
8. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

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
Objectifs nutritionnels & Satiété :
- 55g à 75g de protéines réelles par portion (athlète 84 kg, moyenne visée ~60-65g de protéines).
- Satiété maximale & zéro surplus calorique : chaque repas doit apporter STRICTEMENT entre 650 et 800 kcal par portion (jamais au-dessus de 800 kcal pour éliminer tout risque de surplus).
- Volume alimentaire élevé : chaque plat DOIT intégrer une généreuse portion de légumes rassasiants riches en fibres et eau (200g-300g par personne : brocolis, courgettes, haricots, champignons, épinards, sauce tomate nature...) et des féculents à fort pouvoir de satiété (pommes de terre, riz complet/basmati, lentilles...).
- Matières grasses de cuisson strictement limitées (1 c. à café d'huile par personne), sans crème grasse (lier au skyr ou coulis de tomate).
- CONTRAINTE CONGÉLATEUR STRICTE (PETIT CONGÉLATEUR) : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande, ex: 1 sachet de légumes surgelés et 1 ou 2 poissons/viandes surgelés max). Tout le reste DOIT IMPÉRATIVEMENT provenir du rayon frais, de conserves/bocaux ou de l'épicerie sèche.
Pas de four (uniquement poêle, plaques, casserole, micro-ondes).
Pas de texte de description pour les repas.
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map(r => r.title).join(', ')}` : ''}
${params.customPrices && Object.keys(params.customPrices).length > 0 ? `PRIX CONNUS ET VÉRIFIÉS EN MAGASIN PAR L'UTILISATEUR (utilise ces prix en priorité) :\n${JSON.stringify(params.customPrices, null, 2)}` : ''}

Exigences liste de courses & Respect du budget :
- Détaille article par article sans regrouper de manière vague. Précise le nom, la marque de distributeur (${params.supermarket}), le format/packaging exact et le prix unitaire réaliste.
- Utilise en priorité les gammes premiers prix (${premierPrixBrand}) pour les féculents, conserves/surgelés, œufs et viandes afin de garantir que l'estimation totale soit STRICTEMENT <= ${params.budget} €.

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
- Riche en protéines : 55g à 75g de protéines par portion (musculation 84 kg, moyenne ~60-65g).
- Satiété maximale & zéro surplus calorique : calibrer STRICTEMENT entre 650 et 800 kcal par portion (jamais au-dessus de 800 kcal). Intégrer une belle portion de légumes rassasiants riches en fibres et eau (200g-300g) et féculents à haute satiété (pommes de terre, riz complet, lentilles...), sans excès de matières grasses.
- CONTRAINTE CONGÉLATEUR : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses.
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de "${params.currentRecipe.title}" et différente des autres plats déjà prévus : ${otherTitles.join(', ')}.
${params.excludedIngredients && params.excludedIngredients.length > 0 ? `- ALIMENTS STRICTEMENT INTERDITS (exclus par l'utilisateur) : ${params.excludedIngredients.join(', ')}` : ''}

ADAPTATION DE LA LISTE DE COURSES GRANULAIRE & RESPECT DU BUDGET :
- Ajuste la liste de courses article par article pour intégrer les ingrédients du nouveau plat et enlever les ingrédients qui ne servaient qu'à l'ancienne recette "${params.currentRecipe.title}".
- Détaille article par article avec marque distributeur (${params.supermarket}), conditionnement et prix unitaire réaliste.
- RÈGLE ABSOLUE BUDGET : Utilise si besoin les produits premiers prix (${premierPrixBrand}) et réutilise les ingrédients déjà achetés dans le reste du panier afin que l'estimation totale reste STRICTEMENT <= ${params.budget} €.
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
2. TROUVER UN REMPLAÇANT ADAPTÉ : Choisir un produit équivalent de la même famille nutritionnelle (ex: si légume exclu, remplacer par un autre légume volumineux comme courgettes, haricots verts, carottes ; si viande/poisson, remplacer par escalopes de poulet/dinde, bœuf 5%, œufs, thon ; si féculent, remplacer par pommes de terre, riz, lentilles).
3. ADAPTER LES RECETTES IMPACTÉES : Modifier les recettes concernées pour intégrer ce substitut, ajuster le titre si nécessaire, la liste des ingrédients et les étapes de préparation. Les recettes qui ne contenaient pas "${excludedItem.name}" DOIVENT RESTER STRICTEMENT IDENTIQUES. Apports par portion : 55-75g protéines, 650-800 kcal, sans four.
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
    ... liste complète des ${currentMealPlan.recipes.length} recettes (les recettes non impactées conservent leur id et leur contenu exact, les recettes impactées sont adaptées avec 55-75g prot, 650-800 kcal, sans four)
  ],
  "updatedShoppingList": [
    {
      "name": "Nom ingrédient précis",
      "quantity": "Quantité globale",
      "brand": "Marque",
      "unitDetails": "Format packaging",
      "category": "Boucherie & Poissonnerie",
      "estimatedPrice": 4.50
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

  const updatedRecipes: Recipe[] = (parsed.recipes || []).map((r: any, idx: number) => ({
    ...r,
    id: r.id || currentMealPlan.recipes[idx]?.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
    mealIndex: r.mealIndex || idx + 1,
    equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
  }));

  return {
    updatedRecipes: updatedRecipes.length > 0 ? updatedRecipes : currentMealPlan.recipes,
    updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : currentMealPlan.shoppingList,
    estimatedTotalCost: Number(totalCost.toFixed(2)) || parsed.estimatedTotalCost || currentMealPlan.budget,
    replacementSummary: parsed.replacementSummary || `"${excludedItem.name}" a été remplacé avec succès.`,
  };
}

