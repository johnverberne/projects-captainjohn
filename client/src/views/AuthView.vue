<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { resetLogin } from "../api";
import { useAuth } from "../auth";

const router = useRouter();
const route = useRoute();
const auth = useAuth();

const tab = ref("login");
const email = ref("");
const password = ref("");
const name = ref("");
const reason = ref("");
const error = ref("");
const success = ref("");
const saving = ref(false);

onMounted(() => {
  const ret = String(route.query.return || "").trim();
  if (ret.startsWith("/") && !ret.startsWith("//")) {
    auth.returnUrl.value = ret;
  }
});

watch(tab, () => {
  error.value = "";
  success.value = "";
});

async function submitLogin() {
  error.value = "";
  success.value = "";
  if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
    error.value = "Vul een geldig e-mailadres in.";
    return;
  }
  if (!password.value) {
    error.value = "Wachtwoord is verplicht.";
    return;
  }
  saving.value = true;
  try {
    await auth.login(email.value, password.value);
    const target = auth.returnUrl.value || "/bewerken";
    if (target.startsWith("/api")) {
      window.location.replace(target);
      return;
    }
    router.replace(target);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function submitRegister() {
  error.value = "";
  success.value = "";
  if (!name.value.trim()) {
    error.value = "Vul je naam in.";
    return;
  }
  if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
    error.value = "Vul een geldig e-mailadres in.";
    return;
  }
  if (!reason.value.trim()) {
    error.value = "Vul een reden voor toegang in.";
    return;
  }
  saving.value = true;
  try {
    await auth.requestAccess(email.value, reason.value.trim(), name.value.trim());
    success.value =
      "Een aanvraag voor een nieuw account is aangemaakt. Na goedkeuring ontvangt u een wachtwoord per e-mail.";
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function submitReset() {
  error.value = "";
  success.value = "";
  if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
    error.value = "Vul een geldig e-mailadres in.";
    return;
  }
  saving.value = true;
  try {
    const data = await resetLogin(email.value);
    success.value = data.devPassword
      ? `Nieuw wachtwoord (dev): ${data.devPassword}. Ga naar Inloggen.`
      : "Er is een e-mail met een nieuw wachtwoord verstuurd. Ga naar Inloggen.";
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
      <h1>Inloggen om te bewerken</h1>
      <p class="lead">
        Bekijken kan zonder account. Hier log je in om projecten te wijzigen.
      </p>
    </div>

    <div class="auth-tabs auth-tabs-3">
      <button
        type="button"
        class="choice"
        :class="{ active: tab === 'login' }"
        @click="tab = 'login'"
      >
        Inloggen
      </button>
      <button
        type="button"
        class="choice"
        :class="{ active: tab === 'register' }"
        @click="tab = 'register'"
      >
        Aanmelden
      </button>
      <button
        type="button"
        class="choice"
        :class="{ active: tab === 'reset' }"
        @click="tab = 'reset'"
      >
        Wachtwoord kwijt?
      </button>
    </div>

    <template v-if="tab === 'login'">
      <div class="field">
        <label for="email">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Wachtwoord</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>
      <button class="btn btn-primary btn-block" :disabled="saving" @click="submitLogin">
        {{ saving ? "Bezig…" : "Inloggen" }}
      </button>
      <router-link class="btn btn-secondary btn-block" to="/">
        Terug naar publieke weergave
      </router-link>
    </template>

    <template v-else-if="tab === 'register'">
      <div class="field">
        <label for="name-reg">Naam</label>
        <input id="name-reg" v-model="name" type="text" autocomplete="name" />
      </div>
      <div class="field">
        <label for="email-reg">E-mail</label>
        <input id="email-reg" v-model="email" type="email" autocomplete="username" />
      </div>
      <div class="field">
        <label for="reason">Reden voor toegang</label>
        <textarea
          id="reason"
          v-model="reason"
          placeholder="Waarom wilt u toegang tot Captain John?"
        />
      </div>
      <p class="muted">
        U kiest geen wachtwoord zelf. Na goedkeuring ontvangt u een gegenereerd
        wachtwoord per e-mail.
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>
      <button class="btn btn-primary btn-block" :disabled="saving" @click="submitRegister">
        {{ saving ? "Bezig…" : "Aanvraag indienen" }}
      </button>
    </template>

    <template v-else>
      <div class="field">
        <label for="email-reset">E-mail</label>
        <input
          id="email-reset"
          v-model="email"
          type="email"
          autocomplete="username"
        />
      </div>
      <p class="muted">
        We sturen een nieuw tijdelijk wachtwoord naar dit e-mailadres.
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>
      <button class="btn btn-primary btn-block" :disabled="saving" @click="submitReset">
        {{ saving ? "Bezig…" : "Reset aanvragen" }}
      </button>
    </template>
  </section>
</template>
