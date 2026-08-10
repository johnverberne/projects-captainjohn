<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { health } from "./api";
import { useAuth } from "./auth";

const router = useRouter();
const auth = useAuth();
const mongoOk = ref(false);

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
    <router-view />
  </div>
</template>
