# Captain John — Atelierprojecten

Mobiele Vue-website + Express JSON API + MongoDB Atlas (`project-captainjohn`).

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/DATABASE.md](./docs/DATABASE.md) | Database- / MongoDB-model |
| [docs/API.md](./docs/API.md) | HTTP-endpoints + live API-pagina `/api` |

## App-structuur

| Pad | Wie | Wat |
|---|---|---|
| `/` | Iedereen | Publieke, read-only projectenlijst |
| `/project/:id` | Iedereen | Project bekijken, duimpjes geven |
| `/inloggen` | Gasten | Inloggen / aanmelden / wachtwoord reset |
| `/bewerken` | Ingelogd | Projecten bewerken, prullenbak |
| `/bewerken/nieuw` | Ingelogd | Nieuw project |
| `/bewerken/project/:id` | Ingelogd | Project + stappen bewerken |
| `/api` | Ingelogd | Live overzicht van alle API-endpoints |

Ingelogde gebruikers worden vanaf publieke routes naar `/bewerken` gestuurd. Uitloggen brengt je terug naar de publieke site.

## Eén poort (aanbevolen)

Client wordt gebouwd naar `client/dist` en door Express op `/` geserveerd:

```bash
npm run install:all
npm run prod
```

Of:

```bash
npm run build
npm start
```

Open: **http://localhost:5055** (API + website op dezelfde poort).

Op je telefoon (zelfde wifi): `http://<pc-ip>:5055`.

Lokaal met auto-restart na build:

```bash
npm run dev
```

## Optioneel: Vite apart (twee poorten)

```bash
npm run dev:vite
```

- API: http://localhost:5055  
- Vite: http://localhost:5173  

## Account

- UI: `/inloggen` (Inloggen / Aanmelden / Wachtwoord kwijt?)
- Aanmelden = toegangsaanvraag (naam, e-mail, reden); geen zelfgekozen wachtwoord
- Admin krijgt mail met goedkeuren/afwijzen
- Bij goedkeuren: gegenereerd wachtwoord met **argon2**, per mail
- Sessies via `express-session` + MongoDB

Env: `ADMIN_EMAIL`, `CREATE_SECRET`, SMTP-variabelen.  
Op Railway: `COOKIE_SECURE=true`. Zonder SMTP gaan mails naar de serverlog.

Admin-rol zetten:

```bash
node scripts/make-admin.js iemand@example.com
```

## Functies (kort)

- Projecttypes (glasfusion met techniek/snelheid, tiffany, hout, …)
- Foto’s: lokale galerij of camera; opslag in **MongoDB GridFS**
- Labels met kleur (kiezen of nieuw toevoegen)
- Soft-delete voor projecten en stappen (terugzetten of definitief wissen)
- Duimpjes op foto’s: publiek, max. één per sessie/gebruiker

## MongoDB

Zelfde Atlas-cluster als bdeditor, database-naam `project-captainjohn` via `MONGO_URI` in `.env`.

Details: [docs/DATABASE.md](./docs/DATABASE.md).
