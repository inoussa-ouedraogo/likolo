# Utiliser Codex pour préparer puis déployer sur OVH

## Préparer le travail

1. Mettre le contenu de ce dossier dans un dépôt GitHub (instructions dans `README.md`) ou l'extraire sur son ordinateur.
2. Ouvrir **ce dossier** dans son environnement Codex. Pour Codex CLI déjà installé, ouvrir un terminal ici et lancer `codex`.
3. Fournir le lien exact du dépôt. Le profil `https://github.com/inoussa-ouedraogo` seul ne désigne pas un dépôt.
4. Pour agir sur OVH, utiliser un environnement où l'accès SSH au serveur fonctionne déjà. Codex ne récupère pas automatiquement l'accès à un serveur à partir de son nom. En local, un alias SSH configuré sur l'ordinateur permet d'éviter de partager une clé privée dans la conversation.
5. Copier le texte ci-dessous en remplaçant les crochets. Sans nom de domaine, indiquer « pas encore choisi » : les préparatifs et les tests privés peuvent avancer.

Documentation officielle OpenAI : [Codex CLI](https://learn.chatgpt.com/docs/codex/cli).

## Texte à donner à Codex — préparation uniquement

```text
Je veux préparer le déploiement de mon jeu Likolo sur mon serveur OVH existant.

Dépôt : [URL EXACTE DU DÉPÔT]
Offre OVH : [VPS / serveur dédié / hébergement mutualisé / à vérifier]
Système : [si connu]
Alias SSH déjà configuré : [ALIAS ou accès pas encore configuré]
Domaine : [DOMAINE ou pas encore choisi]

Lis README.md, DEPLOIEMENT_OVH.md et les fichiers du projet.
Ne déploie pas pour le moment. Ne modifie pas le DNS ni les services du serveur.

1. Vérifie localement npm ci, npm run build et npm test avec Node.js 24.
2. Vérifie que le serveur autonome conserve les salons multijoueurs dans SQLite.
3. Si l'accès SSH est disponible, inspecte en lecture seule le serveur : système,
   ressources, Node/Docker, services existants, ports, proxy HTTP et chemins.
4. Choisis Docker Compose ou Node + systemd selon la configuration existante.
   Préserve les sites déjà hébergés et les données.
5. Prépare les fichiers et les commandes exactes, le stockage persistant,
   les sauvegardes, les tests et un retour arrière.
6. Explique où pointer le futur domaine et comment activer HTTPS.
7. Présente le résultat et attends mon accord avant toute modification sur OVH
   ou mise en ligne. S'il manque l'accès SSH, demande uniquement ce qui est nécessaire
   pour le configurer, sans me demander de coller une clé privée dans le chat.

Ne remplace pas le multijoueur par une version statique. Ne remplace pas les
modèles 3D, les avatars noirs personnalisables ni les règles du jeu.
```

## Après avoir vérifié le plan

Quand le dépôt, l'accès serveur et le domaine sont prêts, donner une autorisation précise dans la même session :

```text
J'autorise maintenant le déploiement du commit [SHA] de Likolo sur [ALIAS SSH],
à l'emplacement [CHEMIN], avec l'URL https://[DOMAINE], selon le plan que nous
venons de vérifier. Préserve les autres services et prépare le retour arrière.
Effectue les contrôles de santé et un test de salon après la mise en ligne.
```

Si le domaine n'est pas encore choisi, demander d'abord une installation privée accessible par tunnel SSH, et réserver le DNS et HTTPS à une étape ultérieure.

## Informations utiles à communiquer

- URL du dépôt et branche visée.
- Type de serveur OVH et système si connus.
- Alias SSH ou procédure de connexion déjà mise en place.
- Domaine choisi ou sous-domaine souhaité.
- Sites et services à préserver.
- Choix d'accès : bêta privée ou jeu ouvert au public.

Les fichiers `.env`, les sauvegardes et les clés ne doivent pas être commis. La clé SSH privée reste dans le gestionnaire/agent SSH de l'ordinateur.
