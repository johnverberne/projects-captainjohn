<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { health, listProjects } from "./api";
import { useAuth } from "./auth";

const router = useRouter();
const auth = useAuth();
const mongoOk = ref(false);
const exporting = ref(false);
const exportError = ref("");

const homeLink = computed(() =>
  auth.isLoggedIn.value ? "/bewerken" : "/"
);

onMounted(async () => {
  try {
    const h = await health();
    mongoOk.value = h.mongo === "connected";
  } catch {
    mongoOk.value = false;
  }
});

async function onLogout() {
  await auth.logout();
  router.push("/");
}

async function onExport() {
  if (!auth.isLoggedIn.value || exporting.value) return;
  exporting.value = true;
  exportError.value = "";

  // Direct openen vanuit de klik, anders blokkeert de browser de popup na async werk.
  const previewWindow = window.open("about:blank", "_blank");
  if (previewWindow?.document) {
    try {
      previewWindow.document.title = "Captain John — rapport…";
      previewWindow.document.body.innerHTML =
        '<p style="font-family: Georgia, serif; padding: 2rem; color: #1a3a3a;">Rapport wordt gemaakt…</p>';
    } catch {
      /* ignore cross-window write issues */
    }
  }

  try {
    const [{ downloadProjectsReport }, projects, deletedProjects] =
      await Promise.all([
        import("./report/exportPdf"),
        listProjects(),
        listProjects({ deleted: true }),
      ]);
    const result = await downloadProjectsReport({
      projects,
      deletedProjects,
      user: auth.user.value,
      previewWindow,
    });
    if (!result?.opened && previewWindow && !previewWindow.closed) {
      previewWindow.close();
      exportError.value =
        "PDF-reader kon niet worden geopend (popup geblokkeerd?). Het bestand is wel gedownload.";
    }
  } catch (e) {
    if (previewWindow && !previewWindow.closed) previewWindow.close();
    exportError.value = e.message || "Export mislukt";
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="brand-bar">
      <router-link :to="homeLink" class="brand">
        Captain John
        <span>atelier projecten</span>
      </router-link>
      <div class="brand-actions">
        <span
          class="status-dot"
          :class="{ ok: mongoOk }"
          :title="mongoOk ? 'MongoDB verbonden' : 'MongoDB niet verbonden'"
        />
        <template v-if="auth.isLoggedIn.value">
          <span class="user-chip" :title="auth.user.value?.email">
            {{ auth.user.value?.name || auth.user.value?.email }}
          </span>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            :disabled="exporting"
            title="Download PDF-rapport van alle projecten"
            @click="onExport"
          >
            {{ exporting ? "Bezig…" : "Export" }}
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="onLogout">
            Uitloggen
          </button>
        </template>
        <router-link
          v-else
          class="btn btn-secondary btn-small"
          to="/inloggen"
        >
          Inloggen
        </router-link>
      </div>
    </header>
    <p v-if="exportError" class="export-error">{{ exportError }}</p>
    <router-view />
  </div>
</template>
