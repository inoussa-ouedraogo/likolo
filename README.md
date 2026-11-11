# Likolo — code complet pour GitHub et OVH

Jeu 3D en français pour téléphone et ordinateur : esquives, sauts, interceptions, bouteille de sable, avatars noirs personnalisables, IA et salons multijoueurs (duel, trio, coopération).

Cette livraison contient la version du jeu avec IA différenciées et coiffures réduites, ainsi qu'un serveur autonome pour OVH. **Aucun déploiement OVH n'a été effectué. Les vérifications GitHub Actions ne déclenchent aucun déploiement.**

## Commencer

1. Extraire l'archive et ouvrir le dossier `likolo`.
2. Lire [DEPLOIEMENT_OVH.md](DEPLOIEMENT_OVH.md).
3. Pour se faire accompagner par Codex, lire [UTILISER_CODEX.md](UTILISER_CODEX.md) et copier le texte proposé.

## Essayer sur son ordinateur

Installer Node.js **24**, puis dans ce dossier :

```sh
npm ci
npm run build
npm test
npm start
```

Ouvrir `http://localhost:3000`. Le serveur crée `data/likolo.sqlite` et garde les salons entre ses redémarrages. Pour jouer entre appareils, utiliser une URL réseau ou un domaine configuré correctement ; `localhost` désigne chaque appareil lui-même.

`npm run dev` reconstruit le jeu puis lance le serveur. Il n'y a pas de rechargement automatique. Arrêter avec Ctrl+C avant de relancer.

## Dossiers et fichiers

| Chemin | Contenu |
| --- | --- |
| `dist/` | Sources du navigateur : JavaScript, HTML, CSS, modèle GLB, Three.js et licences |
| `dist/server/index.js` | Serveur HTTP portable au format Fetch, généré par le build ; embarque les ressources du jeu |
| `worker/rooms.mjs` | Logique des salons et synchronisation |
| `server/ovh.mjs` | Adaptateur Node.js HTTP + SQLite pour OVH |
| `drizzle/` | Schéma SQL initial et métadonnées |
| `tests/` | Tests de jeu, modèle 3D, réseau et serveur OVH |
| `Dockerfile`, `compose.yaml` | Option de lancement avec Docker |
| `deploy/` | Exemples Caddy et systemd à adapter au serveur existant |
| `.github/workflows/checks.yml` | Tests automatiques ; ne déploie rien |

Les fichiers client de `dist/` sont les sources du jeu et doivent être conservés dans Git. Modifier ces fichiers et/ou `worker/rooms.mjs`, puis lancer `npm run build`. Ne pas modifier directement `dist/server/index.js`.

## Mettre le code sur GitHub

Créer un dépôt **vide** nommé `likolo` depuis son compte `inoussa-ouedraogo`. Choisir privé si l'on ne souhaite pas publier le code. Ne pas demander à GitHub d'ajouter un README, une licence ou un `.gitignore`, déjà fournis ici.

Depuis le dossier extrait, sur son ordinateur :

```sh
git init
git add .
git commit -m "Import du jeu Likolo et serveur OVH"
git branch -M main
git remote add origin https://github.com/inoussa-ouedraogo/likolo.git
git push -u origin main
```

Ces commandes supposent que le dépôt `likolo` vient d'être créé et que Git est déjà authentifié. Si le nom choisi est différent, remplacer l'URL. Ne pas utiliser de push forcé dans un dépôt existant. Ne jamais ajouter `.env`, les clés SSH, la base de données ni `node_modules` au dépôt.

GitHub conserve le code. Le jeu multijoueur s'exécute sur le serveur OVH ; GitHub Pages seul ne fournit pas ce serveur.

## Modèles et licences

Base 3D : Universal Base Characters Standard, par Quaternius, **CC0**. Licence et provenance dans `dist/models/`. Les coiffures et l'adaptation sportive sont créées pour le prototype. La version gratuite utilise une base masculine stylisée ; les différents avatars partagent cette base, avec coiffures, teints, vêtements et silhouettes variés.

Three.js et ses utilitaires sont sous licence MIT : `dist/vendor/THREE-LICENSE.txt`. Les autres dépendances conservent leurs licences respectives. Aucune licence générale de redistribution n'est imposée au code du projet par cette livraison.

## Limites actuelles

- Internet est nécessaire pour jouer entre appareils. Pas de Bluetooth ni de Wi-Fi hors Internet.
- Les performances restent à vérifier sur de vrais téléphones et avec la latence vers OVH.
- Le serveur OVH est prévu pour **une instance** avec SQLite persistante. Ne pas multiplier les réplicas sans revoir la synchronisation.
- L'accès privé ChatGPT du prototype n'est pas transféré : si ce serveur est exposé, le jeu sera accessible à ses visiteurs. Prévoir un accès restreint avant une bêta privée.
- Les salons et sessions de l'ancien site ne sont pas importés. Un nouveau serveur démarre avec une base neuve.
- Docker n'a pas été exécuté dans l'environnement de préparation ; le serveur Node.js et la persistance SQLite ont été testés directement.
