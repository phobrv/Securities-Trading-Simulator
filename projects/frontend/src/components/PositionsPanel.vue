<script setup lang="ts">
import { formatInteger } from "@/features/accounts/formatters";
import type { AccountPosition } from "@/types/account";

defineProps<{
  positions: AccountPosition[];
  loading: boolean;
  errorMessage: string | null;
}>();
</script>

<template>
  <section
    class="rounded-xl border border-cyan-300/20 bg-slate-900/70 p-5 shadow-sm"
    aria-labelledby="positions-title"
  >
    <h2 id="positions-title" class="text-lg font-semibold">Chứng khoán</h2>
    <p v-if="loading" class="mt-4 text-sm text-slate-400">Đang tải vị thế…</p>
    <p v-else-if="errorMessage" class="mt-4 text-sm text-rose-200" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="positions.length === 0" class="mt-4 text-sm text-slate-400">
      Tài khoản chưa có vị thế chứng khoán.
    </p>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-slate-700 text-slate-400">
          <tr>
            <th class="px-3 py-2 font-medium">Mã</th>
            <th class="px-3 py-2 text-right font-medium">Đã thanh toán</th>
            <th class="px-3 py-2 text-right font-medium">Chờ giao</th>
            <th class="px-3 py-2 text-right font-medium">Đang giữ</th>
            <th class="px-3 py-2 text-right font-medium">Phong tỏa</th>
            <th class="px-3 py-2 text-right font-medium">Có thể bán</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="position in positions" :key="position.securityId" class="border-b border-slate-800">
            <td class="px-3 py-3">
              <div class="font-medium text-slate-100">{{ position.symbol }}</div>
              <div class="text-xs text-slate-400">{{ position.marketCode }}</div>
            </td>
            <td class="px-3 py-3 text-right">{{ formatInteger(position.settledQuantity) }}</td>
            <td class="px-3 py-3 text-right">{{ formatInteger(position.pendingSellQuantity) }}</td>
            <td class="px-3 py-3 text-right">{{ formatInteger(position.reservedQuantity) }}</td>
            <td class="px-3 py-3 text-right">{{ formatInteger(position.blockedQuantity) }}</td>
            <td class="px-3 py-3 text-right font-semibold text-cyan-200">
              {{ formatInteger(position.availableQuantity) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
