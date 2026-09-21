import React, { useState } from 'react';
import type { Supermarket, SavedMeal } from '../types';
import { Sparkles, Store, Users, Calendar, DollarSign, Dumbbell, UtensilsCrossed, CheckCircle2, ChevronRight, Info } from 'lucide-react';

interface GeneratorFormProps {
  onGenerate: (params: {
    numberOfDays: number;
    totalMeals: number;
    numberOfPeople: number;
    supermarket: Supermarket;
    budget: number;
  }) => Promise<void>;
  isLoading: boolean;
  savedRecipes: SavedMeal[];
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const GeneratorForm: React.FC<GeneratorFormProps> = ({
  onGenerate,
  isLoading,
  savedRecipes,
  onOpenSettings,
  hasApiKey,
}) => {
  const [numberOfDays, setNumberOfDays] = useState<number>(7);
  const [totalMeals, setTotalMeals] = useState<number>(7);
  const [numberOfPeople, setNumberOfPeople] = useState<number>(2);
  const [supermarket, setSupermarket] = useState<Supermarket>('E.Leclerc');
  const [budget, setBudget] = useState<number>(70);

  const supermarkets: { name: Supermarket; desc: string }[] = [
    { name: 'E.Leclerc', desc: 'Prix bas & marques repère' },
    { name: 'Intermarché', desc: 'Producteurs & marques propres' },
    { name: 'Auchan', desc: 'Grand choix & formats familiaux' },
  ];

  const costPerPortion = (budget / (totalMeals * numberOfPeople)).toFixed(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      numberOfDays,
      totalMeals,
      numberOfPeople,
      supermarket,
      budget,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 p-4 border border-zinc-800/80 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
              <Dumbbell className="w-3.5 h-3.5" /> Prise de muscle (Athlète 84 kg)
            </span>
            <h2 className="text-lg font-black text-white tracking-tight">
              Prépare ton menu de coloc
            </h2>
            <p className="text-xs text-zinc-400">
              45g à 65g de protéines réelles par repas, économique et 100% sans four.
            </p>
          </div>
        </div>

        {/* Nutrition Highlights */}
        <div className="mt-3 pt-3 border-t border-zinc-800/60 grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-semibold text-emerald-300">45g - 65g prot / portion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Plaques, poêle, casserole</span>
          </div>
        </div>
      </div>

      {/* 1. Nombre de jours */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          Période (jours)
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {[3, 4, 5, 7, 10].map(days => (
            <button
              type="button"
              key={days}
              onClick={() => {
                setNumberOfDays(days);
                // Adjust default meals if needed
                if (totalMeals < days) setTotalMeals(days);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                numberOfDays === days
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
              }`}
            >
              {days} jours
            </button>
          ))}
        </div>
      </div>

      {/* 2. Nombre TOTAL de repas à générer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
            Nombre total de repas
          </label>
          <span className="text-[11px] text-zinc-400">
            Ex: {totalMeals} repas sur {numberOfDays} jours
          </span>
        </div>

        {/* Stepper + Presets */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl px-2 py-1.5 flex-1">
            <button
              type="button"
              disabled={totalMeals <= 1}
              onClick={() => setTotalMeals(m => Math.max(1, m - 1))}
              className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold active:scale-90 transition-all disabled:opacity-30"
            >
              -
            </button>
            <div className="text-center">
              <span className="text-base font-black text-white">{totalMeals}</span>
              <span className="text-xs text-zinc-400 ml-1">repas au total</span>
            </div>
            <button
              type="button"
              disabled={totalMeals >= 21}
              onClick={() => setTotalMeals(m => Math.min(21, m + 1))}
              className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold active:scale-90 transition-all disabled:opacity-30"
            >
              +
            </button>
          </div>

          <div className="flex gap-1">
            {[7, 10, 12, 14].map(preset => (
              <button
                type="button"
                key={preset}
                onClick={() => setTotalMeals(preset)}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  totalMeals === preset
                    ? 'bg-zinc-800 text-emerald-400 border-emerald-500/50'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Nombre de personnes */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          Mangeurs par repas
        </label>
        <div className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800/80 rounded-xl px-3 py-2">
          <button
            type="button"
            disabled={numberOfPeople <= 1}
            onClick={() => setNumberOfPeople(p => Math.max(1, p - 1))}
            className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold active:scale-90 transition-all disabled:opacity-30"
          >
            -
          </button>
          <div className="text-center">
            <span className="text-sm font-bold text-white">
              {numberOfPeople} {numberOfPeople > 1 ? 'personnes (portions doubles)' : 'personne'}
            </span>
          </div>
          <button
            type="button"
            disabled={numberOfPeople >= 6}
            onClick={() => setNumberOfPeople(p => Math.min(6, p + 1))}
            className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold active:scale-90 transition-all disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {/* 4. Choix du supermarché */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-emerald-400" />
          Supermarché pour les courses
        </label>
        <div className="grid grid-cols-3 gap-2">
          {supermarkets.map(market => {
            const isSelected = supermarket === market.name;
            return (
              <button
                type="button"
                key={market.name}
                onClick={() => setSupermarket(market.name)}
                className={`p-3 rounded-xl text-left transition-all relative border ${
                  isSelected
                    ? 'bg-zinc-900 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{market.name}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-zinc-400 line-clamp-1 leading-tight">{market.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Budget total */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Budget total courses
          </label>
          <div className="flex items-baseline gap-1 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
            <span className="text-base font-extrabold text-emerald-400">{budget}</span>
            <span className="text-xs text-zinc-400 font-semibold">€</span>
          </div>
        </div>

        <div className="space-y-1">
          <input
            type="range"
            min="25"
            max="200"
            step="5"
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-medium px-1">
            <span>25 €</span>
            <span>70 €</span>
            <span>115 €</span>
            <span>160 €</span>
            <span>200 €</span>
          </div>
        </div>

        {/* Budget calculation summary */}
        <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between text-xs">
          <div className="text-zinc-400">
            <span className="text-zinc-200 font-medium">{totalMeals} repas</span> × {numberOfPeople} portions
          </div>
          <div className="text-right">
            <span className="text-emerald-400 font-bold">{costPerPortion} €</span>{' '}
            <span className="text-[11px] text-zinc-400">/ portion</span>
          </div>
        </div>
      </div>

      {/* Favoris intégrés notice */}
      {savedRecipes.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-center gap-2.5 text-xs text-emerald-300">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <p>
            <span className="font-semibold">{savedRecipes.length} recette(s) enregistrée(s)</span> seront priorisées dans la génération.
          </p>
        </div>
      )}

      {/* Missing API Key Warning if needed */}
      {!hasApiKey && (
        <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-800/40 flex items-center justify-between text-xs text-amber-300">
          <div>
            <p className="font-semibold">Clé Gemini manquante</p>
            <p className="text-[11px] text-amber-300/80">Gratuit en 2 clics sur Google AI Studio</p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
          >
            Configurer
          </button>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            <span>Nourryr concocte tes {totalMeals} repas protéinés...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 fill-zinc-950 stroke-none" />
            <span>Générer mes {totalMeals} repas ({supermarket})</span>
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Micro status during generation */}
      {isLoading && (
        <div className="text-center p-3 text-xs text-zinc-400 animate-pulse">
          ⚡ Calcul des portions (45g-65g prot), vérification des prix chez {supermarket} et cuisson sans aucun four...
        </div>
      )}
    </form>
  );
};
