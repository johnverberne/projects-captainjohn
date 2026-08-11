export const TYPE_LABELS = {
  glasfusion: "Glasfusion",
  tiffany: "Tiffany",
  "glas-in-lood": "Glas in lood",
  hout: "Hout",
  keramiek: "Keramiek",
  tassen: "Tassen",
  overige: "Overige",
};

export const TECHNIQUE_LABELS = {
  slump: "Slump",
  fuse: "Fuse",
  cast: "Cast",
};

export const SPEED_LABELS = {
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
  "ultra-slow": "Ultra slow",
};

export function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function craftSubtitle(item) {
  if (!item) return "";
  if (item.type !== "glasfusion") return typeLabel(item.type);
  const tech = TECHNIQUE_LABELS[item.glasfusionTechnique] || "";
  const speed = SPEED_LABELS[item.glasfusionSpeed] || "";
  return [typeLabel(item.type), tech, speed].filter(Boolean).join(" · ");
}

export function stepHeading(step, index = 0) {
  if (step?.title?.trim()) return step.title.trim();
  return `Stap ${index + 1}: ${typeLabel(step?.type)}`;
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatKwh(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("nl-NL", {
    maximumFractionDigits: 2,
  })} kWh`;
}

export function formatEuro(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

export function hasSellingPrice(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

/** Hoofdfoto voor projectkaart; fallback: eerste foto. */
export function displayPhoto(project) {
  const photos = project?.photos || [];
  if (!photos.length) return null;
  return photos.find((photo) => photo.isCover) || photos[0];
}

export function labelChipStyle(color) {
  const hex = String(color || "#2a5554").replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length !== 6) {
    return { background: "#2a5554", color: "#fffdf8" };
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    background: `#${full}`,
    color: luminance > 0.62 ? "#1c2422" : "#fffdf8",
  };
}
