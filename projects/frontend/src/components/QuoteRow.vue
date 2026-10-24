<script setup lang="ts">
import type { QuoteSnapshot, Security } from "@/types/market-data";

const props = defineProps<{
  security: Security;
  quote: QuoteSnapshot | undefined;
}>();

const numberFormatter = new Intl.NumberFormat("vi-VN");
const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : numberFormatter.format(value);
}

function formatUpdatedAt(value: string | undefined): string {
  return value ? timeFormatter.format(new Date(value)) : "—";
}

function getPriceColor(price: number | null | undefined): string {
  const quote = props.quote;
  if (price === null || price === undefined || !quote) return "text-slate-400";
  if (price === quote.ceilingPrice) return "text-fuchsia-300";
  if (price === quote.floorPrice) return "text-sky-300";
  if (price > quote.referencePrice) return "text-emerald-300";
  if (price < quote.referencePrice) return "text-rose-300";
  return "text-amber-300";
}
</script>

<template>
  <tr
    class="border-t border-slate-800 text-sm transition-colors hover:bg-slate-800/50"
  >
    <td class="sticky left-0 bg-slate-950 px-4 py-4 text-left sm:static">
      <p class="font-bold text-white">{{ security.symbol }}</p>
      <p class="mt-1 text-xs text-slate-400">{{ security.marketCode }}</p>
    </td>
    <td class="px-4 py-4 text-left">
      <span
        class="rounded px-2 py-1 text-xs font-semibold"
        :class="
          security.tradingStatus === 'TRADABLE'
            ? 'bg-emerald-400/10 text-emerald-200'
            : 'bg-amber-400/10 text-amber-200'
        "
      >
        {{ security.tradingStatus }}
      </span>
    </td>
    <td
      class="px-4 py-4 text-right font-medium"
      :class="getPriceColor(quote?.referencePrice)"
    >
      {{ formatNumber(quote?.referencePrice) }}
    </td>
    <td
      class="px-4 py-4 text-right font-medium"
      :class="getPriceColor(quote?.ceilingPrice)"
    >
      {{ formatNumber(quote?.ceilingPrice) }}
    </td>
    <td
      class="px-4 py-4 text-right font-medium"
      :class="getPriceColor(quote?.floorPrice)"
    >
      {{ formatNumber(quote?.floorPrice) }}
    </td>
    <td
      class="px-4 py-4 text-right font-medium"
      :class="getPriceColor(quote?.bestBid?.price)"
    >
      {{ formatNumber(quote?.bestBid?.price) }}
    </td>
    <td class="px-4 py-4 text-right">
      {{ formatNumber(quote?.bestBid?.quantity) }}
    </td>
    <td
      class="px-4 py-4 text-right text-base font-bold"
      :class="getPriceColor(quote?.lastPrice)"
    >
      {{ formatNumber(quote?.lastPrice) }}
    </td>
    <td class="px-4 py-4 text-right">
      {{ formatNumber(quote?.lastQuantity) }}
    </td>
    <td
      class="px-4 py-4 text-right font-medium"
      :class="getPriceColor(quote?.bestAsk?.price)"
    >
      {{ formatNumber(quote?.bestAsk?.price) }}
    </td>
    <td class="px-4 py-4 text-right">
      {{ formatNumber(quote?.bestAsk?.quantity) }}
    </td>
    <td class="px-4 py-4 text-right font-medium">
      {{ formatNumber(quote?.totalVolume) }}
    </td>
    <td class="px-4 py-4 text-right text-slate-300">
      {{ formatUpdatedAt(quote?.updatedAt) }}
    </td>
  </tr>
</template>
