# Captain John — Atelierprojecten

Mobiele Vue-website + Express JSON API + MongoDB Atlas (`project-captainjohn`).

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

## MongoDB

Zelfde Atlas-cluster als bdeditor, database-naam `project-captainjohn` via `MONGO_URI` in `.env`.
