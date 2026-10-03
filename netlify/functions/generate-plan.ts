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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Netlify environment variables' }),
    };
  }

  try {
    const params = JSON.parse(event.body || '{}');

    const customPrices = params.customPrices || {};
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
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map((r: any) => r.title).join(', ')}` : ''}
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS ET VÉRIFIÉS EN MAGASIN PAR L'UTILISATEUR (utilise ces prix en priorité) :\n${JSON.stringify(customPrices, null, 2)}` : ''}

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
        body: JSON.stringify({ error: `Tous les modèles Gemini sont momentanément saturés (${lastErr}). Patiente une dizaine de secondes puis réessaie.` }),
      };
    }

    const shoppingList = (parsed.shoppingList || []).map((s: any, idx: number) => {
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

    let totalCost = shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);

    // Hard ceiling: never exceed requested budget
    if (totalCost > params.budget && totalCost > 0) {
      const ratio = (params.budget - 0.5) / totalCost;
      shoppingList.forEach((item: any) => {
        item.estimatedPrice = Math.max(0.5, Number((item.estimatedPrice * ratio).toFixed(2)));
      });
      totalCost = shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);
    }

    const mealPlan = {
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mealPlan),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
