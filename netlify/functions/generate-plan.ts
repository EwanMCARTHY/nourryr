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
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MUSCLE SEC) : Chaque repas doit fournir STRICTEMENT entre 55g et 75g de protéines réelles par portion (portions très généreuses : 220g à 280g de volaille, steak haché 5%, thon, colin/cabillaud, ou 3-4 œufs entiers + blancs, skyr 200g, complétés de légumineuses). Moyenne visée : ~60-65g de protéines par portion.
2. SATIÉTÉ MAXIMALE & ZÉRO SURPLUS CALORIQUE (VOLUME EATING) :
   - Calories maîtrisées : STRICTEMENT entre 650 et 800 kcal par portion (aucun repas au-dessus de 800 kcal afin d'éliminer tout risque de surplus calorique ou de prise de gras tout en accueillant les 55-75g de protéines).
   - Grand volume alimentaire : chaque repas doit impérativement comporter une part abondante de légumes riches en fibres et en eau (200g à 300g par personne : courgettes, haricots verts, brocolis, épinards, poivrons, carottes, champignons, concassé de tomates...).
   - Féculents à fort indice de satiété : pommes de terre (aliment n°1 de la satiété), riz basmati/complet, lentilles, pois chiches, pâtes complètes, flocons d'avoine.
   - Limitation stricte des graisses cachées : 1 c. à café d'huile max par portion pour la cuisson. Lier les sauces avec du skyr, fromage blanc 0% ou coulis de tomate sans sucre. Assaisonner avec épices, herbes, ail, oignon, citron.
3. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : aucun gratin, quiche, rôti ou plat au four).
4. CONTRAINTE CONGÉLATEUR STRICTE (PETIT CONGÉLATEUR) : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande, ex: 1 sachet de légumes surgelés et 1 ou 2 poissons/viandes surgelés max). Tout le reste DOIT IMPÉRATIVEMENT provenir du rayon frais, de conserves/bocaux ou de l'épicerie sèche.
5. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché). Optimise l'achat d'ingrédients de base partagés entre plusieurs repas pour éviter le gaspillage.
6. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse de repas, pas de mention Déjeuner/Dîner. Va droit à l'essentiel : titre clair, ingrédients, étapes courtes.
7. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

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
Objectifs nutritionnels & Satiété :
- 55g à 75g de protéines réelles par portion (athlète 84 kg, moyenne visée ~60-65g de protéines).
- Satiété maximale & zéro surplus calorique : chaque repas doit apporter STRICTEMENT entre 650 et 800 kcal par portion (jamais au-dessus de 800 kcal pour éliminer tout risque de surplus).
- Volume alimentaire élevé : chaque plat DOIT intégrer une généreuse portion de légumes rassasiants riches en fibres et eau (200g-300g par personne : brocolis, courgettes, haricots, champignons, épinards, sauce tomate nature...) et des féculents à fort pouvoir de satiété (pommes de terre, riz complet/basmati, lentilles...).
- Matières grasses de cuisson strictement limitées (1 c. à café d'huile par personne), sans crème grasse (lier au skyr ou coulis de tomate).
- CONTRAINTE CONGÉLATEUR STRICTE (PETIT CONGÉLATEUR) : MAXIMUM 3 ARTICLES SURGELÉS AU TOTAL dans toute la liste de courses (le congélateur est minuscule : max 3 produits surgelés par commande, ex: 1 sachet de légumes surgelés et 1 ou 2 poissons/viandes surgelés max). Tout le reste DOIT IMPÉRATIVEMENT provenir du rayon frais, de conserves/bocaux ou de l'épicerie sèche.
Pas de four (uniquement poêle, plaques, casserole, micro-ondes).
Pas de texte de description pour les repas.
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map((r: any) => r.title).join(', ')}` : ''}
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS ET VÉRIFIÉS EN MAGASIN PAR L'UTILISATEUR (utilise ces prix en priorité) :\n${JSON.stringify(customPrices, null, 2)}` : ''}

Exigences liste de courses & Respect du budget :
- Détaille article par article sans regrouper de manière vague. Précise le nom, la marque de distributeur (${params.supermarket}), le format/packaging exact et le prix unitaire réaliste.
- Utilise en priorité les gammes premiers prix (${premierPrixBrand}) pour les féculents, conserves/surgelés, œufs et viandes afin de garantir que l'estimation totale soit STRICTEMENT <= ${params.budget} €.

Réponds avec ce schéma JSON exact :
{
  "estimatedTotalCost": nombre (estimation réaliste en euros chez ${params.supermarket}),
  "recipes": [
    {
      "id": "r1",
      "mealIndex": 1,
      "title": "Nom précis du plat",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 15,
      "proteinGrams": 62,
      "calories": 720,
      "ingredients": [
        { "name": "Escalope de dinde", "amount": "500g" }
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

    const totalCost = shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0);

    const mealPlan = {
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
