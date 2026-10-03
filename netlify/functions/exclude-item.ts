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

const SYSTEM_INSTRUCTION = `Tu es un préparateur nutritionniste et cuisinier pragmatique, expert en repas économiques, riches en protéines, équilibrés et savoureux pour sportifs (visant 45g à 60g de protéines par portion).

Tes règles FONDAMENTALES :

1. RÉALITÉ DU SUPERMARCHÉ & AUCUN ARTICLE NON OUVERT (ZÉRO GASPILLAGE INUTILE) :
   - Chaque ligne de la liste de courses DOIT être un vrai conditionnement de magasin (jamais de quantité au prorata).
   - Utilise les vrais prix constatés en France en marques premier prix (Eco+ chez E.Leclerc, Top Budget chez Intermarché, Pouce chez Auchan) :
     * Boîte de 10-12 œufs : ~2.50€ - 2.80€ (ou plateau de 30 œufs : ~5.50€).
     * Pack 3 boîtes de thon au naturel (3x140g) : ~3.50€ - 3.80€.
     * Paquet de 1kg de riz (basmati/blanc) : ~1.30€ - 1.60€.
     * Paquet de 1kg de pâtes : ~1.10€ - 1.40€.
     * Filet de 1kg d'oignons : ~1.30€ - 1.50€.
     * Tête d'ail : ~0.90€ - 1.10€.
     * Boîte de bouillon cube (bœuf/volaille/légumes) : ~1.20€ - 1.40€.
     * Brique/bocal de coulis ou pulpe de tomate 500g : ~0.85€ - 1.15€.
     * Boîte ou bocal de champignons de Paris émincés 400g (ou barquette frais 250-500g) : ~1.00€ - 1.50€.
     * Sachet d'épinards FRAIS (pas surgelés) 400g-500g : ~1.50€ - 1.90€.
     * Boîte ou bocal de pois chiches premier prix 400g-500g : ~0.80€ - 1.05€.
     * Boîte de maïs doux premier prix (3x140g ou boîte 300g) : ~0.90€ - 1.20€.
     * Boîte de haricots rouges premier prix 400g-500g : ~0.80€ - 1.05€.
     * Filet de 1kg de carottes (ou bocal) : ~1.00€ - 1.30€.
     * Poivrons frais (lot de 3 ou barquette) : ~1.80€ - 2.20€.
     * Bocal de légumes (haricots verts, petits pois) 400g égoutté : ~1.00€ - 1.30€.
     * Barquette de blanc de volaille 500g : ~4.80€ - 5.50€.
     * Boîte de steaks hachés 15% surgelés (boîte de 8 ou 10) : ~6.50€ - 7.50€ (économique et longue conservation).
   - RÈGLE ABSOLUE DU "ZÉRO PRODUIT NON OUVERT" :
     * TOUT article présent dans la liste de courses DOIT OBLIGATOIREMENT être utilisé et cuisiné dans AU MOINS UNE recette de la semaine. Interdiction formelle de mettre un article dans le panier (ex: légumes, conserves de légumineuses) s'il n'est jamais ouvert ni cuisiné dans le menu !
     * Gestion du stock et conservation :
       - Produits longue conservation / surgelés (paquet de 10 steaks surgelés, sac de 1kg de riz/pâtes, conserves de haricots rouges/pois chiches/maïs/champignons, bouillon cube, épices) : aucun problème s'il en reste à la fin de la semaine car ils ne périment pas et serviront plus tard. L'essentiel est qu'ils soient entamés et utilisés dans les recettes.
       - Produits frais périssables (viande fraîche, épinards frais, poivrons, carottes entamées) : à consommer dans la semaine pour éviter le pourrissement.

2. PROTÉINES ÉCONOMIQUES : ŒUFS, THON & LÉGUMINEUSES :
   - Les ŒUFS (omelettes garnies, œufs brouillés, œufs au plat sur riz, riz sauté aux œufs) et le THON au naturel (pâtes au thon sauce tomate, riz sauté thon-oignons, poêlée thon-légumes) sont les protéines PRINCIPALES du menu.
   - Les légumineuses (pois chiches, haricots rouges) apportent des protéines végétales supplémentaires très économiques qui s'additionnent aux œufs et au thon pour atteindre facilement 45g à 60g de protéines par portion.
   - Les viandes (poulet, steaks hachés surgelés ou frais) sont des "bonus" limités à 1 ou 2 repas max dans la semaine pour garder le budget ultra serré.
   - Apports visés : 45g à 60g de protéines par repas (portion généreuse d'œufs : 3 à 4 œufs par personne, ou 1 boîte entière de thon par personne, ou viande + féculents/légumineuses).

3. LÉGUMES & LÉGUMINEUSES DANS TOUS LES PLATS (ÉQUILIBRE, FIBRES & VOLUME) :
   - Ne JAMAIS proposer de repas vides de légumes (ex: riz + thon seul sans aucun légume est interdit). Chaque repas DOIT contenir une belle portion de légumes ou de légumineuses.
   - Sélection privilégiée (varier au fil de la semaine) :
     * Champignons (frais émincés ou boîte, sautés à la poêle avec ail/oignons)
     * Épinards FRAIS (en sachet au rayon frais, tombés à la poêle avec ail, STRICTEMENT PAS surgelés)
     * Pois chiches (en boîte ou bocal premier prix, poêlés aux épices ou en salade tiède)
     * Maïs doux (en boîte premier prix, croquant en poêlées ou salades de riz)
     * Haricots rouges (en boîte premier prix, mijotés façon poêlée savoureuse avec coulis de tomate)
     * Carottes (râpées croquantes en accompagnement ou poêlées en rondelles fondantes)
     * Poivrons (coupés en lanières et poêlés dorés avec oignons)
     * Oignons dorés et ail (systématiques dans chaque poêlée pour le goût)
   - Tous les légumes et légumineuses achetés DOIVENT être répartis dans les recettes pour ne rien gaspiller.

4. PLATS SIMPLES, RAPIDES & ULTRA SAVOUREUX (SANS CRÈME LOURDE) :
   - Pas de recettes compliquées, 2 à 3 étapes de préparation maximum (15-20 min).
   - Cuisson directe à la poêle ou casserole. AUCUN FOUR.
   - Féculents préférés : RIZ et PÂTES. PAS de pommes de terre simplement cuites à l'eau (fade !). Si des pommes de terre sont utilisées, elles doivent impérativement être sautées/dorées à la poêle avec des oignons dorés et des épices.
   - Assaisonnements obligatoires pour un maximum de goût SANS calories superflues :
     * Toujours faire revenir des OIGNONS et de l'AIL doré.
     * Utiliser des CUBES DE BOUILLON émiettés dans la cuisson du riz/pâtes ou dans les poêlées (exhausteur de goût puissant et économique).
     * Coulis de tomate mijoté, moutarde, filet de sauce soja, épices simples (paprika, curry doux, herbes de Provence, sel, poivre).
     * Pas de crème fraîche lourde, pas de fromage blanc cuit à la poêle (le fromage blanc ne se cuit pas, il caille).

5. RESPECT STRICT DU BUDGET (PLAFOND INVIOLABLE) :
   - Le montant total estimé du caddie (somme des prix des packs achetés) DOIT STRICTEMENT être inférieur ou égal au budget défini (estimatedTotalCost <= budget). Jamais de dépassement.

6. FORMAT DE RÉPONSE : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide conforme au schéma demandé, sans aucun texte introductif ni markdown.`;

const STOP_WORDS = new Set([
  // Conditionnements & emballages (singulier & pluriel)
  'pack', 'packs', 'boite', 'boites', 'paquet', 'paquets', 'filet', 'filets',
  'bocal', 'bocaux', 'brique', 'briques', 'sachet', 'sachets', 'barquette', 'barquettes',
  'morceau', 'morceaux', 'tranche', 'tranches', 'conserve', 'conserves',
  'lot', 'lots', 'format', 'formats', 'bouteille', 'bouteilles', 'pot', 'pots',
  'botte', 'bottes', 'grappe', 'grappes', 'plateau', 'plateaux', 'vrac',
  // Mesures & quantites
  'poids', 'gramme', 'grammes', 'kilo', 'kilos', 'kg', 'litre', 'litres', 'ml', 'cl',
  'environ', 'unite', 'unites', 'piece', 'pieces', 'portion', 'portions',
  // Enseignes & premier prix
  'premier', 'premiers', 'premiere', 'premieres', 'prix', 'marque', 'marques', 'repere', 'reperes',
  'budget', 'pouce', 'pouces', 'auchan', 'leclerc', 'intermarche', 'qualite', 'rayon', 'rayons',
  'eco', 'top',
  // Qualificatifs generiques
  'naturel', 'naturels', 'naturelle', 'naturelles',
  'entier', 'entiers', 'entiere', 'entieres',
  'fraiche', 'fraiches', 'frais', 'pure', 'pures', 'pur', 'purs',
  'petit', 'petits', 'petite', 'petites',
  'grand', 'grands', 'grande', 'grandes',
  'produit', 'produits', 'aliment', 'aliments',
  // Mots de liaison, articles & prepositions
  'pour', 'avec', 'sans', 'sous', 'dans', 'sur', 'par',
  'aux', 'des', 'les', 'une', 'ces', 'ses', 'nos', 'vos',
  // Actions de preparation / cuisson
  'chaud', 'chauds', 'chaude', 'chaudes',
  'froid', 'froids', 'froide', 'froides',
  'doux', 'douce', 'vif', 'moyen',
  'fondant', 'fondants', 'fondante', 'fondantes',
  'dore', 'dores', 'doree', 'dorees',
  'poele', 'poeles', 'poelee', 'poelees',
  'casserole', 'casseroles', 'four',
  'cuisson', 'cuire', 'cuit', 'cuits', 'cuite', 'cuites',
  'preparation', 'plat', 'plats', 'recette', 'recettes',
  'minute', 'minutes', 'min', 'etape', 'etapes',
  'ajouter', 'melanger', 'verser', 'laisser', 'servir', 'reserver', 'couper', 'faire'
]);

const NON_DISTINCTIVE_DESCRIPTORS = new Set([
  // Couleurs
  'rouge', 'rouges', 'vert', 'verts', 'verte', 'vertes',
  'blanc', 'blancs', 'blanche', 'blanches',
  'jaune', 'jaunes', 'noir', 'noirs', 'noire', 'noires',
  'brun', 'bruns', 'brune', 'brunes',
  // Origines & terroirs
  'paris', 'dijon', 'parme',
  // Textures, formes & etats de preparation
  'sec', 'secs', 'seche', 'seches',
  'cru', 'crus', 'crue', 'crues',
  'doux', 'douce', 'sauvage', 'sauvages',
  'long', 'longs', 'longue', 'longues',
  'rond', 'ronds', 'ronde', 'rondes',
  'fin', 'fins', 'fine', 'fines', 'extra',
  'emince', 'eminces', 'emincee', 'emincees',
  'rape', 'rapes', 'rapee', 'rapees',
  'branche', 'branches',
  'rondelle', 'rondelles',
  'laniere', 'lanieres',
  'egoutte', 'egouttes', 'egouttee', 'egouttees',
]);

const COLOR_WORDS = new Set([
  'rouge', 'rouges', 'vert', 'verts', 'verte', 'vertes',
  'blanc', 'blancs', 'blanche', 'blanches',
  'jaune', 'jaunes', 'noir', 'noirs', 'noire', 'noires',
  'brun', 'bruns', 'brune', 'brunes',
]);

function normalizeFoodTerms(text: string): string {
  return text
    .replace(/\bpommes?\s+de\s+terre\b/gi, 'pomme_de_terre')
    .replace(/\bpois\s+chiches?\b/gi, 'pois_chiches')
    .replace(/\bnoix\s+de\s+coco\b/gi, 'noix_de_coco')
    .replace(/\blait\s+de\s+coco\b/gi, 'lait_de_coco')
    .replace(/\bbeurre\s+de\s+cacahu[eè]tes?\b/gi, 'beurre_de_cacahuete');
}

function normalizeText(str: string): string {
  const basic = (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
  return normalizeFoodTerms(basic);
}

function normalizeCategory(cat: string | undefined): string {
  if (!cat) return 'Condiments & Autres';
  const c = normalizeText(cat).trim();
  if (c.includes('boucherie') || c.includes('poisson') || c.includes('viande') || c.includes('volaille')) {
    return 'Boucherie & Poissonnerie';
  }
  if (c.includes('cremerie') || c.includes('oeuf') || c.includes('lait') || c.includes('fromage')) {
    return 'Crémerie & Œufs';
  }
  if (c.includes('fruit') || c.includes('legume')) {
    return 'Fruits & Légumes';
  }
  if (c.includes('epicerie') || c.includes('feculent') || c.includes('pate') || c.includes('riz') || c.includes('conserve') || c.includes('sec')) {
    return 'Épicerie & Féculents';
  }
  return 'Condiments & Autres';
}

function getWordStems(word: string): string[] {
  const stems = new Set<string>();
  stems.add(word);
  if (word === 'pomme_de_terre' || word === 'pommes_de_terre') {
    stems.add('pomme_de_terre');
    stems.add('pommes_de_terre');
    return Array.from(stems);
  }
  if (word === 'pois_chiches' || word === 'pois_chiche') {
    stems.add('pois_chiches');
    stems.add('pois_chiche');
    return Array.from(stems);
  }
  if (word === 'noix_de_coco') {
    stems.add('noix_de_coco');
    return Array.from(stems);
  }
  if (word === 'lait_de_coco') {
    stems.add('lait_de_coco');
    return Array.from(stems);
  }
  if (word === 'beurre_de_cacahuete' || word === 'beurre_de_cacahuetes') {
    stems.add('beurre_de_cacahuete');
    stems.add('beurre_de_cacahuetes');
    return Array.from(stems);
  }
  if (word.length >= 4) {
    if (word.endsWith('s') || word.endsWith('x')) {
      const s1 = word.slice(0, -1);
      stems.add(s1);
      if (word.endsWith('es') && s1.length >= 4) {
        stems.add(word.slice(0, -2));
      }
    }
  }
  return Array.from(stems);
}

function getSignificantWords(name: string): string[] {
  const norm = normalizeText(name);
  return norm
    .replace(/[^a-z_]/g, ' ')
    .split(/\s+/)
    .filter(w => {
      if (w.length < 3) return false;
      if (STOP_WORDS.has(w)) return false;
      const stems = getWordStems(w);
      if (stems.some(s => STOP_WORDS.has(s))) return false;
      return true;
    });
}

function extractFoodTokens(name: string): { primary: string[]; descriptors: string[] } {
  const words = getSignificantWords(name);
  const primary: string[] = [];
  const descriptors: string[] = [];

  for (const w of words) {
    const stems = getWordStems(w);
    if (NON_DISTINCTIVE_DESCRIPTORS.has(w) || stems.some(st => NON_DISTINCTIVE_DESCRIPTORS.has(st))) {
      descriptors.push(w);
    } else {
      primary.push(w);
    }
  }

  if (primary.length === 0 && descriptors.length > 0) {
    return { primary: descriptors, descriptors: [] };
  }

  return { primary, descriptors };
}

function isItemUsedInRecipes(itemName: string, recipes: any[]): boolean {
  const { primary } = extractFoodTokens(itemName);
  const targetTokens = primary.length > 0 ? primary : getSignificantWords(itemName);
  if (targetTokens.length === 0) return true;

  // 1. Primary check: Recipe titles + ingredients
  const primaryText = normalizeText(
    (recipes || []).map((r: any) => `${r.title || ''} ${(r.ingredients || []).map((i: any) => i.name).join(' ')}`).join(' ')
  );
  const primaryTokens = primaryText.replace(/[^a-z_]/g, ' ').split(/\s+/).filter(Boolean);
  const primaryWordSet = new Set<string>();
  for (const token of primaryTokens) {
    primaryWordSet.add(token);
    for (const stem of getWordStems(token)) {
      primaryWordSet.add(stem);
    }
  }

  const matchedPrimary = targetTokens.some(word => {
    if (primaryWordSet.has(word)) return true;
    const stems = getWordStems(word);
    return stems.some(s => primaryWordSet.has(s));
  });

  if (matchedPrimary) return true;

  // 2. Secondary check: Instructions with word boundaries (stop words excluded)
  // For 'mais', only match if raw recipe text / instructions actually contain the diacritic "maïs"
  const rawInstructionsText = (recipes || []).map((r: any) => (r.instructions || []).join(' ')).join(' ');
  const hasRawMaisDiacritic = /\bma[ïï]s\b/i.test(rawInstructionsText);

  const instructionsText = normalizeText(rawInstructionsText);
  const instTokens = instructionsText.replace(/[^a-z_]/g, ' ').split(/\s+/).filter(Boolean);
  const instWordSet = new Set<string>();
  for (const token of instTokens) {
    if (!STOP_WORDS.has(token)) {
      instWordSet.add(token);
      for (const stem of getWordStems(token)) {
        if (!STOP_WORDS.has(stem)) instWordSet.add(stem);
      }
    }
  }

  return targetTokens.some(word => {
    const stems = getWordStems(word);
    const isMaisToken = word === 'mais' || stems.includes('mais');
    if (isMaisToken) {
      // Must not match the French conjunction "mais" in instructions without diacritic
      return hasRawMaisDiacritic && (instWordSet.has(word) || stems.some(s => instWordSet.has(s)));
    }
    if (instWordSet.has(word)) return true;
    return stems.some(s => instWordSet.has(s));
  });
}

function pruneOrphanShoppingItems(shoppingList: any[], recipes: any[]): any[] {
  if (!shoppingList || shoppingList.length === 0) return [];
  if (!recipes || recipes.length === 0) return shoppingList;

  const keptItems = shoppingList.filter((item: any) =>
    isItemUsedInRecipes(item.name || '', recipes)
  );

  return keptItems.length > 0 ? keptItems : shoppingList;
}

function isItemExcluded(candidateItemName: string, excludedItemName: string): boolean {
  const normCandidate = normalizeText(candidateItemName).trim();
  const normExcluded = normalizeText(excludedItemName).trim();
  if (!normCandidate || !normExcluded) return false;
  if (normCandidate === normExcluded) return true;

  const exTokens = extractFoodTokens(excludedItemName);
  const candTokens = extractFoodTokens(candidateItemName);
  if (exTokens.primary.length === 0 || candTokens.primary.length === 0) return false;

  const stemMatch = (a: string, b: string) => {
    if (a === b) return true;
    const aStems = getWordStems(a);
    const bStems = getWordStems(b);
    return aStems.some(s => bStems.includes(s));
  };

  // Primary food noun check:
  // All primary words of excludedItem must be present in candidateItem
  // (e.g. for "pois_chiches", candidate must match pois_chiches)
  const primaryMatches = exTokens.primary.every(ew =>
    candTokens.primary.some(cw => stemMatch(ew, cw))
  );

  if (!primaryMatches) return false;

  // Check color conflicts:
  // If excluded item specified a color (e.g. "Haricots rouges") and candidate has a different color (e.g. "Haricots verts"),
  // they should NOT match.
  const exColors = exTokens.descriptors.filter(d => COLOR_WORDS.has(d));
  const candColors = candTokens.descriptors.filter(d => COLOR_WORDS.has(d));
  if (exColors.length > 0 && candColors.length > 0) {
    const colorOverlap = exColors.some(ec =>
      candColors.some(cc => stemMatch(ec, cc))
    );
    if (!colorOverlap) return false;
  }

  return true;
}

function matchCustomPrice(itemName: string, customPrices: Record<string, number>): { price: number; matched: boolean } {
  const normItem = normalizeText(itemName).trim();
  if (!normItem) return { price: 2.50, matched: false };

  for (const [knownName, knownPrice] of Object.entries(customPrices)) {
    const normKnown = normalizeText(knownName).trim();
    if (normItem === normKnown) {
      return { price: Number(knownPrice), matched: true };
    }
  }

  const itemWords = getSignificantWords(itemName);
  if (itemWords.length === 0) return { price: 2.50, matched: false };
  const itemTokens = extractFoodTokens(itemName);

  const stemMatch = (a: string, b: string) => {
    if (a === b) return true;
    const aStems = getWordStems(a);
    const bStems = getWordStems(b);
    return aStems.some(s => bStems.includes(s));
  };

  for (const [knownName, knownPrice] of Object.entries(customPrices)) {
    const knownWords = getSignificantWords(knownName);
    if (knownWords.length === 0) continue;

    // Single-word match with singular/plural stemming (e.g. "oignon" matches "Filet d'oignons 1kg" or "Oignons jaunes")
    if (knownWords.length === 1) {
      if (itemWords.length === 1 && stemMatch(itemWords[0], knownWords[0])) {
        return { price: Number(knownPrice), matched: true };
      }
      if (itemTokens.primary.length === 1 && stemMatch(itemTokens.primary[0], knownWords[0])) {
        return { price: Number(knownPrice), matched: true };
      }
    }

    // Forward subset: known custom item is a multi-word component of the shopping item
    // (e.g. known "champignon de paris" matches shopping item "Boîte de champignons de Paris 400g")
    if (knownWords.length >= 2 && knownWords.every(kw => itemWords.some(iw => stemMatch(kw, iw)))) {
      return { price: Number(knownPrice), matched: true };
    }
  }

  return { price: 2.50, matched: false };
}

function enforceBudgetCeiling(shoppingList: any[], budget: number): number {
  if (shoppingList.length === 0 || budget <= 0) return 0;

  const PRICE_FLOOR = 0.20;

  // Initialize and floor all item prices to prevent zero, negative or NaN values
  shoppingList.forEach((item: any) => {
    const num = Number(item.estimatedPrice);
    item.estimatedPrice = isNaN(num) || num < PRICE_FLOOR ? PRICE_FLOOR : Number(num.toFixed(2));
  });

  let totalCost = Number(shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0).toFixed(2));
  if (totalCost <= budget) {
    return totalCost;
  }

  // 1. Proportional adjustment targeting non-user-price items first
  const excess = Number((totalCost - budget).toFixed(2));
  const nonUserReducible = shoppingList
    .filter((item: any) => !item.isUserPrice && item.estimatedPrice > PRICE_FLOOR)
    .reduce((sum: number, item: any) => sum + (item.estimatedPrice - PRICE_FLOOR), 0);

  if (nonUserReducible > 0) {
    const factor = Math.min(1.0, excess / nonUserReducible);
    shoppingList.forEach((item: any) => {
      if (!item.isUserPrice && item.estimatedPrice > PRICE_FLOOR) {
        const reducible = item.estimatedPrice - PRICE_FLOOR;
        const reduction = Number((reducible * factor).toFixed(2));
        item.estimatedPrice = Math.max(PRICE_FLOOR, Number((item.estimatedPrice - reduction).toFixed(2)));
      }
    });
    totalCost = Number(shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0).toFixed(2));
  }

  // 2. Fine-tuning loop:
  // First adjust non-user-price items. If none can be reduced further, only then adjust user-price items.
  while (totalCost > budget) {
    let pool = shoppingList.filter((item: any) => !item.isUserPrice && item.estimatedPrice > PRICE_FLOOR);
    if (pool.length === 0) {
      pool = shoppingList.filter((item: any) => item.estimatedPrice > PRICE_FLOOR);
    }
    if (pool.length === 0) {
      // All items reached floor, exit cleanly
      break;
    }

    let highestItem = pool[0];
    for (const item of pool) {
      if (item.estimatedPrice > highestItem.estimatedPrice) {
        highestItem = item;
      }
    }

    const currentExcess = Number((totalCost - budget).toFixed(2));
    const maxReduction = Number((highestItem.estimatedPrice - PRICE_FLOOR).toFixed(2));
    if (maxReduction <= 0) break;

    const step = Math.min(currentExcess, maxReduction);
    if (step <= 0) break;

    highestItem.estimatedPrice = Number((highestItem.estimatedPrice - step).toFixed(2));
    totalCost = Number(shoppingList.reduce((sum: number, item: any) => sum + item.estimatedPrice, 0).toFixed(2));
  }

  return Number(totalCost.toFixed(2));
}

function findCheckedState(itemName: string, previousList: any[]): boolean {
  const normName = normalizeText(itemName).trim();
  const direct = (previousList || []).find((p: any) => normalizeText(p.name).trim() === normName);
  if (direct) return !!direct.checked;

  const itemWords = getSignificantWords(itemName);
  if (itemWords.length === 0) return false;

  const stemMatch = (a: string, b: string) => {
    if (a === b) return true;
    const aStems = getWordStems(a);
    const bStems = getWordStems(b);
    return aStems.some(s => bStems.includes(s));
  };

  const itemSet = new Set(itemWords);

  for (const prev of (previousList || [])) {
    const prevWords = getSignificantWords(prev.name);
    if (prevWords.length === 0) continue;

    // 1. Direct word set equality (order-independent)
    const prevSet = new Set(prevWords);
    if (itemSet.size === prevSet.size && itemWords.every(w => prevSet.has(w))) {
      return !!prev.checked;
    }

    // 2. Stem-based set equality (order-independent bijection between distinct tokens)
    if (itemSet.size === prevSet.size) {
      const itemDistinct = Array.from(itemSet);
      const prevDistinct = Array.from(prevSet);
      const itemMatchesAllPrev = itemDistinct.every(iw => prevDistinct.some((pw: string) => stemMatch(iw, pw)));
      const prevMatchesAllItem = prevDistinct.every((pw: string) => itemDistinct.some(iw => stemMatch(pw, iw)));
      if (itemMatchesAllPrev && prevMatchesAllItem) {
        return !!prev.checked;
      }
    }
  }

  return false;
}

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
2. TROUVER UN REMPLAÇANT ADAPTÉ : Choisir un produit équivalent de la même famille nutritionnelle (ex: si légume exclu, remplacer par un autre légume ou légumineuse comme champignons, épinards frais - pas surgelés, carottes, poivrons, haricots rouges, pois chiches, maïs ; si viande/poisson, remplacer par œufs, thon, volaille ; si féculent, remplacer par riz ou pâtes).
3. ADAPTER LES RECETTES IMPACTÉES : Modifier les recettes concernées pour intégrer ce substitut, ajuster le titre si nécessaire, la liste des ingrédients et les étapes de préparation. Les recettes qui ne contenaient pas "${excludedItem.name}" DOIVENT RESTER STRICTEMENT IDENTIQUES. Repas simples (2-3 étapes, 15-20 min), priorité riz/pâtes, œufs/thon, oignons, bouillon cube, 45-60g protéines, sans four ni crème lourde.
4. METTRE À JOUR LA LISTE DE COURSES :
   - Retirer "${excludedItem.name}".
   - Ajouter le produit de remplacement en précisant la marque (${premierPrixBrand}), le conditionnement exact et le prix unitaire.
   - RÈGLE DU ZÉRO PRODUIT NON OUVERT : Le produit de remplacement doit impérativement être cuisiné dans les repas adaptés. Ne jamais ajouter d'ingrédient superflu non utilisé.
   - GARANTIR LE RESPECT DU BUDGET : Utiliser les produits premiers prix (${premierPrixBrand}) pour s'assurer que le coût total estimé reste STRICTEMENT inférieur ou égal à ${currentMealPlan.budget} €.
   - CONTRAINTE CONGÉLATEUR : Conserver au MAXIMUM 3 articles surgelés au total dans toute la liste de courses.
${Object.keys(customPrices).length > 0 ? `PRIX CONNUS DE L'UTILISATEUR : ${JSON.stringify(customPrices)}` : ''}

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
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `Status ${response.status}`;
            lastErr = errMsg;

            if (response.status === 503 || response.status === 429) {
              const waitTime = (attempt + 1) * 900 + Math.floor(Math.random() * 500);
              await sleep(waitTime);
              continue;
            }
            if (response.status === 404) {
              break;
            }
            if (response.status === 400 || response.status === 401 || response.status === 403) {
              if (errMsg.toLowerCase().includes('api_key') || errMsg.toLowerCase().includes('key not valid')) {
                return {
                  statusCode: response.status,
                  body: JSON.stringify({ error: errMsg }),
                };
              }
            }
            break;
          }
        } catch (e: any) {
          lastErr = e.message || 'Erreur réseau';
          if (e.message && (e.message.includes('API key') || e.message.includes('key not valid'))) {
            return {
              statusCode: 401,
              body: JSON.stringify({ error: e.message }),
            };
          }
        }
      }
      if (parsed) break;
    }

    if (!parsed) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: `Tous les modèles sont actuellement occupés ("${lastErr}"). Patiente une dizaine de secondes puis réessaie.` }),
      };
    }

    let activeRecipes: any[];
    if (!parsed.recipes || parsed.recipes.length === 0) {
      activeRecipes = currentMealPlan.recipes;
    } else if (!currentMealPlan.recipes || currentMealPlan.recipes.length === 0) {
      activeRecipes = parsed.recipes.map((r: any, idx: number) => ({
        ...r,
        id: r.id || 'recipe-' + (idx + 1) + '-' + Date.now(),
        mealIndex: r.mealIndex || idx + 1,
        equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
      }));
    } else {
      const merged = currentMealPlan.recipes.map((r: any) => ({ ...r }));
      for (const r of parsed.recipes) {
        const matchIdx = merged.findIndex(
          (m: any) => (r.id && m.id === r.id) || (r.mealIndex != null && m.mealIndex === r.mealIndex)
        );
        if (matchIdx !== -1) {
          merged[matchIdx] = {
            ...merged[matchIdx],
            ...r,
            id: r.id || merged[matchIdx].id,
            mealIndex: r.mealIndex || merged[matchIdx].mealIndex,
            equipmentUsed: r.equipmentUsed || merged[matchIdx].equipmentUsed || ['Poêle', 'Plaques'],
          };
        } else {
          merged.push({
            ...r,
            id: r.id || 'recipe-' + (merged.length + 1) + '-' + Date.now(),
            mealIndex: r.mealIndex || merged.length + 1,
            equipmentUsed: r.equipmentUsed || ['Poêle', 'Plaques'],
          });
        }
      }
      activeRecipes = merged;
    }

    const filteredList = (parsed.updatedShoppingList || []).filter((s: any) =>
      !isItemExcluded(s.name || '', excludedItem.name)
    );

    const rawPrunedList = pruneOrphanShoppingItems(filteredList, activeRecipes);
    const activePrunedList = rawPrunedList.length > 0 ? rawPrunedList : filteredList;

    const updatedShoppingList = activePrunedList.map((s: any, idx: number) => {
      const { price: customPrice, matched } = matchCustomPrice(s.name || '', customPrices);
      const finalPrice = matched ? customPrice : (Number(s.estimatedPrice) || 2.50);
      const isChecked = findCheckedState(s.name || '', currentMealPlan.shoppingList);

      return {
        id: 'shop-' + (idx + 1) + '-' + Date.now(),
        name: s.name,
        quantity: s.quantity,
        brand: s.brand,
        unitDetails: s.unitDetails,
        category: normalizeCategory(s.category),
        checked: isChecked,
        estimatedPrice: Number(finalPrice.toFixed(2)),
        isUserPrice: matched,
      };
    });

    const totalCost = enforceBudgetCeiling(updatedShoppingList, currentMealPlan.budget);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updatedRecipes: activeRecipes,
        updatedShoppingList: updatedShoppingList.length > 0 ? updatedShoppingList : currentMealPlan.shoppingList,
        estimatedTotalCost: totalCost,
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
