<script setup lang="ts">
import type { SimulatorExecution } from "@/types/simulator";

defineProps<{
  executions: SimulatorExecution[];
  loading: boolean;
  errorMessage: string | null;
}>();

const numberFormatter = new Intl.NumberFormat("vi-VN");
const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
</script>

<template>
  <section class="rounded-xl border border-slate-700 bg-slate-900/70 p-5" aria-labelledby="executions-title">
    <h2 id="executions-title" class="text-lg font-semibold">Lần khớp</h2>
    <p v-if="loading" class="mt-3 text-sm text-slate-400">Đang tải executions…</p>
    <p v-else-if="errorMessage" class="mt-3 text-sm text-rose-200" role="alert">{{ errorMessage }}</p>
    <p v-else-if="executions.length === 0" class="mt-3 text-sm text-slate-400">Chưa có execution.</p>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase text-slate-400"><tr><th>Giá</th><th>KL</th><th>Thời điểm</th><th>Lệnh mua / bán</th></tr></thead>
        <tbody>
          <tr v-for="execution in executions" :key="execution.executionId" class="border-t border-slate-800">
            <td class="py-2">{{ numberFormatter.format(execution.price) }} đồng</td>
            <td class="py-2">{{ numberFormatter.format(execution.quantity) }}</td>
            <td class="py-2">{{ timeFormatter.format(new Date(execution.executedAt)) }}</td>
            <td class="py-2">{{ execution.buyOrderId }} / {{ execution.sellOrderId }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
