<script setup lang="ts">
import { computed } from "vue";
import type { OmsEvent } from "./oms.types";

const props = defineProps<{ events: OmsEvent[] | null; loading: boolean }>();

const entries = computed(() => {
  let quantity = 0;
  let filled = 0;
  return (props.events ?? []).map((event) => {
    let label: string;
    switch (event.eventType) {
      case "OrderReceived":
        quantity = Number(event.payload.quantity);
        label = `Đã ghi nhận yêu cầu ${quantity} cổ phiếu`;
        break;
      case "OrderAccepted": label = "Đã được chấp nhận"; break;
      case "OrderRejected": label = "Yêu cầu tạo lệnh bị từ chối"; break;
      case "ExecutionReceived": {
        const amount = Number(event.payload.quantity);
        filled += amount;
        label = `Đã khớp thêm ${amount} tại ${String(event.payload.price)} VND/cổ phiếu · tổng ${filled}/${quantity}`;
        break;
      }
      case "CancelRequested": label = "Đang chờ phản hồi hủy"; break;
      case "CancelConfirmed": label = `Đã hủy ${quantity - filled} còn lại`; break;
      case "CancelRejected": label = "Yêu cầu hủy bị từ chối"; break;
      default: label = event.eventType;
    }
    return { ...event, label };
  });
});

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
</script>

<template>
  <section aria-labelledby="oms-timeline-title">
    <h3 id="oms-timeline-title" class="text-base font-semibold">Timeline lệnh</h3>
    <p v-if="events === null" class="mt-3 text-sm text-slate-400">
      {{ loading ? "Đang tải timeline…" : "Chưa có timeline để hiển thị." }}
    </p>
    <p v-else-if="events.length === 0" class="mt-3 text-sm text-slate-400">Chưa có sự kiện.</p>
    <ol v-else class="mt-3 space-y-3 border-l border-slate-700 pl-4">
      <li v-for="entry in entries" :key="entry.id" class="text-sm">
        <p class="font-medium text-slate-100"><span class="mr-2 text-cyan-300">#{{ entry.eventSequence }}</span>{{ entry.label }}</p>
        <p class="mt-1 text-xs text-slate-400">{{ formatTime(entry.occurredAt) }} · {{ entry.eventType }}</p>
        <p v-if="entry.reasonCode" class="mt-1 text-xs text-amber-200">
          {{ entry.reasonCode }}<template v-if="typeof entry.payload.message === 'string'"> · {{ entry.payload.message }}</template>
        </p>
      </li>
    </ol>
  </section>
</template>
