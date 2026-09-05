# API

Express JSON API op dezelfde poort als de website (standaard **5055**).

Bron van waarheid voor het endpoint-overzicht in de app: `server/api/endpointCatalog.js`.

---

## Live API-pagina

Ingelogde gebruikers kunnen een HTML-overzicht openen:

| URL | Beschrijving |
|---|---|
| [`/api`](http://localhost:5055/api) | Alle endpoints (method, pad, auth, beschrijving) |
| [`/api?format=json`](http://localhost:5055/api?format=json) | Zelfde overzicht als JSON |

- Zonder login: redirect naar `/inloggen?return=/api`
- Met Accept `application/json` of `?format=json`: JSON-response
- Link terug naar de app staat op de pagina

Houd `endpointCatalog.js` bij als je endpoints toevoegt of wijzigt; die catalogus voedt zowel `/api` als deze documentatie.

---

## Auth & sessie

- Cookie-sessie (`express-session` + MongoDB-store)
- Mutaties op projecten vereisen login (`Session expired` bij 401)
- Publieke GET’s: projecten, meta, foto-bestanden, duimpjes
- Admin/eigenaar: soft-deleted items zien, herstellen, definitief wissen

Login-UI: **`/inloggen`** (alias `/auth` → redirect).

---

## Endpoints

Legenda auth: **open** = geen login, **login** = sessie verplicht.

### Algemeen

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| GET | `/api` | login | API-overzichtspagina (HTML of JSON) |
| GET | `/api/health` | open | Healthcheck (MongoDB, mode, client-build) |
| GET | `/api/config` | open | Publieke runtime-config (o.a. URL van de feedback-app) |

### Auth

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| GET | `/api/auth/me` | open | Huidige sessie / gebruiker |
| POST | `/api/auth/login` | open | Inloggen (JSON: `email`, `pw`) |
| GET | `/api/auth/logout` | open | Uitloggen |
| POST | `/api/auth/create-login` | open | Toegang aanvragen (JSON: `name`, `email`, `reason`) |
| GET | `/api/auth/create-confirm` | open | Admin: aanvraag goedkeuren (query + secret) |
| GET | `/api/auth/create-denied` | open | Admin: aanvraag afwijzen (query + secret) |
| GET | `/api/auth/reset-login` | open | Nieuw wachtwoord aanvragen (`?email=`) |

### Projecten

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| GET | `/api/projects/meta` | open | Types, glasfusion-opties, ovens, saleStatuses, labelcatalogus |
| GET | `/api/projects/featured` | open | Publieke foto met de meeste duimpjes (homepage) |
| GET | `/api/projects` | open | Lijst projecten (`?deleted=1`, `?mine=1`) |
| POST | `/api/projects` | login | Nieuw project (multipart) |
| GET | `/api/projects/:id` | open | Project ophalen |
| POST | `/api/projects/:id/interest` | open | Interesse doorgeven (te koop; mail naar admin) |
| PUT | `/api/projects/:id` | login | Project bijwerken (multipart, o.a. `labels`, `saleStatus`, `saleTitle`, `saleDescription`, `oven`, `firingSchedule`) |
| DELETE | `/api/projects/:id` | login | Soft-delete (prullenbak) |
| POST | `/api/projects/:id/restore` | login | Terugzetten |
| DELETE | `/api/projects/:id/permanent` | login | Definitief wissen (na soft-delete) |

Query’s op `GET /api/projects`:

- (geen) — alle niet-verwijderde projecten (publiek)
- `?mine=1` — eigen + projecten zonder eigenaar (login vereist)
- `?deleted=1` — prullenbak (login; admin ziet alles, anderen alleen eigen)

### Projectfoto’s

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| GET | `/api/projects/:id/photos/:photoId/file` | open | Foto streamen (publiek: alleen hoofdfoto/`isPublic`) |
| POST | `/api/projects/:id/photos` | login | Foto’s toevoegen (multipart `photos`) |
| POST | `/api/projects/:id/photos/:photoId/thumb` | open | Duimpje (max. 1× per sessie/gebruiker) |
| POST | `/api/projects/:id/photos/:photoId/cover` | login | Foto vooraan zetten als hoofdfoto (projectkaart) |
| POST | `/api/projects/:id/photos/:photoId/public` | login | Foto markeren als publiek of werkfoto (`isPublic`) |
| PUT | `/api/projects/:id/photos/order` | login | Projectfoto’s herschikken (`photoIds`; eerste = hoofdfoto) |
| DELETE | `/api/projects/:id/photos/:photoId` | login | Foto verwijderen |

### Stappen

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| POST | `/api/projects/:id/steps` | login | Stap toevoegen |
| PUT | `/api/projects/:id/steps/:stepId` | login | Stap bijwerken |
| DELETE | `/api/projects/:id/steps/:stepId` | login | Soft-delete |
| POST | `/api/projects/:id/steps/:stepId/restore` | login | Terugzetten |
| DELETE | `/api/projects/:id/steps/:stepId/permanent` | login | Definitief wissen |
| GET | `/api/projects/:id/steps/:stepId/photos/:photoId/file` | login | Stapfoto streamen (alleen beheer) |
| POST | `/api/projects/:id/steps/:stepId/photos` | login | Foto’s bij stap |
| POST | `/api/projects/:id/steps/:stepId/photos/:photoId/thumb` | open | Duimpje op stapfoto |
| DELETE | `/api/projects/:id/steps/:stepId/photos/:photoId` | login | Stapfoto verwijderen |

---

## Request-vormen

### Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "pw": "geheim" }
```

### Project (multipart)

Velden o.a.: `title` (projecttitel), `type`, `notes` (project notitie), `kwhUsage`, `costPrice`,  
`glasfusionTechnique`, `glasfusionSpeed`, `oven` (code),  
`firingSchemaId`, `firingSchedule` (JSON-segmenten),  
`saleStatus`, `saleTitle`, `saleDescription`,  
`labels` (JSON-string van `[{ "name", "color" }]`),  
bestanden onder `photos`.

### Stookschema’s

| Method | Pad | Auth | Beschrijving |
|---|---|---|---|
| GET | `/api/firing-schemas` | login | Lijst opgeslagen schema’s |
| POST | `/api/firing-schemas` | login | Nieuw schema (`name`, `segments`, optioneel `technique`, `oven`) |
| PUT | `/api/firing-schemas/:id` | login | Schema bijwerken |
| DELETE | `/api/firing-schemas/:id` | login | Schema verwijderen |

Segment: `{ "rate": 150 | null, "targetTemp": 800, "holdMinutes": 10 }`. `rate` leeg/null = vol.

### Duimpjes

Publiek. Per foto max. één keer per ingelogde gebruiker of anonieme browsersessie (`thumbedBy` + cookie-sessie). Response bevat `thumbedByMe` op foto’s.

---

## Fouten (typisch)

| Status | Betekenis |
|---|---|
| 401 | Geen / verlopen sessie |
| 403 | Geen rechten (bijv. andermans prullenbak) |
| 404 | Niet gevonden (of soft-deleted voor publiek) |
| 409 | Duimpje al gegeven |
| 400 | Validatiefout |

Zie ook [DATABASE.md](./DATABASE.md) voor het datamodel.
