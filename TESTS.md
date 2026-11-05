# Procédure de tests - Commentaires

## Lancer les tests automatisés

Prérequis : les dépendances installées dans `server` et `client`, et MySQL démarré (`cd server && docker compose up -d`).

```bash
npm test
```

Cette commande lance les tests du back puis du front. On peut aussi les lancer séparément avec `npm test` dans `server` ou dans `client`.

Les tests du back démarrent l'API sur le port 5098 avec une base dédiée, `blog_test`, supprimée à la fin. La base `blog_db` n'est jamais modifiée.

## Tests automatisés du back (24)

Fichier : `server/tests/comments.test.js`

| ID | Scénario | Résultat attendu |
|---|---|---|
| A01 | Publier sans token | 403 |
| A02 | Publier avec un token invalide | 401 |
| A03 | Modifier sans token | 403 |
| A04 | Supprimer sans token | 403 |
| V01 | Publier sans corps | 400 |
| V02 | Publier un contenu vide ou fait d'espaces | 400 |
| V03 | Publier 2001 caractères | 400 |
| V04 | Publier exactement 2000 caractères | 201 |
| V05 | Publier un contenu qui n'est pas du texte | 400 |
| V06 | Commenter un article inexistant | 404 |
| V07 | Modifier ou supprimer un commentaire inexistant | 404 |
| V08 | Modifier avec un contenu vide | 400 |
| L01 | Lire les commentaires sans être connecté | 200, ordre chronologique, auteur inclus |
| D01 | Envoyer un `user_id` dans le corps | Ignoré, l'auteur vient du token |
| D02 | Modifier le commentaire d'un autre | 403, contenu inchangé |
| D03 | Supprimer le commentaire d'un autre | 403, commentaire conservé |
| D04 | Modifier son commentaire | 200, contenu modifié en base |
| D05 | Supprimer son commentaire | 200, commentaire supprimé en base |
| S01 | Injection SQL dans un commentaire | Stockée comme du texte |
| S02 | Injection SQL dans l'identifiant de l'URL | Aucun commentaire renvoyé |
| S03 | Injection SQL dans un article | Stockée comme du texte |
| S04 | Modifier l'image d'un article | Chemin valide, image accessible |
| C01 | Supprimer un article | Ses commentaires sont supprimés |
| C02 | Supprimer un utilisateur | Ses commentaires sont supprimés |

## Tests automatisés du front (17)

Fichier : `client/src/utils/renderComment.test.js`

| ID | Scénario | Résultat attendu |
|---|---|---|
| F01 | Texte simple sur deux lignes | Texte conservé avec son saut de ligne |
| F02 | Markdown | Gras, code, liste et citation interprétés |
| F03 | HTML de mise en forme | Conservé |
| F04 | Lien | `target="_blank"` et `rel="noopener noreferrer nofollow"` |
| X01 à X08 | `script`, `onerror`, `svg`, `iframe`, `form`, `style`, mXSS, image Markdown | Élément dangereux retiré |
| X09 à X12 | Liens `javascript:` (Markdown, HTML, masqué) et `data:` | Adresse retirée |
| X13 | Attributs `on*`, `style` et `data-*` | Attributs retirés |

## Tests manuels dans le navigateur

Lancer l'application avec `npm run dev`, puis ouvrir la page d'un article.

| ID | Scénario | Résultat attendu |
|---|---|---|
| M01 | Ouvrir un article sans commentaire | « Aucun commentaire pour le moment » |
| M02 | Laisser le champ vide | Bouton Publier désactivé |
| M03 | Publier du texte, du Markdown et du HTML | Les trois s'affichent correctement |
| M04 | Publier `<img src=x onerror="alert(1)">` | Aucune alerte, aucune image |
| M05 | Modifier son commentaire puis annuler | Contenu d'origine conservé |
| M06 | Modifier son commentaire, enregistrer et recharger | Modification conservée |
| M07 | Supprimer son commentaire et confirmer | Commentaire retiré de la liste |
| M08 | Se connecter avec un autre compte | Pas de boutons sur les commentaires des autres |
| M09 | Se déconnecter | Liste visible, formulaire remplacé par un lien de connexion |
| M10 | Publier avec un token expiré | Message d'erreur affiché |
| M11 | Comparer le rendu à la page de l'article | Design cohérent, sur ordinateur et à 400 px de large |
| M12 | Commenter avec un compte qui a un avatar | Avatar affiché dans le commentaire |
| M13 | Créer un article avec une image | Image affichée sur l'accueil et sur l'article |

## Fiabilité des tests

Pour vérifier que les tests détectent de vrais problèmes, 15 protections ont été retirées une par une sur une copie du code. Chaque retrait a fait échouer au moins un test.

| Protection retirée | Tests en échec |
|---|---|
| Contrôle de l'auteur | D02, D03 |
| `verifyToken` sur POST | A01 et les tests qui publient avec un compte |
| `verifyToken` sur PUT | D04 |
| `verifyToken` sur DELETE | D05 |
| Contrôle du type du contenu | V01, V05 |
| Limite de longueur | V03 |
| Contrôle de l'existence de l'article | V06 |
| Auteur lu depuis le token | D01 |
| Requête préparée de `createArticle` (bug d'origine) | S03 et les tests qui créent un article |
| Chemin d'image de `updateArticle` (bug d'origine) | S04 |
| `ON DELETE CASCADE` sur `article_id` | C01 |
| `DOMPurify` | X01 à X13, F04 |
| Liste blanche des balises | X02, X08 |
| Liste blanche des attributs | X13 |
| `rel` des liens | F04 |

Sans `verifyToken` sur PUT et DELETE, A03 et A04 renvoient quand même 403 grâce au contrôle de l'auteur : les deux protections se doublent.

## Résultats du 05/11/2026

- Back : 24 tests sur 24 réussis.
- Front : 17 tests sur 17 réussis.
- Manuels : M01 à M11 vérifiés dans Chrome avec un script automatisé. M12 et M13 restent à faire.
- Anomalie connue : à 400 px de large, la barre de navigation d'un utilisateur connecté déborde de l'écran sur tout le site. L'espace commentaires n'est pas concerné.
