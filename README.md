# Documentation - Plateforme REZA (Web & Mobile)

Bienvenue dans la documentation officielle de la plateforme **REZA**. REZA est une solution SaaS multi-tenant globale dédiée à la gestion d'établissements de beauté et de bien-être (salons de coiffure, instituts de beauté, spas, barbiers, etc.) ainsi qu'à la réservation de prestations en ligne par les clients.

---

## Sommaire

1. [01 presentation](#01-presentation)
2. [02 guide fonctionnel](#02-guide-fonctionnel)
3. [03 guide utilisateur](#03-guide-utilisateur)
4. [04 architecture technique](#04-architecture-technique)
5. [05 api reference](#05-api-reference)
6. [06 securite conformite](#06-securite-conformite)
7. [07 deploiement](#07-deploiement)

---

## 01 presentation

### Context & Vision
REZA ambitionne de digitaliser l'écosystème de la beauté et du bien-être en proposant une suite d'applications complète connectant directement les professionnels de santé/beauté et leurs clients.

La plateforme permet aux professionnels de piloter intégralement leur établissement (agenda, collaborateurs, caisse, facturation, abonnement SaaS) et offre aux clients finaux une expérience fluide et intuitive de prise de rendez-vous en ligne via Web et Mobile.

### Écosystème Global
La plateforme REZA se compose de 5 piliers applicatifs majeurs :

* **REZA Backend (API REST Core)** : Serveur central Node.js / Express / Prisma ORM / PostgreSQL.
* **REZA Web Pro** : Application Next.js dédiée à la gestion du salon par le professionnel et son équipe.
* **REZA Web Client** : Application Next.js de réservation et portail client Web.
* **REZA Mobile Pro** : Application mobile Flutter pour les professionnels (iOS & Android).
* **REZA Mobile Client** : Application mobile Flutter pour les clients finaux (iOS & Android).

---

## 02 guide fonctionnel

### 1. Gestion Multi-Tenant & Abonnements
* **Isolation des données** : Chaque établissement constitue un Tenant distinct avec ses propres règles, monnaie, fuseau horaire, prestations et employés.
* **Comptes & Salons multiples** : Un propriétaire (Account Owner) peut détenir et gérer plusieurs salons via le module multi-salon. Il peut basculer entre ses salons sans se déconnecter et administrer l'ensemble de son réseau depuis un même compte.
* **Gestion des plans SaaS** : Facturation d'abonnements professionnels intégrée via Stripe (limites par nombre de salons, fonctionnalités premium, récurrence annuelle/mensuelle).

### 2. Prise de Rendez-vous & Réservations (Booking System)
* **Réservations individuelles et multi-prestations** : Choix du service, sélection ou attribution automatique du collaborateur, sélection du créneau de disponibilité en temps réel.
* **Réservations de groupe / Famille** : Possibilité de réserver pour des proches (Family Members) ou d'effectuer des réservations groupées (Booking Groups) avec résolution automatique des conflits de planning.
* **Chaînage de services** : Réservation de plusieurs services à la suite pour un même client (ex: coupe + brushing) avec coordination automatique des créneaux.
* **Gestion du statut des RDV** : En attente (`PENDING`), Confirmé (`CONFIRMED`), En cours (`IN_PROGRESS`), Terminé (`COMPLETED`), Annulé (`CANCELLED`), Absent (`NO_SHOW`).

### 3. Facturation Client & Abonnement Plateforme
* **Factures de vente (SALE)** : Générées automatiquement à partir des RDV terminés. Documentent ce que le client paie au salon pour les prestations reçues.
* **Abonnements Plateforme (SUBSCRIPTION)** : Factures récurrentes que le propriétaire du salon paie à REZA pour l'utilisation de la plateforme (gérées via Stripe).
* **Mouvements de Caisse** : Enregistrement des dépôts (`DEPOSIT`), retraits (`WITHDRAWAL`) et remboursements (`REFUND`) pour le suivi de caisse quotidien.

### 4. Avis Clients & Modération
* **Évaluation post-prestation** : Notes de 1 à 5 étoiles et commentaires laissés par les clients.
* **Modération professionnelle** : Validation (`APPROVED`) ou rejet (`REJECTED`) des avis par l'administrateur du salon avant publication sur la fiche vitrine.

### 5. Notifications & Communication
* **Centre de notifications** : Rappels de rendez-vous, confirmations, alertes d'avis à modérer et notifications système en temps réel pour le staff et les clients.

---

## 03 guide utilisateur

### Mode d'emploi - Client (Web & Mobile)
1. **Recherche & Exploration** : Parcourir les salons par ville, catégorie (coiffure, barbier, spa, etc.), note globale ou géolocalisation sur carte interactive.
2. **Consultation de Fiche** : Visualiser la galerie photo, la liste des prestations avec tarifs/durées, les horaires d'ouverture et les avis vérifiés.
3. **Réservation** : Sélectionner les soins, choisir l'employé (optionnel), définir la date et l'heure puis valider le RDV.
4. **Espace Personnel** : Gérer ses RDV à venir/passés, ses proches (membres de famille), ses salons favoris et ses avis.

### Mode d'emploi - Professionnel (Web & Mobile Pro)
1. **Tableau de Bord & Stats** : Visualiser le chiffre d'affaires quotidien/mensuel, le taux d'occupation des collaborateurs et le nombre de réservations.
2. **Planning & Agenda** : Vues jour/semaine/mois dynamiques, création de RDV physiques en salon, blocage de créneaux.
3. **Catalogue & Équipe** : Gestion des collaborateurs (planning, compétences, couleur d'agenda) et des prestations (durée, tarifs, visibilité).
4. **Caisse & Facturation** : Enregistrement du règlement, impression/export des factures (PDF), clôture de caisse.
5. **Gestion de l'Abonnement SaaS** : Suivi de la formule souscrite, gestion des moyens de paiement et factures de la plateforme.

---

## 04 architecture technique

### Architecture Système & Stack Technologique

```
+-------------------------------------------------------------------------+
|                               CLIENTS                                   |
|   +-------------------+  +-------------------+  +--------------------+  |
|   |      Web Client / Pro      |  |      Mobile Client/Pro       |  |
|   |  (Next.js 15/16)  |  |  (Flutter / Dart) |  |  (Next.js 15)      |  |
|   +---------+---------+  +---------+---------+  +---------+----------+  |
+-------------|----------------------|----------------------|-------------+
              |                      |                      |
              +----------------------+----------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         BACKEND API (Node.js / TS)                      |
|                                Express.js                               |
|  +-------------------------------------------------------------------+  |
|  | Middlewares: Auth (JWT), Tenant Isolation, Helmet, CORS             |  |
|  +-------------------------------------------------------------------+  |
|  | Modules: Auth, Tenant, Client, Employee, Service, Appointment...  |  |
|  +-------------------------------------------------------------------+  |
|                                    |                                    |
|                              Prisma ORM                                 |
+------------------------------------|------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            BASE DE DONNÉES                              |
|                            PostgreSQL DB                                |
+-------------------------------------------------------------------------+
```

### Structures des Repositories

```
REZA/
├── Backend/                 # Serveur Node.js Express & API REST
│   ├── prisma/              # Schema Prisma DB & Migrations
│   ├── src/
│   │   ├── lib/             # Client Prisma & utilitaires
│   │   ├── middleware/      # Auth JWT, Tenant Middleware, Error Handling
│   │   ├── modules/         # Modules métier (Auth, Salon, RDV, Caisse, etc.)
│   │   └── server.ts        # Point d'entrée du serveur Express
│   ├── public/uploads/      # Fichiers statiques (photos uploadées)
│   ├── seed/                # Script de démonstration / seed base
│   └── render.yaml          # Configuration de déploiement Render.com
│
├── Web/                     # Applications Web Frontend (Next.js)
│   ├── reza-client/         # Portail Client Web (réservation + vitrine)
│   └── reza-pro/            # Dashboard Gestion Pro & SaaS Admin
│
└── Mobile/                  # Applications Mobiles (Flutter)
    ├── reza_client_mobile/  # App Mobile Client (iOS / Android)
    └── reza_pro_mobile/     # App Mobile Pro (iOS / Android)
```

### Modèles de Données Principaux (Prisma Schema)
* **Account & Subscription** : Gestion des comptes propriétaires et abonnements Stripe.
* **Tenant & TenantSettings** : Organisme/Salon avec configuration horaires, géolocalisation, thèmes.
* **User & Client** : Utilisateurs staff/admin du salon vs clients finaux.
* **Service & Employee** : Catalogue de prestations et gestionnaires/collaborateurs.
* **Appointment & AppointmentServiceItem** : Réservations et détails des soins associés.
* **Invoice & CashTransaction** : Factures émises et mouvements de caisse.

---

## 05 api reference

L'API REZA est une API REST JSON exposée par défaut sur `/api`.

### Authentification & Accès Public
* `POST /api/auth/register` - Inscription nouvel utilisateur / salon.
* `POST /api/auth/login` - Connexion et génération du token JWT.
* `GET /api/public/tenants` - Recherche publique de salons (filtres ville, catégorie, nom).
* `GET /api/public/tenant/:identifier` - Détails d'un salon et ses services bookables.
* `GET /api/public/tenant/:tenantId/available-slots` - Créneaux de disponibilité en temps réel.
* `GET /api/public/availability/stream` - Streaming SSE des disponibilités (mise à jour temps réel).

### Client Authentication (Public)
* `POST /api/public/auth/client-register` - Inscription d'un client final.
* `POST /api/public/auth/client-login` - Connexion client et génération du token JWT.

### Booking System (Public)
* `POST /api/public/bookings` - Créer une réservation (individuelle, groupe, chaîne de services).
* `POST /api/public/tenant/:tenantId/available-slots` - Vérifier les créneaux (avec paramètres dans le body).
* `GET /api/public/tenant/:tenantId/employee-availability` - Disponibilités par collaborateur.
* `POST /api/public/tenant/:tenantId/resolve-conflicts` - Résolution de conflits pour les réservations de groupe.
* `PUT /api/public/appointments/:id/cancel` - Annulation d'un rendez-vous par le client.
* `GET /api/public/client/:email/appointments` - Rendez-vous d'un client.

### Client Profile & Favoris (Public)
* `GET /api/public/client/:email/favorites` - Liste des salons favoris.
* `POST /api/public/favorites` - Ajouter un favori.
* `DELETE /api/public/favorites/:id` - Supprimer un favori.
* `PUT /api/public/client/:email` - Mettre à jour le profil client.
* `PUT /api/public/client/:email/change-password` - Changer le mot de passe.

### Salons & Paramètres Tenant (Protégés)
* `GET /api/tenant` - Récupérer les informations du tenant actif.
* `PUT /api/tenant` - Mettre à jour les informations du tenant.
* `GET /api/tenant/settings` - Récupérer les paramètres.
* `PUT /api/tenant/settings` - Mettre à jour les paramètres de l'établissement.

### Multi-Salon (Protégé)
* `POST /api/auth/switch-salon` - Basculer vers un autre salon du même compte (ré-émet un JWT).
* `GET /api/salons` - Lister les salons du compte propriétaire.
* `POST /api/salons` - Créer un nouveau salon.
* `PATCH /api/salons/:id` - Modifier un salon.
* `DELETE /api/salons/:id` - Désactiver un salon.

### Clients & Proches (Staff & Admin)
* `GET /api/clients` - Liste des clients du salon (pagination, recherche).
* `POST /api/clients` - Création d'un client.
* `GET /api/family-members` - Gestion des membres de la famille d'un client.

### Prestations & Collaborateurs
* `GET /api/services` - Liste des services.
* `POST /api/services` - Ajouter une prestation.
* `GET /api/employees` - Liste des collaborateurs et agendas.

### Rendez-vous & Factures
* `GET /api/appointments` - Planning des rendez-vous.
* `POST /api/appointments` - Créer un RDV (unique ou multi-prestations).
* `PUT /api/appointments/:id` - Mettre à jour un RDV.
* `GET /api/invoices` - Consulter les factures.
* `POST /api/cash-transactions` - Enregistrer un mouvement de caisse.

### Avis, Statistiques & Abonnements
* `GET /api/reviews` - Consulter et modérer les avis clients.
* `GET /api/stats` - Reporting du chiffre d'affaires et fréquentation.
* `POST /api/subscription/checkout` - Session de paiement Stripe pour abonnement SaaS.
* `POST /api/webhooks/stripe` - Webhook de traitement asynchrone des paiements Stripe.

### Health
* `GET /health` - Vérification de l'état du serveur (utilisé par le healthcheck Docker).

---

## 06 securite conformite

1. **Authentification & Authorization**
   * Sessions basées sur JSON Web Tokens (JWT) signés.
   * Modèle RBAC (Role-Based Access Control) : `SUPER_ADMIN`, `ADMIN`, `STAFF`, `RECEPTIONIST`.

2. **Isolation des Données Multi-Tenant**
   * Filtrage strict au niveau ORM Prisma grâce au middleware `tenantMiddleware` vérifiant la correspondance entre le Token utilisateur et le `tenantId` de la requête.

3. **Protection Réseau & En-têtes HTTP**
   * En-têtes de sécurité renforcés via **Helmet**.
   * Configuration **CORS** stricte limitant les requêtes cross-origin aux seuls domaines frontend autorisés (`FRONTEND_URL`, `PRO_APP_URL`, `CLIENT_APP_URL`).
   * Vérification des signatures cryptographiques sur les Webhooks Stripe.

4. **Sécurité des Données & Mots de Passe**
   * Hachage fort des mots de passe via `bcryptjs` (salt rounds).
   * Validation rigoureuse des schémas d'entrée avec `Zod`.

---

## 07 deploiement

### 1. Variables d'Environnement (Backend `.env`)
```env
PORT=5000
NODE_ENV=production

DATABASE_URL="postgresql://user:password@localhost:5432/reza_db?schema=public"

JWT_SECRET="votre_cle_secrete_jwt_robuste"
JWT_EXPIRES_IN=7d

# URLs des applications frontend (utilisées pour la configuration CORS)
FRONTEND_URL="http://localhost:3000"
PRO_APP_URL="http://localhost:3001"
CLIENT_APP_URL="http://localhost:3002"
# Stripe
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

### 2. Configuration de la Base de Données
Le projet utilise **Prisma ORM** avec `prisma.config.ts`. Génération du client et migrations :
```bash
npm run db:generate    # Génère le client Prisma (obligatoire avant les migrations)
npm run db:migrate:deploy  # Applique les migrations en production
```

### 3. Données de Démonstration (Seed)
Un script de seed est disponible pour initialiser la base avec des données de démonstration :
```bash
npm run seed
```
**Attention** : La commande supprime toutes les données existantes avant d'insérer les données de démo.

Comptes de démonstration après seed :

| Rôle | Email | Mot de passe | Application |
|------|-------|-------------|-------------|
| Pro admin (2 salons) | `admin@spa-royal.ma` | `password123` | reza-pro |
| SuperAdmin | `superadmin@gmail.com` | `123456` | reza-pro → `/superadmin` |
| Client B2C | `client1@gmail.com` | `123456` | reza-client |

### 4. Déploiement Backend (Render / Manuel)
* **Render.com** : Un fichier `render.yaml` est disponible pour le déploiement via Render Blueprint. La commande `preDeployCommand` exécute `npx prisma migrate deploy` automatiquement.
* **Manuel** :
  ```bash
  npm run build
  npm start
  ```

### 5. Déploiement Frontend (Web Next.js)
* **Commandes de Build (dans chaque dossier Next.js)** :
  ```bash
  npm install
  npm run build
  npm start
  ```

### 6. Déploiement Mobile (Flutter)
* **Configuration IP LAN automatique** (En mode développement, le script backend met à jour automatiquement `auto_ip.dart`).
* **Build de Production Android / iOS** :
  ```bash
  # Android APK / Bundle
  flutter build apk --release
  flutter build appbundle --release

  # iOS App Store
  flutter build ipa --release
  ```

---

© 2026 REZA Platform - Tous droits réservés.
