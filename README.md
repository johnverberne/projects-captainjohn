# Captain John — Atelierprojecten

Mobiele Vue-website + Express JSON API + MongoDB Atlas (`project-captainjohn`).

## Development (Vite)

```bash
npm run install:all
npm run dev
```

- API: http://localhost:5055  
- Vue (Vite): http://localhost:5173  

Op je telefoon (zelfde wifi): open `http://<pc-ip>:5173`.

Zet in `.env`: `DEV=true`.

## Productie (zonder Vite)

Bouwt de Vue-app naar `client/dist` en serveert die via Express:

```bash
npm run install:all
npm run prod
```

Of in twee stappen:

```bash
npm run build
# DEV=false (of weghalen) in .env
npm start
```

Open daarna alleen: http://localhost:5055 — geen Vite-devserver.

## MongoDB

Zelfde Atlas-cluster als bdeditor, database-naam `project-captainjohn` via `MONGO_URI` in `.env`.
