<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  createFiringSchema,
  deleteFiringSchema,
  listFiringSchemas,
  updateFiringSchema,
} from "../api";
import FiringScheduleChart from "./FiringScheduleChart.vue";
import {
  defaultFiringSchedule,
  emptyFiringSegment,
  OVEN_LABELS,
  TECHNIQUE_LABELS,
} from "../labels";

const schedule = defineModel("schedule", { type: Array, default: () => [] });
const schemaId = defineModel("schemaId", { default: "" });

const props = defineProps({
  technique: { type: String, default: "" },
  oven: { type: String, default: "" },
});

const catalog = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const schemaName = ref("");
const pickedId = ref("");
const activeRateIndex = ref(null);

const selected = computed(() =>
  catalog.value.find((item) => item._id === pickedId.value) || null
);

function cloneSegments(segments) {
  return (segments || []).map((segment) => ({
    rate: segment.rate ?? "",
    targetTemp: segment.targetTemp ?? "",
    holdMinutes: segment.holdMinutes ?? "",
  }));
}

function normalizeSegments(segments) {
  return (segments || [])
    .map((segment) => ({
      rate: segment.rate === "" || segment.rate == null ? null : Number(segment.rate),
      targetTemp: Number(segment.targetTemp),
      holdMinutes:
        segment.holdMinutes === "" || segment.holdMinutes == null
          ? 0
          : Number(segment.holdMinutes),
    }))
    .filter((segment) => Number.isFinite(segment.targetTemp));
}

async function loadCatalog() {
  loading.value = true;
  try {
    catalog.value = await listFiringSchemas();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function applySchema(item) {
  if (!item) return;
  pickedId.value = item._id;
  schemaId.value = item._id;
  schemaName.value = item.name;
  schedule.value = cloneSegments(item.segments);
}

function startNew() {
  pickedId.value = "";
  schemaId.value = "";
  schemaName.value = "";
  schedule.value = defaultFiringSchedule();
}

function addSegment() {
  const list = [...schedule.value];
  const selected = activeRateIndex.value;
  const insertAt =
    selected != null && selected >= 0 && selected <= list.length
      ? selected
      : list.length;
  list.splice(insertAt, 0, emptyFiringSegment());
  schedule.value = list;
  activeRateIndex.value = insertAt;
  nextTick(() => {
    const input = document.querySelector(
      `[data-firing-rate-index="${insertAt}"]`
    );
    input?.focus();
  });
}

function removeSegment(index) {
  schedule.value = schedule.value.filter((_, i) => i !== index);
}

function payload() {
  const name = schemaName.value.trim();
  if (!name) throw new Error("Geef het schema een naam.");
  const segments = normalizeSegments(schedule.value);
  if (!segments.length) throw new Error("Voeg minstens één segment met doeltemperatuur toe.");
  return {
    name,
    technique: props.technique || null,
    oven: props.oven || null,
    segments,
  };
}

async function saveExisting() {
  error.value = "";
  saving.value = true;
  try {
    const body = payload();
    const saved = pickedId.value
      ? await updateFiringSchema(pickedId.value, body)
      : await createFiringSchema(body);
    catalog.value = catalog.value.some((item) => item._id === saved._id)
      ? catalog.value.map((item) => (item._id === saved._id ? saved : item))
      : [...catalog.value, saved].sort((a, b) =>
          a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
        );
    applySchema(saved);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function saveAsNew() {
  error.value = "";
  saving.value = true;
  try {
    const body = payload();
    const saved = await createFiringSchema(body);
    catalog.value = [...catalog.value, saved].sort((a, b) =>
      a.name.localeCompare(b.name, "nl", { sensitivity: "base" })
    );
    applySchema(saved);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeSaved() {
  if (!pickedId.value) return;
  if (!window.confirm(`Schema “${selected.value?.name}” verwijderen?`)) return;
  error.value = "";
  try {
    await deleteFiringSchema(pickedId.value);
    catalog.value = catalog.value.filter((item) => item._id !== pickedId.value);
    startNew();
  } catch (e) {
    error.value = e.message;
  }
}

function onPick(id) {
  const item = catalog.value.find((schema) => schema._id === id);
  if (item) applySchema(item);
}

watch(
  () => schedule.value,
  (value) => {
    if (!value?.length) schedule.value = defaultFiringSchedule();
  },
  { immediate: true }
);

onMounted(async () => {
  await loadCatalog();
  if (schemaId.value) {
    const match = catalog.value.find((item) => item._id === schemaId.value);
    if (match) {
      pickedId.value = match._id;
      schemaName.value = match.name;
    }
  }
  if (!schemaName.value && selected.value) schemaName.value = selected.value.name;
});
</script>

<template>
  <div class="stack firing-editor">
    <div class="field">
      <label>Opgeslagen schema</label>
      <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
        Kies een bestaand stookschema of maak een nieuw schema. Lege stijging = vol (zo snel als de oven kan).
      </p>
      <div class="firing-toolbar">
        <select
          class="firing-select"
          :value="pickedId"
          :disabled="loading"
          @change="onPick($event.target.value)"
        >
          <option value="">Nieuw schema…</option>
          <option v-for="item in catalog" :key="item._id" :value="item._id">
            {{ item.name }}
            <template v-if="item.technique">
              · {{ TECHNIQUE_LABELS[item.technique] || item.technique }}
            </template>
            <template v-if="item.oven">
              · {{ OVEN_LABELS[item.oven] || item.oven }}
            </template>
          </option>
        </select>
        <button class="btn btn-secondary btn-small" type="button" @click="startNew">
          Nieuw
        </button>
      </div>
    </div>

    <div class="field">
      <label for="firing-schema-name">Schema-naam</label>
      <input
        id="firing-schema-name"
        v-model="schemaName"
        type="text"
        placeholder="Bijv. Fuse medium klein"
        autocomplete="off"
      />
    </div>

    <div class="schedule-table-wrap">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Stijging (°C/u)</th>
            <th>Doel (°C)</th>
            <th>Hold (min)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(segment, index) in schedule" :key="index">
            <td>{{ index + 1 }}</td>
            <td>
              <input
                v-model="segment.rate"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                placeholder="Vol"
                :data-firing-rate-index="index"
                @focus="activeRateIndex = index"
              />
            </td>
            <td>
              <input
                v-model="segment.targetTemp"
                type="number"
                inputmode="decimal"
                step="1"
                placeholder="780"
              />
            </td>
            <td>
              <input
                v-model="segment.holdMinutes"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                placeholder="0"
              />
            </td>
            <td>
              <button
                class="btn btn-danger btn-small"
                type="button"
                :disabled="schedule.length <= 1"
                @click="removeSegment(index)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <FiringScheduleChart :segments="schedule" />

    <div class="actions firing-actions">
      <button class="btn btn-secondary btn-small" type="button" @click="addSegment">
        Segment toevoegen
      </button>
      <button
        class="btn btn-primary btn-small"
        type="button"
        :disabled="saving"
        @click="saveExisting"
      >
        {{ saving ? "Opslaan…" : pickedId ? "Schema bijwerken" : "Schema opslaan" }}
      </button>
      <button
        v-if="pickedId"
        class="btn btn-secondary btn-small"
        type="button"
        :disabled="saving"
        @click="saveAsNew"
      >
        Opslaan als nieuw
      </button>
      <button
        v-if="pickedId"
        class="btn btn-danger btn-small"
        type="button"
        @click="removeSaved"
      >
        Schema wissen
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
