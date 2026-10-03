import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STOP_WORDS,
  normalizeText,
  normalizeFoodTerms,
  getSignificantWords,
  getWordStems,
  isItemUsedInRecipes,
  pruneOrphanShoppingItems,
  isItemExcluded,
  matchCustomPrice,
  enforceBudgetCeiling,
  findCheckedState,
  mergeExcludedRecipes,
  normalizeCategory,
} from '../src/lib/gemini.ts';

describe('Vegetables & Legumes Normalization and Pruning', () => {
  describe('normalizeText', () => {
    it('strips accents, diaereses and converts to lowercase', () => {
      assert.equal(normalizeText('Épinards Frais'), 'epinards frais');
      assert.equal(normalizeText('Maïs Doux'), 'mais doux');
      assert.equal(normalizeText('Carotte Râpée'), 'carotte rapee');
      assert.equal(normalizeText('Poivron Émincé'), 'poivron emince');
    });

    it('expands French ligatures œ and æ', () => {
      assert.equal(normalizeText('Œufs'), 'oeufs');
      assert.equal(normalizeText('Bœuf'), 'boeuf');
      assert.equal(normalizeText('Cœur'), 'coeur');
      assert.equal(normalizeText('Lætitia'), 'laetitia');
    });

    it('handles empty strings and falsy inputs without crashing', () => {
      assert.equal(normalizeText(''), '');
      assert.equal(normalizeText(null as any), '');
      assert.equal(normalizeText(undefined as any), '');
    });

    it('normalizes compound food terms to atomic tokens via normalizeFoodTerms', () => {
      assert.equal(normalizeFoodTerms('Pommes de terre'), 'pomme_de_terre');
      assert.equal(normalizeFoodTerms('pomme de terre'), 'pomme_de_terre');
      assert.equal(normalizeFoodTerms('Pois chiches au naturel'), 'pois_chiches au naturel');
      assert.equal(normalizeFoodTerms('pois chiche'), 'pois_chiches');
      assert.equal(normalizeFoodTerms('Lait de coco 200ml'), 'lait_de_coco 200ml');
      assert.equal(normalizeFoodTerms('Noix de coco râpée'), 'noix_de_coco râpée');
      assert.equal(normalizeFoodTerms('Beurre de cacahuète'), 'beurre_de_cacahuete');
      assert.equal(normalizeFoodTerms('beurre de cacahuetes'), 'beurre_de_cacahuete');
    });

    it('normalizeText integrates food term normalization and accent stripping', () => {
      assert.equal(normalizeText('Pommes de terre grenailles'), 'pomme_de_terre grenailles');
      assert.equal(normalizeText('Pois chiches égouttés'), 'pois_chiches egouttes');
      assert.equal(normalizeText('Beurre de cacahuètes crémeux'), 'beurre_de_cacahuete cremeux');
    });
  });

  describe('STOP_WORDS & Linguistic Stemming Helpers', () => {
    it('contains comprehensive packaging plurals, measurements, and cooking actions', () => {
      assert.ok(STOP_WORDS.has('boites'));
      assert.ok(STOP_WORDS.has('sachets'));
      assert.ok(STOP_WORDS.has('morceaux'));
      assert.ok(STOP_WORDS.has('chaud'));
      assert.ok(STOP_WORDS.has('petits'));
      assert.ok(!STOP_WORDS.has('epinards'));
      assert.ok(!STOP_WORDS.has('champignons'));
      assert.ok(!STOP_WORDS.has('carottes'));
      assert.ok(!STOP_WORDS.has('poivrons'));
      // Prepositions and articles added
      assert.ok(STOP_WORDS.has('aux'));
      assert.ok(STOP_WORDS.has('des'));
      assert.ok(STOP_WORDS.has('les'));
      assert.ok(STOP_WORDS.has('une'));
      assert.ok(STOP_WORDS.has('par'));
      assert.ok(STOP_WORDS.has('ces'));
      assert.ok(STOP_WORDS.has('ses'));
      assert.ok(STOP_WORDS.has('nos'));
      assert.ok(STOP_WORDS.has('vos'));
      // mais is a vegetable ("maïs"), must NEVER be in STOP_WORDS
      assert.ok(!STOP_WORDS.has('mais'));
    });

    it('getWordStems produces correct singular and root forms', () => {
      assert.deepEqual(getWordStems('carottes'), ['carottes', 'carotte', 'carott']);
      assert.deepEqual(getWordStems('champignons'), ['champignons', 'champignon']);
      assert.deepEqual(getWordStems('morceaux'), ['morceaux', 'morceau']);
    });

    it('getSignificantWords filters packaging noise and extracts food core words', () => {
      assert.deepEqual(getSignificantWords('Épinards frais en sachet'), ['epinards']);
      assert.deepEqual(getSignificantWords('Boîte de maïs doux 3x140g'), ['mais']);
      assert.deepEqual(getSignificantWords('Champignons de Paris émincés'), ['champignons', 'paris', 'eminces']);
    });
  });

  describe('isItemUsedInRecipes - Requested Vegetables and Legumes', () => {
    const sampleRecipes = [
      {
        id: 'r1',
        title: 'Poêlée de riz aux œufs brouillés, champignons et épinards frais',
        ingredients: [
          { name: 'Œufs', amount: '6 œufs' },
          { name: 'Riz basmati', amount: '200g' },
          { name: 'Champignons de Paris', amount: '200g' },
          { name: 'Épinards frais', amount: '150g' },
          { name: 'Oignon', amount: '1 oignon émincé' },
          { name: 'Ail', amount: '1 gousse' },
          { name: 'Bouillon cube', amount: '1/2 cube' },
        ],
        instructions: [
          'Faire dorer oignon et ail émincés.',
          'Ajouter les champignons puis faire tomber les épinards.',
          'Brouiller les œufs avec le riz.',
        ],
      },
      {
        id: 'r2',
        title: 'Poêlée mexicaine thon, haricots rouges et maïs doux',
        ingredients: [
          { name: 'Thon au naturel', amount: '2 boîtes' },
          { name: 'Haricots rouges', amount: '1 boîte 400g' },
          { name: 'Maïs', amount: '1 boîte 280g' },
          { name: 'Coulis de tomate', amount: '200g' },
          { name: 'Poivron rouge', amount: '1 poivron' },
        ],
        instructions: [
          'Poêler les lanières de poivron avec oignon doré.',
          'Ajouter les haricots rouges égouttés, le maïs et le coulis de tomate.',
          'Incorporer le thon émietté.',
        ],
      },
      {
        id: 'r3',
        title: 'Pâtes sautées aux pois chiches dorés et carottes râpées',
        ingredients: [
          { name: 'Pâtes penne', amount: '250g' },
          { name: 'Pois chiches', amount: '1 boîte 400g' },
          { name: 'Carottes', amount: '2 carottes râpées' },
        ],
        instructions: [
          'Faire dorer les pois chiches à la poêle avec paprika et carottes râpées.',
          'Mélanger aux pâtes cuites.',
        ],
      },
    ];

    const recipesNormText = normalizeText(
      sampleRecipes
        .map(
          r =>
            `${r.title} ${r.ingredients.map(i => i.name).join(' ')} ${r.instructions.join(' ')}`
        )
        .join(' ')
    );

    it('matches Champignons de Paris across singular/plural and packaging words', () => {
      assert.ok(isItemUsedInRecipes('Champignons de Paris émincés', recipesNormText));
      assert.ok(isItemUsedInRecipes('Boîte de champignons 400g', recipesNormText));
      assert.ok(isItemUsedInRecipes('Champignon frais', recipesNormText));
    });

    it('matches Épinards frais (even with accents, sachet packaging, singular)', () => {
      assert.ok(isItemUsedInRecipes('Épinards frais en sachet', recipesNormText));
      assert.ok(isItemUsedInRecipes('Epinards frais 500g', recipesNormText));
      assert.ok(isItemUsedInRecipes('Sachet epinard frais', recipesNormText));
    });

    it('matches Pois chiches (bocal, boîte, singulier)', () => {
      assert.ok(isItemUsedInRecipes('Pois chiches au naturel', recipesNormText));
      assert.ok(isItemUsedInRecipes('Boîte de pois chiche 400g', recipesNormText));
      assert.ok(isItemUsedInRecipes('Bocal de pois chiches Eco+', recipesNormText));
    });

    it('matches Maïs doux (with or without diaeresis)', () => {
      assert.ok(isItemUsedInRecipes('Boîte de maïs doux', recipesNormText));
      assert.ok(isItemUsedInRecipes('Mais doux en boîte', recipesNormText));
      assert.ok(isItemUsedInRecipes('Pack 3 boites de mais', recipesNormText));
    });

    it('matches Haricots rouges', () => {
      assert.ok(isItemUsedInRecipes('Boîte de haricots rouges', recipesNormText));
      assert.ok(isItemUsedInRecipes('Haricot rouge au naturel', recipesNormText));
      assert.ok(isItemUsedInRecipes('Conserve de haricots rouges premier prix', recipesNormText));
    });

    it('matches Carottes (râpées, filet 1kg, rondelles)', () => {
      assert.ok(isItemUsedInRecipes('Filet de carottes 1kg', recipesNormText));
      assert.ok(isItemUsedInRecipes('Carottes râpées', recipesNormText));
      assert.ok(isItemUsedInRecipes('Carotte en rondelles', recipesNormText));
    });

    it('matches Poivrons (poêlés, tricolores, rouge)', () => {
      assert.ok(isItemUsedInRecipes('Poivrons tricolores', recipesNormText));
      assert.ok(isItemUsedInRecipes('Poivron rouge', recipesNormText));
      assert.ok(isItemUsedInRecipes('Lot de 3 poivrons', recipesNormText));
    });

    it('matches Oignons dorés et Ail', () => {
      assert.ok(isItemUsedInRecipes("Filet d'oignons jaunes 1kg", recipesNormText));
      assert.ok(isItemUsedInRecipes('Oignons de cuisine', recipesNormText));
      assert.ok(isItemUsedInRecipes("Tête d'ail", recipesNormText));
      assert.ok(isItemUsedInRecipes('Ail blanc', recipesNormText));
    });

    it('matches Œufs (handling ligature œ vs oe) and Thon', () => {
      assert.ok(isItemUsedInRecipes('Boîte de 12 œufs plein air', recipesNormText));
      assert.ok(isItemUsedInRecipes('Oeufs frais calibre moyen', recipesNormText));
      assert.ok(isItemUsedInRecipes('Thon au naturel 3x140g', recipesNormText));
    });

    it('prunes genuine orphan items not present in any recipe', () => {
      assert.equal(isItemUsedInRecipes('Avocat mûr à point', recipesNormText), false);
      assert.equal(isItemUsedInRecipes('Tablette de chocolat noir', recipesNormText), false);
      assert.equal(isItemUsedInRecipes('Filet de saumon frais', recipesNormText), false);
      assert.equal(isItemUsedInRecipes('Fromage à raclette', recipesNormText), false);
      assert.equal(isItemUsedInRecipes('Courgettes longues', recipesNormText), false);
    });

    it('prevents substring collisions (ail vs volaille, pois vs poisson, eau vs veau)', () => {
      const fishOnlyRecipes = [
        {
          title: 'Filet de poisson blanc à la poêle avec du riz',
          ingredients: [
            { name: 'Poisson blanc', amount: '400g' },
            { name: 'Riz', amount: '200g' },
          ],
          instructions: ['Cuire le poisson à la poêle.'],
        },
      ];
      // "Pois" must NOT match "Poisson"
      assert.equal(isItemUsedInRecipes('Boîte de pois chiches', fishOnlyRecipes), false);

      const poultryOnlyRecipes = [
        {
          title: 'Blanc de volaille et pâtes',
          ingredients: [
            { name: 'Blanc de volaille', amount: '300g' },
            { name: 'Pâtes', amount: '200g' },
          ],
          instructions: ['Dorer la volaille à la poêle.'],
        },
      ];
      // "Ail" must NOT match "Volaille"
      assert.equal(isItemUsedInRecipes("Tête d'ail", poultryOnlyRecipes), false);

      const vealOnlyRecipes = [
        {
          title: 'Morceau de veau sauté',
          ingredients: [{ name: 'Veau', amount: '300g' }],
          instructions: ['Couper en morceaux et dorer.'],
        },
      ];
      // "Eau" must NOT match "Veau" or "Morceau"
      assert.equal(isItemUsedInRecipes('Bouteille d eau minérale', vealOnlyRecipes), false);
    });

    it('handles plural and feminine stop words without falsely keeping orphans', () => {
      const omeletteRecipe = [
        {
          title: 'Omelette au thon',
          ingredients: [
            { name: 'Œufs', amount: '6' },
            { name: 'Thon', amount: '1 boîte' },
          ],
          instructions: ['Ouvrir la boîte de thon et mélanger aux œufs.', 'Servir chaud.'],
        },
      ];

      // "Boîtes de chocolats" must be pruned even if recipe mentions "boîte"
      assert.equal(isItemUsedInRecipes('Boîtes de chocolats', omeletteRecipe), false);

      // "Morceaux de sucre" must be pruned even if instructions mention cooking cuts
      assert.equal(isItemUsedInRecipes('Morceaux de sucre', omeletteRecipe), false);

      // "Petits gâteaux secs" must be pruned
      assert.equal(isItemUsedInRecipes('Petits gâteaux secs', omeletteRecipe), false);

      // "Chocolat chaud" must be pruned even if instruction says "Servir chaud"
      assert.equal(isItemUsedInRecipes('Chocolat chaud', omeletteRecipe), false);
    });

    it('prunes orphan "Boîte de maïs" when instructions only contain the conjunction "mais" without diacritic', () => {
      const conjunctionRecipe = [
        {
          title: 'Poêlée de poulet et riz',
          ingredients: [
            { name: 'Poulet', amount: '200g' },
            { name: 'Riz', amount: '150g' },
          ],
          instructions: [
            'Dorer à feu moyen, mais sans brûler les sucs de cuisson.',
            'Ajouter le riz et mélanger.',
          ],
        },
      ];

      // "Boîte de maïs" must be pruned because "mais" in instruction is a conjunction
      assert.equal(isItemUsedInRecipes('Boîte de maïs', conjunctionRecipe), false);
      assert.equal(isItemUsedInRecipes('Boîte de maïs doux', conjunctionRecipe), false);

      const diacriticRecipe = [
        {
          title: 'Poêlée de poulet et riz',
          ingredients: [
            { name: 'Poulet', amount: '200g' },
            { name: 'Riz', amount: '150g' },
          ],
          instructions: [
            'Ajouter le maïs égoutté dans la poêle et bien mélanger.',
          ],
        },
      ];

      // "Boîte de maïs" must be kept because instruction explicitly contains diacritic "maïs"
      assert.equal(isItemUsedInRecipes('Boîte de maïs', diacriticRecipe), true);
      assert.equal(isItemUsedInRecipes('Boîte de maïs doux', diacriticRecipe), true);

      const ingredientRecipe = [
        {
          title: 'Salade de thon au maïs',
          ingredients: [
            { name: 'Thon', amount: '1 boîte' },
            { name: 'Maïs', amount: '1 boîte' },
          ],
          instructions: ['Mélanger.'],
        },
      ];

      // "Boîte de maïs" must be kept because title & ingredients contain maïs
      assert.equal(isItemUsedInRecipes('Boîte de maïs doux', ingredientRecipe), true);
    });

    it('prunes items when only generic descriptors or preparation methods overlap', () => {
      // "Champignons de Paris" must NOT be kept by "Jambon de Paris"
      const parisHamRecipe = [{
        title: 'Coquillettes au jambon de Paris',
        ingredients: [{ name: 'Jambon de Paris', amount: '4 tranches' }],
        instructions: ['Couper le jambon et mélanger aux coquillettes.'],
      }];
      assert.equal(isItemUsedInRecipes('Champignons de Paris émincés', parisHamRecipe), false);

      // "Haricots rouges" must NOT be kept by "Poivrons rouges"
      const redPepperRecipe = [{
        title: 'Poêlée de poivrons rouges',
        ingredients: [{ name: 'Poivrons rouges', amount: '2' }],
        instructions: ['Faire revenir les poivrons rouges.'],
      }];
      assert.equal(isItemUsedInRecipes('Boîte de haricots rouges', redPepperRecipe), false);

      // "Poisson blanc" must NOT be kept by "Riz blanc"
      const whiteRiceRecipe = [{
        title: 'Bol de riz blanc aux œufs',
        ingredients: [{ name: 'Riz blanc', amount: '200g' }, { name: 'Œufs', amount: '2' }],
        instructions: ['Cuire le riz blanc.'],
      }];
      assert.equal(isItemUsedInRecipes('Filet de poisson blanc', whiteRiceRecipe), false);

      // "Carottes râpées" must NOT be kept by "Gruyère râpé"
      const gratedCheeseRecipe = [{
        title: 'Gratin de pâtes au gruyère râpé',
        ingredients: [{ name: 'Gruyère râpé', amount: '100g' }],
        instructions: ['Saupoudrer de gruyère râpé.'],
      }];
      assert.equal(isItemUsedInRecipes('Barquette de carottes râpées', gratedCheeseRecipe), false);

      // "Poulet émincé" must NOT be kept by "Oignons émincés"
      const mincedOnionRecipe = [{
        title: 'Omelette aux oignons émincés',
        ingredients: [{ name: 'Oignons émincés', amount: '2' }],
        instructions: ['Faire dorer les oignons émincés.'],
      }];
      assert.equal(isItemUsedInRecipes('Filets de poulet émincés', mincedOnionRecipe), false);

      // "Épinards en branches" must NOT be kept by "Céleri branche"
      const celeryRecipe = [{
        title: 'Soupe au céleri branche',
        ingredients: [{ name: 'Céleri branche', amount: '2 branches' }],
        instructions: ['Couper le céleri en morceaux.'],
      }];
      assert.equal(isItemUsedInRecipes('Épinards en branches', celeryRecipe), false);
    });
  });

  describe('pruneOrphanShoppingItems', () => {
    const recipes = [
      {
        id: 'r1',
        title: 'Omelette aux champignons et épinards frais',
        ingredients: [
          { name: 'Œufs', amount: '6' },
          { name: 'Champignons', amount: '200g' },
          { name: 'Épinards frais', amount: '150g' },
          { name: 'Oignon', amount: '1' },
        ],
        instructions: ['Dorer oignons et champignons, ajouter épinards, verser les œufs.'],
      },
    ];

    it('filters out orphan items while keeping all ingredients used in recipes', () => {
      const shoppingList = [
        { name: 'Boîte de 10 œufs', estimatedPrice: 2.5 },
        { name: 'Champignons de Paris', estimatedPrice: 1.2 },
        { name: 'Épinards frais en sachet', estimatedPrice: 1.7 },
        { name: 'Filet d oignons 1kg', estimatedPrice: 1.3 },
        { name: 'Tablette de chocolat noir dessert', estimatedPrice: 1.5 },
        { name: 'Paquet de biscuits sablés', estimatedPrice: 1.8 },
      ];

      const pruned = pruneOrphanShoppingItems(shoppingList, recipes);

      assert.equal(pruned.length, 4);
      assert.deepEqual(
        pruned.map(i => i.name),
        [
          'Boîte de 10 œufs',
          'Champignons de Paris',
          'Épinards frais en sachet',
          'Filet d oignons 1kg',
        ]
      );
    });

    it('falls back to original shoppingList if all items would be pruned', () => {
      const shoppingList = [
        { name: 'Produit Inconnu A', estimatedPrice: 3.0 },
        { name: 'Produit Inconnu B', estimatedPrice: 2.0 },
      ];

      const pruned = pruneOrphanShoppingItems(shoppingList, []);
      assert.equal(pruned.length, 2);
    });
  });

  describe('isItemExcluded', () => {
    it('accurately identifies excluded items across variations of packaging and wording', () => {
      assert.equal(
        isItemExcluded('Épinards en branche', 'Épinards frais en sachet'),
        true
      );
      assert.equal(
        isItemExcluded('Sachet d épinards 500g', 'Épinards frais en sachet'),
        true
      );
      assert.equal(
        isItemExcluded('Champignons de Paris émincés', 'Champignons de Paris'),
        true
      );
      assert.equal(
        isItemExcluded('Boîte de maïs doux 3x140g', 'Maïs doux'),
        true
      );
    });

    it('does NOT falsely exclude unrelated ingredients', () => {
      assert.equal(
        isItemExcluded('Carottes râpées', 'Champignons de Paris'),
        false
      );
      assert.equal(
        isItemExcluded('Haricots rouges', 'Pois chiches'),
        false
      );
      assert.equal(
        isItemExcluded('Riz basmati', 'Pâtes penne'),
        false
      );
      // Disjunctive adjectives & descriptors: must NOT over-exclude
      assert.equal(
        isItemExcluded('Jambon de Paris', 'Champignons de Paris'),
        false
      );
      assert.equal(
        isItemExcluded('Champignons de Paris', 'Jambon de Paris'),
        false
      );
      assert.equal(
        isItemExcluded('Haricots rouges', 'Poivrons rouges'),
        false
      );
      assert.equal(
        isItemExcluded('Poivrons rouges', 'Haricots rouges'),
        false
      );
      assert.equal(
        isItemExcluded('Haricots verts', 'Haricots rouges'),
        false
      );
      assert.equal(
        isItemExcluded('Poisson blanc', 'Riz blanc'),
        false
      );
    });

    it('does NOT falsely cross-exclude compound culinary foods with generic foods', () => {
      // Pommes de terre vs Pommes
      assert.equal(isItemExcluded('Pommes de terre grenailles', 'Pommes'), false);
      assert.equal(isItemExcluded('Pommes golden', 'Pommes de terre'), false);

      // Beurre de cacahuète vs Beurre
      assert.equal(isItemExcluded('Beurre de cacahuète', 'Beurre doux'), false);
      assert.equal(isItemExcluded('Plaquette de beurre', 'Beurre de cacahuète'), false);

      // Lait de coco vs Lait
      assert.equal(isItemExcluded('Brique de lait de coco', 'Bouteille de lait demi-écrémé'), false);
      assert.equal(isItemExcluded('Bouteille de lait demi-écrémé', 'Lait de coco'), false);

      // Noix de coco vs Noix
      assert.equal(isItemExcluded('Noix de coco râpée', 'Sachet de cerneaux de noix'), false);
      assert.equal(isItemExcluded('Sachet de cerneaux de noix', 'Noix de coco'), false);

      // Pois chiches vs Petits pois
      assert.equal(isItemExcluded('Boîte de pois chiches', 'Petits pois'), false);
      assert.equal(isItemExcluded('Boîte de petits pois', 'Pois chiches'), false);
    });
  });

  describe('matchCustomPrice', () => {
    const customPrices = {
      'galettes de riz chocolat': 3.20,
      'poelee de champignons et riz': 4.50,
      'champignons de paris': 1.15,
      'mais doux': 0.95,
      'oeufs de plein air': 2.65,
      'salade de riz blanc traiteur': 4.90,
    };

    it('avoids false positive price overwrites on generic items', () => {
      // Plain rice must not match "galettes de riz chocolat" (3.20€)
      const riceMatch = matchCustomPrice('Riz basmati 1kg', customPrices);
      assert.equal(riceMatch.matched, false);

      // Plain rice must NOT match composite dish "salade de riz blanc traiteur" (reverse subset branch removed)
      const plainRiceMatch = matchCustomPrice('Riz blanc 1kg', customPrices);
      assert.equal(plainRiceMatch.matched, false);

      // Plain mushrooms must not match composed dish "poelee de champignons et riz" (4.50€)
      // but MUST match "champignons de paris" (1.15€)
      const mushroomMatch = matchCustomPrice('Boîte de champignons de Paris 400g', customPrices);
      assert.equal(mushroomMatch.matched, true);
      assert.equal(mushroomMatch.price, 1.15);
    });

    it('matches custom price across diacritics and ligatures', () => {
      const cornMatch = matchCustomPrice('Maïs doux en boîte', customPrices);
      assert.equal(cornMatch.matched, true);
      assert.equal(cornMatch.price, 0.95);

      const eggMatch = matchCustomPrice('Boîte de 12 œufs de plein air', customPrices);
      assert.equal(eggMatch.matched, true);
      assert.equal(eggMatch.price, 2.65);
    });

    it('matches custom prices across singular and plural stems', () => {
      const prices = {
        'oignon': 1.10,
        'carotte': 1.25,
        'champignon de paris': 1.15,
      };

      // "Filet d'oignons 1kg" should match single-word known "oignon"
      const onionMatch = matchCustomPrice("Filet d'oignons 1kg", prices);
      assert.equal(onionMatch.matched, true);
      assert.equal(onionMatch.price, 1.10);

      // "Botte de carottes" should match single-word known "carotte"
      const carrotMatch = matchCustomPrice('Botte de carottes', prices);
      assert.equal(carrotMatch.matched, true);
      assert.equal(carrotMatch.price, 1.25);

      // Multi-word stem subset: "Boîte de champignons de Paris 400g" should match "champignon de paris"
      const mushroomMatch = matchCustomPrice('Boîte de champignons de Paris 400g', prices);
      assert.equal(mushroomMatch.matched, true);
      assert.equal(mushroomMatch.price, 1.15);
    });
  });

  describe('enforceBudgetCeiling', () => {
    it('strictly guarantees that the sum of shopping items does not exceed budget', () => {
      const budget = 50.0;
      const items = Array.from({ length: 15 }, (_, i) => ({
        id: `s-${i}`,
        name: `Article ${i}`,
        quantity: '1',
        category: 'Épicerie & Féculents' as const,
        checked: false,
        estimatedPrice: 4.50, // 15 * 4.50 = 67.50€
      }));

      const totalCost = enforceBudgetCeiling(items, budget);
      const exactSum = Number(items.reduce((sum, item) => sum + item.estimatedPrice, 0).toFixed(2));

      assert.ok(totalCost <= budget, `Total cost ${totalCost} exceeds budget ${budget}`);
      assert.equal(totalCost, exactSum);
    });

    it('protects items with isUserPrice === true from reduction when other items can absorb the excess', () => {
      const budget = 12.0;
      const items = [
        {
          id: 's-1',
          name: 'Œufs frais de la ferme',
          quantity: '1',
          category: 'Crémerie & Œufs' as const,
          checked: false,
          estimatedPrice: 3.50,
          isUserPrice: true, // Verified by user! Must be protected
        },
        {
          id: 's-2',
          name: 'Riz basmati 1kg',
          quantity: '1',
          category: 'Épicerie & Féculents' as const,
          checked: false,
          estimatedPrice: 6.00,
          isUserPrice: false,
        },
        {
          id: 's-3',
          name: 'Pâtes penne 1kg',
          quantity: '1',
          category: 'Épicerie & Féculents' as const,
          checked: false,
          estimatedPrice: 6.00,
          isUserPrice: false,
        },
      ]; // Sum = 15.50€ > 12.00€

      const totalCost = enforceBudgetCeiling(items, budget);

      assert.ok(totalCost <= budget, `Total cost ${totalCost} exceeds budget ${budget}`);
      // User verified price must remain exactly 3.50€
      assert.equal(items[0].estimatedPrice, 3.50, 'Verified user price was improperly reduced');
      // Other items absorbed the reduction
      assert.ok(items[1].estimatedPrice < 6.00);
      assert.ok(items[2].estimatedPrice < 6.00);
    });

    it('never drops prices below 0.20€ floor and exits cleanly when all items reach floor', () => {
      const extremeBudget = 0.50;
      const items = [
        {
          id: 's-1',
          name: 'Ail',
          quantity: '1',
          category: 'Condiments & Autres' as const,
          checked: false,
          estimatedPrice: 0.35,
        },
        {
          id: 's-2',
          name: 'Oignon',
          quantity: '1',
          category: 'Fruits & Légumes' as const,
          checked: false,
          estimatedPrice: 0.40,
        },
      ]; // Minimum possible sum with floor is 0.20 + 0.20 = 0.40€

      const totalCost = enforceBudgetCeiling(items, extremeBudget);

      items.forEach(item => {
        assert.ok(item.estimatedPrice >= 0.20, `Item ${item.name} dropped below 0.20€ floor: ${item.estimatedPrice}`);
      });
      assert.ok(totalCost >= 0.40);
    });

    it('floors zero, negative, and NaN initial prices to 0.20€ before applying budget', () => {
      const items = [
        {
          id: 's-1',
          name: 'Sel fin',
          quantity: '1',
          category: 'Condiments & Autres' as const,
          checked: false,
          estimatedPrice: 0, // Zero price from bad AI response
        },
        {
          id: 's-2',
          name: 'Poivre',
          quantity: '1',
          category: 'Condiments & Autres' as const,
          checked: false,
          estimatedPrice: -2.5, // Negative price
        },
        {
          id: 's-3',
          name: 'Bouillon cube',
          quantity: '1',
          category: 'Condiments & Autres' as const,
          checked: false,
          estimatedPrice: NaN, // Invalid number
        },
        {
          id: 's-4',
          name: 'Riz 1kg',
          quantity: '1',
          category: 'Épicerie & Féculents' as const,
          checked: false,
          estimatedPrice: 3.0,
        },
      ];

      const budget = 10.0;
      const totalCost = enforceBudgetCeiling(items, budget);

      assert.equal(items[0].estimatedPrice, 0.20);
      assert.equal(items[1].estimatedPrice, 0.20);
      assert.equal(items[2].estimatedPrice, 0.20);
      assert.equal(items[3].estimatedPrice, 3.00);
      assert.equal(totalCost, 3.60);
    });
  });

  describe('findCheckedState', () => {
    it('preserves checked state even across diacritics and casing differences', () => {
      const previousList = [
        {
          id: '1',
          name: 'Épinards frais en sachet',
          quantity: '400g',
          category: 'Fruits & Légumes' as const,
          checked: true,
          estimatedPrice: 1.70,
        },
        {
          id: '2',
          name: 'Boîte de 12 œufs',
          quantity: '12',
          category: 'Crémerie & Œufs' as const,
          checked: false,
          estimatedPrice: 2.70,
        },
      ];

      assert.equal(findCheckedState('Epinards frais en sachet', previousList), true);
      assert.equal(findCheckedState('Oeufs de poules', previousList), false);
    });

    it('matches checked items regardless of word order (word-order independence)', () => {
      const previousList = [
        {
          id: '1',
          name: 'Émincés de champignons de Paris',
          quantity: '400g',
          category: 'Fruits & Légumes' as const,
          checked: true,
          estimatedPrice: 1.20,
        },
        {
          id: '2',
          name: 'Poêlés de poivrons rouges',
          quantity: '3',
          category: 'Fruits & Légumes' as const,
          checked: true,
          estimatedPrice: 2.10,
        },
      ];

      assert.equal(findCheckedState('Champignons de Paris émincés', previousList), true);
      assert.equal(findCheckedState('Poivrons rouges poêlés', previousList), true);
    });

    it('rejects duplicate-token collision bypass between different ingredient sets', () => {
      // Previous list had a duplicated word "Riz riz" checked
      const previousList = [
        {
          id: '1',
          name: 'Riz riz',
          quantity: '500g',
          category: 'Épicerie & Féculents' as const,
          checked: true,
          estimatedPrice: 1.50,
        },
      ];

      // New shopping list has "Riz thon" (two distinct words)
      // Old flawed check would see all previous words ("riz") matched in candidate, falsely checking "Riz thon"
      assert.equal(findCheckedState('Riz thon', previousList), false);

      // Exact match for "Riz riz" still matches
      assert.equal(findCheckedState('Riz riz', previousList), true);
    });

    it('matches stem-based bijection with differing word counts or plurals correctly', () => {
      const previousList = [
        {
          id: '1',
          name: 'Filet oignons doux',
          quantity: '1kg',
          category: 'Fruits & Légumes' as const,
          checked: true,
          estimatedPrice: 1.80,
        },
      ];

      // "Oignon doux" has significant words ['oignon', 'doux'] (filet is stop word)
      // Previous significant words ['oignons', 'doux']
      assert.equal(findCheckedState('Oignon doux', previousList), true);
      assert.equal(findCheckedState('Oignons doux', previousList), true);
    });
  });

  describe('mergeExcludedRecipes - Recipe Loss Prevention', () => {
    it('merges modified recipes into full meal plan preserving unaffected recipes', () => {
      const currentRecipes = [
        { id: 'r1', mealIndex: 1, title: 'Omelette aux champignons', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 50, calories: 600, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r2', mealIndex: 2, title: 'Pâtes au thon et brocolis', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 52, calories: 650, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r3', mealIndex: 3, title: 'Riz sauté aux œufs', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 48, calories: 620, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r4', mealIndex: 4, title: 'Poêlée mexicaine haricots rouges', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 55, calories: 700, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r5', mealIndex: 5, title: 'Pois chiches épicés et riz', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 46, calories: 580, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r6', mealIndex: 6, title: 'Poulet sauté aux poivrons', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 58, calories: 680, ingredients: [], instructions: [], equipmentUsed: [] },
        { id: 'r7', mealIndex: 7, title: 'Salade de thon, maïs et carottes', prepTimeMinutes: 10, cookTimeMinutes: 15, proteinGrams: 50, calories: 610, ingredients: [], instructions: [], equipmentUsed: [] },
      ];

      // Gemini only returns the 1 modified recipe where brocolis was replaced
      const geminiReturnedOnlyModified = [
        {
          id: 'r2',
          mealIndex: 2,
          title: 'Pâtes au thon et épinards frais',
          prepTimeMinutes: 10,
          cookTimeMinutes: 15,
          proteinGrams: 52,
          calories: 640,
          ingredients: [{ name: 'Épinards frais', amount: '150g' }],
          instructions: ['Faire tomber les épinards.'],
        },
      ];

      const merged = mergeExcludedRecipes(currentRecipes, geminiReturnedOnlyModified);

      // Must NOT be truncated to 1 recipe! Must retain all 7 recipes
      assert.equal(merged.length, 7);
      assert.equal(merged[0].title, 'Omelette aux champignons');
      assert.equal(merged[1].title, 'Pâtes au thon et épinards frais'); // Updated!
      assert.equal(merged[2].title, 'Riz sauté aux œufs');
      assert.equal(merged[3].title, 'Poêlée mexicaine haricots rouges');
      assert.equal(merged[4].title, 'Pois chiches épicés et riz');
      assert.equal(merged[5].title, 'Poulet sauté aux poivrons');
      assert.equal(merged[6].title, 'Salade de thon, maïs et carottes');
    });
  });

  describe('normalizeCategory - Unrecognized Category Fallback & Robust Mapping', () => {
    it('normalizes standard categories', () => {
      assert.equal(normalizeCategory('Boucherie & Poissonnerie'), 'Boucherie & Poissonnerie');
      assert.equal(normalizeCategory('Crémerie & Œufs'), 'Crémerie & Œufs');
      assert.equal(normalizeCategory('Fruits & Légumes'), 'Fruits & Légumes');
      assert.equal(normalizeCategory('Épicerie & Féculents'), 'Épicerie & Féculents');
      assert.equal(normalizeCategory('Condiments & Autres'), 'Condiments & Autres');
    });

    it('maps variant and descriptive category labels into canonical categories', () => {
      assert.equal(normalizeCategory('Légumes frais'), 'Fruits & Légumes');
      assert.equal(normalizeCategory('Rayon fruits et légumes'), 'Fruits & Légumes');
      assert.equal(normalizeCategory('Viandes et volailles'), 'Boucherie & Poissonnerie');
      assert.equal(normalizeCategory('Poissonnerie fraîche'), 'Boucherie & Poissonnerie');
      assert.equal(normalizeCategory('Œufs et produits laitiers'), 'Crémerie & Œufs');
      assert.equal(normalizeCategory('Fromages et crèmerie'), 'Crémerie & Œufs');
      assert.equal(normalizeCategory('Pâtes et riz'), 'Épicerie & Féculents');
      assert.equal(normalizeCategory('Conserves et épicerie sèche'), 'Épicerie & Féculents');
    });

    it('falls back safely to "Condiments & Autres" for missing or unknown categories so items never disappear', () => {
      assert.equal(normalizeCategory(undefined), 'Condiments & Autres');
      assert.equal(normalizeCategory(''), 'Condiments & Autres');
      assert.equal(normalizeCategory('   '), 'Condiments & Autres');
      assert.equal(normalizeCategory('Boissons gazeuses'), 'Condiments & Autres');
      assert.equal(normalizeCategory('Bazar & Textile'), 'Condiments & Autres');
      assert.equal(normalizeCategory('Hygiène'), 'Condiments & Autres');
    });
  });
});
