# Generator-prompt: Captain John — Atelierprojecten

Plak het blok hieronder in een AI-agent in een lege map om de applicatie vanaf nul te genereren.

---

```text
Bouw de volledige applicatie **Captain John — Atelierprojecten** vanaf nul, als werkende monorepo. Lever alle code, configuratie, docs en tests op zodat `npm run install:all && npm run prod` een complete app start op http://localhost:5055.

## Product
Nederlandstalige, mobile-first atelier-projecttracker voor craft-projecten (glasfusion, tiffany, glas-in-lood, hout, keramiek, tassen, overige).
- Publiek: projecten bekijken, detail openen, duimpjes op foto’s, featured foto met meeste likes, verkoopprijs tonen als gezet.
- Ingelogd: CRUD voor projecten, stappen (“extra stappen”), foto’s (galerij/camera), labels met kleur, kWh/kostprijs/verkoopprijs, soft-delete prullenbak (herstellen/definitief wissen).
- Toegang op uitnodiging: “Aanmelden” = aanvraag (naam, e-mail, reden). Admin keurt goed/af via e-maillinks. Bij goedkeuring: gegenereerd niceware-wachtwoord (argon2) per mail. Geen zelfgekozen wachtwoord bij signup.
- Merk: “Captain John / atelier projecten”. UI-taal: Nederlands.

## Tech stack (exact)
- Root package: `projects-captainjohn`, `"type": "commonjs"`
- Frontend: Vue 3 (^3.5) + Vue Router 4 (^4.5) + Vite 6 (^6.2) + `@vitejs/plugin-vue` in `client/`
- Backend: Express 4 (CommonJS), één proces serveert API + SPA; deps o.a. body-parser, cors, connect-history-api-fallback, dotenv
- DB: MongoDB via Mongoose 8; productiedb-naam `project-captainjohn`
- Sessies: express-session + connect-mongo; `proxy: true`, cookie httpOnly, sameSite=lax, maxAge 7 dagen, rolling
- Auth: argon2 wachtwoorden; niceware passphrases
- Mail: nodemailer (SMTP); zonder SMTP → log naar serverconsole; `devPassword` in JSON wanneer `DEV=true` of `COOKIE_SECURE !== "true"`
- Uploads: multer memory, veld `photos`, fileSize 12MB, max 20 files → GridFS bucket `photos`; legacy disk `server/uploads/` + static `/uploads`; bij start legacy → GridFS migratie (`migrateLegacyPhoto`)
- body-parser JSON/urlencoded limit 10mb; CORS met credentials (localhost / 192.168.*)
- Tests: node:test + supertest (unit/API); Playwright e2e met video “film”; devDeps concurrently, nodemon, @playwright/test, supertest
- CI: GitHub Actions op push/PR, concurrency cancel-in-progress, MongoDB 7 + mongosh health, Node 22, artifacts 14 dagen
- Default poort: 5055, listen 0.0.0.0; `trust proxy` 1; Railway-ready met `COOKIE_SECURE=true`

## Repo-structuur
```
/
├── README.md, PROMPT.md, package.json, playwright.config.js, .env.example, .gitignore
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
│   ├── model/ user.model.js, project.model.js, label.model.js
│   ├── middleware/auth.js
│   ├── services/ photoStorage.js, labels.js, mail.js
│   ├── config/db.js
│   └── uploads/          # legacy foto’s (optioneel)
├── scripts/ build-client.js, prod.js, create-user.js, make-admin.js, seed-e2e.js, test-server.js
└── tests/
    ├── unit/labels.test.js
    ├── api/health-auth-projects.test.js
    ├── e2e/app-film.spec.js
    └── helpers/ env.js, db.js, app.js
```

Houd `server/api/endpointCatalog.js` als single source of truth voor `/api` (HTML+JSON) én docs/API.md.
`createApp({ allowNoClient, mongoUri, mongoSessionUri, sessionSecret })` is de app-factory voor prod, tests en `scripts/test-server.js`.
`server/server.js`: listen → Mongo connect → legacy photo migratie.

.gitignore moet o.a. bevatten: `client/dist/`, `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`, `.env`.

## Domain model
### User
name, email (unique, lowercase), pw (argon2), roles[] (default `["editor"]`; admin via role `admin` en/of `ADMIN_EMAIL`), loginCount, lastLogin, active, timestamps.
`ADMIN_EMAIL` default in code: `john.verberne@gmail.com`. `CREATE_SECRET` fallback: `SESSION_SECRET` of `"captainjohn-create"`.

### Project
- title (required)
- type enum: `glasfusion | tiffany | glas-in-lood | hout | keramiek | tassen | overige`
- bij glasfusion verplicht: glasfusionTechnique ∈ `slump|fuse|cast`, glasfusionSpeed ∈ `fast|medium|slow|ultra-slow`
- notes, kwhUsage, costPrice, sellingPrice (≥0 of null)
- ownerEmail; soft-delete deletedAt/deletedBy
- embedded: labels[{name,color}], photos[Photo], steps[Step]
Documenteer `sellingPrice` in zowel `docs/DATABASE.md` als `docs/API.md` (multipart-velden).

### Step (embedded)
Zelfde craft-velden als project (title optioneel), eigen photos, eigen soft-delete. Geen sellingPrice / project-labels.

### Photo (embedded)
fileId (GridFS), filename, originalName, mimetype, size, legacy url, thumbsUp, thumbedBy[] (`user:email` of `anon:uuid`). API serialiseert met url-pad + thumbedByMe.

### Label (catalogus)
name, nameKey (unique lowercase), color hex (fallback `#2a5554`, 3-digit hex expand), createdBy. Project bewaart een kopie; opslaan upsert catalogus (max 20 labels/project, naam ≤40 chars).

### Access
- Admin (ADMIN_EMAIL of role) ziet alle trash
- Eigenaar beheert eigen items
- Projects met ownerEmail null: claimbaar/bewerkbaar door elke ingelogde user
- Publieke responses strippen alleen kwhUsage/costPrice (sellingPrice blijft zichtbaar) en verbergen deleted steps
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

Gedrag & copy:
- Ingelogde users vanaf publieke routes → `/bewerken` (detail → `/bewerken/project/:id`)
- Uitloggen → publieke site
- App-shell brand-bar: “Captain John” + span “atelier projecten”; Mongo-statusdot via `/api/health`; user chip + Uitloggen/Inloggen
- Public lead: `Bekijk de atelierprojecten van Captain John.`
- Edit lead: `Bewerk je atelierprojecten vanaf je telefoon.`
- Public detail hint: `Publieke weergave — alleen bekijken.`
- CTA: `Nieuw project starten`; trash heading: `Verwijderde projecten`
- Home: logo-hero, featured foto, projectcards (thumb, type-badge, stappen-count, labels, datum, fotocount, sellingPrice alleen als gezet)
- Detail publiek: notes, fotogrid+thumbs, steps, lightbox (Esc); geen edit
- Edit detail modes: view / edit-project / add-step / edit-step; totals kWh/cost over project+steps; confirm dialogs voor delete/restore/purge
- PhotoUploadPicker: “Lokale foto” / “Foto nemen” (`capture="environment"`)
- LabelPicker: catalogus-toggle + swatches `#b85c38 #1a3a3a #2f6b4f #3d5a80 #8b3a4a #6b4f3a #c4a35a #4a6670` + custom color
- ProjectOptionFields: gedeelde type/glasfusion/kWh/cost/notes/labels/selling velden
- `client/src/labels.js`: TYPE_LABELS / TECHNIQUE_LABELS / SPEED_LABELS, craftSubtitle, stepHeading, formatDate/formatKwh/formatEuro, hasSellingPrice, labelChipStyle
- Client fetch met `credentials: "include"`; thumb 409+project body behandelen als succespayload
- Guest login met `return` die met `/api` start → `window.location.replace` (full navigation)
- nl-NL formatting; max-width ~640px; safe-area padding

## API (zelfde origin, poort 5055)
Catalogusgroepen: Algemeen, Auth, Projecten, Projectfoto’s, Stappen.

### Algemeen
- GET `/api/health` open → `{ ok, mongo, db, mode, client }`
- GET `/api` login:
  - geen sessie + HTML → 302 `/inloggen?return=/api`
  - geen sessie + JSON → 401 `{ error: "Session expired" }`
  - ingelogd JSON (`?format=json` of Accept application/json) → `{ ok, user, groups }`
  - ingelogd HTML → styled cataloguspagina (zelfde fonts/kleuren)

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
- GET `/api/projects/featured` → `{ projectId, projectTitle, photo }` of null; photo.url zoals `/api/projects/:id/photos/:photoId/file`
- GET `/api/projects` — `?mine=1`, `?deleted=1`
- POST `/api/projects` → 201; multipart: title,type,notes,kwhUsage,costPrice,sellingPrice,glasfusion*, labels JSON, photos
- GET/PUT/DELETE `/api/projects/:id` (DELETE = soft)
- POST `/api/projects/:id/restore`
- DELETE `/api/projects/:id/permanent` (alleen na soft-delete) → `{ ok: true }`
- Projectfoto’s: GET `…/photos/:photoId/file`, POST `…/photos`, DELETE `…/photos/:photoId`
- POST `…/photos/:photoId/thumb` — publiek; 409 als al geduimd, body bevat nog steeds `project`
- Stappen: POST/PUT/DELETE `…/steps[/:stepId]`, restore, permanent, nested photo file/upload/thumb/delete
- Typische errors: 400 validatie, 403 rechten, 404 missing/deleted public, 409 double thumb

Documenteer alles in `docs/API.md` en `docs/DATABASE.md` (inclusief sellingPrice en nested foto/stap-paden).

## Env
### `.env.example` (productie/dev)
MONGO_URI, MONGO_SESSION_URI, SESSION_SECRET (leeg in example; code-default `captainjohn-dev`), DEV, COOKIE_SECURE, PORT (5055), ADMIN_EMAIL, CREATE_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL.

### Runtime/test (niet per se in .env.example)
ALLOW_NO_CLIENT (tests zonder client/dist), E2E_EMAIL, E2E_PASSWORD, E2E_NAME, optioneel PLAYWRIGHT_BASE_URL.
loadEnv mag ontbrekende mail-keys optioneel uit sibling `../bdeditor/.env` trekken.

## npm scripts
Root: install:all, build (scripts/build-client.js → client/dist), start, prod, dev (build+nodemon), server (nodemon), client (vite --host via prefix), dev:vite (concurrently server+client; Vite 5173 proxied `/api` + `/uploads` → 5055), test, test:unit, test:api, test:node, test:e2e, test:e2e:ui, seed:e2e.
Client: dev, build, preview.
Helpers: `node scripts/create-user.js <email> <password> [name]`, `node scripts/make-admin.js <email>`.

## Design (niet generiek AI-paars)
- Fonts: Fraunces (opsz weights 500;700, display/brand) + Source Sans 3 (body) via Google Fonts
- CSS vars: --ink #1c2422, --ink-soft #3d4a46, --paper #f3efe6, --paper-deep #e4ddd0, --sea #1a3a3a, --sea-mid #2a5554, --copper #b85c38, --copper-deep #8f4024, --ok #2f6b4f, --danger #9b2c2c, --fog rgba(28,36,34,0.08), --radius 14px, --shadow 0 18px 40px rgba(26,58,58,0.12)
- Achtergrond: gelaagde radial gradients (teal + copper wash) over warm paper — geen flat white
- Frosted panels, soft shadow, primary buttons met sea-gradient, choice tiles met active teal wash
- Logo PNG hero op home; brand-bar altijd productnaam als primaire identiteit
- index.html: theme-color #1a3a3a, apple-mobile-web-app-capable, viewport-fit=cover
- Motion: lichte hover-lift op featured foto; button :active scale 0.98; choice transitions
- Geen dashboard-look; één compositie; mobile-first ~640px shell

## Tests
### Unit
`tests/unit/labels.test.js` — normalize/parse labels.

### API
`tests/api/health-auth-projects.test.js` via supertest + `createApp({ allowNoClient: true })` en helpers (`tests/helpers/*`).
Cover: health, login/me, public list, auth-required create, soft-delete/restore, steps, thumbs 409, featured, `/api` docs login.
Helper-user: `tester@example.com` / `test-pass-123` (admin+editor); DB `project-captainjohn-test`.
(Invite create-confirm/deny hoeft niet in API-tests tenzij je die flow apart toevoegt.)

### E2E “film”
- `playwright.config.js`: workers 1, serial, video on, locale nl-NL, Desktop Chrome; CI retries 1; timeout 90s / expect 15s; reporters github+html+list in CI; webServer `node scripts/test-server.js` + health URL; default Mongo `project-captainjohn-e2e`
- `scripts/test-server.js`: build als geen `client/dist/index.html`, dan seed-e2e, dan createApp listen
- Seed: `e2e@example.com` / `e2e-pass-123`, name `E2E Tester`, roles editor+admin; project `E2E showcase project` glasfusion/fuse/medium; label `E2E` `#2f6b4f`
- Flow (`tests/e2e/app-film.spec.js`): showcase zichtbaar → `/project/:id` → login → maak “E2E film project” (Overige + label Film + PNG fixture `tests/e2e/fixtures/dot.png`) → stap “Afwerking” (Hout) → Verwijderen → Terugzetten → Uitloggen

### CI
`.github/workflows/ci.yml`: push+PR; Mongo 7 service; Node 22; `npm ci` root + client; env DB `project-captainjohn-ci` + E2E credentials; unit+API+e2e; artifacts `playwright-report` en `test-film-and-results` (webm), retentie 14 dagen.
Lokaal: Mongo op `127.0.0.1:27017`; `npx playwright install chromium` vóór e2e.

## README
Nederlandse README met: docs-tabel (DATABASE.md + API.md), route-tabel (incl. `/api`), één-poort workflow, optionele Vite-dev, account/invite-flow, functies (incl. verkoopprijs + GridFS + soft-delete + duimpjes), tests/CI (artifacts), MongoDB-notitie (`project-captainjohn`).

## Implementatievolgorde
1. Root package + createApp + health + SPA serve + static /uploads
2. Mongoose models (*.model.js) + db + session store
3. Auth API + mail + invite approve/deny + reset
4. Projects/steps/photos/labels API + GridFS + legacy migratie
5. endpointCatalog + /api docs pagina + docs/* (sellingPrice meenemen)
6. Vue client (router, api, auth, labels, views, components, styles)
7. Scripts (build, prod, create-user, make-admin, seed-e2e, test-server)
8. Unit + API + Playwright film + CI
9. .env.example + README + PROMPT.md

## Acceptatiecriteria
- `npm run install:all && npm run build && npm start` serveert UI+API op :5055
- Publiek browsen + duimpjes + featured foto werkt zonder login
- Verkoopprijs zichtbaar publiek alleen als gezet; kWh/kostprijs nooit publiek
- Invite → admin approve → login met gemaild wachtwoord werkt (of SMTP-log / devPassword fallback)
- Ingelogd: project/stap/foto/label CRUD + soft-delete trash
- `npm run test:node` en `npm run test:e2e` groen met lokale Mongo
- Design volgt sea/copper/paper + Fraunces look, niet een generiek paars/cream template

Lever de volledige werkende codebase op, geen stubs of “TODO later” voor kernflows.
```
