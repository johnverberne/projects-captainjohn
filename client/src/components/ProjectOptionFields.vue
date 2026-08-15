<script setup>
import { computed } from "vue";
import {
  TYPE_LABELS,
  TECHNIQUE_LABELS,
  SPEED_LABELS,
  SALE_STATUS_LABELS,
  SALE_STATUSES,
} from "../labels";
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
const sellingPrice = defineModel("sellingPrice", { default: "" });
const saleStatus = defineModel("saleStatus", { type: String, default: "" });
const saleDescription = defineModel("saleDescription", {
  type: String,
  default: "",
});
const labels = defineModel("labels", { type: Array, default: () => [] });

const props = defineProps({
  meta: { type: Object, required: true },
  idPrefix: { type: String, default: "field" },
  showTitle: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: false },
  showSellingPrice: { type: Boolean, default: false },
  showSaleFields: { type: Boolean, default: false },
  titleLabel: { type: String, default: "Titel" },
  titlePlaceholder: { type: String, default: "Bijv. Blauw schaaltje" },
  typeLabelText: { type: String, default: "Soort project" },
});

const isGlasfusion = computed(() => type.value === "glasfusion");
const saleStatusOptions = computed(() => {
  const fromMeta = props.meta?.saleStatuses;
  return Array.isArray(fromMeta) && fromMeta.length ? fromMeta : SALE_STATUSES;
});

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

    <div v-if="showSellingPrice" class="field">
      <label :for="`${idPrefix}-sell`">Verkoopprijs (€)</label>
      <input
        :id="`${idPrefix}-sell`"
        v-model="sellingPrice"
        type="number"
        inputmode="decimal"
        min="0"
        step="0.01"
        placeholder="Bijv. 89.00"
      />
    </div>

    <template v-if="showSaleFields">
      <div class="field">
        <label>Verkoophoekje</label>
        <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
          De hoofdfoto is de verkoopfoto. Kies een status om het stuk te tonen.
        </p>
        <div class="choice-grid">
          <button
            type="button"
            class="choice"
            :class="{ active: !saleStatus }"
            @click="saleStatus = ''"
          >
            Niet in hoekje
          </button>
          <button
            v-for="value in saleStatusOptions"
            :key="value"
            type="button"
            class="choice"
            :class="{ active: saleStatus === value }"
            @click="saleStatus = value"
          >
            {{ SALE_STATUS_LABELS[value] || value }}
          </button>
        </div>
      </div>

      <div class="field">
        <label :for="`${idPrefix}-sale-desc`">Verkoopomschrijving</label>
        <textarea
          :id="`${idPrefix}-sale-desc`"
          v-model="saleDescription"
          placeholder="Korte tekst voor het verkoophoekje…"
        />
      </div>
    </template>

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
