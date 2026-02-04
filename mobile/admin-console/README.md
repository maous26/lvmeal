# LYM Admin Console

Console d'administration pour gérer les abonnements premium de l'application LYM.

## Fonctionnalités

- 📊 Dashboard avec statistiques (utilisateurs, premium, essais)
- 🔍 Recherche d'utilisateurs par email
- ✅ Accorder l'accès premium (manuel, lifetime, annuel, mensuel)
- ❌ Révoquer l'accès premium
- 🔐 Authentification sécurisée

## Déploiement sur Railway

### 1. Préparer Supabase

Exécutez la migration SQL dans votre Supabase SQL Editor :

```bash
# Copiez le contenu de supabase-migration.sql et exécutez-le dans Supabase
```

### 2. Créer le projet Railway

1. Allez sur [Railway](https://railway.app)
2. Créez un nouveau projet
3. Choisissez "Deploy from GitHub repo"
4. Sélectionnez ce repo et le dossier `admin-console`

### 3. Configurer les variables d'environnement

Dans Railway, ajoutez ces variables :

```
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=votre-mot-de-passe-secure
SESSION_SECRET=une-chaine-aleatoire-de-32-caracteres-minimum
NODE_ENV=production
PORT=3000
```

⚠️ **Important** : Utilisez la **Service Role Key** de Supabase (pas l'anon key) pour avoir accès admin.

### 4. Déployer

Railway déploiera automatiquement à chaque push sur la branche.

## Développement local

```bash
# Installer les dépendances
cd admin-console
npm install

# Créer le fichier .env
cp .env.example .env
# Éditez .env avec vos vraies valeurs

# Lancer en développement
npm run dev
```

## Structure

```
admin-console/
├── src/
│   ├── index.ts           # Point d'entrée serveur
│   ├── routes/
│   │   └── api.ts         # Routes API
│   ├── services/
│   │   ├── supabase.ts    # Client Supabase admin
│   │   └── subscription-service.ts
│   └── middleware/
│       └── auth.ts        # Authentification
├── public/
│   ├── index.html         # Dashboard
│   └── login.html         # Page de connexion
├── package.json
├── tsconfig.json
├── Dockerfile
├── railway.json
└── supabase-migration.sql
```

## API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion admin |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/check` | Vérifier l'authentification |
| GET | `/api/stats` | Statistiques dashboard |
| GET | `/api/users` | Rechercher des utilisateurs |
| GET | `/api/subscriptions` | Liste des abonnements actifs |
| POST | `/api/subscriptions/grant` | Accorder premium |
| POST | `/api/subscriptions/revoke` | Révoquer premium |

## Intégration avec l'app mobile

L'app mobile doit appeler la fonction Supabase `check_premium_status` pour vérifier si un utilisateur a un abonnement premium accordé manuellement :

```typescript
const { data } = await supabase.rpc('check_premium_status', {
  check_user_id: userId
})

if (data?.isPremium) {
  // L'utilisateur a un abonnement premium
}
```
