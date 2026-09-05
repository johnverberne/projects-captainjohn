<script setup>
import { onMounted, ref } from "vue";
import { getConfig } from "../api";

const feedbackUrl = ref("");
const busy = ref(false);
const error = ref("");

onMounted(async () => {
  try {
    const config = await getConfig();
    feedbackUrl.value = String(config.feedbackUrl || "").replace(/\/$/, "");
  } catch {
    feedbackUrl.value = "";
  }
});

async function captureScreenshot() {
  const { toPng } = await import("html-to-image");
  return toPng(document.body, {
    filter: (node) => !node.classList?.contains("feedback-fab"),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.25),
    backgroundColor: "#f3efe6",
    cacheBust: true,
  });
}

async function openFeedback() {
  if (!feedbackUrl.value || busy.value) return;
  error.value = "";
  busy.value = true;

  const formWindow = window.open("about:blank", "_blank");
  if (formWindow?.document) {
    try {
      formWindow.document.title = "Feedback…";
      formWindow.document.body.innerHTML =
        '<p style="font-family: Soleil, system-ui, sans-serif; padding: 2rem; color: #1a3a3a;">Screenshot maken…</p>';
    } catch {
      /* ignore */
    }
  }

  try {
    let screenshot = "";
    try {
      screenshot = await captureScreenshot();
    } catch (e) {
      console.warn("Screenshot mislukt", e);
    }

    const res = await fetch(`${feedbackUrl.value}/api/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screenshot,
        pageUrl: window.location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Feedback-app antwoordde ${res.status}`);
    }

    const target = `${feedbackUrl.value}/?session=${encodeURIComponent(data.id)}`;
    if (formWindow && !formWindow.closed) {
      formWindow.location = target;
    } else {
      window.location.href = target;
    }
  } catch (e) {
    if (formWindow && !formWindow.closed) formWindow.close();
    error.value = e.message || "Feedback openen mislukt";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="feedbackUrl" class="feedback-fab">
    <p v-if="error" class="feedback-fab-error">{{ error }}</p>
    <button
      type="button"
      class="feedback-fab-btn"
      :disabled="busy"
      :title="busy ? 'Screenshot maken…' : 'Geef feedback over deze pagina'"
      @click="openFeedback"
    >
      {{ busy ? "Bezig…" : "Feedback" }}
    </button>
  </div>
</template>
