<script setup lang="ts">
import { onMounted, ref } from "vue";

type SystemOverview = {
  name: string;
  mode: string;
  conventions: {
    currency: string;
    priceUnit: string;
    timestampFormat: string;
    displayTimeZone: string;
  };
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const overview = ref<SystemOverview | null>(null);
const connectionState = ref<"loading" | "connected" | "unavailable">("loading");

onMounted(async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/system/overview`);

    if (!response.ok) {
      throw new Error("System overview is unavailable.");
    }

    overview.value = (await response.json()) as SystemOverview;
    connectionState.value = "connected";
  } catch {
    connectionState.value = "unavailable";
  }
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
    <section class="mx-auto max-w-3xl">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-300">
        DAY 01 · FOUNDATION
      </p>
      <h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Securities Trading Simulator
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        Nền móng cho ứng dụng mô phỏng giao dịch chứng khoán. Dữ liệu, quy tắc
        và kết quả chỉ dùng cho mục đích học tập.
      </p>

      <div
        class="mt-10 rounded-2xl border border-slate-700 bg-slate-900/70 p-6 shadow-2xl"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-lg font-semibold">Kết nối backend</h2>
          <span
            class="rounded-full px-3 py-1 text-xs font-bold"
            :class="{
              'bg-amber-400/15 text-amber-200': connectionState === 'loading',
              'bg-emerald-400/15 text-emerald-200':
                connectionState === 'connected',
              'bg-rose-400/15 text-rose-200': connectionState === 'unavailable',
            }"
          >
            {{ connectionState }}
          </span>
        </div>

        <dl v-if="overview" class="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div class="rounded-lg bg-slate-800 p-4">
            <dt class="text-slate-400">Chế độ</dt>
            <dd class="mt-1 font-medium text-white">{{ overview.mode }}</dd>
          </div>
          <div class="rounded-lg bg-slate-800 p-4">
            <dt class="text-slate-400">Tiền tệ</dt>
            <dd class="mt-1 font-medium text-white">
              {{ overview.conventions.currency }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-800 p-4">
            <dt class="text-slate-400">Đơn vị giá</dt>
            <dd class="mt-1 font-medium text-white">
              {{ overview.conventions.priceUnit }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-800 p-4">
            <dt class="text-slate-400">Múi giờ hiển thị</dt>
            <dd class="mt-1 font-medium text-white">
              {{ overview.conventions.displayTimeZone }}
            </dd>
          </div>
        </dl>

        <p v-else class="mt-6 text-sm leading-6 text-slate-400">
          Chạy backend tại {{ apiBaseUrl }} để hiển thị metadata của simulator.
        </p>
      </div>
    </section>
  </main>
</template>
