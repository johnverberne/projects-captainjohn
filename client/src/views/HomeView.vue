<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getFeaturedPhoto,
  listProjects,
  purgeProject,
  restoreProject,
} from "../api";
import PhotoSlideshow from "../components/PhotoSlideshow.vue";
import SalePhotoBanner from "../components/SalePhotoBanner.vue";
import {
  typeLabel,
  formatDate,
  formatDateShort,
  formatKwh,
  formatEuro,
  hasSellingPrice,
  labelChipStyle,
  displayPhoto,
  displayTitle,
  matchesQuery,
  publicPhotos,
  saleStatusLabel,
  isOnSale,
  SALE_STATUSES,
  SALE_STATUS_LABELS,
  TYPE_LABELS,
} from "../labels";

const route = useRoute();
const router = useRouter();

const editMode = computed(() => Boolean(route.meta.editMode));
const projects = ref([]);
const deletedProjects = ref([]);
const featured = ref(null);
const loading = ref(true);
const error = ref("");
const busyId = ref("");
const showSlideshow = ref(false);
const projectsSection = ref(null);

const statusFilter = ref("all");
const typeFilter = ref("all");
const labelFilter = ref("all");
const search = ref("");

const SALE_ORDER = ["te_koop", "showroom", "verkocht"];

const salesLink = computed(() =>
  editMode.value ? "/bewerken/verkoop" : "/verkoop"
);

const saleSections = computed(() =>
  SALE_ORDER.filter((status) => SALE_STATUSES.includes(status)).map(
    (status) => ({
      status,
      label: SALE_STATUS_LABELS[status],
      count: projects.value.filter((project) => project.saleStatus === status)
        .length,
    })
  )
);

/** Publiek: alleen hoekjestukken. Bewerken: alles wat niet verwijderd is. */
const baseProjects = computed(() =>
  editMode.value ? projects.value : projects.value.filter(isOnSale)
);

const typeOptions = computed(() =>
  Object.keys(TYPE_LABELS)
    .map((type) => ({
      type,
      label: TYPE_LABELS[type],
      count: baseProjects.value.filter((project) => project.type === type)
        .length,
    }))
    .filter((option) => option.count > 0)
);

const labelOptions = computed(() => {
  const found = new Map();
  for (const project of baseProjects.value) {
    for (const label of project.labels || []) {
      if (!label?.name) continue;
      const existing = found.get(label.name);
      if (existing) existing.count += 1;
      else found.set(label.name, { ...label, count: 1 });
    }
  }
  return [...found.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "nl")
  );
});

const listedProjects = computed(() => {
  let list = baseProjects.value;
  if (statusFilter.value !== "all") {
    list = list.filter((project) => project.saleStatus === statusFilter.value);
  }
  if (typeFilter.value !== "all") {
    list = list.filter((project) => project.type === typeFilter.value);
  }
  if (labelFilter.value !== "all") {
    list = list.filter((project) =>
      (project.labels || []).some((label) => label.name === labelFilter.value)
    );
  }
  if (search.value.trim()) {
    list = list.filter((project) =>
      matchesQuery(project, search.value, { includeInternal: editMode.value })
    );
  }
  return list;
});

const hasActiveFilters = computed(
  () =>
    statusFilter.value !== "all" ||
    typeFilter.value !== "all" ||
    labelFilter.value !== "all" ||
    Boolean(search.value.trim())
);

const activeFilterSummary = computed(() =>
  [
    statusFilter.value !== "all" ? saleStatusLabel(statusFilter.value) : "",
    typeFilter.value !== "all" ? typeLabel(typeFilter.value) : "",
    labelFilter.value !== "all" ? labelFilter.value : "",
    search.value.trim() ? `“${search.value.trim()}”` : "",
  ]
    .filter(Boolean)
    .join(" · ")
);

function readFilters(query) {
  const status = String(query.status || "");
  statusFilter.value = SALE_STATUSES.includes(status) ? status : "all";
  const type = String(query.type || "");
  typeFilter.value = TYPE_LABELS[type] ? type : "all";
  labelFilter.value = String(query.label || "") || "all";
  search.value = String(query.q || "");
}

readFilters(route.query);

// Identieke waarden opnieuw zetten triggert geen watcher, dus geen lus met de query.
watch(() => route.query, readFilters);

watch([statusFilter, typeFilter, labelFilter, search], () => {
  const query = {};
  if (statusFilter.value !== "all") query.status = statusFilter.value;
  if (typeFilter.value !== "all") query.type = typeFilter.value;
  if (labelFilter.value !== "all") query.label = labelFilter.value;
  if (search.value.trim()) query.q = search.value.trim();
  router.replace({ query });
});

function toggleStatus(status) {
  statusFilter.value = statusFilter.value === status ? "all" : status;
  scrollToProjects();
}

function resetFilters() {
  statusFilter.value = "all";
  typeFilter.value = "all";
  labelFilter.value = "all";
  search.value = "";
}

function scrollToProjects() {
  projectsSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function photoCount(project) {
  if (!editMode.value) {
    return publicPhotos(project).length;
  }
  const main = project.photos?.length || 0;
  const steps = (project.steps || [])
    .filter((step) => !step.deletedAt)
    .reduce((sum, step) => sum + (step.photos?.length || 0), 0);
  return main + steps;
}

function stepCount(project) {
  return (project.steps || []).filter((step) => !step.deletedAt).length;
}

function projectLink(project) {
  return editMode.value
    ? `/bewerken/project/${project._id}`
    : `/project/${project._id}`;
}

function cardTitle(project) {
  if (editMode.value && !isOnSale(project)) return project.title || "";
  return displayTitle(project);
}

function featuredLink(item) {
  return editMode.value
    ? `/bewerken/project/${item.projectId}`
    : `/project/${item.projectId}`;
}

const featuredSaleStatus = computed(() => {
  const id = featured.value?.projectId;
  if (!id) return featured.value?.saleStatus || "";
  const match = projects.value.find((project) => String(project._id) === String(id));
  return match?.saleStatus || featured.value?.saleStatus || "";
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [list, topPhoto] = await Promise.all([
      listProjects(),
      getFeaturedPhoto(),
    ]);
    projects.value = list;
    featured.value = topPhoto;
    if (editMode.value) {
      deletedProjects.value = await listProjects({ deleted: true });
    } else {
      deletedProjects.value = [];
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function restore(project) {
  if (!confirm(`Project “${project.title}” terugzetten?`)) return;
  busyId.value = `restore-${project._id}`;
  error.value = "";
  try {
    await restoreProject(project._id);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = "";
  }
}

async function purge(project) {
  if (
    !confirm(
      `Project “${project.title}” DEFINITIEF verwijderen? Dit kan niet ongedaan worden gemaakt.`
    )
  ) {
    return;
  }
  busyId.value = `purge-${project._id}`;
  error.value = "";
  try {
    await purgeProject(project._id);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = "";
  }
}

const showTrash = computed(
  () => editMode.value && deletedProjects.value.length > 0
);

onMounted(load);
</script>

<template>
  <section class="panel stack">
    <div class="home-hero">
      <img
        class="home-logo"
        src="/logo-captainjohn.png"
        alt="CaptainJohn — navigeert tussen projecten"
        width="220"
        height="220"
      />
      <p class="home-tagline">Glas · Hout · 3D · Stoffen</p>
      <p class="lead">
        {{
          editMode
            ? "Bewerk je atelierprojecten vanaf je telefoon."
            : "Bekijk de atelierprojecten van Captain John."
        }}
      </p>

      <div class="home-hero-actions">
        <button
          type="button"
          class="btn btn-primary"
          @click="scrollToProjects"
        >
          Bekijk projecten
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showSlideshow = true"
        >
          ▶ Slideshow
        </button>
      </div>
    </div>

    <router-link
      v-if="editMode"
      class="btn btn-primary btn-block"
      to="/bewerken/nieuw"
    >
      Nieuw project starten
    </router-link>

    <p v-if="loading" class="muted">Laden…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <section v-if="featured?.photo?.url" class="home-section">
        <div class="home-section-head">
          <h2>Uitgelicht</h2>
        </div>
        <div class="home-featured">
          <router-link class="featured-photo" :to="featuredLink(featured)">
            <div class="featured-photo-media">
              <img
                class="featured-photo-img"
                :src="featured.photo.url"
                :alt="featured.projectTitle"
              />
              <SalePhotoBanner :status="featuredSaleStatus" />
            </div>
            <div class="featured-photo-caption">
              <strong>{{ featured.projectTitle }}</strong>
              <span class="muted">
                Meest geliked · {{ featured.photo.thumbsUp }} duimpje{{
                  featured.photo.thumbsUp === 1 ? "" : "s"
                }}
              </span>
            </div>
          </router-link>
        </div>
      </section>

      <section class="home-section">
        <div class="home-section-head">
          <h2>Verkoophoekje</h2>
          <router-link class="home-sales-all" :to="salesLink">
            Alles bekijken
          </router-link>
        </div>

        <div class="home-sales-buttons">
          <button
            v-for="section in saleSections"
            :key="section.status"
            type="button"
            class="home-sales-btn"
            :class="`home-sales-btn-${section.status}`"
            :aria-pressed="statusFilter === section.status"
            @click="toggleStatus(section.status)"
          >
            <span class="home-sales-btn-count">{{ section.count }}</span>
            <span class="home-sales-btn-label">{{ section.label }}</span>
          </button>
        </div>
      </section>

      <section ref="projectsSection" class="home-section">
        <div class="home-section-head">
          <h2 class="home-projects-heading">Projecten</h2>
          <span class="muted">
            {{ listedProjects.length }} van {{ baseProjects.length }}
          </span>
        </div>

        <div class="filter-bar">
          <div
            v-if="typeOptions.length > 1"
            class="filter-row"
            role="group"
            aria-label="Filter op materiaal"
          >
            <span class="filter-row-label">Materiaal</span>
            <button
              type="button"
              class="chip"
              :aria-pressed="typeFilter === 'all'"
              @click="typeFilter = 'all'"
            >
              Alles
            </button>
            <button
              v-for="option in typeOptions"
              :key="option.type"
              type="button"
              class="chip"
              :aria-pressed="typeFilter === option.type"
              @click="typeFilter = option.type"
            >
              {{ option.label }}
              <span class="chip-count">{{ option.count }}</span>
            </button>
          </div>

          <div
            v-if="labelOptions.length"
            class="filter-row"
            role="group"
            aria-label="Filter op label"
          >
            <span class="filter-row-label">Label</span>
            <button
              type="button"
              class="chip"
              :aria-pressed="labelFilter === 'all'"
              @click="labelFilter = 'all'"
            >
              Alles
            </button>
            <button
              v-for="option in labelOptions"
              :key="option.name"
              type="button"
              class="chip"
              :aria-pressed="labelFilter === option.name"
              @click="labelFilter = option.name"
            >
              <span
                class="chip-dot"
                :style="{ background: option.color || '#2a5554' }"
              />
              {{ option.name }}
              <span class="chip-count">{{ option.count }}</span>
            </button>
          </div>

          <div class="search-field">
            <span class="search-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21" />
              </svg>
            </span>
            <input
              v-model="search"
              type="search"
              enterkeyhint="search"
              placeholder="Zoek een project…"
              aria-label="Zoek een project"
            />
            <button
              v-if="search"
              type="button"
              class="search-clear"
              aria-label="Zoekterm wissen"
              @click="search = ''"
            >
              ×
            </button>
          </div>

          <p v-if="hasActiveFilters" class="filter-summary muted">
            <span>Filter: {{ activeFilterSummary }}</span>
            <button type="button" class="filter-reset" @click="resetFilters">
              Wis filters
            </button>
          </p>
        </div>

        <div v-if="!listedProjects.length" class="empty">
          <template v-if="hasActiveFilters">
            Geen projecten met deze filters.
          </template>
          <template v-else-if="editMode">
            Nog geen projecten. Tik op “Nieuw project starten”.
          </template>
          <template v-else>Nog geen projecten om te bekijken.</template>
        </div>

        <div v-else class="project-grid">
          <router-link
            v-for="project in listedProjects"
            :key="project._id"
            class="project-tile"
            :to="projectLink(project)"
          >
            <div class="project-tile-media">
              <img
                v-if="displayPhoto(project)?.url"
                :src="displayPhoto(project).url"
                :alt="cardTitle(project)"
                loading="lazy"
              />
              <div v-else class="project-tile-placeholder">geen foto</div>
              <SalePhotoBanner :status="project.saleStatus" aria-hidden="true" />
            </div>
            <div class="project-tile-body">
              <h3 class="project-tile-title">{{ cardTitle(project) }}</h3>
              <div class="project-tile-badges">
                <span class="badge">{{ typeLabel(project.type) }}</span>
                <span
                  v-if="isOnSale(project)"
                  class="badge"
                  :class="`sales-badge-${project.saleStatus}`"
                >
                  {{ saleStatusLabel(project.saleStatus) }}
                </span>
                <span
                  v-if="editMode && stepCount(project)"
                  class="badge badge-soft"
                >
                  +{{ stepCount(project) }} stap{{
                    stepCount(project) === 1 ? "" : "pen"
                  }}
                </span>
              </div>
              <p
                v-if="hasSellingPrice(project.sellingPrice)"
                class="project-tile-price"
              >
                {{ formatEuro(project.sellingPrice) }}
              </p>
              <div v-if="project.labels?.length" class="label-chip-row compact">
                <span
                  v-for="label in project.labels"
                  :key="label.name"
                  class="label-chip"
                  :style="labelChipStyle(label.color)"
                >
                  {{ label.name }}
                </span>
              </div>
              <p class="muted project-tile-meta">
                {{ formatDateShort(project.createdAt) }}
                · {{ photoCount(project) }} foto{{
                  photoCount(project) === 1 ? "" : "'s"
                }}
                <template v-if="editMode && project.kwhUsage != null">
                  · {{ formatKwh(project.kwhUsage) }}
                </template>
                <template v-if="editMode && project.costPrice != null">
                  · {{ formatEuro(project.costPrice) }}
                </template>
              </p>
            </div>
          </router-link>
        </div>
      </section>

      <div v-if="showTrash" class="trash-section">
        <h2 class="trash-heading">Verwijderde projecten</h2>
        <p class="muted">
          Terugzetten of definitief verwijderen. Definitief wissen haalt ook foto’s weg.
        </p>
        <div class="project-list">
          <div
            v-for="project in deletedProjects"
            :key="project._id"
            class="project-card project-card-deleted"
          >
            <router-link class="project-card-main" :to="projectLink(project)">
              <img
                v-if="displayPhoto(project)"
                class="thumb"
                :src="displayPhoto(project).url"
                :alt="project.title"
              />
              <div v-else class="thumb placeholder">geen foto</div>
              <div>
                <h2 class="meta-title">{{ project.title }}</h2>
                <span class="badge badge-deleted">Verwijderd</span>
                <span class="badge">{{ typeLabel(project.type) }}</span>
                <p class="muted" style="margin: 6px 0 0">
                  Verwijderd {{ formatDate(project.deletedAt) }}
                  <template v-if="project.deletedBy">
                    · door {{ project.deletedBy }}
                  </template>
                </p>
              </div>
            </router-link>
            <div class="trash-actions">
              <button
                class="btn btn-secondary"
                type="button"
                :disabled="busyId === `restore-${project._id}`"
                @click="restore(project)"
              >
                {{
                  busyId === `restore-${project._id}` ? "Bezig…" : "Terugzetten"
                }}
              </button>
              <button
                class="btn btn-danger"
                type="button"
                :disabled="busyId === `purge-${project._id}`"
                @click="purge(project)"
              >
                {{
                  busyId === `purge-${project._id}`
                    ? "Bezig…"
                    : "Definitief wissen"
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <PhotoSlideshow v-if="showSlideshow" @close="showSlideshow = false" />
  </section>
</template>
