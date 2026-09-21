import type { Handler } from '@netlify/functions';

const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 160g à 185g de protéines par jour).
Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS : Chaque repas principal doit fournir STRICTEMENT entre 45g et 65g de protéines par portion (poulet, dinde, boeuf haché 5%, thon, oeufs, skyr, etc.).
2. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit).
3. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché).
4. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse, pas de mention Déjeuner/Dîner.
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

    const prompt = `L'utilisateur souhaite remplacer le repas "${params.currentRecipe.title}" (Repas n°${params.currentRecipe.mealIndex || 1}).
Critères du nouveau plat :
- Nombre de personnes : ${params.numberOfPeople}
- Supermarché : ${params.supermarket}
- Riche en protéines : 45g à 65g de protéines par portion (musculation 84 kg).
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de "${params.currentRecipe.title}" et différente des autres plats déjà prévus : ${otherTitles.join(', ')}.

ADAPTATION DE LA LISTE DE COURSES GRANULAIRE :
- Ajuste la liste de courses article par article pour intégrer les ingrédients du nouveau plat et enlever les ingrédients qui ne servaient qu'à l'ancienne recette "${params.currentRecipe.title}".
- Détaille article par article avec marque distributeur (${params.supermarket}), conditionnement et prix unitaire réaliste.
- Essaie en priorité de réutiliser des ingrédients déjà achetés dans le reste du panier pour respecter le budget max de ${params.budget} €.
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(customPrices)}` : ''}

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
          if (response.status === 503 || response.status === 429 || response.status === 404) {
            continue; // try next model
          }
        }
      } catch (e: any) {
        lastErr = e.message;
      }
    }

    if (!parsed) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: `Tous les modèles Gemini sont momentanément saturés (${lastErr}). Réessaie dans quelques secondes.` }),
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
