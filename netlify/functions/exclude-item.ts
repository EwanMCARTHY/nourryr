import type { Handler } from '@netlify/functions';

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
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS : Chaque repas principal doit fournir STRICTEMENT entre 55g et 75g de protéines par portion (poulet, dinde, bœuf haché 5%, thon, colin, œufs, skyr, etc. moyenne ~60-65g).
2. SATIÉTÉ MAXIMALE & ZÉRO SURPLUS CALORIQUE : Calories entre 650 et 800 kcal par portion, gros volume de légumes (200-300g), féculents rassasiants, 1 c. à café d'huile max.
3. ÉQUIPEMENT DISPONIBLE : STRICTEMENT plaques, poêle, casserole et micro-ondes. AUCUN FOUR.
4. CONTRAINTE CONGÉLATEUR : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande).
5. RESPECT STRICT DU BUDGET & PREMIERS PRIX : Le coût total estimé du caddie ne doit JAMAIS dépasser le budget max. Utiliser les marques premiers prix (Eco+, Top Budget, Pouce) pour garantir le respect du budget.
6. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse.
7. FORMAT DE RÉPONSE : Objet JSON valide conforme au schéma demandé.`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Netlify' }),
    };
  }

  try {
    const params = JSON.parse(event.body || '{}');
    const { excludedItem, currentMealPlan } = params;

    if (!excludedItem || !currentMealPlan) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'excludedItem and currentMealPlan are required' }),
      };
    }

    const customPrices = params.customPrices || {};
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
${JSON.stringify((currentMealPlan.recipes || []).map((r: any) => ({
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
${JSON.stringify((currentMealPlan.shoppingList || []).map((s: any) => ({
  name: s.name,
  quantity: s.quantity,
  brand: s.brand,
  unitDetails: s.unitDetails,
  category: s.category,
  estimatedPrice: s.estimatedPrice,
})), null, 2)}

OBJECTIFS OBLIGATOIRES :
1. SUPPRIMER COMPLÈTEMENT "${excludedItem.name}" du caddie et de TOUTES les recettes qui en contenaient.
2. TROUVER UN REMPLAÇANT ADAPTÉ : Choisir un produit équivalent de la même famille nutritionnelle (légume volumineux, volaille/poisson/œufs, féculent à haute satiété).
3. ADAPTER LES RECETTES IMPACTÉES : Modifier les recettes concernées pour intégrer ce substitut, ajuster le titre si nécessaire, la liste des ingrédients et les étapes. Les recettes non impactées DOIVENT RESTER STRICTEMENT IDENTIQUES. Apports par portion : 55-75g protéines, 650-800 kcal, sans four.
4. METTRE À JOUR LA LISTE DE COURSES :
   - Retirer "${excludedItem.name}".
   - Ajouter le produit de remplacement en précisant la marque (${premierPrixBrand}), le format exact et le prix.
   - RESPECT DU BUDGET : Utiliser les produits premiers prix (${premierPrixBrand}) pour s'assurer que le coût total estimé reste STRICTEMENT inférieur ou égal à ${currentMealPlan.budget} €.
   - CONTRAINTE CONGÉLATEUR : Conserver au MAXIMUM 3 articles surgelés au total dans toute la liste de courses (le congélateur est minuscule).
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(customPrices)}` : ''}

Réponds avec ce schéma JSON exact :
{
  "replacementSummary": "Explication claire en 1 phrase (ex: 'Brocoli remplacé par des courgettes dans le Repas 2 et le Repas 4')",
  "recipes": [
    ... liste complète des ${currentMealPlan.recipes.length} recettes (recettes non impactées à l'identique, recettes impactées adaptées avec 55-75g prot, 650-800 kcal, sans four)
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

    let parsed: any = null;
    let lastErr = '';

    for (const model of FALLBACK_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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

          if (response.ok) {
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              parsed = JSON.parse(rawText);
              break;
            }
          } else {
            lastErr = `Status ${response.status}`;
            if (response.status === 503 || response.status === 429) {
              const waitTime = (attempt + 1) * 900 + Math.floor(Math.random() * 500);
              await sleep(waitTime);
              continue;
            }
            if (response.status === 404) {
              break;
            }
            break;
          }
        } catch (e: any) {
          lastErr = e.message;
        }
      }
      if (parsed) break;
    }

    if (!parsed) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: `Modèles Gemini indisponibles (${lastErr}). Patiente une dizaine de secondes puis réessaie.` }),
      };
    }

    const checkedMap = new Map<string, boolean>();
    (currentMealPlan.shoppingList || []).forEach((item: any) => {
      checkedMap.set(item.name?.toLowerCase()?.trim(), item.checked);
    });

    const updatedShoppingList = (parsed.updatedShoppingList || []).map((s: any, idx: number) => {
      const normName = s.name?.toLowerCase()?.trim() || '';
      let finalPrice = Number(s.estimatedPrice) || 3.0;
      let isUserPrice = false;

      for (const [knownName, knownPrice] of Object.entries(customPrices)) {
        if (normName.includes(knownName.toLowerCase()) || knownName.toLowerCase().includes(normName)) {
          finalPrice = Number(knownPrice);
          isUserPrice = true;
          break;
        }
      }

      return {
        id: 'shop-' + (idx + 1) + '-' + Date.now(),
        name: s.name,
        quantity: s.quantity,
        brand: s.brand,
        unitDetails: s.unitDetails,
        category: s.category || 'Épicerie & Féculents',
        checked: checkedMap.get(normName) || false,
        estimatedPrice: Number(finalPrice.toFixed(2)),
        isUserPrice,
      };
    });

    const totalCost = updatedShoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);

    const updatedRecipes = (parsed.recipes || []).map((r: any, idx: number) => ({
      ...r,
      id: r.id || currentMealPlan.recipes[idx]?.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
      mealIndex: r.mealIndex || idx + 1,
      equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updatedRecipes: updatedRecipes.length > 0 ? updatedRecipes : currentMealPlan.recipes,
        updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : currentMealPlan.shoppingList,
        estimatedTotalCost: Number(totalCost.toFixed(2)) || parsed.estimatedTotalCost || currentMealPlan.budget,
        replacementSummary: parsed.replacementSummary || `"${excludedItem.name}" a été remplacé avec succès.`,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
