<script setup>
import { computed } from "vue";
import { TYPE_LABELS, TECHNIQUE_LABELS, SPEED_LABELS } from "../labels";
import LabelPicker from "./LabelPicker.vue";

const title = defineModel("title", { type: String, default: "" });
const type = defineModel("type", { type: String, default: "" });
const glasfusionTechnique = defineModel("glasfusionTechnique", {
  type: String,
  default: "",
});
const glasfusionSpeed = defineModel("glasfusionSpeed", {
  type: String,
  default: "",
});
const notes = defineModel("notes", { type: String, default: "" });
const kwhUsage = defineModel("kwhUsage", { default: "" });
const costPrice = defineModel("costPrice", { default: "" });
const labels = defineModel("labels", { type: Array, default: () => [] });

defineProps({
  meta: { type: Object, required: true },
  idPrefix: { type: String, default: "field" },
  showTitle: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: false },
  titleLabel: { type: String, default: "Titel" },
  titlePlaceholder: { type: String, default: "Bijv. Blauw schaaltje" },
  typeLabelText: { type: String, default: "Soort project" },
});

const isGlasfusion = computed(() => type.value === "glasfusion");

function selectType(value) {
  type.value = value;
  if (value !== "glasfusion") {
    glasfusionTechnique.value = "";
    glasfusionSpeed.value = "";
  }
}
</script>

<template>
  <div class="stack">
    <div v-if="showTitle" class="field">
      <label :for="`${idPrefix}-title`">{{ titleLabel }}</label>
      <input
        :id="`${idPrefix}-title`"
        v-model="title"
        type="text"
        :placeholder="titlePlaceholder"
        autocomplete="off"
      />
    </div>

    <div class="field">
      <label>{{ typeLabelText }}</label>
      <div class="choice-grid">
        <button
          v-for="value in meta.types"
          :key="value"
          type="button"
          class="choice"
          :class="{ active: type === value }"
          @click="selectType(value)"
        >
          {{ TYPE_LABELS[value] || value }}
        </button>
      </div>
    </div>

    <template v-if="isGlasfusion">
      <div class="field">
        <label>Techniek</label>
        <div class="choice-grid">
          <button
            v-for="value in meta.glasfusionTechniques"
            :key="value"
            type="button"
            class="choice"
            :class="{ active: glasfusionTechnique === value }"
            @click="glasfusionTechnique = value"
          >
            {{ TECHNIQUE_LABELS[value] || value }}
          </button>
        </div>
      </div>

      <div class="field">
        <label>Type (snelheid)</label>
        <div class="choice-grid">
          <button
            v-for="value in meta.glasfusionSpeeds"
            :key="value"
            type="button"
            class="choice"
            :class="{ active: glasfusionSpeed === value }"
            @click="glasfusionSpeed = value"
          >
            {{ SPEED_LABELS[value] || value }}
          </button>
        </div>
      </div>
    </template>

    <div class="field-row">
      <div class="field">
        <label :for="`${idPrefix}-kwh`">Kilowattverbruik (kWh)</label>
        <input
          :id="`${idPrefix}-kwh`"
          v-model="kwhUsage"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 12.5"
        />
      </div>
      <div class="field">
        <label :for="`${idPrefix}-cost`">Kostprijs (€)</label>
        <input
          :id="`${idPrefix}-cost`"
          v-model="costPrice"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 45.00"
        />
      </div>
    </div>

    <LabelPicker
      v-if="showLabels"
      v-model="labels"
      :catalog="meta.labels || []"
    />

    <div class="field">
      <label :for="`${idPrefix}-notes`">Notities (optioneel)</label>
      <textarea
        :id="`${idPrefix}-notes`"
        v-model="notes"
        placeholder="Afmetingen, kleuren, klant…"
      />
    </div>
  </div>
</template>
