import type { Handler } from '@netlify/functions';

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et chef cuisinier expert en musculation et prise de muscle sec pour des sportifs d'environ 84 kg (visant 160g à 185g de protéines par jour).

Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS TRÈS ÉLEVÉS (PRISE DE MASSE MUSCULAIRE) : Chaque repas doit fournir STRICTEMENT entre 45g et 65g de protéines réelles par portion (portions généreuses de volaille 200-250g, bœuf haché 5%, thon, œufs, skyr, etc.).
2. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : aucun gratin, quiche, rôti ou plat au four).
3. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché). Optimise l'achat d'ingrédients de base partagés entre plusieurs repas pour éviter le gaspillage.
4. SOBRIÉTÉ : Pas de blabla, pas de description verbeuse de repas, pas de mention Déjeuner/Dîner. Va droit à l'essentiel : titre clair, ingrédients, étapes courtes.
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

    const prompt = `Génère exactement ${params.totalMeals} repas protéinés distincts pour ${params.numberOfPeople} personnes sur ${params.numberOfDays} jours.
Supermarché : ${params.supermarket}
Budget total max : ${params.budget} €
Objectif : 45g à 65g de protéines par portion.
Pas de four (uniquement poêle, plaques, casserole, micro-ondes).
Pas de texte de description pour les repas.
${params.savedRecipes && params.savedRecipes.length > 0 ? `Recettes favorites des utilisateurs (à réutiliser en priorité) : ${params.savedRecipes.map((r: any) => r.title).join(', ')}` : ''}

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
      "proteinGrams": 52,
      "calories": 700,
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
      "id": "s1",
      "name": "Blancs de dinde (format familial)",
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
      const err = await response.text();
      return { statusCode: response.status, body: err };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText);

    const mealPlan = {
      id: 'plan-' + Date.now(),
      createdAt: new Date().toISOString(),
      numberOfDays: params.numberOfDays,
      totalMeals: params.totalMeals,
      numberOfPeople: params.numberOfPeople,
      supermarket: params.supermarket,
      budget: params.budget,
      estimatedTotalCost: parsed.estimatedTotalCost || params.budget,
      recipes: (parsed.recipes || []).map((r: any, idx: number) => ({
        ...r,
        id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
        mealIndex: idx + 1,
        equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
      })),
      shoppingList: (parsed.shoppingList || []).map((s: any, idx: number) => ({
        ...s,
        id: s.id || 'shop-' + (idx + 1) + '-' + Date.now(),
        checked: false,
      })),
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
