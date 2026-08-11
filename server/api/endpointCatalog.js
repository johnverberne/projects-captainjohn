/** Handmatig bijgehouden overzicht van alle HTTP-endpoints. */
const ENDPOINTS = [
  {
    group: "Algemeen",
    items: [
      {
        method: "GET",
        path: "/api",
        auth: true,
        description: "Deze pagina — overzicht van alle endpoints",
      },
      {
        method: "GET",
        path: "/api/health",
        auth: false,
        description: "Healthcheck (MongoDB, mode, client-build)",
      },
    ],
  },
  {
    group: "Auth",
    items: [
      {
        method: "GET",
        path: "/api/auth/me",
        auth: false,
        description: "Huidige sessie / gebruiker",
      },
      {
        method: "POST",
        path: "/api/auth/login",
        auth: false,
        description: "Inloggen (JSON: email, pw)",
      },
      {
        method: "GET",
        path: "/api/auth/logout",
        auth: false,
        description: "Uitloggen",
      },
      {
        method: "POST",
        path: "/api/auth/create-login",
        auth: false,
        description: "Toegang aanvragen (JSON: name, email, reason)",
      },
      {
        method: "GET",
        path: "/api/auth/create-confirm",
        auth: false,
        description: "Admin: aanvraag goedkeuren (query + secret)",
      },
      {
        method: "GET",
        path: "/api/auth/create-denied",
        auth: false,
        description: "Admin: aanvraag afwijzen (query + secret)",
      },
      {
        method: "GET",
        path: "/api/auth/reset-login",
        auth: false,
        description: "Nieuw wachtwoord aanvragen (?email=)",
      },
    ],
  },
  {
    group: "Projecten",
    items: [
      {
        method: "GET",
        path: "/api/projects/meta",
        auth: false,
        description: "Types, glasfusion-opties en labelcatalogus (publiek)",
      },
      {
        method: "GET",
        path: "/api/projects/featured",
        auth: false,
        description: "Foto met de meeste duimpjes voor de homepage (publiek)",
      },
      {
        method: "GET",
        path: "/api/projects",
        auth: false,
        description: "Lijst projecten (publiek; ?deleted=1 admin; ?mine=1 eigen)",
      },
      {
        method: "POST",
        path: "/api/projects",
        auth: true,
        description: "Nieuw project (multipart: velden + photos)",
      },
      {
        method: "GET",
        path: "/api/projects/:id",
        auth: false,
        description: "Project ophalen (publiek, niet-verwijderd)",
      },
      {
        method: "PUT",
        path: "/api/projects/:id",
        auth: true,
        description: "Project bijwerken (multipart, o.a. labels JSON)",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id",
        auth: true,
        description: "Project soft-deleten (prullenbak)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/restore",
        auth: true,
        description: "Project terugzetten uit prullenbak",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id/permanent",
        auth: true,
        description: "Project definitief verwijderen (na soft-delete)",
      },
    ],
  },
  {
    group: "Projectfoto’s",
    items: [
      {
        method: "GET",
        path: "/api/projects/:id/photos/:photoId/file",
        auth: false,
        description: "Foto-bestand streamen (publiek)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/photos",
        auth: true,
        description: "Foto’s toevoegen (multipart)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/photos/:photoId/thumb",
        auth: false,
        description: "Duimpje omhoog op foto (publiek)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/photos/:photoId/cover",
        auth: true,
        description: "Foto als hoofdfoto markeren (projectkaart)",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id/photos/:photoId",
        auth: true,
        description: "Foto verwijderen",
      },
    ],
  },
  {
    group: "Stappen",
    items: [
      {
        method: "POST",
        path: "/api/projects/:id/steps",
        auth: true,
        description: "Stap toevoegen (multipart)",
      },
      {
        method: "PUT",
        path: "/api/projects/:id/steps/:stepId",
        auth: true,
        description: "Stap bijwerken (multipart)",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id/steps/:stepId",
        auth: true,
        description: "Stap soft-deleten (prullenbak)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/steps/:stepId/restore",
        auth: true,
        description: "Stap terugzetten",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id/steps/:stepId/permanent",
        auth: true,
        description: "Stap definitief verwijderen",
      },
      {
        method: "GET",
        path: "/api/projects/:id/steps/:stepId/photos/:photoId/file",
        auth: false,
        description: "Stapfoto streamen (publiek)",
      },
      {
        method: "POST",
        path: "/api/projects/:id/steps/:stepId/photos",
        auth: true,
        description: "Foto’s bij stap toevoegen",
      },
      {
        method: "POST",
        path: "/api/projects/:id/steps/:stepId/photos/:photoId/thumb",
        auth: false,
        description: "Duimpje op stapfoto (publiek)",
      },
      {
        method: "DELETE",
        path: "/api/projects/:id/steps/:stepId/photos/:photoId",
        auth: true,
        description: "Stapfoto verwijderen",
      },
    ],
  },
];

function wantsJson(req) {
  const accept = String(req.get("accept") || "");
  return (
    req.query.format === "json" ||
    (accept.includes("application/json") && !accept.includes("text/html"))
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function methodClass(method) {
  return `m-${method.toLowerCase()}`;
}

function renderApiDocsHtml({ email, groups }) {
  const sections = groups
    .map((group) => {
      const rows = group.items
        .map(
          (item) => `
        <tr>
          <td><span class="method ${methodClass(item.method)}">${escapeHtml(
            item.method
          )}</span></td>
          <td><code>${escapeHtml(item.path)}</code></td>
          <td>${item.auth ? '<span class="pill">login</span>' : '<span class="pill open">open</span>'}</td>
          <td>${escapeHtml(item.description)}</td>
        </tr>`
        )
        .join("");
      return `
      <section class="group">
        <h2>${escapeHtml(group.group)}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Pad</th>
                <th>Auth</th>
                <th>Beschrijving</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API — Captain John</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #1c2422;
      --ink-soft: #3d4a46;
      --paper: #f3efe6;
      --sea: #1a3a3a;
      --copper: #b85c38;
      --ok: #2f6b4f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Source Sans 3", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(42, 85, 84, 0.18), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(184, 92, 56, 0.14), transparent 50%),
        linear-gradient(180deg, #f7f3eb 0%, var(--paper) 40%, #ebe4d6 100%);
      line-height: 1.45;
      min-height: 100vh;
    }
    .shell {
      width: min(960px, 100%);
      margin: 0 auto;
      padding: 24px 16px 40px;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
    h1 {
      font-family: "Fraunces", Georgia, serif;
      font-size: 2rem;
      margin: 0;
      color: var(--sea);
    }
    .lead { margin: 6px 0 0; color: var(--ink-soft); }
    .user { color: var(--ink-soft); font-size: 0.95rem; }
    a.back {
      display: inline-block;
      margin-top: 8px;
      color: var(--copper);
      font-weight: 700;
      text-decoration: none;
    }
    .group {
      background: #fffdf8;
      border: 1px solid rgba(26, 58, 58, 0.1);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: 0 12px 28px rgba(26, 58, 58, 0.08);
    }
    .group h2 {
      font-family: "Fraunces", Georgia, serif;
      font-size: 1.25rem;
      margin: 0 0 12px;
    }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      vertical-align: top;
      border-top: 1px solid rgba(26, 58, 58, 0.08);
    }
    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ink-soft);
      border-top: 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.86rem;
      word-break: break-all;
    }
    .method {
      display: inline-block;
      min-width: 4.2rem;
      text-align: center;
      font-weight: 700;
      font-size: 0.72rem;
      letter-spacing: 0.04em;
      padding: 4px 6px;
      border-radius: 6px;
      color: #fffdf8;
      background: var(--sea);
    }
    .m-get { background: var(--ok); }
    .m-post { background: var(--copper); }
    .m-put { background: #3d5a80; }
    .m-delete { background: #9b2c2c; }
    .pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(184, 92, 56, 0.14);
      color: #8f4024;
    }
    .pill.open {
      background: rgba(47, 107, 79, 0.14);
      color: var(--ok);
    }
    .hint {
      margin-top: 8px;
      color: var(--ink-soft);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="top">
      <div>
        <h1>API</h1>
        <p class="lead">Alle endpoints van Captain John</p>
        <a class="back" href="/">← Terug naar app</a>
      </div>
      <div class="user">${escapeHtml(email)}</div>
    </div>
    ${sections}
    <p class="hint">Tip: <code>/api?format=json</code> geeft hetzelfde overzicht als JSON.</p>
  </div>
</body>
</html>`;
}

module.exports = {
  ENDPOINTS,
  wantsJson,
  renderApiDocsHtml,
};
