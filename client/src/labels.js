export const TYPE_LABELS = {
  glasfusion: "Glasfusion",
  tiffany: "Tiffany",
  "glas-in-lood": "Glas in lood",
  hout: "Hout",
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
