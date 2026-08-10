<script setup>
import { nextTick, ref } from "vue";

defineProps({
  title: { type: String, default: "Foto’s toevoegen" },
  disabled: { type: Boolean, default: false },
  busyLabel: { type: String, default: "Uploaden…" },
});

const emit = defineEmits(["change"]);

const galleryInput = ref(null);
const cameraInput = ref(null);

async function openInput(inputRef) {
  await nextTick();
  inputRef.value?.click();
}

function pickGallery() {
  openInput(galleryInput);
}

function pickCamera() {
  openInput(cameraInput);
}

function onChange(event) {
  emit("change", event);
}
</script>

<template>
  <div class="photo-upload-picker" :class="{ disabled }">
    <p class="photo-upload-title">{{ disabled ? busyLabel : title }}</p>
    <p class="muted photo-upload-hint">Kies eerst de bron</p>
    <div class="photo-source-grid">
      <button
        type="button"
        class="photo-source"
        :disabled="disabled"
        @click="pickGallery"
      >
        <strong>Lokale foto</strong>
        <span>Uit galerij of bestanden</span>
      </button>
      <button
        type="button"
        class="photo-source"
        :disabled="disabled"
        @click="pickCamera"
      >
        <strong>Foto nemen</strong>
        <span>Camera gebruiken</span>
      </button>
    </div>
    <input
      ref="galleryInput"
      class="photo-upload-input"
      type="file"
      accept="image/*"
      multiple
      :disabled="disabled"
      @change="onChange"
    />
    <input
      ref="cameraInput"
      class="photo-upload-input"
      type="file"
      accept="image/*"
      capture="environment"
      :disabled="disabled"
      @change="onChange"
    />
  </div>
</template>
