<script setup>
import { computed } from "vue";
import {
  TYPE_LABELS,
  TECHNIQUE_LABELS,
  SPEED_LABELS,
  SALE_STATUS_LABELS,
  SALE_STATUSES,
  OVEN_LABELS,
  OVEN_CODES,
} from "../labels";
import LabelPicker from "./LabelPicker.vue";
import FiringScheduleEditor from "./FiringScheduleEditor.vue";

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
const oven = defineModel("oven", { type: String, default: "" });
const firingSchemaId = defineModel("firingSchemaId", { default: "" });
const firingSchedule = defineModel("firingSchedule", {
  type: Array,
  default: () => [],
});
const notes = defineModel("notes", { type: String, default: "" });
const kwhUsage = defineModel("kwhUsage", { default: "" });
const costPrice = defineModel("costPrice", { default: "" });
const sellingPrice = defineModel("sellingPrice", { default: "" });
const saleStatus = defineModel("saleStatus", { type: String, default: "" });
const saleTitle = defineModel("saleTitle", { type: String, default: "" });
const saleDescription = defineModel("saleDescription", {
  type: String,
  default: "",
});
const labels = defineModel("labels", { type: Array, default: () => [] });

const props = defineProps({
  meta: { type: Object, required: true },
  idPrefix: { type: String, default: "field" },
  showTitle: { type: Boolean, default: true },
  showNotes: { type: Boolean, default: true },
  notesAfterTitle: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: false },
  showSellingPrice: { type: Boolean, default: false },
  showSaleFields: { type: Boolean, default: false },
  showFiringSchema: { type: Boolean, default: false },
  titleLabel: { type: String, default: "Project titel" },
  titlePlaceholder: { type: String, default: "Bijv. Blauw schaaltje" },
  notesLabel: { type: String, default: "Project notitie" },
  notesPlaceholder: { type: String, default: "Afmetingen, kleuren, klant…" },
  typeLabelText: { type: String, default: "Soort project" },
});

const isGlasfusion = computed(() => type.value === "glasfusion");
const showCustomSchedule = computed(
  () => isGlasfusion.value && glasfusionTechnique.value === "custom"
);
const usesOven = computed(() => type.value === "glasfusion" || type.value === "keramiek");
const saleStatusOptions = computed(() => {
  const fromMeta = props.meta?.saleStatuses;
  return Array.isArray(fromMeta) && fromMeta.length ? fromMeta : SALE_STATUSES;
});
const ovenOptions = computed(() => {
  const fromMeta = props.meta?.ovens;
  return Array.isArray(fromMeta) && fromMeta.length ? fromMeta : OVEN_CODES;
});
const hasHoekje = computed(() => Boolean(saleStatus.value));

function fieldId(name) {
  return props.idPrefix ? `${props.idPrefix}-${name}` : name;
}

function selectType(value) {
  type.value = value;
  if (value !== "glasfusion") {
    glasfusionTechnique.value = "";
    glasfusionSpeed.value = "";
    firingSchemaId.value = "";
    firingSchedule.value = [];
  }
  if (value !== "glasfusion" && value !== "keramiek") {
    oven.value = "";
  }
}

function selectTechnique(value) {
  glasfusionTechnique.value = value;
  if (value === "custom") {
    glasfusionSpeed.value = "";
  } else {
    firingSchemaId.value = "";
    firingSchedule.value = [];
  }
}
</script>

<template>
  <div class="stack">
    <div v-if="showTitle" class="field">
      <label :for="fieldId('title')">{{ titleLabel }}</label>
      <input
        :id="fieldId('title')"
        v-model="title"
        type="text"
        :placeholder="titlePlaceholder"
        autocomplete="off"
      />
    </div>

    <div v-if="showNotes && notesAfterTitle" class="field">
      <label :for="fieldId('notes')">{{ notesLabel }}</label>
      <textarea
        :id="fieldId('notes')"
        v-model="notes"
        :placeholder="notesPlaceholder"
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
            @click="selectTechnique(value)"
          >
            {{ TECHNIQUE_LABELS[value] || value }}
          </button>
        </div>
      </div>

      <div v-if="!showCustomSchedule" class="field">
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

    <div v-if="usesOven" class="field">
      <label>Oven</label>
      <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
        De code wordt opgeslagen; de tekst kun je later aanpassen.
      </p>
      <div class="choice-grid">
        <button
          type="button"
          class="choice"
          :class="{ active: !oven }"
          @click="oven = ''"
        >
          Geen oven
        </button>
        <button
          v-for="value in ovenOptions"
          :key="value"
          type="button"
          class="choice"
          :class="{ active: oven === value }"
          @click="oven = value"
        >
          {{ OVEN_LABELS[value] || value }}
        </button>
      </div>
    </div>

    <div v-if="showFiringSchema && showCustomSchedule" class="field">
      <label>Stookschema</label>
      <FiringScheduleEditor
        v-model:schedule="firingSchedule"
        v-model:schema-id="firingSchemaId"
        :technique="glasfusionTechnique"
        :oven="oven"
      />
    </div>

    <div class="field-row">
      <div class="field">
        <label :for="fieldId('kwh')">Kilowattverbruik (kWh)</label>
        <input
          :id="fieldId('kwh')"
          v-model="kwhUsage"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 12.5"
        />
      </div>
      <div class="field">
        <label :for="fieldId('cost')">Kostprijs (€)</label>
        <input
          :id="fieldId('cost')"
          v-model="costPrice"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 45.00"
        />
      </div>
    </div>

    <template v-if="showSaleFields">
      <div class="field">
        <label>Verkoophoekje</label>
        <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
          Kies een hoekje om verkooptitel en -tekst te tonen. De hoofdfoto is de verkoopfoto.
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

      <div v-if="showSellingPrice" class="field">
        <label :for="fieldId('sell')">Verkoopprijs (€)</label>
        <input
          :id="fieldId('sell')"
          v-model="sellingPrice"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 89.00"
        />
      </div>

      <template v-if="hasHoekje">
        <div class="field">
          <label :for="fieldId('sale-title')">Verkooptitel</label>
          <input
            :id="fieldId('sale-title')"
            v-model="saleTitle"
            type="text"
            placeholder="Titel in het verkoophoekje…"
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label :for="fieldId('sale-desc')">Verkooptekst</label>
          <textarea
            :id="fieldId('sale-desc')"
            v-model="saleDescription"
            placeholder="Korte tekst voor het verkoophoekje…"
          />
        </div>
      </template>
    </template>

    <LabelPicker
      v-if="showLabels"
      v-model="labels"
      :catalog="meta.labels || []"
    />

    <div v-if="showNotes && !notesAfterTitle" class="field">
      <label :for="fieldId('notes')">{{ notesLabel }}</label>
      <textarea
        :id="fieldId('notes')"
        v-model="notes"
        :placeholder="notesPlaceholder"
      />
    </div>
  </div>
</template>
