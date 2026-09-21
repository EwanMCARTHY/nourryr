import React from 'react';
import { Bookmark, Settings, UtensilsCrossed, RefreshCw } from 'lucide-react';

interface HeaderProps {
  hasActivePlan: boolean;
  savedCount: number;
  onOpenSaved: () => void;
  onOpenSettings: () => void;
  onResetPlan: () => void;
  hasApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  hasActivePlan,
  savedCount,
  onOpenSaved,
  onOpenSettings,
  onResetPlan,
  hasApiKey,
}) => {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/85 border-b border-zinc-800/80 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <UtensilsCrossed className="w-5 h-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">
              Nourryr
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {hasActivePlan && (
            <button
              onClick={onResetPlan}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 active:scale-95 transition-all text-xs flex items-center gap-1"
              title="Créer un nouveau programme"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenSaved}
            className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/60 active:scale-95 transition-all"
            title="Recettes favorites"
          >
            <Bookmark className="w-5 h-5 text-zinc-300" />
            {savedCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-[10px] font-bold text-zinc-950 flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/60 active:scale-95 transition-all"
            title="Paramètres & Clés"
          >
            <Settings className="w-5 h-5 text-zinc-300" />
            {!hasApiKey && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
