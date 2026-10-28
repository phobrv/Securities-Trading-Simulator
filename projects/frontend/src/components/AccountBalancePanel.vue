<script setup lang="ts">
import { formatVnd } from "@/features/accounts/formatters";
import type { AccountBalance } from "@/types/account";

defineProps<{
  balance: AccountBalance | null;
  loading: boolean;
  errorMessage: string | null;
}>();
</script>

<template>
  <section
    class="rounded-xl border border-cyan-300/20 bg-slate-900/70 p-5 shadow-sm"
    aria-labelledby="account-balance-title"
  >
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="account-balance-title" class="text-lg font-semibold">Tiền</h2>
      <span class="text-xs font-medium text-slate-400">VND</span>
    </div>
    <p v-if="loading" class="mt-4 text-sm text-slate-400">Đang tải số dư tiền…</p>
    <p v-else-if="errorMessage" class="mt-4 text-sm text-rose-200" role="alert">
      {{ errorMessage }}
    </p>
    <dl v-else-if="balance" class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div class="sm:col-span-2 rounded-lg bg-cyan-300/10 p-4">
        <dt class="text-cyan-100">Tiền khả dụng</dt>
        <dd class="mt-1 text-xl font-bold text-cyan-200">
          {{ formatVnd(balance.availableCash) }}
        </dd>
      </div>
      <div>
        <dt class="text-slate-400">Đã thanh toán</dt>
        <dd class="mt-1 font-medium">{{ formatVnd(balance.settledCash) }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Đang giữ mua</dt>
        <dd class="mt-1 font-medium">{{ formatVnd(balance.reservedCash) }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Nghĩa vụ mua</dt>
        <dd class="mt-1 font-medium">{{ formatVnd(balance.buyPayable) }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Phong tỏa khác</dt>
        <dd class="mt-1 font-medium">{{ formatVnd(balance.blockedCash) }}</dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-slate-400">Tiền bán chờ nhận (chưa khả dụng)</dt>
        <dd class="mt-1 font-medium">{{ formatVnd(balance.pendingReceivable) }}</dd>
      </div>
    </dl>
  </section>
</template>
