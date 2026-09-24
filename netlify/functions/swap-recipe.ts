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
2. SATIÉTÉ MAXIMALE & ZÉRO SURPLUS CALORIQUE (VOLUME EATING) :
   - Calories maîtrisées : STRICTEMENT entre 650 et 800 kcal par portion (aucun repas au-dessus de 800 kcal).
   - Grand volume alimentaire : part abondante de légumes riches en fibres (200g à 300g par personne : brocolis, courgettes, haricots, épinards...) et féculents à haute satiété (pommes de terre, riz complet, lentilles...).
   - Graisses de cuisson minimales (1 c. à café d'huile max par portion), liaisons légères (skyr, coulis de tomate sans sucre).
3. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit).
4. CONTRAINTE CONGÉLATEUR : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande).
5. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché).
6. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse, pas de mention Déjeuner/Dîner.
7. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

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
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(customPrices)}` : ''}

Réponds avec ce schéma JSON exact :
{
  "newRecipe": {
    "title": "Nom du plat",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 15,
    "proteinGrams": 62,
    "calories": 720,
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

    const totalCost = updatedShoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);

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
        estimatedTotalCost: Number(totalCost.toFixed(2)) || parsed.estimatedTotalCost || params.budget,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
