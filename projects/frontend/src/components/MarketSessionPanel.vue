<script setup lang="ts">
import { computed } from "vue";

import type { MarketSession, MarketSessionState } from "@/types/market-session";

const props = defineProps<{
  session: MarketSession | null;
  loading: boolean;
  errorMessage: string | null;
}>();

const stateLabelByCode: Record<MarketSessionState, string> = {
  PRE_OPEN: "Trước giờ mở cửa",
  OPENING_AUCTION: "Định kỳ mở cửa",
  CONTINUOUS: "Khớp lệnh liên tục",
  BREAK: "Nghỉ trưa",
  CLOSING_AUCTION: "Định kỳ đóng cửa",
  CLOSED: "Đóng cửa",
};

const sessionLabel = computed(() =>
  props.session ? stateLabelByCode[props.session.state] : "—",
);
</script>

<template>
  <section
    class="rounded-xl border border-cyan-300/20 bg-slate-900/70 p-5 shadow-sm"
    aria-labelledby="market-session-title"
  >
    <h2 id="market-session-title" class="text-lg font-semibold">
      Phiên giao dịch
    </h2>
    <p v-if="loading" class="mt-3 text-sm text-slate-400">
      Đang tải trạng thái phiên…
    </p>
    <p
      v-else-if="errorMessage"
      class="mt-3 rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <dl v-else-if="session" class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-slate-400">Thị trường</dt>
        <dd class="mt-1 font-medium text-slate-100">
          {{ session.marketCode }}
        </dd>
      </div>
      <div>
        <dt class="text-slate-400">Ngày phiên</dt>
        <dd class="mt-1 font-medium text-slate-100">{{ session.tradingDate }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Phiên</dt>
        <dd class="mt-1 font-medium text-cyan-200">{{ sessionLabel }}</dd>
      </div>
      <div>
        <dt class="text-slate-400">Loại lệnh được nhận</dt>
        <dd class="mt-1 font-medium text-slate-100">
          {{ session.allowedOrderTypes.join(", ") || "Không nhận lệnh" }}
        </dd>
      </div>
      <div>
        <dt class="text-slate-400">Đồng hồ</dt>
        <dd class="mt-1 font-medium text-slate-100">
          {{ session.clockMode === "FIXED" ? "Giả lập" : "Hệ thống" }}
        </dd>
      </div>
    </dl>
  </section>
</template>
