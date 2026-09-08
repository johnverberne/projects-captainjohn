<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { listProjects } from "../api";
import SaleInterestDialog from "../components/SaleInterestDialog.vue";
import SalePhotoBanner from "../components/SalePhotoBanner.vue";
import {
  displayPhoto,
  displayTitle,
  formatEuro,
  hasSellingPrice,
  isOnSale,
  saleStatusLabel,
  SALE_STATUSES,
  SALE_STATUS_LABELS,
} from "../labels";

const route = useRoute();
const editMode = computed(() => Boolean(route.meta.editMode));

const projects = ref([]);
const loading = ref(true);
const error = ref("");
const interestProject = ref(null);

function statusFromQuery(value) {
  const status = String(value || "").trim();
  return SALE_STATUSES.includes(status) ? status : "all";
}

const filter = ref(statusFromQuery(route.query.status));

watch(
  () => route.query.status,
  (value) => {
    filter.value = statusFromQuery(value);
  }
);

const SALE_ORDER = { te_koop: 0, showroom: 1, verkocht: 2 };

const saleProjects = computed(() => {
  const list = projects.value.filter(isOnSale);
  list.sort((a, b) => {
    const rank =
      (SALE_ORDER[a.saleStatus] ?? 9) - (SALE_ORDER[b.saleStatus] ?? 9);
    if (rank !== 0) return rank;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
  return list;
});

const filteredProjects = computed(() => {
  if (filter.value === "all") return saleProjects.value;
  return saleProjects.value.filter((p) => p.saleStatus === filter.value);
});

const counts = computed(() => {
  const result = { all: saleProjects.value.length };
  for (const status of SALE_STATUSES) {
    result[status] = saleProjects.value.filter(
      (p) => p.saleStatus === status
    ).length;
  }
  return result;
});

function projectLink(project) {
  return editMode.value
    ? `/bewerken/project/${project._id}`
    : `/project/${project._id}`;
}

function openInterest(project, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  interestProject.value = project;
}

function closeInterest() {
  interestProject.value = null;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    projects.value = await listProjects();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="panel stack">
    <div class="sales-hero">
      <h1>Verkoophoekje</h1>
      <p class="lead">
        Showroomstukken, te koop en recent verkocht. De hoofdfoto is de
        verkoopfoto.
      </p>
    </div>

    <div class="filter-row sales-filters" role="group" aria-label="Filter op verkoopstatus">
      <button
        type="button"
        class="chip"
        :aria-pressed="filter === 'all'"
        @click="filter = 'all'"
      >
        Alles
        <span class="chip-count">{{ counts.all }}</span>
      </button>
      <button
        v-for="status in SALE_STATUSES"
        :key="status"
        type="button"
        class="chip"
        :aria-pressed="filter === status"
        @click="filter = status"
      >
        {{ SALE_STATUS_LABELS[status] }}
        <span class="chip-count">{{ counts[status] }}</span>
      </button>
    </div>

    <p v-if="loading" class="muted">Laden…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <div v-if="!filteredProjects.length" class="empty">
        {{
          saleProjects.length
            ? "Geen stukken in deze categorie."
            : "Nog geen stukken in het verkoophoekje."
        }}
      </div>

      <div v-else class="sales-grid">
        <article
          v-for="project in filteredProjects"
          :key="project._id"
          class="sales-card"
        >
          <router-link class="sales-card-link" :to="projectLink(project)">
            <div class="sales-card-media">
              <img
                v-if="displayPhoto(project)?.url"
                :src="displayPhoto(project).url"
                :alt="displayTitle(project)"
              />
              <div v-else class="sales-card-placeholder">geen foto</div>
              <SalePhotoBanner :status="project.saleStatus" />
              <span
                v-if="project.saleStatus === 'showroom'"
                class="badge sales-badge"
                :class="`sales-badge-${project.saleStatus}`"
              >
                {{ saleStatusLabel(project.saleStatus) }}
              </span>
            </div>
            <div class="sales-card-body">
              <h2 class="meta-title">{{ displayTitle(project) }}</h2>
              <p
                v-if="project.saleDescription?.trim()"
                class="sales-description"
              >
                {{ project.saleDescription.trim() }}
              </p>
              <p
                v-if="hasSellingPrice(project.sellingPrice)"
                class="sales-price"
              >
                {{ formatEuro(project.sellingPrice) }}
              </p>
            </div>
          </router-link>
          <div v-if="project.saleStatus === 'te_koop'" class="sales-card-actions">
            <button
              type="button"
              class="btn btn-primary btn-block"
              @click="openInterest(project)"
            >
              Interesse doorgeven
            </button>
          </div>
        </article>
      </div>
    </template>

    <SaleInterestDialog
      v-if="interestProject"
      :project="interestProject"
      :open="Boolean(interestProject)"
      @close="closeInterest"
    />
  </section>
</template>
