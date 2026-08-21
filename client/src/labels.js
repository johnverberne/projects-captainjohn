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
  custom: "Custom",
};

export function usesFiringSchedule(item) {
  return item?.type === "glasfusion" && item?.glasfusionTechnique === "custom";
}

export const SPEED_LABELS = {
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
  "ultra-slow": "Ultra slow",
};

export const SALE_STATUS_LABELS = {
  showroom: "Showroom",
  te_koop: "Te koop",
  verkocht: "Verkocht",
};

export const SALE_STATUSES = Object.keys(SALE_STATUS_LABELS);

export const OVEN_LABELS = {
  klein: "Klein",
  groot: "Groot",
  overige: "Overige",
};

export const OVEN_CODES = Object.keys(OVEN_LABELS);

export function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function saleStatusLabel(status) {
  return SALE_STATUS_LABELS[status] || status || "";
}

export function salePhotoLabel(status) {
  if (status === "te_koop" || status === "verkocht") {
    return SALE_STATUS_LABELS[status];
  }
  return "";
}

export function isOnSale(project) {
  return Boolean(project?.saleStatus && SALE_STATUS_LABELS[project.saleStatus]);
}

export function ovenLabel(code) {
  return OVEN_LABELS[code] || code || "";
}

export function displayTitle(project) {
  const saleTitle = project?.saleTitle?.trim();
  if (saleTitle) return saleTitle;
  return project?.title || "";
}

export function isPublicPhoto(photo) {
  return Boolean(photo?.isCover || photo?.isPublic);
}

export function publicPhotos(project) {
  return (project?.photos || []).filter(isPublicPhoto);
}

export function emptyFiringSegment() {
  return { rate: "", targetTemp: "", holdMinutes: "" };
}

export function defaultFiringSchedule() {
  return [
    { rate: 150, targetTemp: 540, holdMinutes: 20 },
    { rate: 300, targetTemp: 800, holdMinutes: 10 },
    { rate: "", targetTemp: 516, holdMinutes: 60 },
    { rate: 80, targetTemp: 370, holdMinutes: 0 },
    { rate: "", targetTemp: 50, holdMinutes: 0 },
  ];
}

export function formatFiringRate(rate) {
  if (rate === null || rate === undefined || rate === "") return "Vol";
  return `${Number(rate).toLocaleString("nl-NL")} °C/u`;
}

export function formatFiringSegment(segment) {
  if (!segment) return "";
  const hold = Number(segment.holdMinutes) || 0;
  return [
    formatFiringRate(segment.rate),
    `naar ${Number(segment.targetTemp).toLocaleString("nl-NL")} °C`,
    hold ? `${hold} min houden` : "geen hold",
  ].join(" · ");
}

/** Aangenomen stijging voor een lege (“vol”) ramp in de grafiek. */
export const FIRING_FULL_RATE = 600;
export const FIRING_START_TEMP = 20;

export function formatFiringDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours} u ${mins} min`;
  if (hours) return `${hours} u`;
  return `${mins} min`;
}

export function firingChartSeries(segments, { startTemp = FIRING_START_TEMP } = {}) {
  const points = [{ timeMin: 0, temp: startTemp, kind: "start" }];
  let timeMin = 0;
  let temp = startTemp;

  for (const segment of segments || []) {
    const target = Number(segment.targetTemp);
    if (!Number.isFinite(target)) continue;

    const hold = Number(segment.holdMinutes) || 0;
    const isFull =
      segment.rate === null || segment.rate === undefined || segment.rate === "";
    const rate = isFull ? FIRING_FULL_RATE : Number(segment.rate);
    const usableRate = Number.isFinite(rate) && rate > 0 ? rate : FIRING_FULL_RATE;
    const rampMin = (Math.abs(target - temp) / usableRate) * 60;

    if (rampMin > 0 || target !== temp) {
      timeMin += rampMin;
      temp = target;
      points.push({
        timeMin,
        temp,
        kind: isFull ? "full" : "ramp",
      });
    }

    if (hold > 0) {
      timeMin += hold;
      points.push({ timeMin, temp, kind: "hold" });
    }
  }

  return {
    points,
    durationMin: timeMin,
    maxTemp: Math.max(...points.map((point) => point.temp)),
    minTemp: Math.min(...points.map((point) => point.temp)),
  };
}

export function craftSubtitle(item) {
  if (!item) return "";
  if (item.type !== "glasfusion") {
    return [typeLabel(item.type), ovenLabel(item.oven)].filter(Boolean).join(" · ");
  }
  const tech = TECHNIQUE_LABELS[item.glasfusionTechnique] || "";
  const speed = SPEED_LABELS[item.glasfusionSpeed] || "";
  return [typeLabel(item.type), tech, speed, ovenLabel(item.oven)]
    .filter(Boolean)
    .join(" · ");
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
