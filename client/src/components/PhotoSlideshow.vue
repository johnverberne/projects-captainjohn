<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { listProjects } from "../api";
import { displayTitle, publicPhotos, saleStatusLabel } from "../labels";

const emit = defineEmits(["close"]);

const SLIDE_MS = 7000;
const MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right"];

const slides = ref([]);
const index = ref(0);
const loading = ref(true);
const error = ref("");
const playId = ref(0);
let timer = null;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSlides(projects) {
  const items = [];
  for (const project of projects) {
    const title = displayTitle(project);
    const description = (project.saleDescription || "").trim();
    const status = project.saleStatus || "";
    for (const photo of publicPhotos(project)) {
      if (!photo?.url) continue;
      items.push({
        id: `${project._id}-${photo._id}`,
        url: photo.url,
        title,
        description,
        status,
        statusLabel: saleStatusLabel(status),
      });
    }
  }
  return shuffle(items);
}

const current = computed(() => slides.value[index.value] || null);
const motion = computed(
  () => MOTIONS[(index.value + playId.value) % MOTIONS.length]
);

function preload(offset) {
  const slide = slides.value[(index.value + offset) % slides.value.length];
  if (!slide?.url) return;
  const img = new Image();
  img.src = slide.url;
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  if (!slides.value.length) return;
  timer = setInterval(advance, SLIDE_MS);
}

function advance() {
  if (!slides.value.length) return;
  if (slides.value.length === 1) {
    playId.value += 1;
    return;
  }
  index.value = (index.value + 1) % slides.value.length;
  if (index.value === 0) {
    const last = slides.value[slides.value.length - 1];
    slides.value = shuffle(slides.value);
    if (slides.value[0]?.id === last.id && slides.value.length > 1) {
      const swap = slides.value.pop();
      slides.value.unshift(swap);
    }
  }
  playId.value += 1;
  preload(1);
}

function onStageClick() {
  advance();
  startTimer();
}

function close() {
  stopTimer();
  emit("close");
}

function onKey(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    advance();
    startTimer();
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    slides.value = buildSlides(await listProjects());
    index.value = 0;
    playId.value = 0;
    preload(1);
    startTimer();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function lockScroll(locked) {
  document.documentElement.classList.toggle("slideshow-open", locked);
}

watch(index, () => preload(1));

onMounted(() => {
  lockScroll(true);
  window.addEventListener("keydown", onKey);
  load();
});

onUnmounted(() => {
  stopTimer();
  lockScroll(false);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="slideshow"
      role="dialog"
      aria-modal="true"
      aria-label="Fotovoorstelling"
    >
      <button type="button" class="slideshow-close" @click="close">
        Sluiten
      </button>

      <p v-if="loading" class="slideshow-message">Foto’s laden…</p>
      <p v-else-if="error" class="slideshow-message">{{ error }}</p>
      <p v-else-if="!current" class="slideshow-message">
        Nog geen foto’s voor de slideshow.
      </p>

      <div
        v-else
        class="slideshow-stage"
        :key="`${current.id}-${playId}`"
        role="button"
        tabindex="0"
        aria-label="Volgende foto"
        @click="onStageClick"
        @keydown.enter.prevent="onStageClick"
        @keydown.space.prevent="onStageClick"
      >
        <img
          class="slideshow-photo"
          :class="`is-${motion}`"
          :src="current.url"
          :alt="current.title"
        />
        <div class="slideshow-scrim" />
        <div class="slideshow-meta">
          <span
            v-if="current.statusLabel"
            class="slideshow-status badge"
            :class="`sales-badge-${current.status}`"
          >
            {{ current.statusLabel }}
          </span>
          <h2 v-if="current.title" class="slideshow-title">
            {{ current.title }}
          </h2>
          <p v-if="current.description" class="slideshow-description">
            {{ current.description }}
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
