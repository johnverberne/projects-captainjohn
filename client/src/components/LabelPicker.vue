<script setup>
import { computed, ref } from "vue";

const selected = defineModel({ type: Array, default: () => [] });

const props = defineProps({
  catalog: { type: Array, default: () => [] },
});

const LABEL_COLORS = [
  "#b85c38",
  "#1a3a3a",
  "#2f6b4f",
  "#3d5a80",
  "#8b3a4a",
  "#6b4f3a",
  "#c4a35a",
  "#4a6670",
];

const newName = ref("");
const newColor = ref(LABEL_COLORS[0]);
const localError = ref("");

const catalogOptions = computed(() => {
  const map = new Map();
  for (const item of props.catalog || []) {
    const key = String(item.name || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    map.set(key, { name: item.name, color: item.color });
  }
  for (const item of selected.value || []) {
    const key = String(item.name || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    map.set(key, { name: item.name, color: item.color });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
  );
});

function keyOf(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function isSelected(name) {
  const key = keyOf(name);
  return (selected.value || []).some((item) => keyOf(item.name) === key);
}

function contrastInk(color) {
  const hex = String(color || "").replace("#", "");
  if (hex.length !== 6) return "#fffdf8";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1c2422" : "#fffdf8";
}

function chipStyle(color) {
  return {
    background: color,
    color: contrastInk(color),
    borderColor: "transparent",
  };
}

function toggleCatalogLabel(item) {
  localError.value = "";
  const key = keyOf(item.name);
  if (isSelected(item.name)) {
    selected.value = (selected.value || []).filter(
      (entry) => keyOf(entry.name) !== key
    );
    return;
  }
  selected.value = [
    ...(selected.value || []),
    { name: item.name, color: item.color || LABEL_COLORS[0] },
  ];
}

function setSelectedColor(name, color) {
  const key = keyOf(name);
  selected.value = (selected.value || []).map((item) =>
    keyOf(item.name) === key ? { ...item, color } : item
  );
}

function removeSelected(name) {
  const key = keyOf(name);
  selected.value = (selected.value || []).filter(
    (item) => keyOf(item.name) !== key
  );
}

function addNewLabel() {
  localError.value = "";
  const name = newName.value.trim().replace(/\s+/g, " ");
  if (!name) {
    localError.value = "Vul een labelnaam in.";
    return;
  }
  if (name.length > 40) {
    localError.value = "Maximaal 40 tekens.";
    return;
  }
  if (isSelected(name)) {
    localError.value = "Dit label staat al bij het project.";
    return;
  }
  selected.value = [
    ...(selected.value || []),
    { name, color: newColor.value || LABEL_COLORS[0] },
  ];
  newName.value = "";
}
</script>

<template>
  <div class="field label-picker">
    <label>Labels</label>
    <p class="muted" style="margin: 0 0 8px">
      Kies bestaande labels of voeg een nieuw label toe. Kies zelf de kleur.
    </p>

    <div v-if="catalogOptions.length" class="label-choice-grid">
      <button
        v-for="item in catalogOptions"
        :key="keyOf(item.name)"
        type="button"
        class="label-choice"
        :class="{ active: isSelected(item.name) }"
        :style="isSelected(item.name) ? chipStyle(item.color) : undefined"
        @click="toggleCatalogLabel(item)"
      >
        <span class="label-dot" :style="{ background: item.color }" />
        {{ item.name }}
      </button>
    </div>
    <p v-else class="muted" style="margin: 0 0 10px">
      Nog geen labels in gebruik. Voeg hieronder de eerste toe.
    </p>

    <div v-if="selected.length" class="selected-labels">
      <div
        v-for="item in selected"
        :key="keyOf(item.name)"
        class="selected-label-row"
      >
        <span class="label-chip" :style="chipStyle(item.color)">
          {{ item.name }}
        </span>
        <div class="color-swatches" role="group" :aria-label="`Kleur voor ${item.name}`">
          <button
            v-for="color in LABEL_COLORS"
            :key="`${keyOf(item.name)}-${color}`"
            type="button"
            class="color-swatch"
            :class="{ active: item.color?.toLowerCase() === color }"
            :style="{ background: color }"
            :title="color"
            @click="setSelectedColor(item.name, color)"
          />
          <label class="color-custom" :title="'Eigen kleur'">
            <input
              type="color"
              :value="item.color || LABEL_COLORS[0]"
              @input="setSelectedColor(item.name, $event.target.value)"
            />
          </label>
        </div>
        <button
          type="button"
          class="btn btn-danger btn-small"
          @click="removeSelected(item.name)"
        >
          Weg
        </button>
      </div>
    </div>

    <div class="new-label-row">
      <input
        v-model="newName"
        type="text"
        maxlength="40"
        placeholder="Nieuw label, bijv. Cadeau"
        autocomplete="off"
        @keydown.enter.prevent="addNewLabel"
      />
      <div class="color-swatches compact">
        <button
          v-for="color in LABEL_COLORS"
          :key="`new-${color}`"
          type="button"
          class="color-swatch"
          :class="{ active: newColor === color }"
          :style="{ background: color }"
          @click="newColor = color"
        />
        <label class="color-custom" title="Eigen kleur">
          <input v-model="newColor" type="color" />
        </label>
      </div>
      <button class="btn btn-secondary" type="button" @click="addNewLabel">
        Toevoegen
      </button>
    </div>
    <p v-if="localError" class="error" style="margin: 8px 0 0">{{ localError }}</p>
  </div>
</template>
