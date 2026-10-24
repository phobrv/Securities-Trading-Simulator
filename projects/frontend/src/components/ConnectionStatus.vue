<script setup lang="ts">
import type { MarketDataConnectionState } from "@/types/market-data";

defineProps<{ state: MarketDataConnectionState }>();

const labels: Record<MarketDataConnectionState, string> = {
  connecting: "CONNECTING",
  connected: "CONNECTED",
  disconnected: "DISCONNECTED",
  unavailable: "UNAVAILABLE",
};

const classes: Record<MarketDataConnectionState, string> = {
  connecting: "bg-amber-400/15 text-amber-200",
  connected: "bg-emerald-400/15 text-emerald-200",
  disconnected: "bg-rose-400/15 text-rose-200",
  unavailable: "bg-rose-400/15 text-rose-200",
};
</script>

<template>
  <span
    class="rounded-full px-3 py-1 text-xs font-bold"
    :class="classes[state]"
  >
    {{ labels[state] }}
  </span>
</template>
