# 🎀 Pink Library

Application culturelle personnelle, gratuite et locale. Pink Library recherche des livres, films et séries, propose des recommandations et conserve wishlist, favoris, notes et historique dans IndexedDB.

## Prérequis

- Node.js 20 ou plus récent
- Un navigateur récent
- Une connexion Internet pour rechercher les métadonnées et les couvertures

## Installation et lancement

1. Décompresser le dossier.
2. Ouvrir un terminal dans `pink-library`.
3. Installer les dépendances :

   ```bash
   npm install
   ```

4. Lancer l'application :

   ```bash
   npm run dev
   ```

5. Ouvrir l'adresse locale affichée par Vite (généralement `http://localhost:5173`).

Pour construire la version de production : `npm run build`, puis `npm run preview`.

## Activer les films et séries (TMDB)

La recherche de films et séries nécessite un **API Read Access Token** TMDB (V4). La création d'un compte et l'accès API sont gratuits, sous réserve des conditions de TMDB.

1. Créer un compte sur [themoviedb.org](https://www.themoviedb.org/).
2. Ouvrir les paramètres du compte puis la section API.
3. Demander/activer l'accès API et copier le **API Read Access Token** (jeton long V4).
4. Dans Pink Library, ouvrir **Réglages**, coller le jeton et enregistrer.

Le jeton est conservé dans le stockage local du navigateur (localStorage) et envoyé directement au domaine TMDB depuis ton navigateur. Il n'est pas transmis à un serveur Pink Library. Ne partage pas ton jeton.

Les recherches de livres via Google Books et Open Library fonctionnent sans clé API.

## Stockage et confidentialité

- Wishlist, favoris, notes, historique et préférence de thème : IndexedDB du navigateur.
- Jeton TMDB : localStorage du navigateur.
- Pas de compte Pink Library, serveur applicatif, publicité, analytics ou synchronisation cloud.
- Les requêtes de recherche partent vers TMDB, Google Books et/ou Open Library pour récupérer les données demandées. Les fournisseurs reçoivent donc les termes de recherche et certaines métadonnées techniques de la requête.
- Les données locales sont liées au profil navigateur et à cet appareil. Effacer les données du site/navigateur peut les supprimer. Utilise régulièrement l'export JSON dans Réglages.

## Fonctionnalités

- Recherche multi-catégories et filtre Films / Séries / Livres.
- Fiche de l'œuvre choisie et recommandations.
- Modes de présentation : ambiance, univers, personnages, style, surprise.
- Wishlist, favoris, notes, statut « découvert ».
- Historique de recherche et export/import JSON.
- Thème sombre rose doux.

## À propos de la pertinence des recommandations

Les recommandations films/séries utilisent les endpoints « recommendations » et « similar » de TMDB. Les recommandations de livres sont générées par recherche de sujets/catégories dans les catalogues Google Books et Open Library. Les modes de recommandation changent le classement local à partir des métadonnées disponibles.

**Limite honnête :** les modes « ambiance », « personnages » et « style » ne sont pas une analyse sémantique par IA. Ils s'appuient sur les genres, sujets et textes descriptifs disponibles ; ces champs sont parfois incomplets. L'application n'invente pas de notes ni de résumés. Une œuvre sans résumé affiche un message de remplacement clairement identifié.

## Sources, attribution et conditions

- Films et séries : [The Movie Database (TMDB)](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB. Cette application utilise l'API TMDB. Respecte les exigences d'attribution de TMDB et ses conditions d'utilisation avant toute diffusion publique.
- Livres : [Google Books API](https://developers.google.com/books/docs/v1/using) et [Open Library](https://openlibrary.org/developers/api). Les informations et couvertures restent la propriété de leurs ayants droit/fournisseurs respectifs.

Cette version est pensée pour un usage personnel local. Les quotas, disponibilités, conditions d'accès et règles d'attribution des fournisseurs peuvent évoluer.

## Dépannage

- **Films/séries indisponibles** : vérifie le jeton TMDB V4 dans Réglages.
- **Aucune œuvre trouvée** : vérifie l'orthographe, essaye le titre original ou change le filtre de catégorie.
- **Couverture absente** : certains catalogues ne fournissent pas d'image ; une vignette typographique s'affiche alors.
- **Données locales** : elles restent dans le navigateur utilisé. Exporte un fichier JSON avant de changer de navigateur ou d'ordinateur.

## Publication iPhone (GitHub Pages)

Le dépôt est préparé pour GitHub Pages sous le nom `pink-library` : manifest PWA, icônes, cache hors ligne de l'interface et workflow de déploiement automatique sont inclus.

1. Crée un dépôt GitHub **public** nommé `pink-library` et ajoute tous les fichiers de ce dossier à la branche `main`.
2. Dans le dépôt, ouvre **Settings → Pages** et choisis **GitHub Actions** comme source.
3. À chaque mise à jour de `main`, le workflow `.github/workflows/deploy.yml` construit et publie le site. Attends la fin du workflow dans l'onglet **Actions**.
4. Ouvre `https://TON-PSEUDO.github.io/pink-library/` dans Safari sur l'iPhone.
5. Touche **Partager → Sur l’écran d’accueil**, active **Ouvrir comme app web** si l’option apparaît, puis touche **Ajouter**.

Pour un autre nom de dépôt, adapte `base` dans `vite.config.ts` et le champ `id` du manifest.

Les favoris et données de bibliothèque restent dans le stockage local du navigateur. L'interface peut être mise en cache, mais les recherches de catalogues nécessitent une connexion internet. Les appels de recherche partent vers les fournisseurs concernés.
