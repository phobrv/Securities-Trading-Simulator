<script setup lang="ts">
import type { OrderBookSnapshot } from "@/types/simulator";

defineProps<{
  orderBook: OrderBookSnapshot | null;
  loading: boolean;
  errorMessage: string | null;
}>();

const numberFormatter = new Intl.NumberFormat("vi-VN");
</script>

<template>
  <section class="rounded-xl border border-slate-700 bg-slate-900/70 p-5" aria-labelledby="order-book-title">
    <h2 id="order-book-title" class="text-lg font-semibold">Sổ lệnh simulator</h2>
    <p v-if="loading" class="mt-3 text-sm text-slate-400">Đang tải sổ lệnh…</p>
    <p v-else-if="errorMessage" class="mt-3 text-sm text-rose-200" role="alert">{{ errorMessage }}</p>
    <div v-else class="mt-4 grid gap-5 sm:grid-cols-2">
      <div>
        <h3 class="text-sm font-medium text-emerald-200">Mua</h3>
        <p v-if="!orderBook?.bids.length" class="mt-2 text-sm text-slate-400">—</p>
        <ul v-else class="mt-2 space-y-1 text-sm">
          <li v-for="level in orderBook.bids" :key="`bid-${level.price}`" class="flex justify-between">
            <span>{{ numberFormatter.format(level.price) }} đồng</span><span>{{ numberFormatter.format(level.quantity) }}</span>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="text-sm font-medium text-rose-200">Bán</h3>
        <p v-if="!orderBook?.asks.length" class="mt-2 text-sm text-slate-400">—</p>
        <ul v-else class="mt-2 space-y-1 text-sm">
          <li v-for="level in orderBook.asks" :key="`ask-${level.price}`" class="flex justify-between">
            <span>{{ numberFormatter.format(level.price) }} đồng</span><span>{{ numberFormatter.format(level.quantity) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
