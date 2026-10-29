<script setup lang="ts">
import { ref, watch } from "vue";
import { fetchPortfolio } from "@/services/account-api";
import type { Portfolio } from "./portfolio.types";

const props = defineProps<{ accountId: string }>();
const portfolio = ref<Portfolio | null>(null);
const loading = ref(false);
const error = ref("");
let requestId = 0;
async function refresh(): Promise<void> {
  const id = ++requestId;
  loading.value = true;
  error.value = "";
  portfolio.value = null;
  try {
    const result = await fetchPortfolio(props.accountId);
    if (id === requestId) portfolio.value = result;
  } catch {
    if (id === requestId) error.value = "Không thể tải danh mục.";
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(
  () => props.accountId,
  () => void refresh(),
  { immediate: true },
);
function format(value: string | null): string {
  if (value === null) return "—";
  const [whole, fraction] = value.split(".");
  const decimals = fraction?.replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("vi-VN")}${decimals ? `,${decimals}` : ""}`;
}
</script>

<template>
  <section
    class="rounded-xl border border-slate-700 bg-slate-900 p-5"
    aria-labelledby="portfolio-title"
  >
    <div class="flex items-center justify-between gap-4">
      <h2 id="portfolio-title" class="text-lg font-semibold">
        Ngày 11 · Danh mục
      </h2>
      <button
        class="rounded border border-slate-600 px-3 py-1 text-sm"
        type="button"
        @click="refresh"
      >
        Làm mới
      </button>
    </div>
    <p v-if="loading" class="mt-4 text-slate-400" role="status">
      Đang tải danh mục…
    </p>
    <p v-else-if="error" class="mt-4 text-rose-300" role="alert">{{ error }}</p>
    <p v-else-if="!portfolio?.positions.length" class="mt-4 text-slate-400">
      Chưa có vị thế.
    </p>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="text-slate-400">
            <th>Mã</th>
            <th>Vị thế kinh tế</th>
            <th>Có thể bán</th>
            <th>Giá vốn BQ</th>
            <th>Giá thị trường</th>
            <th>Lãi/lỗ chưa thực hiện</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in portfolio?.positions"
            :key="p.securityId"
            class="border-t border-slate-700 align-top"
          >
            <td class="py-3 font-semibold">
              {{ p.symbol }}
              <p
                v-if="p.pendingBuyQuantity"
                class="mt-1 font-normal text-amber-200"
              >
                {{ p.pendingBuyQuantity }} cổ phiếu mua chờ nhận.
              </p>
            </td>
            <td>{{ p.economicQuantity }}</td>
            <td>{{ p.availableQuantity }}</td>
            <td>
              {{ format(p.averageCost) }}
              <p v-if="p.costStatus === 'MISSING'" class="text-amber-200">
                Thiếu giá vốn
              </p>
            </td>
            <td>
              {{ format(p.marketPrice) }}
              <p
                v-if="p.valuationStatus !== 'AVAILABLE'"
                class="text-amber-200"
              >
                {{ p.valuationStatus === "STALE" ? "Giá cũ" : "Chưa có giá" }}
              </p>
              <p v-if="p.quoteUpdatedAt" class="text-slate-400">
                {{ p.quoteUpdatedAt }}
              </p>
            </td>
            <td>{{ format(p.unrealizedPnl) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
