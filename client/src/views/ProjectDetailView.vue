<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProjectOptionFields from "../components/ProjectOptionFields.vue";
import PhotoUploadPicker from "../components/PhotoUploadPicker.vue";
import SaleInterestDialog from "../components/SaleInterestDialog.vue";
import {
  addPhotos,
  addStep,
  addStepPhotos,
  deletePhoto,
  deleteProject,
  deleteStep,
  deleteStepPhoto,
  getMeta,
  getProject,
  purgeProject,
  purgeStep,
  reorderPhotos,
  restoreProject,
  restoreStep,
  thumbPhoto,
  thumbStepPhoto,
  updateProject,
  updateStep,
} from "../api";
import { useAuth } from "../auth";
import {
  typeLabel,
  TYPE_LABELS,
  TECHNIQUE_LABELS,
  SPEED_LABELS,
  craftSubtitle,
  stepHeading,
  formatDate,
  formatKwh,
  formatEuro,
  hasSellingPrice,
  labelChipStyle,
  saleStatusLabel,
  isOnSale,
} from "../labels";

const route = useRoute();
const router = useRouter();
const { isAdmin, isLoggedIn, user } = useAuth();

const editMode = computed(() => Boolean(route.meta.editMode));
const homePath = computed(() => (editMode.value ? "/bewerken" : "/"));

const project = ref(null);
const loading = ref(true);
const error = ref("");
const uploading = ref(false);
const liking = ref(false);
const photoBusy = ref("");
const saving = ref(false);
const interestOpen = ref(false);
const mode = ref("view"); // view | edit-project | add-step | edit-step
const editingStepId = ref(null);
const viewerPhoto = ref(null);
const viewerStepId = ref(null);
const stepUploadId = ref(null);

const meta = ref({
  types: Object.keys(TYPE_LABELS),
  glasfusionTechniques: Object.keys(TECHNIQUE_LABELS),
  glasfusionSpeeds: Object.keys(SPEED_LABELS),
  labels: [],
});

const title = ref("");
const type = ref("");
const glasfusionTechnique = ref("");
const glasfusionSpeed = ref("");
const notes = ref("");
const kwhUsage = ref("");
const costPrice = ref("");
const sellingPrice = ref("");
const saleStatus = ref("");
const saleDescription = ref("");
const projectLabels = ref([]);
const stepFiles = ref([]);
const stepPreviews = ref([]);

const isGlasfusion = computed(() => type.value === "glasfusion");
const allSteps = computed(() => project.value?.steps || []);
const steps = computed(() => allSteps.value.filter((step) => !step.deletedAt));
const deletedSteps = computed(() =>
  allSteps.value.filter((step) => Boolean(step.deletedAt))
);
const isDeleted = computed(() => Boolean(project.value?.deletedAt));
const restoring = ref(false);
const stepBusyId = ref("");

const canManage = computed(() => {
  if (!editMode.value || !isLoggedIn.value || !project.value) return false;
  if (isAdmin.value) return true;
  const owner = project.value.ownerEmail;
  if (!owner) return true;
  return owner === user.value?.email;
});

const canEdit = computed(() => canManage.value && !isDeleted.value);

const totals = computed(() => {
  if (!project.value) return { kwh: null, cost: null };
  let kwh = 0;
  let cost = 0;
  let hasKwh = false;
  let hasCost = false;

  const add = (item) => {
    if (item.kwhUsage != null) {
      kwh += Number(item.kwhUsage) || 0;
      hasKwh = true;
    }
    if (item.costPrice != null) {
      cost += Number(item.costPrice) || 0;
      hasCost = true;
    }
  };

  add(project.value);
  for (const step of steps.value) add(step);

  return {
    kwh: hasKwh ? kwh : null,
    cost: hasCost ? cost : null,
  };
});

function openPhoto(photo, stepId = null) {
  if (suppressPhotoClick.value) return;
  viewerPhoto.value = photo;
  viewerStepId.value = stepId;
}

function closePhoto() {
  viewerPhoto.value = null;
  viewerStepId.value = null;
}

const viewerPhotos = computed(() => {
  if (!project.value) return [];
  if (viewerStepId.value) {
    const step = project.value.steps?.find((s) => s._id === viewerStepId.value);
    return step?.photos || [];
  }
  return project.value.photos || [];
});

function selectViewerPhoto(photo) {
  if (!photo?._id) return;
  viewerPhoto.value = photo;
}

function stepViewerPhoto(delta) {
  const photos = viewerPhotos.value;
  if (photos.length < 2 || !viewerPhoto.value) return;
  const index = photos.findIndex((p) => p._id === viewerPhoto.value._id);
  if (index < 0) return;
  const next = (index + delta + photos.length) % photos.length;
  viewerPhoto.value = photos[next];
}

function findPhoto(photoId, stepId = null) {
  if (!project.value) return null;
  if (stepId) {
    const step = project.value.steps?.find((s) => s._id === stepId);
    return step?.photos?.find((p) => p._id === photoId) || null;
  }
  return project.value.photos?.find((p) => p._id === photoId) || null;
}

function syncViewerPhoto() {
  if (!viewerPhoto.value) return;
  viewerPhoto.value = findPhoto(viewerPhoto.value._id, viewerStepId.value);
}

const canThumb = computed(() => Boolean(project.value) && !isDeleted.value);

async function giveThumb(photo, event, stepId = null) {
  event?.stopPropagation();
  if (!canThumb.value || !photo?._id || liking.value || photo.thumbedByMe) return;
  liking.value = true;
  error.value = "";
  try {
    project.value = stepId
      ? await thumbStepPhoto(route.params.id, stepId, photo._id)
      : await thumbPhoto(route.params.id, photo._id);
    if (viewerPhoto.value?._id === photo._id) {
      viewerStepId.value = stepId;
      syncViewerPhoto();
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    liking.value = false;
  }
}

const projectPhotos = computed(() => project.value?.photos || []);

const dragPhotoId = ref(null);
const dragOverPhotoId = ref(null);
const suppressPhotoClick = ref(false);

const PHOTO_DRAG_DELAY_MS = 280;
const PHOTO_DRAG_MOVE_PX = 8;
const PHOTO_SCROLL_CANCEL_PX = 12;

let photoPointer = null;

function photoFromPoint(x, y) {
  const node = document.elementFromPoint(x, y);
  const tile = node?.closest?.("[data-photo-id]");
  if (!tile) return null;
  const id = tile.getAttribute("data-photo-id");
  return (project.value?.photos || []).find((p) => String(p._id) === id) || null;
}

function preventPhotoContextMenu(event) {
  event.preventDefault();
}

function removePhotoPointerListeners() {
  window.removeEventListener("pointermove", onPhotoPointerMove);
  window.removeEventListener("pointerup", onPhotoPointerUp);
  window.removeEventListener("pointercancel", onPhotoPointerCancel);
  window.removeEventListener("touchmove", onPhotoTouchMove);
  window.removeEventListener("touchend", onPhotoTouchEnd);
  window.removeEventListener("touchcancel", onPhotoTouchCancel);
  window.removeEventListener("contextmenu", preventPhotoContextMenu, true);
}

function releasePhotoPointerCapture() {
  if (!photoPointer?.el || photoPointer.id == null) return;
  if (photoPointer.type === "touch") return;
  try {
    if (photoPointer.el.hasPointerCapture(photoPointer.id)) {
      photoPointer.el.releasePointerCapture(photoPointer.id);
    }
  } catch {
    /* already released */
  }
}

function clearPhotoPointer({ endDrag = false } = {}) {
  if (photoPointer?.timer) clearTimeout(photoPointer.timer);
  releasePhotoPointerCapture();
  removePhotoPointerListeners();
  photoPointer = null;
  if (endDrag) onPhotoDragEnd();
}

function onPhotoDragEnd() {
  dragPhotoId.value = null;
  dragOverPhotoId.value = null;
  window.setTimeout(() => {
    suppressPhotoClick.value = false;
  }, 0);
}

function beginPhotoPointerDrag() {
  if (!photoPointer || photoPointer.dragging) return;
  photoPointer.timer = 0;
  photoPointer.dragging = true;
  dragPhotoId.value = photoPointer.photo._id;
  suppressPhotoClick.value = true;
  if (photoPointer.type !== "touch") {
    try {
      photoPointer.el.setPointerCapture(photoPointer.id);
    } catch {
      /* capture is optional */
    }
  }
  if (typeof navigator.vibrate === "function") navigator.vibrate(12);
}

function canStartPhotoDrag(photo, target) {
  return (
    canEdit.value &&
    !photoBusy.value &&
    Boolean(photo?._id) &&
    !target?.closest?.(".photo-delete, .thumb-chip")
  );
}

function startPhotoPointerSession({ photo, el, id, x, y, type }) {
  clearPhotoPointer();
  photoPointer = {
    photo,
    el,
    id,
    x,
    y,
    dragging: false,
    timer: 0,
    type,
  };
  window.addEventListener("contextmenu", preventPhotoContextMenu, true);
  if (type === "touch") {
    window.addEventListener("touchmove", onPhotoTouchMove, { passive: false });
    window.addEventListener("touchend", onPhotoTouchEnd);
    window.addEventListener("touchcancel", onPhotoTouchCancel);
    photoPointer.timer = window.setTimeout(
      beginPhotoPointerDrag,
      PHOTO_DRAG_DELAY_MS
    );
    return;
  }
  window.addEventListener("pointermove", onPhotoPointerMove, { passive: false });
  window.addEventListener("pointerup", onPhotoPointerUp);
  window.addEventListener("pointercancel", onPhotoPointerCancel);
}

function finishPhotoPointer(x, y) {
  const wasDragging = Boolean(photoPointer?.dragging);
  const target = wasDragging ? photoFromPoint(x, y) : null;
  releasePhotoPointerCapture();
  if (photoPointer?.timer) clearTimeout(photoPointer.timer);
  removePhotoPointerListeners();
  photoPointer = null;
  if (!wasDragging) return;
  if (target) onPhotoDrop(target);
  onPhotoDragEnd();
}

function updatePhotoDragOver(x, y, event) {
  if (!photoPointer?.dragging) return;
  event.preventDefault();
  const over = photoFromPoint(x, y);
  dragOverPhotoId.value =
    over && over._id !== dragPhotoId.value ? over._id : null;
}

function onPhotoPointerDown(photo, event) {
  if (event.pointerType === "touch") return;
  if (!canStartPhotoDrag(photo, event.target)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  startPhotoPointerSession({
    photo,
    el: event.currentTarget,
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    type: event.pointerType || "mouse",
  });
}

function onPhotoTouchStart(photo, event) {
  if (!canStartPhotoDrag(photo, event.target)) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  startPhotoPointerSession({
    photo,
    el: event.currentTarget,
    id: touch.identifier,
    x: touch.clientX,
    y: touch.clientY,
    type: "touch",
  });
}

function onPhotoPointerMove(event) {
  if (!photoPointer || event.pointerId !== photoPointer.id) return;
  const dist = Math.hypot(
    event.clientX - photoPointer.x,
    event.clientY - photoPointer.y
  );
  if (!photoPointer.dragging) {
    if (dist >= PHOTO_DRAG_MOVE_PX) beginPhotoPointerDrag();
    return;
  }
  updatePhotoDragOver(event.clientX, event.clientY, event);
}

function onPhotoPointerUp(event) {
  if (!photoPointer || event.pointerId !== photoPointer.id) return;
  finishPhotoPointer(event.clientX, event.clientY);
}

function onPhotoPointerCancel(event) {
  if (!photoPointer || event.pointerId !== photoPointer.id) return;
  clearPhotoPointer({ endDrag: photoPointer.dragging });
}

function touchFromEvent(event) {
  if (!photoPointer) return null;
  const changed = Array.from(event.changedTouches || []);
  const active = Array.from(event.touches || []);
  return (
    changed.find((touch) => touch.identifier === photoPointer.id) ||
    active.find((touch) => touch.identifier === photoPointer.id) ||
    null
  );
}

function onPhotoTouchMove(event) {
  const touch = touchFromEvent(event);
  if (!touch) return;
  const dist = Math.hypot(touch.clientX - photoPointer.x, touch.clientY - photoPointer.y);
  if (!photoPointer.dragging) {
    if (dist >= PHOTO_SCROLL_CANCEL_PX) clearPhotoPointer();
    return;
  }
  updatePhotoDragOver(touch.clientX, touch.clientY, event);
}

function onPhotoTouchEnd(event) {
  const touch = touchFromEvent(event);
  if (!touch) return;
  finishPhotoPointer(touch.clientX, touch.clientY);
}

function onPhotoTouchCancel(event) {
  if (!photoPointer || photoPointer.type !== "touch") return;
  const cancelled = Array.from(event.changedTouches || []).some(
    (touch) => touch.identifier === photoPointer.id
  );
  if (!cancelled) return;
  clearPhotoPointer({ endDrag: photoPointer.dragging });
}

function onPhotoContextMenu(event) {
  if (canEdit.value) event.preventDefault();
}

async function onPhotoDrop(targetPhoto) {
  const fromId = dragPhotoId.value;
  dragOverPhotoId.value = null;
  if (
    !canEdit.value ||
    !fromId ||
    !targetPhoto?._id ||
    fromId === targetPhoto._id ||
    photoBusy.value
  ) {
    return;
  }

  const photos = [...(project.value?.photos || [])];
  const fromIdx = photos.findIndex((p) => p._id === fromId);
  const toIdx = photos.findIndex((p) => p._id === targetPhoto._id);
  if (fromIdx < 0 || toIdx < 0) return;

  const [moved] = photos.splice(fromIdx, 1);
  photos.splice(toIdx, 0, moved);
  const nextPhotos = photos.map((photo, index) => ({
    ...photo,
    isCover: index === 0,
  }));
  project.value = { ...project.value, photos: nextPhotos };

  photoBusy.value = "reorder";
  error.value = "";
  try {
    project.value = await reorderPhotos(
      route.params.id,
      nextPhotos.map((photo) => photo._id)
    );
    syncViewerPhoto();
  } catch (e) {
    error.value = e.message;
    try {
      project.value = await getProject(route.params.id);
    } catch {
      /* keep optimistic order if reload fails */
    }
  } finally {
    photoBusy.value = "";
  }
}

async function removePhoto(photo, event, stepId = null) {
  event?.stopPropagation();
  if (!canEdit.value || !photo?._id || photoBusy.value) return;
  if (!window.confirm("Deze foto verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
    return;
  }
  photoBusy.value = `delete-${photo._id}`;
  error.value = "";
  try {
    project.value = stepId
      ? await deleteStepPhoto(route.params.id, stepId, photo._id)
      : await deletePhoto(route.params.id, photo._id);
    if (viewerPhoto.value?._id === photo._id) {
      closePhoto();
    } else {
      syncViewerPhoto();
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    photoBusy.value = "";
  }
}

function clearStepFiles() {
  for (const preview of stepPreviews.value) {
    URL.revokeObjectURL(preview.url);
  }
  stepFiles.value = [];
  stepPreviews.value = [];
}

function resetForm() {
  title.value = "";
  type.value = "";
  glasfusionTechnique.value = "";
  glasfusionSpeed.value = "";
  notes.value = "";
  kwhUsage.value = "";
  costPrice.value = "";
  sellingPrice.value = "";
  saleStatus.value = "";
  saleDescription.value = "";
  projectLabels.value = [];
  clearStepFiles();
}

function fillForm(item) {
  title.value = item.title || "";
  type.value = item.type || "";
  glasfusionTechnique.value = item.glasfusionTechnique || "";
  glasfusionSpeed.value = item.glasfusionSpeed || "";
  notes.value = item.notes || "";
  kwhUsage.value = item.kwhUsage ?? "";
  costPrice.value = item.costPrice ?? "";
  sellingPrice.value = item.sellingPrice ?? "";
  saleStatus.value = item.saleStatus || "";
  saleDescription.value = item.saleDescription || "";
  projectLabels.value = (item.labels || []).map((label) => ({
    name: label.name,
    color: label.color,
  }));
}

function startEditProject() {
  if (!canEdit.value || !project.value) return;
  fillForm(project.value);
  clearStepFiles();
  error.value = "";
  mode.value = "edit-project";
}

function startAddStep() {
  if (!canEdit.value) return;
  resetForm();
  error.value = "";
  editingStepId.value = null;
  mode.value = "add-step";
}

function startEditStep(step) {
  if (!canEdit.value) return;
  fillForm(step);
  clearStepFiles();
  error.value = "";
  editingStepId.value = step._id;
  mode.value = "edit-step";
}

function cancelForm() {
  mode.value = "view";
  editingStepId.value = null;
  error.value = "";
  clearStepFiles();
}

function onKeydown(event) {
  if (viewerPhoto.value) {
    if (event.key === "Escape") {
      closePhoto();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepViewerPhoto(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepViewerPhoto(1);
      return;
    }
    return;
  }
  if (event.key === "Escape" && mode.value !== "view") cancelForm();
}

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearPhotoPointer();
  clearStepFiles();
});

function validateForm({ requireTitle }) {
  error.value = "";
  if (requireTitle && !title.value.trim()) {
    error.value = "Geef een titel.";
    return false;
  }
  if (!type.value) {
    error.value = "Kies een soort.";
    return false;
  }
  if (isGlasfusion.value && (!glasfusionTechnique.value || !glasfusionSpeed.value)) {
    error.value = "Kies techniek (slump/fuse/cast) en type (fast…ultra slow).";
    return false;
  }
  return true;
}

function buildFormData({
  includePhotos = false,
  includeLabels = false,
  includeSellingPrice = false,
  includeSaleFields = false,
} = {}) {
  const form = new FormData();
  form.append("title", title.value.trim());
  form.append("type", type.value);
  form.append("notes", notes.value);
  form.append("kwhUsage", kwhUsage.value);
  form.append("costPrice", costPrice.value);
  if (includeSellingPrice) {
    form.append("sellingPrice", sellingPrice.value);
  }
  if (includeSaleFields) {
    form.append("saleStatus", saleStatus.value);
    form.append("saleDescription", saleDescription.value);
  }
  if (isGlasfusion.value) {
    form.append("glasfusionTechnique", glasfusionTechnique.value);
    form.append("glasfusionSpeed", glasfusionSpeed.value);
  }
  if (includeLabels) {
    form.append("labels", JSON.stringify(projectLabels.value || []));
  }
  if (includePhotos) {
    for (const file of stepFiles.value) form.append("photos", file);
  }
  return form;
}

async function saveProjectEdit() {
  if (!validateForm({ requireTitle: true })) return;
  saving.value = true;
  try {
    project.value = await updateProject(
      route.params.id,
      buildFormData({
        includeLabels: true,
        includeSellingPrice: true,
        includeSaleFields: true,
      })
    );
    meta.value = {
      ...meta.value,
      labels: mergeCatalog(meta.value.labels, projectLabels.value),
    };
    mode.value = "view";
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function mergeCatalog(catalog, added) {
  const map = new Map();
  for (const item of [...(catalog || []), ...(added || [])]) {
    const key = String(item.name || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    map.set(key, { name: item.name, color: item.color });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
  );
}

async function saveStep() {
  if (!validateForm({ requireTitle: false })) return;
  saving.value = true;
  try {
    const form = buildFormData({ includePhotos: mode.value === "add-step" });
    if (mode.value === "add-step") {
      project.value = await addStep(route.params.id, form);
    } else {
      project.value = await updateStep(route.params.id, editingStepId.value, form);
    }
    mode.value = "view";
    editingStepId.value = null;
    clearStepFiles();
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function onStepFiles(event) {
  const selected = Array.from(event.target.files || []);
  stepFiles.value = [...stepFiles.value, ...selected];
  stepPreviews.value = stepFiles.value.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));
  event.target.value = "";
}

function removeStepFile(index) {
  URL.revokeObjectURL(stepPreviews.value[index]?.url);
  stepFiles.value.splice(index, 1);
  stepPreviews.value.splice(index, 1);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    project.value = await getProject(route.params.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  load();
  window.addEventListener("keydown", onKeydown);
  try {
    meta.value = await getMeta();
  } catch {
    /* fallback labels already set */
  }
});

async function onMorePhotos(event, stepId = null) {
  const selected = Array.from(event.target.files || []);
  event.target.value = "";
  if (!selected.length) return;

  uploading.value = true;
  stepUploadId.value = stepId;
  error.value = "";
  try {
    const form = new FormData();
    for (const file of selected) form.append("photos", file);
    project.value = stepId
      ? await addStepPhotos(route.params.id, stepId, form)
      : await addPhotos(route.params.id, form);
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
    stepUploadId.value = null;
  }
}

async function removeStep(step) {
  const label = stepHeading(step, steps.value.indexOf(step));
  if (
    !confirm(
      `Stap “${label}” verwijderen? Je kunt hem later terugzetten of definitief wissen.`
    )
  ) {
    return;
  }
  error.value = "";
  try {
    project.value = await deleteStep(route.params.id, step._id);
  } catch (e) {
    error.value = e.message;
  }
}

async function restoreDeletedStep(step) {
  const label = stepHeading(step, 0);
  if (!confirm(`Stap “${label}” terugzetten?`)) return;
  stepBusyId.value = `restore-${step._id}`;
  error.value = "";
  try {
    project.value = await restoreStep(route.params.id, step._id);
  } catch (e) {
    error.value = e.message;
  } finally {
    stepBusyId.value = "";
  }
}

async function purgeDeletedStep(step) {
  const label = stepHeading(step, 0);
  if (
    !confirm(
      `Stap “${label}” DEFINITIEF verwijderen? Dit kan niet ongedaan worden gemaakt.`
    )
  ) {
    return;
  }
  stepBusyId.value = `purge-${step._id}`;
  error.value = "";
  try {
    project.value = await purgeStep(route.params.id, step._id);
  } catch (e) {
    error.value = e.message;
  } finally {
    stepBusyId.value = "";
  }
}

async function remove() {
  if (
    !confirm(
      "Dit project verwijderen? Het verdwijnt uit de lijst; je kunt het later terugzetten of definitief wissen."
    )
  ) {
    return;
  }
  try {
    await deleteProject(route.params.id);
    router.replace(homePath.value);
  } catch (e) {
    error.value = e.message;
  }
}

async function restore() {
  if (!confirm("Dit project terugzetten?")) return;
  restoring.value = true;
  error.value = "";
  try {
    project.value = await restoreProject(route.params.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    restoring.value = false;
  }
}

async function purge() {
  if (
    !confirm(
      "Dit project DEFINITIEF verwijderen? Foto’s en stappen gaan ook weg. Dit kan niet ongedaan worden gemaakt."
    )
  ) {
    return;
  }
  restoring.value = true;
  error.value = "";
  try {
    await purgeProject(route.params.id);
    router.replace(homePath.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    restoring.value = false;
  }
}
</script>

<template>
  <section class="panel stack">
    <p v-if="loading" class="muted">Laden…</p>
    <p v-else-if="error && !project" class="error">{{ error }}</p>

    <template v-else-if="project && canEdit && mode === 'edit-project'">
      <div>
        <h1>Project bewerken</h1>
        <p class="lead">Pas titel, soort en overige gegevens aan.</p>
      </div>

      <ProjectOptionFields
        v-model:title="title"
        v-model:type="type"
        v-model:glasfusion-technique="glasfusionTechnique"
        v-model:glasfusion-speed="glasfusionSpeed"
        v-model:notes="notes"
        v-model:kwh-usage="kwhUsage"
        v-model:cost-price="costPrice"
        v-model:selling-price="sellingPrice"
        v-model:sale-status="saleStatus"
        v-model:sale-description="saleDescription"
        v-model:labels="projectLabels"
        :meta="meta"
        :show-labels="true"
        :show-selling-price="true"
        :show-sale-fields="true"
        id-prefix="edit-project"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="btn btn-primary" type="button" :disabled="saving" @click="saveProjectEdit">
          {{ saving ? "Opslaan…" : "Wijzigingen opslaan" }}
        </button>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="cancelForm">
          Annuleren
        </button>
      </div>
    </template>

    <template v-else-if="project && canEdit && (mode === 'add-step' || mode === 'edit-step')">
      <div>
        <h1>{{ mode === 'add-step' ? 'Stap toevoegen' : 'Stap bewerken' }}</h1>
        <p class="lead">
          Extra onderdelen bij dit project, zoals een houten voet of een tas.
        </p>
      </div>

      <ProjectOptionFields
        v-model:title="title"
        v-model:type="type"
        v-model:glasfusion-technique="glasfusionTechnique"
        v-model:glasfusion-speed="glasfusionSpeed"
        v-model:notes="notes"
        v-model:kwh-usage="kwhUsage"
        v-model:cost-price="costPrice"
        :meta="meta"
        id-prefix="step"
        title-label="Titel (optioneel)"
        title-placeholder="Bijv. Houten voet"
        type-label-text="Soort stap"
      />

      <div v-if="mode === 'add-step'" class="field">
        <label>Foto’s</label>
        <PhotoUploadPicker title="Foto’s bij deze stap" @change="onStepFiles" />
        <div v-if="stepPreviews.length" class="photo-grid" style="margin-top: 12px">
          <div
            v-for="(preview, index) in stepPreviews"
            :key="preview.url"
            style="position: relative"
          >
            <img :src="preview.url" :alt="preview.name" />
            <button
              type="button"
              class="btn btn-danger"
              style="position: absolute; top: 4px; right: 4px; padding: 4px 8px; font-size: 0.75rem"
              @click="removeStepFile(index)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="btn btn-primary" type="button" :disabled="saving" @click="saveStep">
          {{ saving ? "Opslaan…" : mode === "add-step" ? "Stap opslaan" : "Wijzigingen opslaan" }}
        </button>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="cancelForm">
          Annuleren
        </button>
      </div>
    </template>

    <template v-else-if="project">
      <p v-if="isDeleted" class="deleted-banner">
        Dit project is verwijderd
        <template v-if="project.deletedAt">
          op {{ formatDate(project.deletedAt) }}
        </template>
        <template v-if="project.deletedBy">
          door {{ project.deletedBy }}
        </template>
        . Foto’s en gegevens blijven bewaard.
      </p>
      <p v-else-if="!editMode" class="muted" style="margin: 0">
        Publieke weergave — alleen bekijken.
      </p>
      <p v-else-if="!canEdit" class="muted" style="margin: 0">
        Je hebt geen rechten om dit project te bewerken.
      </p>

      <div>
        <span class="badge">{{ typeLabel(project.type) }}</span>
        <span
          v-if="isOnSale(project)"
          class="badge"
          :class="`sales-badge-${project.saleStatus}`"
        >
          {{ saleStatusLabel(project.saleStatus) }}
        </span>
        <span v-if="isDeleted" class="badge badge-deleted">Verwijderd</span>
        <h1 style="margin-top: 10px">{{ project.title }}</h1>
        <p class="lead">{{ craftSubtitle(project) }}</p>
        <div v-if="project.labels?.length" class="label-chip-row">
          <span
            v-for="label in project.labels"
            :key="label.name"
            class="label-chip"
            :style="labelChipStyle(label.color)"
          >
            {{ label.name }}
          </span>
        </div>
        <p class="muted">Gestart {{ formatDate(project.createdAt) }}</p>
      </div>

      <div
        v-if="
          hasSellingPrice(project.sellingPrice) ||
          (editMode &&
            (project.kwhUsage != null || project.costPrice != null))
        "
        class="stats-row"
      >
        <div v-if="hasSellingPrice(project.sellingPrice)" class="stat">
          <span class="stat-label">Verkoopprijs</span>
          <strong>{{ formatEuro(project.sellingPrice) }}</strong>
        </div>
        <div v-if="editMode && project.kwhUsage != null" class="stat">
          <span class="stat-label">Verbruik</span>
          <strong>{{ formatKwh(project.kwhUsage) }}</strong>
        </div>
        <div v-if="editMode && project.costPrice != null" class="stat">
          <span class="stat-label">Kostprijs</span>
          <strong>{{ formatEuro(project.costPrice) }}</strong>
        </div>
      </div>

      <div v-if="project.saleDescription?.trim()">
        <h2>Verkoopomschrijving</h2>
        <p class="muted" style="white-space: pre-wrap">
          {{ project.saleDescription.trim() }}
        </p>
      </div>

      <div v-if="project.notes">
        <h2>Notities</h2>
        <p class="muted" style="white-space: pre-wrap">{{ project.notes }}</p>
      </div>

      <div>
        <h2>Foto’s ({{ project.photos?.length || 0 }})</h2>
        <p v-if="canEdit && project.photos?.length" class="muted" style="margin-top: 4px">
          Sleep foto’s om de volgorde te wijzigen (op de telefoon: even vasthouden).
          De eerste foto is de hoofdfoto (en verkoopfoto).
        </p>
        <div
          v-if="projectPhotos.length"
          class="photo-grid"
          :class="{ 'is-reordering': Boolean(dragPhotoId) }"
          style="margin-top: 10px"
        >
          <div
            v-for="photo in projectPhotos"
            :key="photo._id"
            class="photo-tile"
            :class="{
              cover: photo.isCover,
              dragging: dragPhotoId === photo._id,
              'drag-over': dragOverPhotoId === photo._id,
              sortable: canEdit && !photoBusy,
            }"
            :data-photo-id="photo._id"
            @pointerdown="onPhotoPointerDown(photo, $event)"
            @touchstart="onPhotoTouchStart(photo, $event)"
            @contextmenu="onPhotoContextMenu($event)"
          >
            <button
              type="button"
              class="photo-thumb"
              @click="openPhoto(photo)"
            >
              <img :src="photo.url" :alt="photo.originalName" draggable="false" />
            </button>
            <span v-if="photo.isCover" class="cover-badge">Hoofdfoto</span>
            <button
              v-if="canEdit"
              type="button"
              class="photo-delete"
              :disabled="Boolean(photoBusy)"
              aria-label="Foto verwijderen"
              @click="removePhoto(photo, $event)"
            >
              ×
            </button>
            <button
              v-if="canThumb"
              type="button"
              class="thumb-chip"
              :class="{ done: photo.thumbedByMe }"
              :disabled="liking || photo.thumbedByMe"
              :aria-label="
                photo.thumbedByMe
                  ? `Al een duimpje gegeven, nu ${photo.thumbsUp || 0}`
                  : `Duimpje geven, nu ${photo.thumbsUp || 0}`
              "
              @click="giveThumb(photo, $event)"
            >
              <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                />
              </svg>
              <span>{{ photo.thumbsUp || 0 }}</span>
            </button>
            <span v-else class="thumb-chip thumb-chip-static">
              <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                />
              </svg>
              <span>{{ photo.thumbsUp || 0 }}</span>
            </span>
          </div>
        </div>
        <p v-else class="muted" style="margin-top: 8px">Nog geen foto’s.</p>
      </div>

      <PhotoUploadPicker
        v-if="canEdit"
        title="Meer foto’s toevoegen"
        :disabled="uploading"
        @change="onMorePhotos($event)"
      />

      <div class="step-section">
        <div class="step-section-head">
          <h2>Extra stappen ({{ steps.length }})</h2>
          <p class="muted">
            Bijvoorbeeld een houten voet maken of het werk in een tas leveren.
          </p>
        </div>

        <div v-if="!steps.length" class="empty-step">
          Nog geen extra stappen.
        </div>

        <article
          v-for="(step, index) in steps"
          :key="step._id"
          class="step-block"
        >
          <div class="step-block-head">
            <span class="badge">{{ typeLabel(step.type) }}</span>
            <h3>{{ stepHeading(step, index) }}</h3>
            <p class="muted">{{ craftSubtitle(step) }}</p>
          </div>

          <div
            v-if="
              editMode &&
              (step.kwhUsage != null || step.costPrice != null)
            "
            class="stats-row"
          >
            <div v-if="step.kwhUsage != null" class="stat">
              <span class="stat-label">Verbruik</span>
              <strong>{{ formatKwh(step.kwhUsage) }}</strong>
            </div>
            <div v-if="step.costPrice != null" class="stat">
              <span class="stat-label">Kostprijs</span>
              <strong>{{ formatEuro(step.costPrice) }}</strong>
            </div>
          </div>

          <div v-if="step.notes">
            <p class="muted" style="white-space: pre-wrap">{{ step.notes }}</p>
          </div>

          <div>
            <h4 class="step-photos-title">Foto’s ({{ step.photos?.length || 0 }})</h4>
            <div v-if="step.photos?.length" class="photo-grid" style="margin-top: 10px">
              <div
                v-for="photo in step.photos"
                :key="photo._id"
                class="photo-tile"
              >
                <button
                  type="button"
                  class="photo-thumb"
                  @click="openPhoto(photo, step._id)"
                >
                  <img :src="photo.url" :alt="photo.originalName" />
                </button>
                <button
                  v-if="canEdit"
                  type="button"
                  class="photo-delete"
                  :disabled="Boolean(photoBusy)"
                  aria-label="Foto verwijderen"
                  @click="removePhoto(photo, $event, step._id)"
                >
                  ×
                </button>
                <button
                  v-if="canThumb"
                  type="button"
                  class="thumb-chip"
                  :class="{ done: photo.thumbedByMe }"
                  :disabled="liking || photo.thumbedByMe"
                  :aria-label="
                    photo.thumbedByMe
                      ? `Al een duimpje gegeven, nu ${photo.thumbsUp || 0}`
                      : `Duimpje geven, nu ${photo.thumbsUp || 0}`
                  "
                  @click="giveThumb(photo, $event, step._id)"
                >
                  <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                    />
                  </svg>
                  <span>{{ photo.thumbsUp || 0 }}</span>
                </button>
                <span v-else class="thumb-chip thumb-chip-static">
                  <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                    />
                  </svg>
                  <span>{{ photo.thumbsUp || 0 }}</span>
                </span>
              </div>
            </div>
            <p v-else class="muted" style="margin-top: 8px">Nog geen foto’s bij deze stap.</p>
          </div>

          <PhotoUploadPicker
            v-if="canEdit"
            title="Foto’s bij deze stap"
            :disabled="uploading"
            @change="onMorePhotos($event, step._id)"
          />

          <div v-if="canEdit" class="step-actions">
            <button class="btn btn-secondary btn-small" type="button" @click="startEditStep(step)">
              Stap bewerken
            </button>
            <button class="btn btn-danger btn-small" type="button" @click="removeStep(step)">
              Stap verwijderen
            </button>
          </div>
        </article>

        <button
          v-if="canEdit"
          class="btn btn-secondary btn-block"
          type="button"
          @click="startAddStep"
        >
          Stap toevoegen
        </button>

        <div
          v-if="canManage && deletedSteps.length"
          class="trash-section"
          style="margin-top: 8px"
        >
          <h3 class="trash-heading">Verwijderde stappen</h3>
          <p class="muted">Terugzetten of definitief wissen.</p>
          <article
            v-for="step in deletedSteps"
            :key="step._id"
            class="step-block step-block-deleted"
          >
            <div class="step-block-head">
              <span class="badge badge-deleted">Verwijderd</span>
              <span class="badge">{{ typeLabel(step.type) }}</span>
              <h3>{{ stepHeading(step, 0) }}</h3>
              <p class="muted">
                Verwijderd {{ formatDate(step.deletedAt) }}
                <template v-if="step.deletedBy"> · door {{ step.deletedBy }}</template>
              </p>
            </div>
            <div class="trash-actions">
              <button
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="stepBusyId === `restore-${step._id}`"
                @click="restoreDeletedStep(step)"
              >
                {{
                  stepBusyId === `restore-${step._id}` ? "Bezig…" : "Terugzetten"
                }}
              </button>
              <button
                class="btn btn-danger btn-small"
                type="button"
                :disabled="stepBusyId === `purge-${step._id}`"
                @click="purgeDeletedStep(step)"
              >
                {{
                  stepBusyId === `purge-${step._id}`
                    ? "Bezig…"
                    : "Definitief wissen"
                }}
              </button>
            </div>
          </article>
        </div>
      </div>

      <div
        v-if="
          editMode &&
          steps.length &&
          (totals.kwh != null || totals.cost != null)
        "
        class="stats-row totals-row"
      >
        <div v-if="totals.kwh != null" class="stat">
          <span class="stat-label">Totaal verbruik</span>
          <strong>{{ formatKwh(totals.kwh) }}</strong>
        </div>
        <div v-if="totals.cost != null" class="stat">
          <span class="stat-label">Totale kostprijs</span>
          <strong>{{ formatEuro(totals.cost) }}</strong>
        </div>
      </div>

      <div
        v-if="viewerPhoto"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Foto bekijken"
        @click.self="closePhoto"
      >
        <button type="button" class="lightbox-close" @click="closePhoto">
          Sluiten
        </button>
        <div class="lightbox-stage">
          <img
            class="lightbox-image"
            :src="viewerPhoto.url"
            :alt="viewerPhoto.originalName"
          />
        </div>
        <div class="lightbox-footer">
          <div
            v-if="viewerPhotos.length > 1"
            class="lightbox-filmstrip"
            role="list"
            aria-label="Andere foto’s"
          >
            <button
              v-for="photo in viewerPhotos"
              :key="photo._id"
              type="button"
              class="lightbox-filmstrip-item"
              :class="{ active: photo._id === viewerPhoto._id }"
              role="listitem"
              :aria-current="photo._id === viewerPhoto._id ? 'true' : undefined"
              :aria-label="photo.originalName || 'Foto'"
              @click="selectViewerPhoto(photo)"
            >
              <img :src="photo.url" alt="" draggable="false" />
            </button>
          </div>
          <div class="lightbox-actions">
            <button
              v-if="canEdit"
              type="button"
              class="lightbox-action lightbox-action-danger"
              :disabled="Boolean(photoBusy)"
              @click="removePhoto(viewerPhoto, $event, viewerStepId)"
            >
              {{
                photoBusy === `delete-${viewerPhoto._id}`
                  ? "Bezig…"
                  : "Verwijderen"
              }}
            </button>
            <button
              v-if="canThumb"
              type="button"
              class="lightbox-thumb"
              :class="{ done: viewerPhoto.thumbedByMe }"
              :disabled="liking || viewerPhoto.thumbedByMe"
              :aria-label="
                viewerPhoto.thumbedByMe
                  ? `Al een duimpje gegeven, nu ${viewerPhoto.thumbsUp || 0}`
                  : `Duimpje geven, nu ${viewerPhoto.thumbsUp || 0}`
              "
              @click="giveThumb(viewerPhoto, $event, viewerStepId)"
            >
              <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                />
              </svg>
              <span>{{ viewerPhoto.thumbsUp || 0 }}</span>
            </button>
            <span v-else class="lightbox-thumb thumb-chip-static">
              <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
                />
              </svg>
              <span>{{ viewerPhoto.thumbsUp || 0 }}</span>
            </span>
          </div>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button
          v-if="project.saleStatus === 'te_koop' && !isDeleted"
          class="btn btn-primary"
          type="button"
          @click="interestOpen = true"
        >
          Interesse doorgeven
        </button>
        <button
          v-if="canManage && isDeleted"
          class="btn btn-primary"
          type="button"
          :disabled="restoring"
          @click="restore"
        >
          {{ restoring ? "Bezig…" : "Terugzetten" }}
        </button>
        <button
          v-if="canManage && isDeleted"
          class="btn btn-danger"
          type="button"
          :disabled="restoring"
          @click="purge"
        >
          Definitief wissen
        </button>
        <button
          v-if="canEdit"
          class="btn btn-primary"
          type="button"
          @click="startEditProject"
        >
          Bewerken
        </button>
        <router-link class="btn btn-secondary" :to="homePath">Terug</router-link>
        <button
          v-if="canEdit"
          class="btn btn-danger"
          type="button"
          @click="remove"
        >
          Verwijderen
        </button>
      </div>

      <SaleInterestDialog
        v-if="project"
        :project="project"
        :open="interestOpen"
        @close="interestOpen = false"
      />
    </template>
  </section>
</template>
