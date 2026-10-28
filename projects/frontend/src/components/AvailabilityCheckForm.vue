<script setup lang="ts">
import { ref } from "vue";

import { formatInteger, formatVnd } from "@/features/accounts/formatters";
import type {
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
} from "@/types/account";
import type { Security } from "@/types/market-data";

const props = defineProps<{
  securities: Security[];
  loading: boolean;
  result: AvailabilityCheckResult | null;
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  submit: [input: AvailabilityCheckRequest];
}>();

const securityId = ref("");
const side = ref<"BUY" | "SELL">("BUY");
const price = ref(25_000);
const quantity = ref(100);
const inputError = ref<string | null>(null);

const reasonLabels: Record<
  NonNullable<AvailabilityCheckResult["reasonCode"]>,
  string
> = {
  INSUFFICIENT_CASH: "Không đủ tiền khả dụng.",
  INSUFFICIENT_SECURITIES: "Không đủ chứng khoán khả dụng.",
  ACCOUNT_NOT_ACTIVE: "Tài khoản không ở trạng thái hoạt động.",
  SECURITY_NOT_TRADABLE: "Chứng khoán không được phép giao dịch.",
};

function submit(): void {
  if (!securityId.value) {
    inputError.value = "Hãy chọn chứng khoán.";
    return;
  }
  if (
    !Number.isSafeInteger(price.value) ||
    !Number.isSafeInteger(quantity.value) ||
    price.value <= 0 ||
    quantity.value <= 0
  ) {
    inputError.value = "Giá và khối lượng phải là số nguyên dương an toàn.";
    return;
  }

  inputError.value = null;
  emit("submit", {
    securityId: securityId.value,
    side: side.value,
    orderType: "LO",
    price: price.value,
    quantity: quantity.value,
  });
}

function reasonLabel(result: AvailabilityCheckResult): string {
  return result.reasonCode ? reasonLabels[result.reasonCode] : "Không hợp lệ.";
}
</script>

<template>
  <section
    class="rounded-xl border border-amber-300/30 bg-slate-900/70 p-5 shadow-sm"
    aria-labelledby="availability-check-title"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="availability-check-title" class="text-lg font-semibold">Kiểm tra thử</h2>
      <span class="rounded-full bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-100">
        Không đặt lệnh, không giữ tài sản
      </span>
    </div>
    <form class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <label class="grid gap-2 text-sm font-medium text-slate-200 sm:col-span-2">
        Chứng khoán
        <select v-model="securityId" class="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
          <option disabled value="">Chọn chứng khoán</option>
          <option v-for="security in props.securities" :key="security.id" :value="security.id">
            {{ security.symbol }} · {{ security.marketCode }}
          </option>
        </select>
      </label>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        Phía
        <select v-model="side" class="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
          <option value="BUY">Mua</option>
          <option value="SELL">Bán</option>
        </select>
      </label>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        Loại lệnh
        <input value="LO" disabled class="rounded-md border border-slate-800 bg-slate-800 px-3 py-2 text-slate-400" />
      </label>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        Giá (đồng)
        <input v-model.number="price" min="1" step="1" type="number" class="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
      </label>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        Khối lượng
        <input v-model.number="quantity" min="1" step="1" type="number" class="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
      </label>
      <p v-if="inputError" class="text-sm text-rose-200 sm:col-span-2" role="alert">
        {{ inputError }}
      </p>
      <button
        :disabled="loading"
        class="rounded-md bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        type="submit"
      >
        {{ loading ? "Đang kiểm tra…" : "Kiểm tra khả dụng" }}
      </button>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-rose-200" role="alert">
      {{ errorMessage }}
    </p>
    <div
      v-else-if="result"
      class="mt-4 rounded-lg border p-4 text-sm"
      :class="result.valid ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-rose-300/30 bg-rose-300/10 text-rose-100'"
      aria-live="polite"
    >
      <p class="font-semibold">
        {{ result.valid ? "Tài sản khả dụng đáp ứng yêu cầu." : reasonLabel(result) }}
      </p>
      <dl v-if="result.requiredCash !== undefined" class="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt class="opacity-75">Cần</dt><dd>{{ formatVnd(result.requiredCash) }}</dd></div>
        <div><dt class="opacity-75">Khả dụng</dt><dd>{{ formatVnd(result.availableCash ?? "0") }}</dd></div>
        <div v-if="result.shortfallCash !== undefined" class="sm:col-span-2">
          <dt class="opacity-75">Còn thiếu</dt><dd>{{ formatVnd(result.shortfallCash) }}</dd>
        </div>
      </dl>
      <dl v-else-if="result.requiredQuantity !== undefined" class="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt class="opacity-75">Cần</dt><dd>{{ formatInteger(result.requiredQuantity) }}</dd></div>
        <div><dt class="opacity-75">Có thể bán</dt><dd>{{ formatInteger(result.availableQuantity ?? 0) }}</dd></div>
        <div v-if="result.shortfallQuantity !== undefined" class="sm:col-span-2">
          <dt class="opacity-75">Còn thiếu</dt><dd>{{ formatInteger(result.shortfallQuantity) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
