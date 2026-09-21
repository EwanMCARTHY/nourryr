# 🥗 Nourryr • Repas Protéinés, Budget & Courses

**Nourryr** est une application web mobile-first conçue pour planifier les repas de la semaine entre colocataires sportifs. Elle génère automatiquement un programme nutritionnel riche en protéines adapté au supermarché choisi (**E.Leclerc, Auchan, Intermarché**) et à un budget précis, sans aucun four (100% poêle, casseroles, plaques et micro-ondes).

---

## ⚡ Fonctionnalités clés

1. **Génération intelligente avec Gemini** :
   - Choix du nombre de jours (2, 3, 4, 5, 7 jours).
   - Choix du nombre de repas par jour (2 ou 3) et du nombre de colocataires.
   - Sélection du supermarché (**E.Leclerc, Auchan, Intermarché**).
   - Définition d'un budget maximum en euros (calcul automatique du coût par repas/portion).
   - **Règle d'or nutritionnelle** : 35g à 55g de protéines par portion (poulet, dinde, bœuf haché 5%, thon, œufs, skyr, lentilles...).
   - **Équipement strict** : Aucune recette nécessitant un four (plaques, poêle, casserole et micro-ondes uniquement).

2. **Double vue synchronisée** :
   - **Fiches Recettes** : Ingrédients, temps de préparation, macros et étapes détaillées.
   - **Liste de Courses interactive** : Ingrédients regroupés par rayon (*Boucherie, Produits frais/œufs, Fruits & Légumes, Épicerie, Condiments*). Les cases se cochent facilement au supermarché d'une seule main.
   - **Bouton Partage** : Copie de la liste de courses formatée en un clic pour l'envoyer sur WhatsApp/SMS à son coloc.

3. **Remplacement de recette à la volée** :
   - Si un plat ne convient pas, le bouton "Changer" permet à Gemini de générer une alternative immédiate sans toucher au reste du planning.

4. **Système de Favoris & Apprentissage** :
   - Enregistrer un repas l'ajoute à la base de données partagée.
   - Lors des générations suivantes, Nourryr priorise vos recettes favorites !

5. **Partage coloc sans mot de passe** :
   - Grâce à **Supabase** (gratuit), les deux téléphones partagent la même liste en temps réel sans inscription ni compte.
   - Fonctionne également en mode local hors-ligne si Supabase n'est pas encore configuré.

---

## 🚀 Lancement rapide en local

1. Ouvre un terminal dans le dossier :
   ```bash
   cd C:\Users\ewanm\.gemini\antigravity\scratch\nourryr
   npm run dev
   ```
2. Ouvre l'URL indiquée (généralement `http://localhost:5173`) sur ton navigateur ou ton smartphone (via le réseau local).

---

## 🔑 1. Clé d'API Google Gemini (100% Gratuite)

1. Rends-toi sur [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Connecte-toi avec ton compte Google.
3. Clique sur **"Create API key"**.
4. Copie la clé et colle-la dans l'application via le bouton **Paramètres ⚙️** (en haut à droite).

> **Note sur le coût :** Google AI Studio offre 15 requêtes/minute et 1 million de tokens gratuits par minute. Pour votre utilisation avec votre colocataire, cela ne vous coûtera **absolument rien (0 €)**.

---

## 👥 2. Synchronisation entre téléphones avec Supabase (Gratuit)

Pour que ton coloc et toi ayez la même liste synchronisée sur vos téléphones :

1. Crée un compte gratuit sur [Supabase](https://supabase.com/) et crée un nouveau projet (ex: `nourryr`).
2. Va dans l'onglet **SQL Editor** à gauche, clique sur **New query**, colle ce script et clique sur **Run** :
   ```sql
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

   alter table nourryr_plan enable row level security;
   create policy "Public plan access" on nourryr_plan for all using (true) with check (true);

   alter table nourryr_favorites enable row level security;
   create policy "Public favorites access" on nourryr_favorites for all using (true) with check (true);
   ```
3. Va dans **Project Settings** > **API** et récupère :
   - **Project URL**
   - **anon public key**
4. Renseigne-les dans le menu **Paramètres ⚙️** de l'application sur vos deux téléphones. C'est tout !

---

## 🌐 3. Déploiement gratuit sur GitHub + Netlify

### Étape A : Créer le repo GitHub
1. Crée un nouveau dépôt vide sur [GitHub](https://github.com/new) nommé `nourryr`.
2. Dans le dossier `C:\Users\ewanm\.gemini\antigravity\scratch\nourryr`, lance :
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Nourryr app"
   git branch -M main
   git remote add origin https://github.com/<TON_PSEUDO>/nourryr.git
   git push -u origin main
   ```

### Étape B : Lier à Netlify
1. Connecte-toi sur [Netlify](https://www.netlify.com/) (gratuit).
2. Clique sur **"Add new site"** > **"Import an existing project"** > **GitHub**.
3. Sélectionne ton dépôt `nourryr`.
4. Netlify détecte automatiquement la configuration grâce au fichier `netlify.toml` déjà inclus.
5. (Optionnel) Dans **Site configuration > Environment variables**, tu peux ajouter `GEMINI_API_KEY` pour que la clé soit gérée côté serveur Netlify sans être exposée dans le navigateur.
6. Clique sur **Deploy**. En moins de 60 secondes, votre site est en ligne avec une URL HTTPS gratuite (ex: `nourryr.netlify.app`) !

---

## 📱 Installer sur smartphone (Comme une vraie application)

* **Sur iPhone (Safari)** : Ouvre le lien du site, appuie sur le bouton **Partager** (carré avec flèche vers le haut) puis choisis **"Sur l'écran d'accueil"**.
* **Sur Android (Chrome)** : Ouvre le lien, appuie sur les 3 petits points verticaux en haut à droite puis choisis **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**.
