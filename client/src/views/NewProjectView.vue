<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import LabelPicker from "../components/LabelPicker.vue";
import PhotoUploadPicker from "../components/PhotoUploadPicker.vue";
import { createProject, getMeta } from "../api";
import { TYPE_LABELS, TECHNIQUE_LABELS, SPEED_LABELS, SALE_STATUS_LABELS, SALE_STATUSES } from "../labels";

const router = useRouter();

const meta = ref({
  types: Object.keys(TYPE_LABELS),
  glasfusionTechniques: Object.keys(TECHNIQUE_LABELS),
  glasfusionSpeeds: Object.keys(SPEED_LABELS),
  labels: [],
});

const title = ref("");
const type = ref("");
const glasfusionTechnique = ref("");
const glasfusionSpeed = ref("");
const notes = ref("");
const kwhUsage = ref("");
const costPrice = ref("");
const sellingPrice = ref("");
const saleStatus = ref("");
const saleDescription = ref("");
const projectLabels = ref([]);
const files = ref([]);
const previews = ref([]);
const saving = ref(false);
const error = ref("");

const isGlasfusion = computed(() => type.value === "glasfusion");

onMounted(async () => {
  try {
    meta.value = await getMeta();
  } catch {
    /* fallback labels already set */
  }
});

function selectType(value) {
  type.value = value;
  if (value !== "glasfusion") {
    glasfusionTechnique.value = "";
    glasfusionSpeed.value = "";
  }
}

function onFiles(event) {
  const selected = Array.from(event.target.files || []);
  files.value = [...files.value, ...selected];
  previews.value = files.value.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));
  event.target.value = "";
}

function removeFile(index) {
  URL.revokeObjectURL(previews.value[index]?.url);
  files.value.splice(index, 1);
  previews.value.splice(index, 1);
}

async function submit() {
  error.value = "";
  if (!title.value.trim()) {
    error.value = "Geef het project een titel.";
    return;
  }
  if (!type.value) {
    error.value = "Kies een projectsoort.";
    return;
  }
  if (isGlasfusion.value && (!glasfusionTechnique.value || !glasfusionSpeed.value)) {
    error.value = "Kies techniek (slump/fuse/cast) en type (fast…ultra slow).";
    return;
  }

  saving.value = true;
  try {
    const form = new FormData();
    form.append("title", title.value.trim());
    form.append("type", type.value);
    form.append("notes", notes.value);
    form.append("kwhUsage", kwhUsage.value);
    form.append("costPrice", costPrice.value);
    form.append("sellingPrice", sellingPrice.value);
    form.append("saleStatus", saleStatus.value);
    form.append("saleDescription", saleDescription.value);
    form.append("labels", JSON.stringify(projectLabels.value || []));
    if (isGlasfusion.value) {
      form.append("glasfusionTechnique", glasfusionTechnique.value);
      form.append("glasfusionSpeed", glasfusionSpeed.value);
    }
    for (const file of files.value) {
      form.append("photos", file);
    }
    const project = await createProject(form);
    router.replace(`/bewerken/project/${project._id}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="panel stack">
    <div>
      <h1>Nieuw project</h1>
      <p class="lead">Titel, soort, eventueel glasfusion-opties en foto’s.</p>
    </div>

    <div class="field">
      <label for="title">Titel</label>
      <input
        id="title"
        v-model="title"
        type="text"
        placeholder="Bijv. Blauw schaaltje"
        autocomplete="off"
      />
    </div>

    <div class="field">
      <label>Soort project</label>
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

    <div class="field">
      <label>Foto’s</label>
      <PhotoUploadPicker title="Foto’s toevoegen" @change="onFiles" />
      <div v-if="previews.length" class="photo-grid" style="margin-top: 12px">
        <div v-for="(preview, index) in previews" :key="preview.url" style="position: relative">
          <img :src="preview.url" :alt="preview.name" />
          <button
            type="button"
            class="btn btn-danger"
            style="position: absolute; top: 4px; right: 4px; padding: 4px 8px; font-size: 0.75rem"
            @click="removeFile(index)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="kwhUsage">Kilowattverbruik (kWh)</label>
        <input
          id="kwhUsage"
          v-model="kwhUsage"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 12.5"
        />
      </div>
      <div class="field">
        <label for="costPrice">Kostprijs (€)</label>
        <input
          id="costPrice"
          v-model="costPrice"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="Bijv. 45.00"
        />
      </div>
    </div>

    <div class="field">
      <label for="sellingPrice">Verkoopprijs (€)</label>
      <input
        id="sellingPrice"
        v-model="sellingPrice"
        type="number"
        inputmode="decimal"
        min="0"
        step="0.01"
        placeholder="Bijv. 89.00"
      />
    </div>

    <div class="field">
      <label>Verkoophoekje</label>
      <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
        De hoofdfoto (eerste foto) is de verkoopfoto.
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
          v-for="value in SALE_STATUSES"
          :key="value"
          type="button"
          class="choice"
          :class="{ active: saleStatus === value }"
          @click="saleStatus = value"
        >
          {{ SALE_STATUS_LABELS[value] }}
        </button>
      </div>
    </div>

    <div class="field">
      <label for="saleDescription">Verkoopomschrijving</label>
      <textarea
        id="saleDescription"
        v-model="saleDescription"
        placeholder="Korte tekst voor het verkoophoekje…"
      />
    </div>

    <LabelPicker v-model="projectLabels" :catalog="meta.labels || []" />

    <div class="field">
      <label for="notes">Notities (optioneel)</label>
      <textarea id="notes" v-model="notes" placeholder="Afmetingen, kleuren, klant…" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        {{ saving ? "Opslaan…" : "Project opslaan" }}
      </button>
      <router-link class="btn btn-secondary" to="/bewerken">Annuleren</router-link>
    </div>
  </section>
</template>
