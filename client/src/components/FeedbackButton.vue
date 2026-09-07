<script setup>
import { onMounted, ref } from "vue";
import { getConfig } from "../api";

const feedbackUrl = ref("");
const busy = ref(false);
const error = ref("");
const askConsent = ref(false);

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

function openConsent() {
  if (!feedbackUrl.value || busy.value) return;
  error.value = "";
  askConsent.value = true;
}

function closeConsent() {
  if (busy.value) return;
  askConsent.value = false;
}

async function openFeedback(includeScreenshot) {
  if (!feedbackUrl.value || busy.value) return;
  error.value = "";
  askConsent.value = false;
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
    if (includeScreenshot) {
      try {
        screenshot = await captureScreenshot();
      } catch (e) {
        console.warn("Screenshot mislukt", e);
      }
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
      :title="busy ? 'Feedback openen…' : 'Geef feedback over deze pagina'"
      @click="openConsent"
    >
      {{ busy ? "Bezig…" : "Feedback" }}
    </button>
  </div>

  <div
    v-if="askConsent"
    class="interest-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="feedback-consent-title"
    @click.self="closeConsent"
  >
    <div class="interest-panel stack">
      <div class="interest-panel-head">
        <h2 id="feedback-consent-title">Schermafbeelding meesturen?</h2>
      </div>
      <p class="lead">
        Mag Captain John een afbeelding van het <strong>zichtbare scherm</strong>
        meesturen bij je feedback? Zo is duidelijker waar het over gaat.
      </p>
      <p class="muted" style="margin: 0">
        Zonder akkoord openen we het formulier zonder screenshot.
      </p>
      <div class="actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy"
          @click="openFeedback(true)"
        >
          Ja, stuur schermafbeelding mee
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="busy"
          @click="openFeedback(false)"
        >
          Nee, alleen het formulier
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="busy"
          @click="closeConsent"
        >
          Annuleren
        </button>
      </div>
    </div>
  </div>
</template>
