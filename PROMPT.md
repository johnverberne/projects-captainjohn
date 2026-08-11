# Generator-prompt: Captain John — Atelierprojecten

Plak het blok hieronder in een AI-agent in een lege map om de applicatie vanaf nul te genereren.

---

```text
Bouw de volledige applicatie **Captain John — Atelierprojecten** vanaf nul, als werkende monorepo. Lever alle code, configuratie, docs en tests op zodat `npm run install:all && npm run prod` een complete app start op http://localhost:5055.

## Product
Nederlandstalige, mobile-first atelier-projecttracker voor craft-projecten (glasfusion, tiffany, glas-in-lood, hout, keramiek, tassen, overige).
- Publiek: projecten bekijken, detail openen, duimpjes op foto’s, featured foto met meeste likes.
- Ingelogd: CRUD voor projecten, stappen (“extra stappen”), foto’s (galerij/camera), labels met kleur, kWh/kostprijs/verkoopprijs, soft-delete prullenbak (herstellen/definitief wissen).
- Toegang op uitnodiging: “Aanmelden” = aanvraag (naam, e-mail, reden). Admin keurt goed/af via e-maillinks. Bij goedkeuring: gegenereerd niceware-wachtwoord (argon2) per mail. Geen zelfgekozen wachtwoord bij signup.
- Merk: “Captain John / atelier projecten”. UI-taal: Nederlands.

## Tech stack (exact)
- Frontend: Vue 3 + Vue Router 4 + Vite 6 in `client/`
- Backend: Express 4 (CommonJS), één proces serveert API + SPA
- DB: MongoDB via Mongoose 8; productiedb-naam `project-captainjohn`
- Sessies: express-session + connect-mongo; cookie httpOnly, sameSite=lax, maxAge 7 dagen, rolling
- Auth: argon2 wachtwoorden; niceware passphrases
- Mail: nodemailer (SMTP); zonder SMTP → log naar serverconsole; in non-secure mode mag `devPassword` in JSON
- Uploads: multer (memory) → GridFS bucket `photos` (images only, ≤12MB, ≤20 files)
- Tests: node:test + supertest (unit/API); Playwright e2e met video “film”
- CI: GitHub Actions op push/PR, MongoDB 7 service, Node 22, artifacts voor report + webm
- Default poort: 5055, listen 0.0.0.0; `trust proxy` 1; Railway-ready met `COOKIE_SECURE=true`

## Repo-structuur
```
/
├── README.md, package.json, playwright.config.js, .env.example, .gitignore
├── .github/workflows/ci.yml
├── docs/API.md, docs/DATABASE.md
├── client/
│   ├── index.html, vite.config.js, package.json
│   ├── public/logo-captainjohn.png
│   └── src/
│       ├── main.js, App.vue, router.js, api.js, auth.js, labels.js, styles.css
│       ├── views/ HomeView.vue, ProjectDetailView.vue, NewProjectView.vue, AuthView.vue
│       └── components/ LabelPicker.vue, PhotoUploadPicker.vue, ProjectOptionFields.vue
├── server/
│   ├── server.js, createApp.js, loadEnv.js
│   ├── api/ auth.js, projects.js, apiDocs.js, endpointCatalog.js
│   ├── model/ user, project, label
│   ├── middleware/auth.js
│   ├── services/ photoStorage, labels, mail
│   └── config/db.js
├── scripts/ build-client.js, prod.js, create-user.js, make-admin.js, seed-e2e.js, test-server.js
└── tests/ unit/, api/, e2e/, helpers/
```

Houd `server/api/endpointCatalog.js` als single source of truth voor `/api` (HTML+JSON) én docs/API.md.

## Domain model
### User
name, email (unique, lowercase), pw (argon2), roles[] (default `["editor"]`; admin via role `admin` en/of `ADMIN_EMAIL`), loginCount, lastLogin, active, timestamps.

### Project
- title (required)
- type enum: `glasfusion | tiffany | glas-in-lood | hout | keramiek | tassen | overige`
- bij glasfusion verplicht: glasfusionTechnique ∈ `slump|fuse|cast`, glasfusionSpeed ∈ `fast|medium|slow|ultra-slow`
- notes, kwhUsage, costPrice, sellingPrice (≥0 of null)
- ownerEmail; soft-delete deletedAt/deletedBy
- embedded: labels[{name,color}], photos[Photo], steps[Step]

### Step (embedded)
Zelfde craft-velden als project (title optioneel), eigen photos, eigen soft-delete. Geen sellingPrice / project-labels.

### Photo (embedded)
fileId (GridFS), filename, originalName, mimetype, size, legacy url, thumbsUp, thumbedBy[] (`user:email` of `anon:uuid`). API serialiseert met url-pad + thumbedByMe.

### Label (catalogus)
name, nameKey (unique lowercase), color hex, createdBy. Project bewaart een kopie; opslaan upsert catalogus (max 20 labels/project, naam ≤40 chars).

### Access
- Admin (ADMIN_EMAIL of role) ziet alle trash
- Eigenaar beheert eigen items
- Projects met ownerEmail null: claimbaar/bewerkbaar door elke ingelogde user
- Publieke responses strippen kwhUsage/costPrice en verbergen deleted steps
- Mutaties zonder sessie → 401 `{ error: "Session expired" }`

## Routes (Vue)
| Path | View | Meta |
|---|---|---|
| `/` | HomeView | public |
| `/project/:id` | ProjectDetailView | public |
| `/inloggen` | AuthView | guest (tabs: Inloggen / Aanmelden / Wachtwoord kwijt?) |
| `/auth` | redirect → `/inloggen` | |
| `/bewerken` | HomeView | requiresAuth + editMode |
| `/bewerken/nieuw` | NewProjectView | auth |
| `/bewerken/project/:id` | ProjectDetailView | auth |
| `/nieuw` | redirect → `/bewerken/nieuw` | |

Gedrag:
- Ingelogde users vanaf publieke routes → `/bewerken` (detail → `/bewerken/project/:id`)
- Uitloggen → publieke site
- App-shell: brand “Captain John / atelier projecten”, Mongo-statusdot via `/api/health`, user chip + Uitloggen/Inloggen
- Home: logo-hero, lead “Bekijk de atelierprojecten…”, featured foto, projectcards (thumb, type-badge, stappen-count, labels, datum, fotocount, sellingPrice indien gezet)
- Detail publiek: notes, fotogrid+thumbs, steps, lightbox (Esc); geen edit
- Edit detail modes: view / edit-project / add-step / edit-step; totals kWh/cost over project+steps; confirm dialogs voor delete/restore/purge
- PhotoUploadPicker: “Lokale foto” / “Foto nemen” (`capture="environment"`)
- LabelPicker: catalogus-toggle + 8 swatches + custom color
- ProjectOptionFields: gedeelde type/glasfusion/kWh/cost/notes/labels/selling velden
- Client fetch met `credentials: "include"`; thumb 409+project body behandelen als succespayload
- nl-NL formatting voor datum/valuta/kWh; max-width ~640px; safe-area padding

## API (zelfde origin, poort 5055)
### Algemeen
- GET `/api/health` open → `{ ok, mongo, db, mode, client }`
- GET `/api` login → HTML catalogus of `?format=json` / Accept application/json

### Auth
- GET `/api/auth/me` → `{ login, user }`
- POST `/api/auth/login` `{ email, pw }` (accepteer ook `password`)
- GET `/api/auth/logout`
- POST `/api/auth/create-login` `{ name, email, reason }`
- GET `/api/auth/create-confirm?email&name&secret=`
- GET `/api/auth/create-denied?email&secret=`
- GET `/api/auth/reset-login?email=`

### Projects
- GET `/api/projects/meta` — types, techniques, speeds, label catalog
- GET `/api/projects/featured`
- GET `/api/projects` — `?mine=1`, `?deleted=1`
- POST `/api/projects` multipart: title,type,notes,kwhUsage,costPrice,sellingPrice,glasfusion*, labels JSON, photos
- GET/PUT/DELETE `/api/projects/:id` (DELETE = soft)
- POST `/api/projects/:id/restore`
- DELETE `/api/projects/:id/permanent` (alleen na soft-delete) → `{ ok: true }`
- Photo: GET file, POST upload, DELETE; POST thumb (publiek; 409 als al geduimd, return nog steeds project)
- Steps: POST/PUT/DELETE, restore, permanent, nested photo file/upload/thumb/delete
- Typische errors: 400 validatie, 403 rechten, 404 missing/deleted public, 409 double thumb

Documenteer alles in `docs/API.md` en `docs/DATABASE.md`. Live `/api` pagina hergebruikt fonts/kleuren van de app.

## Env (.env.example)
MONGO_URI, MONGO_SESSION_URI (fallback MONGO_URI), SESSION_SECRET (dev default `captainjohn-dev`), DEV, COOKIE_SECURE, PORT (5055), ADMIN_EMAIL, CREATE_SECRET, SMTP_*, FROM_EMAIL, ALLOW_NO_CLIENT (tests zonder client/dist), E2E_EMAIL/E2E_PASSWORD/E2E_NAME.
loadEnv mag ontbrekende mail-keys optioneel uit sibling `../bdeditor/.env` trekken.

## npm scripts
install:all, build (scripts/build-client.js → client/dist), start, prod, dev (build+nodemon), dev:vite (API 5055 + Vite 5173 met proxy /api en /uploads), test, test:unit, test:api, test:node, test:e2e, seed:e2e.
Helpers: `node scripts/create-user.js <email> <password> [name]`, `node scripts/make-admin.js <email>`.

## Design (niet generiek AI-paars)
- Fonts: Fraunces (display/brand) + Source Sans 3 (body) via Google Fonts
- CSS vars: --ink #1c2422, --paper #f3efe6, --sea #1a3a3a, --sea-mid #2a5554, --copper #b85c38, --copper-deep #8f4024, --ok #2f6b4f, --danger #9b2c2c
- Achtergrond: gelaagde radial gradients (teal + copper wash) over warm paper — geen flat white
- Frosted panels, soft shadow, radius ~14px, primary buttons met sea-gradient, choice tiles met active teal wash
- Logo PNG hero op home; brand-bar altijd productnaam als primaire identiteit
- theme-color #1a3a3a, apple-mobile-web-app-capable
- Motion: lichte hover-lift op featured foto; button :active scale 0.98; choice transitions
- Geen dashboard-look; één compositie; mobile-first ~640px shell

## Tests
- Unit: labels normalize/parse
- API (supertest + createApp({ allowNoClient: true })): health, login/me, public list, create-auth flow, soft-delete/restore, steps, thumbs 409, featured, /api docs
- E2E Playwright serial “film” video:on; webServer = scripts/test-server.js (build indien nodig + seed + listen). Flow: publiek → login → project+label+foto → stap → trash → restore → logout
- Seed e2e: user e2e@example.com / e2e-pass-123 (editor+admin); project “E2E showcase project” glasfusion/fuse/medium; label E2E #2f6b4f
- API helper user: tester@example.com / test-pass-123
- Test DBs: project-captainjohn-test, -e2e, CI -ci; lokaal Mongo op 127.0.0.1:27017
- CI workflow: unit+API+e2e, upload playwright-report + test-results webm

## README
Nederlandse README met: doel, route-tabel, één-poort workflow, optionele Vite-dev, account/invite-flow, functies, tests/CI, MongoDB-notitie.

## Implementatievolgorde
1. Root package + Express createApp + health + SPA serve
2. Mongoose models + db + session store
3. Auth API + mail + invite approve/deny + reset
4. Projects/steps/photos/labels API + GridFS
5. endpointCatalog + /api docs pagina + docs/*
6. Vue client (router, api, auth, views, components, styles)
7. Scripts (build, prod, create-user, make-admin, seed-e2e, test-server)
8. Unit + API + Playwright + CI
9. .env.example + README

## Acceptatiecriteria
- `npm run install:all && npm run build && npm start` serveert UI+API op :5055
- Publiek browsen + duimpjes werkt zonder login
- Invite → admin approve → login met gemaild wachtwoord werkt (of SMTP-log fallback)
- Ingelogd: project/stap/foto/label CRUD + soft-delete trash
- Publiek ziet geen interne kostenvelden
- `npm run test:node` en `npm run test:e2e` groen met lokale Mongo
- Design volgt de sea/copper/paper + Fraunces look, niet een generiek paars/cream template

Lever de volledige werkende codebase op, geen stubs of “TODO later” voor kernflows.
```
