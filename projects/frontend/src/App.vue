<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import ConnectionStatus from "@/components/ConnectionStatus.vue";
import QuoteBoard from "@/components/QuoteBoard.vue";
import { useMarketData } from "@/composables/useMarketData";

const {
  securities,
  quotesById,
  connectionState,
  loading,
  errorMessage,
  start,
  stop,
} = useMarketData();

onMounted(() => void start());
onUnmounted(stop);
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
    <section class="mx-auto max-w-7xl">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-300">
        DAY 03 · MARKET DATA REALTIME
      </p>
      <h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Securities Trading Simulator
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        Bảng giá giả lập cập nhật qua WebSocket. Giá hiển thị theo đồng trên một
        đơn vị chứng khoán và chỉ dùng cho mục đích học tập.
      </p>

      <div class="mt-10">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-lg font-semibold">Bảng giá mô phỏng</h2>
          <ConnectionStatus :state="connectionState" />
        </div>

        <p v-if="loading" class="mt-6 text-sm text-slate-400">
          Đang tải danh mục chứng khoán…
        </p>
        <p
          v-else-if="errorMessage"
          class="mt-6 rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"
        >
          {{ errorMessage }}
        </p>
        <QuoteBoard
          v-else
          :securities="securities"
          :quotes-by-id="quotesById"
          class="mt-6"
        />
      </div>
    </section>
  </main>
</template>
