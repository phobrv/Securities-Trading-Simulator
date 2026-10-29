<script setup lang="ts">
import { computed, ref } from "vue";
import type { OmsOrder, SimulatedEvent } from "./oms.types";

const props = defineProps<{ order: OmsOrder; loading: boolean }>();
const emit = defineEmits<{ simulate: [event: SimulatedEvent] }>();
const quantity = ref(40);
const price = ref("25000");
const inputError = ref<string | null>(null);
const active = computed(() => props.order.status === "NEW" || props.order.status === "PARTIALLY_FILLED");
const waitingCancel = computed(() => props.order.cancelRequestStatus === "PENDING");

function sendExecution(): void {
  if (!Number.isInteger(quantity.value) || quantity.value <= 0 || quantity.value > 4_294_967_295 || !/^[1-9]\d{0,19}$/.test(price.value)) {
    inputError.value = "Giá và khối lượng phải là số nguyên dương hợp lệ.";
    return;
  }
  inputError.value = null;
  emit("simulate", { type: "ExecutionReceived", executionId: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    quantity: quantity.value, price: price.value });
}
</script>

<template>
  <section aria-labelledby="oms-actions-title" class="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
    <h3 id="oms-actions-title" class="font-semibold">Cấp phản hồi mô phỏng</h3>
    <p class="mt-1 text-xs leading-5 text-amber-200">Chỉ thay đổi OMS demo, không gửi lệnh tới matching hoặc giữ tài sản.</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <template v-if="order.status === 'PENDING_NEW'">
        <button type="button" :disabled="loading" class="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50" @click="emit('simulate', { type: 'OrderAccepted' })">Chấp nhận lệnh</button>
        <button type="button" :disabled="loading" class="rounded-md border border-rose-400/50 px-3 py-2 text-sm text-rose-100 hover:bg-rose-400/10 disabled:opacity-50" @click="emit('simulate', { type: 'OrderRejected', reasonCode: 'SIMULATED_REJECTION', message: 'Phản hồi từ chối mô phỏng.' })">Từ chối lệnh</button>
      </template>
      <button v-if="active && !waitingCancel" type="button" :disabled="loading" class="rounded-md border border-amber-300/50 px-3 py-2 text-sm text-amber-100 hover:bg-amber-300/10 disabled:opacity-50" @click="emit('simulate', { type: 'CancelRequested' })">Gửi yêu cầu hủy</button>
      <button v-if="active && waitingCancel" type="button" :disabled="loading" class="rounded-md border border-amber-300/50 px-3 py-2 text-sm text-amber-100 hover:bg-amber-300/10 disabled:opacity-50" @click="emit('simulate', { type: 'CancelConfirmed' })">Xác nhận hủy phần còn lại</button>
      <button v-if="waitingCancel && (active || order.status === 'FILLED')" type="button" :disabled="loading" class="rounded-md border border-rose-400/50 px-3 py-2 text-sm text-rose-100 hover:bg-rose-400/10 disabled:opacity-50" @click="emit('simulate', { type: 'CancelRejected', reasonCode: 'SIMULATED_REJECTION', message: 'Yêu cầu hủy bị từ chối trong mô phỏng.' })">Từ chối yêu cầu hủy</button>
    </div>
    <form v-if="active" class="mt-4 grid gap-3 sm:grid-cols-3" @submit.prevent="sendExecution">
      <label class="grid gap-1 text-xs text-slate-300">Khối lượng khớp mới
        <input v-model.number="quantity" type="number" min="1" :max="order.remainingQuantity" step="1" required class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
      </label>
      <label class="grid gap-1 text-xs text-slate-300">Giá khớp (VND/cổ phiếu)
        <input v-model="price" type="text" inputmode="numeric" pattern="[1-9][0-9]{0,19}" required class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
      </label>
      <button :disabled="loading" type="submit" class="self-end rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">Mô phỏng khớp</button>
      <p v-if="inputError" role="alert" class="text-sm text-rose-200 sm:col-span-3">{{ inputError }}</p>
    </form>
    <p v-if="!active && order.status !== 'PENDING_NEW' && !waitingCancel" class="mt-3 text-sm text-slate-400">Lệnh đã kết thúc, không còn phản hồi mô phỏng hợp lệ.</p>
  </section>
</template>
