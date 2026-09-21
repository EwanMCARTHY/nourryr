import type { Handler } from '@netlify/functions';

const SYSTEM_INSTRUCTION = `Tu es un nutritionniste du sport et un chef cuisinier professionnel spécialisé dans l'alimentation pour la musculation, la prise de muscle sec et la performance sportive.
Tes règles ABSOLUES :
1. APPORTS PROTÉINÉS ÉLEVÉS : Chaque repas principal doit fournir entre 35g et 55g de protéines par portion (poulet, dinde, boeuf haché 5%, thon, oeufs, skyr, fromage blanc, lentilles, tofu, etc.).
2. ÉQUIPEMENT DE CUISINE DISPONIBLE : STRICTEMENT plaques de cuisson, poêle, casserole et micro-ondes. AUCUN FOUR (Strictement interdit : pas de gratins au four, pas de quiches au four, pas de rôtis).
3. BUDGET & ENSEIGNE : Respecte rigoureusement le budget total indiqué pour le supermarché sélectionné (E.Leclerc, Auchan ou Intermarché).
4. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

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

    const prompt = `Génère UNE SEULE nouvelle recette de remplacement pour un ${params.currentRecipe.mealType}, jour ${params.currentRecipe.dayIndex}.
Critères :
- Nombre de personnes : ${params.numberOfPeople}
- Supermarché : ${params.supermarket}
- Riche en protéines (35-50g par portion).
- AUCUN FOUR (uniquement plaques, poêle, casserole, micro-ondes).
- Recette différente de : ${params.currentRecipe.title} et des autres repas déjà prévus : ${(params.otherRecipeTitles || []).join(', ')}.

Réponds avec ce schéma JSON exact pour UNE seule recette :
{
  "title": "Nom du plat",
  "description": "Courte description",
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 15,
  "proteinGrams": 45,
  "calories": 600,
  "ingredients": [
    { "name": "Ingrédient", "amount": "Quantité" }
  ],
  "instructions": [
    "Étape 1...",
    "Étape 2..."
  ],
  "equipmentUsed": ["Poêle", "Plaques"]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: response.status, body: err };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...parsed,
        id: 'recipe-swap-' + Date.now(),
        dayIndex: params.currentRecipe.dayIndex,
        mealType: params.currentRecipe.mealType,
        equipmentUsed: parsed.equipmentUsed || ['Poêle', 'Plaques'],
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
