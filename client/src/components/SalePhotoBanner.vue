<script setup>
import { computed } from "vue";
import { salePhotoLabel } from "../labels";

const props = defineProps({
  status: { type: String, default: "" },
  compact: { type: Boolean, default: false },
});

const label = computed(() => salePhotoLabel(props.status));
</script>

<template>
  <span
    v-if="label"
    class="sale-photo-banner"
    :class="[`sale-photo-banner-${status}`, { compact }]"
  >
    {{ label }}
  </span>
</template>
