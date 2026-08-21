import { jsPDF } from "jspdf";
import {
  craftSubtitle,
  formatDate,
  formatEuro,
  formatFiringSegment,
  formatKwh,
  ovenLabel,
  stepHeading,
  typeLabel,
  usesFiringSchedule,
} from "../labels";

const MARGIN = 16;
const HEADER_Y = 10;
const FOOTER_Y = 287;
const CONTENT_TOP = 24;
const CONTENT_BOTTOM = 278;
const PAGE_WIDTH = 210;
const SEA = [26, 58, 58];
const COPPER = [184, 92, 56];
const INK = [28, 36, 34];
const MUTED = [61, 74, 70];

const IMG_COLS = 2;
const IMG_GAP = 6;
const IMG_MAX_H = 58;
const IMG_CAPTION_H = 12;
const IMG_CACHE = new Map();

function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { label: `${day}-${m}-${y} ${h}:${min}`, file: `${y}${m}${day}-${h}${min}` };
}

function moneyOrDash(value) {
  return formatEuro(value) || "—";
}

function kwhOrDash(value) {
  return formatKwh(value) || "—";
}

function textOrDash(value) {
  const s = String(value ?? "").trim();
  return s || "—";
}

/**
 * Genereer een PDF-rapport, open de PDF-reader en download het bestand.
 * @param {{ projects: object[], deletedProjects?: object[], user?: object|null, previewWindow?: Window|null }} opts
 */
export async function downloadProjectsReport({
  projects = [],
  deletedProjects = [],
  user = null,
  previewWindow = null,
} = {}) {
  IMG_CACHE.clear();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const when = stamp();
  const active = [...projects].sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "nl")
  );
  const trash = [...deletedProjects].sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "nl")
  );

  drawCover(doc, {
    when,
    user,
    activeCount: active.length,
    trashCount: trash.length,
  });

  if (active.length) {
    doc.addPage();
    drawSectionTitle(doc, "Actieve projecten");
    for (let i = 0; i < active.length; i += 1) {
      if (i > 0) doc.addPage();
      await drawProject(doc, active[i], {
        index: i + 1,
        total: active.length,
        continuePage: i === 0,
      });
    }
  }

  if (trash.length) {
    doc.addPage();
    drawSectionTitle(doc, "Verwijderde projecten (prullenbak)");
    for (let i = 0; i < trash.length; i += 1) {
      if (i > 0) doc.addPage();
      await drawProject(doc, trash[i], {
        index: i + 1,
        total: trash.length,
        deleted: true,
        continuePage: i === 0,
      });
    }
  }

  if (!active.length && !trash.length) {
    doc.addPage();
    ensureSpace(doc, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text("Geen projecten gevonden om te exporteren.", MARGIN, CONTENT_TOP + 8);
  }

  applyChrome(doc, when);
  IMG_CACHE.clear();

  const who = user?.name || user?.email || "export";
  const safeWho = String(who)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = `captain-john-rapport-${when.file}-${safeWho || "export"}.pdf`;

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  let opened = false;
  if (previewWindow && !previewWindow.closed) {
    try {
      previewWindow.location.href = url;
      opened = true;
    } catch {
      opened = false;
    }
  }
  if (!opened) {
    const win = window.open(url, "_blank");
    opened = Boolean(win);
  }

  // Download blijft beschikbaar; viewer opent in een nieuw tabblad.
  doc.save(filename);

  // Blob-URL pas later vrijgeven zodat de PDF-reader hem kan laden.
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);

  return { filename, opened };
}

function drawCover(doc, { when, user, activeCount, trashCount }) {
  doc.setFillColor(...SEA);
  doc.rect(0, 0, PAGE_WIDTH, 72, "F");
  doc.setFillColor(...COPPER);
  doc.rect(0, 72, PAGE_WIDTH, 3, "F");

  doc.setTextColor(255, 253, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Captain John", PAGE_WIDTH / 2, 34, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("atelier projecten", PAGE_WIDTH / 2, 44, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Projectrapport", PAGE_WIDTH / 2, 100, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(
    "Overzicht van alle atelierprojecten, stappen, foto’s en kosten.",
    PAGE_WIDTH / 2,
    110,
    { align: "center", maxWidth: PAGE_WIDTH - MARGIN * 2 }
  );

  const lines = [
    ["Gegenereerd", when.label],
    ["Door", user?.name || user?.email || "Onbekend"],
    ["E-mail", user?.email || "—"],
    ["Actieve projecten", String(activeCount)],
    ["In prullenbak", String(trashCount)],
    ["Totaal in rapport", String(activeCount + trashCount)],
  ];

  let y = 130;
  doc.setDrawColor(228, 221, 208);
  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...SEA);
    doc.text(label, MARGIN + 10, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(value, MARGIN + 70, y);
    doc.line(MARGIN + 10, y + 3, PAGE_WIDTH - MARGIN - 10, y + 3);
    y += 12;
  }

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "Vertrouwelijk — bevat interne kostprijzen, verbruik en projectfoto’s.",
    PAGE_WIDTH / 2,
    270,
    { align: "center", maxWidth: PAGE_WIDTH - MARGIN * 2 }
  );
}

function drawSectionTitle(doc, title) {
  doc.__cursorY = CONTENT_TOP;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...SEA);
  doc.text(title, MARGIN, doc.__cursorY);
  doc.__cursorY += 10;
}

async function drawProject(
  doc,
  project,
  { index, total, deleted = false, continuePage = false }
) {
  if (!continuePage) {
    doc.__cursorY = CONTENT_TOP;
  } else if (!doc.__cursorY || doc.__cursorY < CONTENT_TOP) {
    doc.__cursorY = CONTENT_TOP;
  } else {
    doc.__cursorY += 4;
  }

  const title = textOrDash(project.title);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...SEA);
  writeWrapped(doc, `${index}/${total}  ${title}`, MARGIN, PAGE_WIDTH - MARGIN * 2);

  if (deleted) {
    ensureSpace(doc, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COPPER);
    doc.text("STATUS: VERWIJDERD (prullenbak)", MARGIN, doc.__cursorY);
    doc.__cursorY += 6;
  }

  ensureSpace(doc, 6);
  doc.setDrawColor(...COPPER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, doc.__cursorY, PAGE_WIDTH - MARGIN, doc.__cursorY);
  doc.__cursorY += 7;

  const labels = (project.labels || [])
    .map((l) => l.name)
    .filter(Boolean)
    .join(", ");

  const projectPhotos = project.photos || [];
  const stepPhotos = (project.steps || []).flatMap((s) => s.photos || []);
  const totalLikes =
    [...projectPhotos, ...stepPhotos].reduce(
      (sum, photo) => sum + (Number(photo.thumbsUp) || 0),
      0
    );

  const fields = [
    ["Soort", craftSubtitle(project) || typeLabel(project.type)],
    ["Eigenaar", textOrDash(project.ownerEmail)],
    ["Aangemaakt", formatDate(project.createdAt) || "—"],
    ["Bijgewerkt", formatDate(project.updatedAt) || "—"],
    ["Labels", labels || "—"],
    ["Duimpjes (totaal)", String(totalLikes)],
    ["Oven", ovenLabel(project.oven) || "—"],
    ["Verbruik (kWh)", kwhOrDash(project.kwhUsage)],
    ["Kostprijs", moneyOrDash(project.costPrice)],
    ["Verkoopprijs", moneyOrDash(project.sellingPrice)],
    ["Verkooptitel", textOrDash(project.saleTitle)],
  ];

  if (deleted) {
    fields.push(
      ["Verwijderd op", formatDate(project.deletedAt) || "—"],
      ["Verwijderd door", textOrDash(project.deletedBy)]
    );
  }

  drawFieldGrid(doc, fields);

  ensureSpace(doc, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SEA);
  doc.text("Project notitie", MARGIN, doc.__cursorY);
  doc.__cursorY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  writeWrapped(doc, textOrDash(project.notes), MARGIN, PAGE_WIDTH - MARGIN * 2);

  if (usesFiringSchedule(project) && project.firingSchedule?.length) {
    ensureSpace(doc, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SEA);
    doc.text("Stookschema", MARGIN, doc.__cursorY);
    doc.__cursorY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    for (const segment of project.firingSchedule) {
      writeWrapped(
        doc,
        formatFiringSegment(segment),
        MARGIN,
        PAGE_WIDTH - MARGIN * 2
      );
    }
  }

  await drawPhotos(doc, project.photos || [], "Projectfoto’s");

  const steps = project.steps || [];
  const activeSteps = steps.filter((s) => !s.deletedAt);
  const deletedSteps = steps.filter((s) => s.deletedAt);

  ensureSpace(doc, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SEA);
  doc.text(`Extra stappen (${activeSteps.length})`, MARGIN, doc.__cursorY);
  doc.__cursorY += 6;

  if (!activeSteps.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Geen extra stappen.", MARGIN, doc.__cursorY);
    doc.__cursorY += 6;
  } else {
    for (let idx = 0; idx < activeSteps.length; idx += 1) {
      await drawStep(doc, activeSteps[idx], idx);
    }
  }

  if (deletedSteps.length) {
    ensureSpace(doc, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COPPER);
    doc.text(`Verwijderde stappen (${deletedSteps.length})`, MARGIN, doc.__cursorY);
    doc.__cursorY += 6;
    for (let idx = 0; idx < deletedSteps.length; idx += 1) {
      await drawStep(doc, deletedSteps[idx], idx, true);
    }
  }

  let kwh = 0;
  let cost = 0;
  let hasKwh = false;
  let hasCost = false;
  const add = (item) => {
    if (item?.kwhUsage != null) {
      kwh += Number(item.kwhUsage) || 0;
      hasKwh = true;
    }
    if (item?.costPrice != null) {
      cost += Number(item.costPrice) || 0;
      hasCost = true;
    }
  };
  add(project);
  activeSteps.forEach(add);

  if (hasKwh || hasCost) {
    ensureSpace(doc, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SEA);
    doc.text("Totalen (project + actieve stappen)", MARGIN, doc.__cursorY);
    doc.__cursorY += 6;
    drawFieldGrid(doc, [
      ["Totaal verbruik", hasKwh ? formatKwh(kwh) : "—"],
      ["Totale kostprijs", hasCost ? formatEuro(cost) : "—"],
    ]);
  }
}

async function drawStep(doc, step, index, deleted = false) {
  ensureSpace(doc, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const heading = stepHeading(step, index);
  writeWrapped(
    doc,
    `${deleted ? "[verwijderd] " : ""}${heading}`,
    MARGIN,
    PAGE_WIDTH - MARGIN * 2
  );

  drawFieldGrid(doc, [
    ["Soort", craftSubtitle(step) || typeLabel(step.type)],
    ["Oven", ovenLabel(step.oven) || "—"],
    ["Verbruik (kWh)", kwhOrDash(step.kwhUsage)],
    ["Kostprijs", moneyOrDash(step.costPrice)],
    ...(deleted
      ? [
          ["Verwijderd op", formatDate(step.deletedAt) || "—"],
          ["Verwijderd door", textOrDash(step.deletedBy)],
        ]
      : []),
  ]);

  ensureSpace(doc, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SEA);
  doc.text("Notities", MARGIN, doc.__cursorY);
  doc.__cursorY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  writeWrapped(doc, textOrDash(step.notes), MARGIN, PAGE_WIDTH - MARGIN * 2);

  await drawPhotos(doc, step.photos || [], "Stapfoto’s", true);
  doc.__cursorY += 2;
}

async function drawPhotos(doc, photos, title, compact = false) {
  ensureSpace(doc, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 9 : 11);
  doc.setTextColor(...SEA);
  doc.text(`${title} (${photos.length})`, MARGIN, doc.__cursorY);
  doc.__cursorY += compact ? 4 : 5;

  if (!photos.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Geen foto’s.", MARGIN, doc.__cursorY);
    doc.__cursorY += 5;
    return;
  }

  const cellW =
    (PAGE_WIDTH - MARGIN * 2 - IMG_GAP * (IMG_COLS - 1)) / IMG_COLS;

  for (let i = 0; i < photos.length; i += IMG_COLS) {
    const row = photos.slice(i, i + IMG_COLS);
    const loaded = await Promise.all(row.map((photo) => loadPhotoImage(photo)));

    let rowH = 0;
    for (const img of loaded) {
      if (!img) {
        rowH = Math.max(rowH, 18);
        continue;
      }
      const scale = Math.min(cellW / img.widthMm, IMG_MAX_H / img.heightMm, 1);
      rowH = Math.max(rowH, img.heightMm * scale + IMG_CAPTION_H);
    }

    ensureSpace(doc, rowH + 4);
    const y0 = doc.__cursorY;

    for (let c = 0; c < row.length; c += 1) {
      const photo = row[c];
      const img = loaded[c];
      const x = MARGIN + c * (cellW + IMG_GAP);
      const name = photo.originalName || photo.filename || `foto-${i + c + 1}`;
      const likes = Number(photo.thumbsUp) || 0;
      const caption = `${i + c + 1}. ${name}${photo.isCover ? " · hoofdfoto" : ""}`;
      const likesLine = `Duimpjes: ${likes}`;

      if (!img) {
        doc.setFillColor(228, 221, 208);
        doc.roundedRect(x, y0, cellW, 14, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Foto niet geladen", x + 2, y0 + 8);
        doc.setTextColor(...INK);
        const lines = doc.splitTextToSize(caption, cellW);
        doc.text(lines[0] || "", x, y0 + 18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COPPER);
        doc.text(likesLine, x, y0 + 22);
        continue;
      }

      const scale = Math.min(cellW / img.widthMm, IMG_MAX_H / img.heightMm, 1);
      const w = img.widthMm * scale;
      const h = img.heightMm * scale;
      const xPad = x + (cellW - w) / 2;

      try {
        doc.addImage(img.dataUrl, "JPEG", xPad, y0, w, h, undefined, "FAST");
      } catch {
        doc.setFillColor(228, 221, 208);
        doc.roundedRect(x, y0, cellW, h || 14, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Foto niet toegevoegd", x + 2, y0 + 8);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(caption, cellW);
      doc.text(lines.slice(0, 1), x, y0 + h + 3.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COPPER);
      doc.text(likesLine, x, y0 + h + 7.5);
    }

    doc.__cursorY = y0 + rowH + 3;
  }
}

async function loadPhotoImage(photo) {
  const url = photo?.url;
  if (!url) return null;
  if (IMG_CACHE.has(url)) return IMG_CACHE.get(url);

  const promise = (async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const maxPx = 1200;
      const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      // mm at 96dpi-ish for layout ratio only
      return {
        dataUrl,
        widthMm: w * 0.15,
        heightMm: h * 0.15,
      };
    } catch {
      return null;
    }
  })();

  IMG_CACHE.set(url, promise);
  return promise;
}

function drawFieldGrid(doc, fields) {
  const colGap = 4;
  const colW = (PAGE_WIDTH - MARGIN * 2 - colGap) / 2;
  let i = 0;
  while (i < fields.length) {
    ensureSpace(doc, 12);
    const rowY = doc.__cursorY;
    const left = fields[i];
    const right = fields[i + 1];
    drawField(doc, left[0], left[1], MARGIN, rowY, colW);
    if (right) {
      drawField(doc, right[0], right[1], MARGIN + colW + colGap, rowY, colW);
    }
    doc.__cursorY = rowY + 11;
    i += 2;
  }
}

function drawField(doc, label, value, x, y, maxW) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(String(value ?? "—"), maxW);
  doc.text(lines[0] || "—", x, y + 4);
}

function writeWrapped(doc, text, x, maxW) {
  const size = doc.getFontSize();
  const lines = doc.splitTextToSize(String(text ?? ""), maxW);
  const lineH = size * 0.4;
  for (const line of lines) {
    ensureSpace(doc, lineH + 1);
    doc.text(line, x, doc.__cursorY);
    doc.__cursorY += lineH;
  }
  doc.__cursorY += 1.5;
}

function ensureSpace(doc, needed) {
  if (!doc.__cursorY) doc.__cursorY = CONTENT_TOP;
  if (doc.__cursorY + needed <= CONTENT_BOTTOM) return;
  doc.addPage();
  doc.__cursorY = CONTENT_TOP;
}

function applyChrome(doc, when) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);

    if (i === 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Captain John — atelier projecten", MARGIN, FOOTER_Y);
      doc.text(`Pagina ${i} / ${total}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
        align: "right",
      });
      continue;
    }

    doc.setDrawColor(...SEA);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, HEADER_Y + 4, PAGE_WIDTH - MARGIN, HEADER_Y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SEA);
    doc.text("Captain John — atelier projecten", MARGIN, HEADER_Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Projectrapport", PAGE_WIDTH - MARGIN, HEADER_Y, { align: "right" });

    doc.line(MARGIN, FOOTER_Y - 5, PAGE_WIDTH - MARGIN, FOOTER_Y - 5);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Gegenereerd ${when.label}`, MARGIN, FOOTER_Y);
    doc.text(`Pagina ${i} / ${total}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
      align: "right",
    });
  }
}
