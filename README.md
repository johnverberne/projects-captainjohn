# Captain John — Atelierprojecten

Mobiele website om atelierprojecten te **bekijken**, **beheren** en **verkopen**.  
Stack: **Vue 3** + **Express** + **MongoDB Atlas** (database `project-captainjohn`), één poort voor API en client.

Productie: [projects-captainjohn-production.up.railway.app](https://projects-captainjohn-production.up.railway.app/)

----

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/DATABASE.md](./docs/DATABASE.md) | MongoDB-model (projecten, stappen, foto’s, labels, gebruikers) |
| [docs/API.md](./docs/API.md) | HTTP-endpoints |
| Live `/api` | Ingelogd: overzicht van alle endpoints (HTML/JSON) |

---

## Wat de website doet

Captain John is een atelier-app voor glas, hout, stof en meer. Bezoekers bladeren door projecten en kunnen duimpjes geven. Ingelogde makers beheren projecten, foto’s, stappen, prijzen en het **Verkoophoekje**. Bezoekers kunnen bij stukken **te koop** hun interesse doorgeven per mail.

---

## Pagina’s en routes

### Publiek (zonder login)

| Pad | Onderdeel | Beschrijving |
|---|---|---|
| `/` | **Homepage** | Logo, meest gelikede foto, Verkoophoekje-tellers, lijst van alle projecten |
| `/verkoop` | **Verkoophoekje** | Filters Alles / Showroom / Te koop / Verkocht; kaarten met hoofdfoto, omschrijving en prijs |
| `/project/:id` | **Projectdetail** | Titel, type, labels, verkoopinfo, notities, foto’s (lightbox), stappen, duimpjes |
| `/inloggen` | **Account** | Tabs: Inloggen · Aanmelden · Wachtwoord kwijt? |

### Ingelogd (bewerk-modus)

| Pad | Onderdeel | Beschrijving |
|---|---|---|
| `/bewerken` | **Bewerk-home** | Zelfde overzicht als publiek, plus “Nieuw project”, interne kosten, prullenbak |
| `/bewerken/verkoop` | **Verkoophoekje (edit)** | Zelfde verkoop-UI; links gaan naar bewerk-projecten |
| `/bewerken/nieuw` | **Nieuw project** | Formulier: soort, foto’s, kWh/kosten/verkoopprijs, verkoopstatus, labels, notities |
| `/bewerken/project/:id` | **Project bewerken** | Alles van detail + bewerken, foto’s slepen, stappen, soft-delete |

**Navigatiegedrag**

- Ingelogd op een publieke route → doorverwezen naar `/bewerken…` (behalve `/verkoop`, die mag beide)
- Niet ingelogd op `/bewerken*` → `/inloggen?return=…`
- Uitloggen → terug naar de publieke site

Aliases: `/auth` → `/inloggen`, `/nieuw` → `/bewerken/nieuw`.

---

## Onderdelen in detail

### 1. Homepage (`/` en `/bewerken`)

- **Hero** met logo Captain John
- **Featured foto**: foto met de meeste duimpjes (project- of stapfoto)
- **Verkoophoekje-knoppen** (horizontaal): Te koop / Showroom / Verkocht met aantallen → link naar filtered verkooppagina
- **Alle projecten**: kaarten met hoofdfoto, type, sale-badge, labels, datum, fototelling, eventueel prijs
- In bewerk-modus: knop **Nieuw project starten**, kWh/kostprijs op kaarten, sectie **Verwijderde projecten**

### 2. Verkoophoekje (`/verkoop`)

- Statussen: **Showroom**, **Te koop**, **Verkocht** (of “niet in hoekje”)
- Filterknoppen met tellers
- Kaart toont **hoofdfoto** (= verkoopfoto), titel, craft-info, verkoopomschrijving, prijs
- Bij **Te koop**: knop **Interesse doorgeven**

### 3. Interesseformulier

Velden: **naam**, **e-mail**, **woonplaats**, **interesse**.  
Toont “Over *[titel]* · *[prijs]*”.  
Alleen bij `saleStatus === te_koop`. Mail naar `ADMIN_EMAIL` (SMTP); zonder SMTP → serverlog.

### 4. Projecten

**Soorten:** Glasfusion, Tiffany, Glas in lood, Hout, Keramiek, Tassen, Overige.

**Glasfusion** vraagt extra:

- Techniek: Slump / Fuse / Cast  
- Type (snelheid): Fast / Medium / Slow / Ultra slow  

**Velden**

| Veld | Zichtbaarheid | Opmerking |
|---|---|---|
| Titel, type, notities | Iedereen | |
| Labels (naam + kleur) | Iedereen | Catalogus + nieuwe labels |
| Verkoopprijs | Iedereen (als ingevuld) | |
| Verkoopstatus + verkoopomschrijving | Iedereen (als in hoekje) | |
| kWh, kostprijs | Alleen ingelogd | Verborgen voor gasten |
| Eigenaar | Intern | |

### 5. Extra stappen

Onderdelen bij een project (bijv. houten voet, tas). Zelfde soort-opties als projecten, optionele titel, eigen foto’s, kWh/kosten. Soft-delete net als projecten.

### 6. Foto’s

- Upload via **lokale foto** of **camera** (`PhotoUploadPicker`)
- Opslag in **MongoDB GridFS** (bucket `photos`)
- **Hoofdfoto**: eerste foto in de volgorde (`isCover`); ook de verkoopfoto
- In bewerk-modus: **slepen** om te herschikken; rode omkadering + badge “Hoofdfoto”
- Verwijderen met × (bevestiging)
- **Lightbox**: inzoomen, filmstrip om te wisselen, ←/→, Sluiten, duimpje, verwijderen

### 7. Duimpjes

Publiek, max. **één per sessie/gebruiker** per foto (project- of stapfoto). Teller op de tegels en in de lightbox.

### 8. Labels

Kleurchips op projecten. Kiezen uit catalogus of nieuw toevoegen (naam + kleur). Catalogus leeft mee in MongoDB.

### 9. Soft-delete (prullenbak)

- Project of stap → soft-delete (niet meteen weg)
- In bewerk-modus: **Terugzetten** of **Definitief wissen**
- Definitief wissen van een project haalt ook GridFS-foto’s weg

### 10. PDF-export

Ingelogd: knop **Export** in de topbalk. Client-side rapport (jsPDF) van alle projecten inclusief prullenbak: voorpagina, headers/footers, prijzen, labels, duimpjes, foto’s.

### 11. Account & rechten

| Flow | Werking |
|---|---|
| **Inloggen** | E-mail + wachtwoord → cookie-sessie |
| **Aanmelden** | Naam, e-mail, reden → admin krijgt goedkeur-/afwijsmail |
| **Goedkeuren** | Gegenereerd wachtwoord (argon2 + niceware) per mail |
| **Wachtwoord kwijt?** | Nieuw wachtwoord per mail (of log zonder SMTP) |

Rollen: standaard editor; admin via `node scripts/make-admin.js iemand@example.com`.  
Admin ziet alle prullenbak-items; anderen alleen eigen.

### 12. Feedback-knop

Op elke pagina staat rechtsonder een knop **Feedback**. Die legt met html2canvas alleen het **zichtbare scherm** vast (geen hele pagina, geen tabblad-delen) en opent de feedback-app (`FEEDBACK_APP_URL`). De bezoeker vult een markdown-formulier in; de reactie gaat naar GitHub/Codeberg/MongoDB, inclusief screenshot.

### 13. Topbalk (App-shell)

- Merk **Captain John**
- MongoDB-statusdot
- Gast: **Inloggen**
- Ingelogd: naam, **Export**, **Uitloggen**

---

## Technische structuur

```text
projects-captainjohn/
├── client/                 # Vue 3 + Vite
│   └── src/
│       ├── views/          # Home, Detail, New, Sales, Auth
│       ├── components/     # Form fields, upload, labels, interesse-dialog
│       ├── report/         # PDF-export
│       ├── api.js          # Fetch-wrappers
│       ├── router.js       # Routes + guards
│       └── styles.css
├── server/
│   ├── api/                # auth, projects, API-docs, catalogus
│   ├── model/              # Project, User, Label
│   ├── services/           # GridFS-foto’s, mail, labels
│   ├── middleware/         # isAuthenticated
│   ├── createApp.js        # Express-app factory
│   └── server.js           # Start + Mongo-connect
├── scripts/                # build, seed, admin, SMTP-test
├── tests/                  # unit, API, Playwright E2E
├── docs/                   # DATABASE.md, API.md
└── .github/workflows/      # CI
```

| Laag | Keuze |
|---|---|
| Frontend | Vue 3, Vue Router, Vite 6 |
| Backend | Node.js, Express 4 |
| Database | MongoDB / Mongoose 8 |
| Foto’s | GridFS (+ legacy `/uploads` migratie) |
| Sessies | express-session + connect-mongo |
| Mail | nodemailer (SMTP) |
| Deploy | Railway, poort **5055**, API + `client/dist` |

---

## API (groepoverzicht)

| Groep | Basis | Voorbeelden |
|---|---|---|
| Algemeen | `/api`, `/api/health` | Docs, healthcheck |
| Auth | `/api/auth/*` | login, me, create-login, reset |
| Projecten | `/api/projects` | lijst, meta, featured, CRUD, interest |
| Projectfoto’s | `…/photos…` | file, upload, thumb, cover, order, delete |
| Stappen | `…/steps…` | CRUD, soft-delete, stapfoto’s |

Volledige tabel: [docs/API.md](./docs/API.md). Live: `/api` (login vereist).

---

## Lokaal draaien

```bash
npm run install:all
cp .env.example .env          # vul MONGO_URI e.d. in
npm run prod                  # build + start
```

Of: `npm run build` + `npm start`.  
Open **http://localhost:5055** (telefoon opzelfde wifi: `http://<pc-ip>:5055`).

```bash
npm run dev                   # build + nodemon
npm run dev:vite              # API :5055 + Vite :5173
```

### Scripts

| Script | Doel |
|---|---|
| `npm run install:all` | Root + client dependencies |
| `npm run build` | Vue → `client/dist` |
| `npm start` / `npm run prod` | Server (prod = eerst build) |
| `npm test` | Unit + API + E2E |
| `npm run seed:e2e` | Testgebruiker voor Playwright |
| `node scripts/make-admin.js` | Admin-rol zetten |
| `node scripts/send-test-mail.js` | SMTP-test naar `ADMIN_EMAIL` |

### Omgevingsvariabelen (`.env`)

| Variabele | Doel |
|---|---|
| `MONGO_URI` / `MONGO_SESSION_URI` | Database / sessies |
| `SESSION_SECRET` | Sessies ondertekenen |
| `PORT` | Standaard `5055` |
| `DEV` | Dev-gedrag / Mongo-debug |
| `COOKIE_SECURE` | `true` op HTTPS (Railway) |
| `ADMIN_EMAIL` | Goedkeuringen + interesse-mails |
| `CREATE_SECRET` | Secrets in goedkeurlinks |
| `SMTP_*` / `FROM_EMAIL` | Uitgaande mail |
| `FEEDBACK_APP_URL` | URL van de feedback-app (screenshot + GitHub-issue) |

Lokale logingegevens voor handmatig testen (niet committen): kopieer `.credentials.local.example.json` → `.credentials.local.json`. Dat bestand staat in `.gitignore`.

---

## Tests & CI

GitHub Actions bij elke **push** en **pull request** (MongoDB 7, Node 22):

- Unit: labels-normalisatie  
- API: health, auth, projecten, foto’s, hoofdfoto/volgorde  
- Playwright E2E (“film” met video-artifact)

Lokaal (MongoDB op `127.0.0.1:27017`):

```bash
npm run build
npm run test:node
npx playwright install chromium
npm run test:e2e
```

---

## Samenvatting UI-onderdelen

| Onderdeel | Publiek | Ingelogd |
|---|---|---|
| Projectenlijst | ✓ | ✓ (+ kosten, prullenbak) |
| Projectdetail + lightbox | ✓ | ✓ (+ bewerken) |
| Duimpjes | ✓ | ✓ |
| Verkoophoekje + filters | ✓ | ✓ |
| Interesse doorgeven (te koop) | ✓ | ✓ |
| Nieuw/bewerk project & stappen | — | ✓ |
| Foto upload / slepen / verwijderen | — | ✓ |
| Labels, prijzen, sale-status | bekijken | beheren |
| Soft-delete / herstellen | — | ✓ |
| PDF-export | — | ✓ |
| Account aanvragen / login / reset | ✓ | — |
| Feedback-knop (screenshot → GitHub-issue) | ✓ | ✓ |
