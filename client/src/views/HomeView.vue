<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getFeaturedPhoto,
  listProjects,
  purgeProject,
  restoreProject,
} from "../api";
import {
  typeLabel,
  formatDate,
  formatKwh,
  formatEuro,
  hasSellingPrice,
  labelChipStyle,
  displayPhoto,
  saleStatusLabel,
  isOnSale,
  SALE_STATUSES,
  SALE_STATUS_LABELS,
} from "../labels";

const route = useRoute();

const editMode = computed(() => Boolean(route.meta.editMode));
const projects = ref([]);
const deletedProjects = ref([]);
const featured = ref(null);
const loading = ref(true);
const error = ref("");
const busyId = ref("");

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

function salesStatusLink(status) {
  return `${salesLink.value}?status=${status}`;
}

function photoCount(project) {
  const main = project.photos?.length || 0;
  const steps = (project.steps || [])
    .filter((step) => !step.deletedAt)
    .reduce((sum, step) => sum + (step.photos?.length || 0), 0);
  return main + steps;
}

function projectLink(project) {
  return editMode.value
    ? `/bewerken/project/${project._id}`
    : `/project/${project._id}`;
}

function featuredLink(item) {
  return editMode.value
    ? `/bewerken/project/${item.projectId}`
    : `/project/${item.projectId}`;
}

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
      <p class="lead">
        {{
          editMode
            ? "Bewerk je atelierprojecten vanaf je telefoon."
            : "Bekijk de atelierprojecten van Captain John."
        }}
      </p>

      <router-link
        v-if="featured?.photo?.url"
        class="featured-photo"
        :to="featuredLink(featured)"
      >
        <img
          class="featured-photo-img"
          :src="featured.photo.url"
          :alt="featured.projectTitle"
        />
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
      <div class="home-sales">
        <div class="home-sales-head">
          <h2>Verkoophoekje</h2>
          <router-link class="home-sales-all" :to="salesLink">
            Alles bekijken
          </router-link>
        </div>

        <div class="home-sales-buttons" role="navigation" aria-label="Verkoopstatus">
          <router-link
            v-for="section in saleSections"
            :key="section.status"
            class="home-sales-btn"
            :class="`home-sales-btn-${section.status}`"
            :to="salesStatusLink(section.status)"
          >
            <span class="home-sales-btn-count">{{ section.count }}</span>
            <span class="home-sales-btn-label">{{ section.label }}</span>
          </router-link>
        </div>
      </div>

      <div v-if="!projects.length" class="empty">
        {{
          editMode
            ? "Nog geen projecten. Tik op “Nieuw project starten”."
            : "Nog geen projecten om te bekijken."
        }}
      </div>

      <template v-else>
        <h2 class="home-projects-heading">Alle projecten</h2>
        <div class="project-list">
          <router-link
            v-for="project in projects"
            :key="project._id"
            class="project-card"
            :to="projectLink(project)"
          >
            <img
              v-if="displayPhoto(project)?.url"
              class="thumb"
              :src="displayPhoto(project).url"
              :alt="project.title"
            />
            <div v-else class="thumb placeholder">geen foto</div>
            <div>
              <h2 class="meta-title">{{ project.title }}</h2>
              <span class="badge">{{ typeLabel(project.type) }}</span>
              <span
                v-if="isOnSale(project)"
                class="badge"
                :class="`sales-badge-${project.saleStatus}`"
              >
                {{ saleStatusLabel(project.saleStatus) }}
              </span>
              <span
                v-if="project.steps?.filter((s) => !s.deletedAt).length"
                class="badge badge-soft"
              >
                +{{ project.steps.filter((s) => !s.deletedAt).length }} stap{{
                  project.steps.filter((s) => !s.deletedAt).length === 1
                    ? ""
                    : "pen"
                }}
              </span>
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
              <p class="muted" style="margin: 6px 0 0">
                {{ formatDate(project.createdAt) }}
                · {{ photoCount(project) }} foto{{
                  photoCount(project) === 1 ? "" : "'s"
                }}
                <template v-if="hasSellingPrice(project.sellingPrice)">
                  · {{ formatEuro(project.sellingPrice) }}
                </template>
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
      </template>

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
  </section>
</template>
