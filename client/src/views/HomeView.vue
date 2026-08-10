<script setup>
import { onMounted, ref } from "vue";
import { listProjects } from "../api";
import { typeLabel, formatDate, formatKwh, formatEuro } from "../labels";

const projects = ref([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    projects.value = await listProjects();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
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
      <p class="lead">Start een nieuw atelierproject vanaf je telefoon.</p>
    </div>

    <router-link class="btn btn-primary btn-block" to="/nieuw">
      Nieuw project starten
    </router-link>

    <p v-if="loading" class="muted">Laden…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="!projects.length" class="empty">
      Nog geen projecten. Tik op “Nieuw project starten”.
    </div>

    <div v-else class="project-list">
      <router-link
        v-for="project in projects"
        :key="project._id"
        class="project-card"
        :to="`/project/${project._id}`"
      >
        <img
          v-if="project.photos?.[0]"
          class="thumb"
          :src="project.photos[0].url"
          :alt="project.title"
        />
        <div v-else class="thumb placeholder">geen foto</div>
        <div>
          <h2 class="meta-title">{{ project.title }}</h2>
          <span class="badge">{{ typeLabel(project.type) }}</span>
          <p class="muted" style="margin: 6px 0 0">
            {{ formatDate(project.createdAt) }}
            · {{ project.photos?.length || 0 }} foto{{
              (project.photos?.length || 0) === 1 ? "" : "'s"
            }}
            <template v-if="project.kwhUsage != null">
              · {{ formatKwh(project.kwhUsage) }}
            </template>
            <template v-if="project.costPrice != null">
              · {{ formatEuro(project.costPrice) }}
            </template>
          </p>
        </div>
      </router-link>
    </div>
  </section>
</template>
