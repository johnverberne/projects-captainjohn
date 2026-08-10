<script setup>
import { onMounted, ref } from "vue";
import { health } from "./api";

const mongoOk = ref(false);

onMounted(async () => {
  try {
    const h = await health();
    mongoOk.value = h.mongo === "connected";
  } catch {
    mongoOk.value = false;
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="brand-bar">
      <router-link to="/" class="brand">
        Captain John
        <span>atelier projecten</span>
      </router-link>
      <span
        class="status-dot"
        :class="{ ok: mongoOk }"
        :title="mongoOk ? 'MongoDB verbonden' : 'MongoDB niet verbonden'"
      />
    </header>
    <router-view />
  </div>
</template>
