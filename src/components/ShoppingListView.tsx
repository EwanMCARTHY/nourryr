import React, { useState } from 'react';
import type { GroceryCategory, ShoppingItem, Supermarket } from '../types';
import { Check, Copy, CheckCheck, ShoppingBag, Store, Filter, RefreshCw, Pencil, X, Tag } from 'lucide-react';

interface ShoppingListViewProps {
  items: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onUpdatePrice?: (itemId: string, newPrice: number) => void;
  supermarket: Supermarket;
  budget: number;
  estimatedCost: number;
  onResetAllChecks: () => void;
}

const CATEGORY_ORDER: GroceryCategory[] = [
  'Boucherie & Poissonnerie',
  'Crémerie & Œufs',
  'Fruits & Légumes',
  'Épicerie & Féculents',
  'Condiments & Autres',
];

const CATEGORY_ICONS: Record<GroceryCategory, string> = {
  'Boucherie & Poissonnerie': '🥩',
  'Crémerie & Œufs': '🥚',
  'Fruits & Légumes': '🥦',
  'Épicerie & Féculents': '🍚',
  'Condiments & Autres': '🧂',
};

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  items,
  onToggleItem,
  onUpdatePrice,
  supermarket,
  budget,
  estimatedCost,
  onResetAllChecks,
}) => {
  const [hideChecked, setHideChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  const handleStartEdit = (item: ShoppingItem) => {
    setEditingItemId(item.id);
    setEditPriceValue(item.estimatedPrice.toString());
  };

  const handleConfirmEdit = (itemId: string) => {
    const parsed = parseFloat(editPriceValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && onUpdatePrice) {
      onUpdatePrice(itemId, Number(parsed.toFixed(2)));
    }
    setEditingItemId(null);
  };

  const checkedCount = items.filter(i => i.checked).length;
  const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  // Group items by category
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = items.filter(item => item.category === cat);
    return acc;
  }, {} as Record<GroceryCategory, ShoppingItem[]>);

  const copyToClipboard = () => {
    let text = `🛒 Liste de courses Nourryr (${supermarket}) - Budget ~${estimatedCost}€\n\n`;
    CATEGORY_ORDER.forEach(cat => {
      const catItems = grouped[cat];
      if (catItems && catItems.length > 0) {
        text += `${CATEGORY_ICONS[cat]} ${cat.toUpperCase()} :\n`;
        catItems.forEach(item => {
          text += `  [${item.checked ? 'x' : ' '}] ${item.name} (${item.quantity})\n`;
        });
        text += '\n';
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Supermarket & Budget bar */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Courses chez</span>
              <span className="text-sm font-bold text-white">{supermarket}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-zinc-400 font-medium block">Estimation caddie</span>
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-base font-extrabold text-emerald-400">~{estimatedCost}</span>
              <span className="text-xs text-zinc-400">/ max {budget}€</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              {checkedCount} sur {items.length} articles dans le caddie
            </span>
            <span className="font-bold text-emerald-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Quick action bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setHideChecked(!hideChecked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              hideChecked
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>{hideChecked ? 'Masquer cochés (actif)' : 'Masquer cochés'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {checkedCount > 0 && (
              <button
                type="button"
                onClick={onResetAllChecks}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
                title="Décocher tout"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Partager</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Shopping List by Department */}
      <div className="space-y-4">
        {CATEGORY_ORDER.map(category => {
          const catItems = grouped[category] || [];
          const visibleItems = hideChecked ? catItems.filter(i => !i.checked) : catItems;

          if (visibleItems.length === 0 && hideChecked && catItems.length > 0) {
            return null;
          }

          if (catItems.length === 0) return null;

          const checkedInCat = catItems.filter(i => i.checked).length;

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="text-base leading-none">{CATEGORY_ICONS[category]}</span>
                  <span>{category}</span>
                </h3>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {checkedInCat}/{catItems.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {visibleItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onToggleItem(item.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                      item.checked
                        ? 'bg-zinc-950/60 border-zinc-800/50 text-zinc-500'
                        : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-100 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      {/* Checkbox button */}
                      <div
                        className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center transition-all ${
                          item.checked
                            ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30'
                            : 'border-2 border-zinc-700 bg-zinc-800/60'
                        }`}
                      >
                        {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs font-semibold ${
                              item.checked ? 'line-through text-zinc-500' : 'text-zinc-100'
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.isUserPrice && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                              Prix vérifié
                            </span>
                          )}
                        </div>

                        {(item.brand || item.unitDetails) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-zinc-400">
                            {item.brand && (
                              <span className="text-zinc-400 flex items-center gap-1 font-medium">
                                <Tag className="w-2.5 h-2.5 text-zinc-500" />
                                {item.brand}
                              </span>
                            )}
                            {item.brand && item.unitDetails && <span>•</span>}
                            {item.unitDetails && (
                              <span className="text-zinc-500">{item.unitDetails}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-emerald-400/90 px-2 py-1 rounded-lg bg-zinc-800/80">
                        {item.quantity}
                      </span>

                      {editingItemId === item.id ? (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 bg-zinc-950 border border-emerald-500/80 rounded-lg p-0.5"
                        >
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={editPriceValue}
                            onChange={e => setEditPriceValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleConfirmEdit(item.id);
                              if (e.key === 'Escape') setEditingItemId(null);
                            }}
                            autoFocus
                            className="w-14 px-1.5 py-0.5 text-xs bg-transparent text-white font-bold outline-none"
                          />
                          <span className="text-xs text-zinc-400 mr-1">€</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmEdit(item.id)}
                            className="p-1 rounded bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
                            title="Valider le prix"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Annuler"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleStartEdit(item);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.isUserPrice
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                              : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                          }`}
                          title="Cliquer pour corriger le prix réel en magasin"
                        >
                          <span>{item.estimatedPrice.toFixed(2)} €</span>
                          <Pencil className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
