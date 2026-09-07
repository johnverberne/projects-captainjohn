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
  const fab = document.querySelector(".feedback-fab");
  if (fab) fab.style.visibility = "hidden";
  try {
    const html2canvas = (await import("html2canvas")).default;
    const width = Math.round(window.innerWidth);
    const height = Math.round(window.innerHeight);
    const canvas = await html2canvas(document.documentElement, {
      x: window.scrollX,
      y: window.scrollY,
      width,
      height,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: height,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      scale: 1,
      logging: false,
      useCORS: true,
      backgroundColor: "#f3efe6",
      imageTimeout: 1500,
      ignoreElements: (el) => Boolean(el.closest?.(".feedback-fab")),
    });
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    if (fab) fab.style.visibility = "";
  }
}

function writeScreenshotLoadingPage(doc) {
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feedback…</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #f3efe6;
      color: #1a3a3a;
      font-family: Soleil, system-ui, sans-serif;
    }
    .wrap {
      box-sizing: border-box;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.1rem;
      padding: 2rem;
    }
    .spinner {
      width: 42px;
      height: 42px;
      border: 3px solid rgba(26, 58, 58, 0.14);
      border-top-color: #b85c38;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    p {
      margin: 0;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; border-top-color: #1a3a3a; }
    }
  </style>
</head>
<body>
  <div class="wrap" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p>Zichtbaar scherm vastleggen…</p>
  </div>
</body>
</html>`);
  doc.close();
}

async function openFeedback() {
  if (!feedbackUrl.value || busy.value) return;
  error.value = "";
  busy.value = true;

  const formWindow = window.open("about:blank", "_blank");
  if (formWindow?.document) {
    try {
      writeScreenshotLoadingPage(formWindow.document);
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
      :title="busy ? 'Zichtbaar scherm vastleggen…' : 'Geef feedback over deze pagina'"
      @click="openFeedback"
    >
      {{ busy ? "Bezig…" : "Feedback" }}
    </button>
  </div>
</template>
