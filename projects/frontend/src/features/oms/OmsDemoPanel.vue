<script setup lang="ts">
import { ref, watch } from "vue";
import { useOmsDemo } from "@/composables/useOmsDemo";
import { formatInteger, formatVnd } from "@/features/accounts/formatters";
import OmsActions from "./OmsActions.vue";
import OmsTimeline from "./OmsTimeline.vue";
import type { CancelStatus, OrderStatus } from "./oms.types";

const { order, events, loading, errorMessage, notice, create, load, simulate } = useOmsDemo();
const accountId = ref("acc-001");
const securityId = ref("sec-001");
const side = ref<"BUY" | "SELL">("BUY");
const price = ref("25000");
const quantity = ref(100);
const lookupId = ref("");
const inputError = ref<string | null>(null);

const orderLabels: Record<OrderStatus, string> = {
  PENDING_NEW: "Chờ tiếp nhận", NEW: "Đã được chấp nhận", PARTIALLY_FILLED: "Khớp một phần",
  FILLED: "Khớp hết", CANCELED: "Đã hủy phần còn lại", REJECTED: "Bị từ chối",
};
const cancelLabels: Record<CancelStatus, string> = {
  NONE: "Chưa yêu cầu", PENDING: "Đang chờ phản hồi", ACCEPTED: "Đã xác nhận hủy", REJECTED: "Yêu cầu hủy bị từ chối",
};

watch(() => order.value?.id, (id) => { if (id) lookupId.value = id; });

function createOrder(): void {
  if (!accountId.value.trim() || !securityId.value.trim() || !/^[1-9]\d{0,19}$/.test(price.value) ||
      !Number.isInteger(quantity.value) || quantity.value <= 0 || quantity.value > 4_294_967_295) {
    inputError.value = "Hãy nhập tài khoản, chứng khoán, giá và khối lượng hợp lệ.";
    return;
  }
  inputError.value = null;
  void create({ accountId: accountId.value.trim(), securityId: securityId.value.trim(), side: side.value,
    orderType: "LO", price: price.value, quantity: quantity.value });
}

function lookupOrder(): void {
  if (!lookupId.value.trim()) {
    inputError.value = "Hãy nhập mã lệnh OMS.";
    return;
  }
  inputError.value = null;
  void load(lookupId.value.trim());
}
</script>

<template>
  <section class="rounded-xl border border-cyan-300/30 bg-slate-900/70 p-5 shadow-sm sm:p-6" aria-labelledby="oms-demo-title">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-widest text-cyan-300">NGÀY 08 · OMS DEMO</p>
        <h2 id="oms-demo-title" class="mt-2 text-xl font-semibold">Vòng đời lệnh</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Theo dõi lệnh và phản hồi hủy riêng biệt. OMS demo không kết nối sổ lệnh hoặc tài sản.</p>
      </div>
      <span class="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">Dữ liệu mô phỏng</span>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <div class="space-y-5">
        <form class="grid gap-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4 sm:grid-cols-2" @submit.prevent="createOrder">
          <h3 class="font-semibold sm:col-span-2">Tạo lệnh demo</h3>
          <label class="grid gap-1 text-xs text-slate-300">Mã tài khoản
            <input v-model="accountId" required maxlength="36" class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </label>
          <label class="grid gap-1 text-xs text-slate-300">Mã chứng khoán
            <input v-model="securityId" required maxlength="36" class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </label>
          <label class="grid gap-1 text-xs text-slate-300">Phía · lệnh LO
            <select v-model="side" class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"><option value="BUY">Mua</option><option value="SELL">Bán</option></select>
          </label>
          <label class="grid gap-1 text-xs text-slate-300">Giá giới hạn (VND/cổ phiếu)
            <input v-model="price" type="text" inputmode="numeric" pattern="[1-9][0-9]{0,19}" required class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </label>
          <label class="grid gap-1 text-xs text-slate-300">Khối lượng
            <input v-model.number="quantity" type="number" min="1" max="4294967295" step="1" required class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </label>
          <button type="submit" :disabled="loading" class="self-end rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">Tạo lệnh demo</button>
        </form>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="lookupOrder">
          <label class="grid min-w-0 flex-1 gap-1 text-xs text-slate-300">Tra cứu mã lệnh OMS
            <input v-model="lookupId" maxlength="36" required placeholder="Nhập mã lệnh" class="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          </label>
          <button type="submit" :disabled="loading" class="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">Tra cứu / làm mới</button>
        </form>
        <p v-if="inputError" role="alert" class="text-sm text-rose-200">{{ inputError }}</p>
        <p v-if="loading" role="status" class="text-sm text-slate-300">Đang xử lý yêu cầu OMS…</p>
        <p v-if="errorMessage" role="alert" class="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">{{ errorMessage }} Hãy tra cứu lại lệnh trước khi gửi lại phản hồi.</p>
        <p v-if="notice" role="status" class="text-sm text-emerald-200">{{ notice }}</p>
        <OmsActions v-if="order" :key="order.id" :order="order" :loading="loading" @simulate="simulate" />
      </div>

      <div class="space-y-6">
        <div v-if="order" class="rounded-lg border border-slate-700 bg-slate-950/50 p-4" aria-live="polite">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <h3 class="font-semibold">Trạng thái hiện tại</h3>
            <span class="text-xs text-slate-400">Version {{ order.version }}</span>
          </div>
          <p class="mt-2 break-all text-xs text-slate-400">Mã lệnh: {{ order.id }}</p>
          <dl class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><dt class="text-slate-400">Lệnh</dt><dd class="mt-1 font-semibold text-cyan-200">{{ orderLabels[order.status] }} <span class="text-xs text-slate-400">({{ order.status }})</span></dd></div>
            <div><dt class="text-slate-400">Yêu cầu hủy</dt><dd class="mt-1 font-semibold text-amber-200">{{ cancelLabels[order.cancelRequestStatus] }} <span class="text-xs text-slate-400">({{ order.cancelRequestStatus }})</span></dd></div>
            <div><dt class="text-slate-400">Lệnh LO</dt><dd class="mt-1">{{ order.side === 'BUY' ? 'Mua' : 'Bán' }} {{ formatVnd(order.price) }}/cp</dd></div>
            <div><dt class="text-slate-400">Đã khớp / yêu cầu</dt><dd class="mt-1">{{ formatInteger(order.filledQuantity) }} / {{ formatInteger(order.quantity) }}</dd></div>
            <div><dt class="text-slate-400">Còn lại</dt><dd class="mt-1">{{ formatInteger(order.remainingQuantity) }}</dd></div>
            <div><dt class="text-slate-400">Đã hủy</dt><dd class="mt-1">{{ formatInteger(order.canceledQuantity) }}</dd></div>
          </dl>
        </div>
        <p v-else class="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">Tạo lệnh demo hoặc tra cứu mã lệnh để xem trạng thái và timeline.</p>
        <OmsTimeline :events="events" :loading="loading" />
      </div>
    </div>
  </section>
</template>
