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

1. RÉALITÉ DU SUPERMARCHÉ & AUCUN ARTICLE NON OUVERT (ZÉRO GASPILLAGE INUTILE) :
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
     * Boîte de steaks hachés 15% surgelés (boîte de 8 ou 10) : ~6.50€ - 7.50€ (économique et longue conservation).
   - RÈGLE ABSOLUE DU "ZÉRO PRODUIT NON OUVERT" :
     * TOUT article présent dans la liste de courses DOIT OBLIGATOIREMENT être utilisé et cuisiné dans AU MOINS UNE recette de la semaine. Interdiction formelle de mettre un article dans le panier (ex: carottes, conserve de lentilles) s'il n'est jamais ouvert ni cuisiné dans le menu !
     * Gestion du stock et conservation :
       - Produits longue conservation / surgelés (paquet de 10 steaks surgelés, sac de 1kg de riz/pâtes, boîte de cubes de bouillon, épices) : aucun problème s'il en reste à la fin de la semaine car ils ne périment pas et serviront plus tard. L'essentiel est qu'ils soient entamés et utilisés dans les recettes.
       - Produits frais périssables (viande fraîche, légumes frais entamés) : à consommer dans la semaine pour éviter le pourrissement.

2. PROTÉINES ÉCONOMIQUES : PRIORITÉ MAXIMALE AUX ŒUFS ET AU THON :
   - Les ŒUFS (omelettes garnies, œufs brouillés, œufs au plat sur riz, riz sauté aux œufs) et le THON au naturel (pâtes au thon sauce tomate, riz sauté thon-oignons, poêlée thon-légumes) sont les protéines PRINCIPALES du menu.
   - Les viandes (poulet, steaks hachés surgelés ou frais) sont des "bonus" limités à 1 ou 2 repas max dans la semaine pour garder le budget ultra serré.
   - Apports visés : 45g à 60g de protéines par repas (portion généreuse d'œufs : 3 à 4 œufs par personne, ou 1 boîte entière de thon par personne, ou steak/viande + féculents).

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
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Netlify' }),
    };
  }

  try {
    const params = JSON.parse(event.body || '{}');

    const otherTitles = (params.allRecipes || [])
      .filter((r: any) => r.id !== params.currentRecipe.id)
      .map((r: any) => r.title);

    const customPrices = params.customPrices || {};
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
- RÈGLE DU ZÉRO PRODUIT NON OUVERT : Tout article présent dans updatedShoppingList DOIT être cuisiné dans le menu (le nouveau plat ou les autres plats). Ne jamais ajouter un article superflu qui ne sera pas utilisé. Les produits surgelés/secs longue conservation peuvent avoir du reste pour plus tard, mais doivent être entamés et utilisés.
- RÈGLE ABSOLUE BUDGET : Utilise si besoin les produits premiers prix (${premierPrixBrand}) afin que l'estimation totale reste STRICTEMENT <= ${params.budget} €.
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(customPrices)}` : ''}

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
                temperature: 0.8,
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

    const checkedMap = new Map<string, boolean>();
    (params.currentShoppingList || []).forEach((item: any) => {
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

    let totalCost = updatedShoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);

    // Hard ceiling: updated budget MUST NOT exceed params.budget
    if (totalCost > params.budget && totalCost > 0) {
      const ratio = (params.budget - 0.5) / totalCost;
      updatedShoppingList.forEach((item: any) => {
        item.estimatedPrice = Math.max(0.5, Number((item.estimatedPrice * ratio).toFixed(2)));
      });
      totalCost = updatedShoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);
    }

    const newRecipe = {
      ...parsed.newRecipe,
      id: 'recipe-swap-' + Date.now(),
      mealIndex: params.currentRecipe.mealIndex,
      equipmentUsed: parsed.newRecipe.equipmentUsed || ['Poêle', 'Plaques'],
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newRecipe,
        updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : params.currentShoppingList,
        estimatedTotalCost: Math.min(Number(totalCost.toFixed(2)) || params.budget, params.budget),
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
