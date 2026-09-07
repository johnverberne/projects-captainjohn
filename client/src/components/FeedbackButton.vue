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

function isNearViewport(node) {
  if (!(node instanceof Element)) return true;
  if (node.tagName !== "IMG" && node.tagName !== "VIDEO" && node.tagName !== "CANVAS") {
    return true;
  }
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const margin = 80;
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

function jpegFromCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function captureTabPixels() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Geen schermkopie-API");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: "browser",
      frameRate: 1,
      width: { max: 1920 },
      height: { max: 1080 },
    },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    systemAudio: "exclude",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  });
  try {
    const [track] = stream.getVideoTracks();
    if (!track) throw new Error("Geen videobeeld");

    if (typeof ImageCapture === "function") {
      try {
        const bitmap = await new ImageCapture(track).grabFrame();
        const dataUrl = jpegFromCanvas(bitmap, bitmap.width, bitmap.height);
        bitmap.close?.();
        return dataUrl;
      } catch {
        /* fallback naar video-element */
      }
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    if ("requestVideoFrameCallback" in video) {
      await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
    } else {
      await new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.onloadeddata = () => resolve();
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return jpegFromCanvas(
      video,
      video.videoWidth || window.innerWidth,
      video.videoHeight || window.innerHeight
    );
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

async function captureDomFallback() {
  const { toJpeg } = await import("html-to-image");
  const width = Math.round(window.innerWidth);
  const height = Math.round(window.innerHeight);
  return toJpeg(document.documentElement, {
    filter: (node) =>
      !node.classList?.contains("feedback-fab") && isNearViewport(node),
    width,
    height,
    pixelRatio: 1,
    quality: 0.72,
    backgroundColor: "#f3efe6",
    cacheBust: false,
    skipFonts: true,
    style: {
      transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
      overflow: "hidden",
    },
  });
}

async function captureScreenshot() {
  const fab = document.querySelector(".feedback-fab");
  if (fab) fab.style.visibility = "hidden";
  try {
    return await captureTabPixels();
  } catch (e) {
    if (e?.name === "NotAllowedError") {
      console.warn("Schermdelen geweigerd, DOM-fallback");
    } else {
      console.warn("Schermkopie mislukt, DOM-fallback", e);
    }
    return captureDomFallback();
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
    <p>Dit tabblad delen voor een schermkopie…</p>
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
      :title="busy ? 'Schermkopie maken…' : 'Geef feedback over deze pagina'"
      @click="openFeedback"
    >
      {{ busy ? "Bezig…" : "Feedback" }}
    </button>
  </div>
</template>
