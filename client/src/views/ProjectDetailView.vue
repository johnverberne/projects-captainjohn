<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { addPhotos, deleteProject, getProject, thumbPhoto } from "../api";
import {
  typeLabel,
  TECHNIQUE_LABELS,
  SPEED_LABELS,
  formatDate,
} from "../labels";

const route = useRoute();
const router = useRouter();

const project = ref(null);
const loading = ref(true);
const error = ref("");
const uploading = ref(false);
const liking = ref(false);
const viewerPhoto = ref(null);

function openPhoto(photo) {
  viewerPhoto.value = photo;
}

function closePhoto() {
  viewerPhoto.value = null;
}

function syncViewerPhoto() {
  if (!viewerPhoto.value || !project.value) return;
  viewerPhoto.value =
    project.value.photos.find((p) => p._id === viewerPhoto.value._id) || null;
}

async function giveThumb(photo, event) {
  event?.stopPropagation();
  if (!photo?._id || liking.value) return;
  liking.value = true;
  error.value = "";
  try {
    project.value = await thumbPhoto(route.params.id, photo._id);
    syncViewerPhoto();
  } catch (e) {
    error.value = e.message;
  } finally {
    liking.value = false;
  }
}

function onKeydown(event) {
  if (event.key === "Escape") closePhoto();
}

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});

const subtitle = computed(() => {
  if (!project.value) return "";
  if (project.value.type !== "glasfusion") return typeLabel(project.value.type);
  const tech = TECHNIQUE_LABELS[project.value.glasfusionTechnique] || "";
  const speed = SPEED_LABELS[project.value.glasfusionSpeed] || "";
  return `${typeLabel(project.value.type)} · ${tech} · ${speed}`;
});

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

onMounted(() => {
  load();
  window.addEventListener("keydown", onKeydown);
});

async function onMorePhotos(event) {
  const selected = Array.from(event.target.files || []);
  event.target.value = "";
  if (!selected.length) return;

  uploading.value = true;
  error.value = "";
  try {
    const form = new FormData();
    for (const file of selected) form.append("photos", file);
    project.value = await addPhotos(route.params.id, form);
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}

async function remove() {
  if (!confirm("Dit project verwijderen?")) return;
  try {
    await deleteProject(route.params.id);
    router.replace("/");
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <section class="panel stack">
    <p v-if="loading" class="muted">Laden…</p>
    <p v-else-if="error && !project" class="error">{{ error }}</p>

    <template v-else-if="project">
      <div>
        <span class="badge">{{ typeLabel(project.type) }}</span>
        <h1 style="margin-top: 10px">{{ project.title }}</h1>
        <p class="lead">{{ subtitle }}</p>
        <p class="muted">Gestart {{ formatDate(project.createdAt) }}</p>
      </div>

      <div v-if="project.notes">
        <h2>Notities</h2>
        <p class="muted" style="white-space: pre-wrap">{{ project.notes }}</p>
      </div>

      <div>
        <h2>Foto’s ({{ project.photos?.length || 0 }})</h2>
        <div v-if="project.photos?.length" class="photo-grid" style="margin-top: 10px">
          <div
            v-for="photo in project.photos"
            :key="photo._id"
            class="photo-tile"
          >
            <button
              type="button"
              class="photo-thumb"
              @click="openPhoto(photo)"
            >
              <img :src="photo.url" :alt="photo.originalName" />
            </button>
            <button
              type="button"
              class="thumb-chip"
              :disabled="liking"
              :aria-label="`Duimpje geven, nu ${photo.thumbsUp || 0}`"
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
          </div>
        </div>
        <p v-else class="muted" style="margin-top: 8px">Nog geen foto’s.</p>
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
        <img
          class="lightbox-image"
          :src="viewerPhoto.url"
          :alt="viewerPhoto.originalName"
        />
        <button
          type="button"
          class="lightbox-thumb"
          :disabled="liking"
          :aria-label="`Duimpje geven, nu ${viewerPhoto.thumbsUp || 0}`"
          @click="giveThumb(viewerPhoto, $event)"
        >
          <svg class="thumb-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M2 10.5h3.5V21H2zm19.1 1.2-1.8 7.2A2.5 2.5 0 0 1 16.9 21H8.5v-9.7l2.4-4.8A2.2 2.2 0 0 1 12.9 5h.4a1.7 1.7 0 0 1 1.7 2v3.5H19a2.1 2.1 0 0 1 2.1 2.2Z"
            />
          </svg>
          <span>{{ viewerPhoto.thumbsUp || 0 }}</span>
        </button>
      </div>

      <div class="file-drop">
        <strong>{{ uploading ? "Uploaden…" : "Meer foto’s toevoegen" }}</strong>
        <span class="muted">Meerdere tegelijk mogelijk</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          :disabled="uploading"
          @change="onMorePhotos"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <router-link class="btn btn-secondary" to="/">Terug</router-link>
        <button class="btn btn-danger" type="button" @click="remove">
          Verwijderen
        </button>
      </div>
    </template>
  </section>
</template>
