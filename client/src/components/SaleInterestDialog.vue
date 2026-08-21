<script setup>
import { ref, watch } from "vue";
import { sendSaleInterest } from "../api";
import { displayTitle, formatEuro, hasSellingPrice } from "../labels";

const props = defineProps({
  project: { type: Object, required: true },
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "sent"]);

const name = ref("");
const email = ref("");
const city = ref("");
const interest = ref("");
const saving = ref(false);
const error = ref("");
const done = ref(false);

function reset() {
  name.value = "";
  email.value = "";
  city.value = "";
  interest.value = "";
  saving.value = false;
  error.value = "";
  done.value = false;
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset();
  }
);

function close() {
  emit("close");
}

async function submit() {
  error.value = "";
  if (!name.value.trim()) {
    error.value = "Vul je naam in.";
    return;
  }
  if (!email.value.trim() || !/\S+@\S+\.\S+/.test(email.value.trim())) {
    error.value = "Vul een geldig e-mailadres in.";
    return;
  }
  if (!city.value.trim()) {
    error.value = "Vul je woonplaats in.";
    return;
  }
  if (!interest.value.trim()) {
    error.value = "Vertel kort waar je interesse in hebt.";
    return;
  }

  saving.value = true;
  try {
    await sendSaleInterest(props.project._id, {
      name: name.value.trim(),
      email: email.value.trim(),
      city: city.value.trim(),
      interest: interest.value.trim(),
    });
    done.value = true;
    emit("sent");
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="interest-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Interesse doorgeven"
    @click.self="close"
  >
    <div class="interest-panel stack">
      <div class="interest-panel-head">
        <div>
          <h2>Interesse doorgeven</h2>
          <p class="muted" style="margin: 4px 0 0">
            Over <strong>{{ displayTitle(project) }}</strong>
            <template v-if="hasSellingPrice(project.sellingPrice)">
              · {{ formatEuro(project.sellingPrice) }}
            </template>
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-small" @click="close">
          Sluiten
        </button>
      </div>

      <template v-if="done">
        <p class="ok-msg">
          Bedankt! Je bericht is verstuurd. Captain John neemt contact met je op.
        </p>
        <button type="button" class="btn btn-primary" @click="close">
          Sluiten
        </button>
      </template>

      <template v-else>
        <div class="field">
          <label for="interest-name">Naam</label>
          <input
            id="interest-name"
            v-model="name"
            type="text"
            autocomplete="name"
            placeholder="Je naam"
          />
        </div>
        <div class="field">
          <label for="interest-email">E-mailadres</label>
          <input
            id="interest-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="naam@voorbeeld.nl"
          />
        </div>
        <div class="field">
          <label for="interest-city">Woonplaats</label>
          <input
            id="interest-city"
            v-model="city"
            type="text"
            autocomplete="address-level2"
            placeholder="Bijv. Eindhoven"
          />
        </div>
        <div class="field">
          <label for="interest-text">Interesse</label>
          <textarea
            id="interest-text"
            v-model="interest"
            placeholder="Waar ben je in geïnteresseerd? Vragen, bezichtiging, prijs…"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving"
            @click="submit"
          >
            {{ saving ? "Versturen…" : "Versturen" }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            @click="close"
          >
            Annuleren
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
