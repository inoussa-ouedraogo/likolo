# Préparer le déploiement de Likolo sur OVH

**Guide uniquement : ne rien exécuter sur le serveur avant d'avoir choisi et validé la configuration.**

## 1. Identifier l'offre OVH

Cette version nécessite un serveur capable d'exécuter Node.js 24 ou Docker : généralement un **VPS ou un serveur dédié Linux avec accès SSH**. Un hébergement web mutualisé peut avoir d'autres contraintes. Faire vérifier l'offre et les droits disponibles avant de choisir la procédure.

Informations à réunir pour Codex : type de serveur, système d'exploitation, adresse IP, utilisateur/alias SSH déjà configuré, emplacement souhaité, dépôt GitHub exact et futur domaine. Les secrets restent dans les outils d'authentification et les fichiers locaux ignorés par Git.

## 2. Préparation et vérification locales

```sh
npm ci
npm run build
npm test
npm start
```

Ouvrir `http://localhost:3000` et essayer le solo, les avatars, la musique et un salon à deux onglets. `http://localhost:3000/healthz` doit répondre `{"ok":true}`.

Le serveur utilise SQLite via le module natif de Node.js 24 ; aucun service de base de données payant supplémentaire n'est nécessaire pour cette configuration. Les requêtes utilisent les mêmes règles de salon que le prototype initial.

## 3. Option Docker sur un VPS Linux

À utiliser uniquement si Docker et le plugin Compose sont disponibles et autorisés sur le serveur. Ne pas écraser une installation existante de Nginx, Apache ou Caddy.

Une fois le dépôt placé sur le VPS, dans son répertoire :

```sh
cp .env.example .env
```

Modifier `.env` pour utiliser l'URL réelle :

```dotenv
PUBLIC_ORIGIN=https://ton-domaine.fr
```

Après validation du déploiement :

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 likolo
curl http://127.0.0.1:3000/healthz
```

Le service ne publie le port 3000 que sur `127.0.0.1` du VPS. Le proxy HTTP/HTTPS du VPS doit transmettre les requêtes vers `127.0.0.1:3000`. Le volume Docker `likolo-data` conserve la base de données. **Ne pas lancer `docker compose down -v` : cela supprimerait le volume.**

Pour tester avant l'achat du domaine, garder le service privé et utiliser un tunnel SSH, si l'alias SSH du serveur est déjà configuré :

```sh
ssh -L 3000:127.0.0.1:3000 mon-serveur-ovh
```

Dans ce cas, démarrer le service avec `PUBLIC_ORIGIN=http://localhost:3000` puis ouvrir `http://localhost:3000` sur son ordinateur. Revenir à l'origine HTTPS définitive avant d'ouvrir le site sur le domaine.

## 4. Alternative sans Docker

Avec Node.js 24 installé sur le VPS :

```sh
npm ci
npm run build
npm test
cp .env.example .env
```

Adapter `.env` avec `HOST=127.0.0.1`, `PORT=3000`, l'origine HTTPS réelle et un chemin persistant pour `DATABASE_PATH`. Un lancement ponctuel se fait avec `npm start`.

Pour un service permanent, `deploy/likolo.service.example` fournit une base systemd. Codex doit adapter l'utilisateur non privilégié, le chemin du projet et le chemin réel de Node, donner accès au dossier de données et vérifier le service avant de l'activer. Cette option remplace Docker ; ne pas lancer les deux sur le même port.

## 5. Nom de domaine et HTTPS

Quand le domaine est choisi :

1. Ajouter un enregistrement **A** vers l'adresse IPv4 du VPS. Ajouter un **AAAA** uniquement si l'IPv6 du VPS est configurée et joignable.
2. Prévoir `www` seulement si on souhaite l'utiliser et le configurer dans le proxy.
3. Faire vérifier les ports 80/443 et le proxy existant avant toute modification.
4. Définir `PUBLIC_ORIGIN` avec **l'origine réellement utilisée**, par exemple `https://jouer.ton-domaine.fr`, sans chemin.
5. Installer/configurer le certificat HTTPS avec le proxy existant. Si Caddy est choisi et installé sur le VPS, l'exemple `deploy/Caddyfile.example` active le proxy inverse et la gestion HTTPS automatique sous réserve que le DNS et les ports soient accessibles.

Ne pas remplacer intégralement les configurations des autres sites. Ajouter uniquement le bloc destiné à Likolo. Si Caddy est lui-même dans Docker, l'adresse réseau à utiliser est différente : Codex doit adapter le réseau ; l'exemple fourni suppose un Caddy installé directement sur le VPS.

## 6. Validation et retour arrière

Vérifier l'accueil, le GLB, un salon à deux appareils, les lancers, la rotation des postes, les commandes tactiles et les erreurs du navigateur. Vérifier la persistance des salons après un redémarrage et l'absence de secrets dans Git et dans les réponses API.

Avant une mise à jour : conserver le commit précédent et une sauvegarde cohérente de SQLite. Pour une première petite installation Docker, une méthode simple consiste à arrêter temporairement le service, sauvegarder **tout le dossier `/app/data` du volume**, puis redémarrer. SQLite utilise WAL : ne pas copier uniquement le fichier principal pendant que le service écrit dedans. Adapter le plan de sauvegarde aux contraintes du serveur.

Le retour arrière consiste à relancer la précédente version de l'application ; toute future migration de schéma devra prévoir sa compatibilité. Le schéma initial est créé automatiquement si absent ; les changements de schéma futurs doivent être gérés explicitement.

## Documentation officielle

- [OVH — créer un enregistrement A](https://docs.ovhcloud.com/fr/guides/web-cloud/domains/dns-zone-a-record-creation)
- [Caddy — HTTPS automatique](https://caddyserver.com/docs/automatic-https)
- [Caddy — proxy inverse](https://caddyserver.com/docs/quick-starts/reverse-proxy)
