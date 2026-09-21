import React, { useState, useEffect } from 'react';
import { X, Key, Database, Check, ExternalLink, Copy, CheckCheck, ShieldCheck, Loader2 } from 'lucide-react';
import { resetSupabaseClient } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const SUPABASE_SQL_SNIPPET = `-- Script SQL à coller dans l'éditeur SQL de Supabase (Gratuit) :
create table if not exists nourryr_plan (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists nourryr_favorites (
  id text primary key,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rendre accessible à la coloc sans mot de passe
alter table nourryr_plan enable row level security;
create policy "Public plan access" on nourryr_plan for all using (true) with check (true);

alter table nourryr_favorites enable row level security;
create policy "Public favorites access" on nourryr_favorites for all using (true) with check (true);`;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('nourryr_gemini_api_key') || '');
      setSupabaseUrl(localStorage.getItem('nourryr_supabase_url') || '');
      setSupabaseAnonKey(localStorage.getItem('nourryr_supabase_anon_key') || '');
      setSupabaseStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('nourryr_gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('nourryr_gemini_api_key');
    }

    resetSupabaseClient(supabaseUrl.trim(), supabaseAnonKey.trim());

    setSaveSuccess(true);
    onSaved();
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const testConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatus({ ok: false, message: "Renseigne d'abord l'URL et la clé anonyme." });
      return;
    }
    setTestingSupabase(true);
    setSupabaseStatus(null);
    try {
      const client = createClient(supabaseUrl.trim(), supabaseAnonKey.trim());
      const { error } = await client.from('nourryr_plan').select('id').limit(1);
      if (error) {
        setSupabaseStatus({ ok: false, message: `Erreur: ${error.message}` });
      } else {
        setSupabaseStatus({ ok: true, message: "Connexion réussie ! Vos 2 tables sont prêtes." });
      }
    } catch (e: any) {
      setSupabaseStatus({ ok: false, message: `Échec de connexion : ${e.message || 'URL incorrecte'}` });
    } finally {
      setTestingSupabase(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white leading-tight">
              Configuration & Connexions
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Section 1: Clé Gemini */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                Clé d'API Google Gemini
              </label>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Obtenir gratuitement</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Pour générer les programmes, Nourryr utilise Gemini. L'accès développeur sur Google AI Studio est 100% gratuit et sans carte bancaire requise.
            </p>

            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>

          {/* Section 2: Supabase (Synchronisation colocataire) */}
          <div className="space-y-3 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Synchronisation coloc (Supabase)
              </label>

              <a
                href="https://supabase.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <span>supabase.com (Gratuit)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Pour que ton coloc et toi voyiez la même liste de courses et les mêmes recettes enregistrées sur vos téléphones sans créer de compte, entrez votre URL et clé publique Supabase.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Supabase Project URL (https://xyz.supabase.co)"
                value={supabaseUrl}
                onChange={e => {
                  setSupabaseUrl(e.target.value);
                  setSupabaseStatus(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <input
                type="password"
                placeholder="Supabase Anon Key (public API key)"
                value={supabaseAnonKey}
                onChange={e => {
                  setSupabaseAnonKey(e.target.value);
                  setSupabaseStatus(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>

            {/* Test Connection Button */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={testConnection}
                disabled={testingSupabase || !supabaseUrl || !supabaseAnonKey}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                {testingSupabase ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Test en cours...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tester la connexion Supabase</span>
                  </>
                )}
              </button>

              {supabaseStatus && (
                <span
                  className={`text-xs font-semibold ${
                    supabaseStatus.ok ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {supabaseStatus.ok ? '✓ Connecté' : '⚠️ Erreur'}
                </span>
              )}
            </div>

            {supabaseStatus && (
              <div
                className={`p-2.5 rounded-xl text-xs border ${
                  supabaseStatus.ok
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                    : 'bg-red-950/20 border-red-900/40 text-red-300'
                }`}
              >
                {supabaseStatus.message}
              </div>
            )}

            {/* Toggle SQL helper */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-xs text-emerald-400 font-medium hover:underline flex items-center gap-1"
              >
                {showSql ? 'Masquer le script SQL pour Supabase' : '📋 Voir le script SQL à coller dans Supabase'}
              </button>

              {showSql && (
                <div className="mt-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-mono">SQL Editor (2 tables)</span>
                    <button
                      type="button"
                      onClick={copySql}
                      className="px-2 py-1 rounded bg-zinc-800 text-[11px] text-zinc-200 font-medium hover:bg-zinc-700 flex items-center gap-1"
                    >
                      {copiedSql ? (
                        <>
                          <CheckCheck className="w-3 h-3 text-emerald-400" />
                          <span>Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copier SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] text-zinc-400 font-mono bg-zinc-950 p-2 rounded overflow-x-auto">
                    {SUPABASE_SQL_SNIPPET}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Si Supabase n'est pas renseigné, l'application fonctionne quand même parfaitement en mode local sur ton téléphone.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Enregistré !</span>
              </>
            ) : (
              <span>Enregistrer les paramètres</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
