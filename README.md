# Chinédex Photo

Petit guide de terrain mobile et hors ligne pour chiner du matériel photo vintage pendant la Braderie de Lille.

## Contenu

- 68 références éditorialisées
- 136 images WebP locales, une miniature et une grande vue par produit
- recherche tolérante sur les noms, marques, focales, ouvertures, montures, rendus et usages
- filtres de terrain, favoris, jackpots et mots clés
- fiches détaillées avec compatibilité Canon EOS 1300D, rendu, usages, prix indicatifs et checklist persistante
- thème clair et sombre
- PWA installable et cache hors ligne complet

## Lancer localement

Le service worker a besoin de `localhost` ou de HTTPS. Ouvrir directement `index.html` permet de consulter l'app, mais pas d'installer correctement le mode hors ligne.

Depuis ce dossier :

```sh
python3 -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173/`.

Pour une installation sur téléphone, publier le dossier sur un hébergement HTTPS statique, ouvrir l'adresse sur le téléphone, puis choisir « Ajouter à l'écran d'accueil ».

## Modifier les produits

Toutes les fiches sont dans `data/products.js`. Chaque produit est un objet passé à `make({...})`.

Les images suivent cette convention :

```text
assets/images/products/<id>-thumb.webp
assets/images/products/<id>-hero.webp
```

Les pages sources des photos sont enregistrées dans `data/image-sources.json` et affichées au bas des fiches.

## Mettre à jour le cache

Après une modification déployée, changer la valeur `CACHE_VERSION` dans `service-worker.js`. Le navigateur téléchargera le nouveau lot de fichiers et supprimera l'ancien cache.

## Important sur les prix

Les montants sont des repères de terrain approximatifs. Ils ne constituent ni une cote garantie ni une estimation professionnelle. L'état, la variante, les accessoires et le marché au moment de l'achat peuvent modifier fortement la valeur.

## Testé

- mobile 390 x 844 px
- affichage large
- recherche `50 1.4`
- favoris et vue Cibles
- modes Jackpots et Mots clés
- ouverture de fiche et checklist persistante
- recharge complète après arrêt du serveur local
- chargement hors ligne d'une grande image non ouverte auparavant
