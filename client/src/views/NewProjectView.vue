<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PhotoUploadPicker from "../components/PhotoUploadPicker.vue";
import ProjectOptionFields from "../components/ProjectOptionFields.vue";
import { createProject, getMeta } from "../api";
import {
  TYPE_LABELS,
  TECHNIQUE_LABELS,
  SPEED_LABELS,
  OVEN_CODES,
} from "../labels";

const router = useRouter();

const meta = ref({
  types: Object.keys(TYPE_LABELS),
  glasfusionTechniques: Object.keys(TECHNIQUE_LABELS),
  glasfusionSpeeds: Object.keys(SPEED_LABELS),
  ovens: OVEN_CODES,
  labels: [],
});

const title = ref("");
const type = ref("");
const glasfusionTechnique = ref("");
const glasfusionSpeed = ref("");
const oven = ref("");
const firingSchemaId = ref("");
const firingSchedule = ref([]);
const notes = ref("");
const kwhUsage = ref("");
const costPrice = ref("");
const sellingPrice = ref("");
const saleStatus = ref("");
const saleTitle = ref("");
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

function appendSchedule(form) {
  form.append("oven", oven.value);
  form.append("firingSchemaId", firingSchemaId.value || "");
  form.append("firingSchedule", JSON.stringify(firingSchedule.value || []));
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
  if (isGlasfusion.value && !glasfusionTechnique.value) {
    error.value = "Kies een techniek.";
    return;
  }
  if (
    isGlasfusion.value &&
    glasfusionTechnique.value !== "custom" &&
    !glasfusionSpeed.value
  ) {
    error.value = "Kies type (fast…ultra slow).";
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
    form.append("saleTitle", saleTitle.value);
    form.append("saleDescription", saleDescription.value);
    form.append("labels", JSON.stringify(projectLabels.value || []));
    appendSchedule(form);
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
      <p class="lead">Projecttitel, notitie, soort en foto’s. Verkoopvelden alleen bij een hoekje.</p>
    </div>

    <ProjectOptionFields
      v-model:title="title"
      v-model:type="type"
      v-model:glasfusion-technique="glasfusionTechnique"
      v-model:glasfusion-speed="glasfusionSpeed"
      v-model:oven="oven"
      v-model:firing-schema-id="firingSchemaId"
      v-model:firing-schedule="firingSchedule"
      v-model:notes="notes"
      v-model:kwh-usage="kwhUsage"
      v-model:cost-price="costPrice"
      v-model:selling-price="sellingPrice"
      v-model:sale-status="saleStatus"
      v-model:sale-title="saleTitle"
      v-model:sale-description="saleDescription"
      v-model:labels="projectLabels"
      :meta="meta"
      id-prefix=""
      :show-labels="true"
      :show-selling-price="true"
      :show-sale-fields="true"
      :show-firing-schema="true"
    />

    <div class="field">
      <label>Foto’s</label>
      <p class="muted" style="margin: 0 0 8px; font-size: 0.9rem">
        De eerste foto wordt de hoofdfoto (publiek). Extra foto’s markeer je later als publiek.
      </p>
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

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        {{ saving ? "Opslaan…" : "Project opslaan" }}
      </button>
      <router-link class="btn btn-secondary" to="/bewerken">Annuleren</router-link>
    </div>
  </section>
</template>
