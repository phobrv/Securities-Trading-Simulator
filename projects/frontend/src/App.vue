<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import AccountBalancePanel from "@/components/AccountBalancePanel.vue";
import AvailabilityCheckForm from "@/components/AvailabilityCheckForm.vue";
import ConnectionStatus from "@/components/ConnectionStatus.vue";
import MarketSessionPanel from "@/components/MarketSessionPanel.vue";
import PositionsPanel from "@/components/PositionsPanel.vue";
import QuoteBoard from "@/components/QuoteBoard.vue";
import SimulatorExecutionsPanel from "@/components/SimulatorExecutionsPanel.vue";
import SimulatorOrderBookPanel from "@/components/SimulatorOrderBookPanel.vue";
import OmsDemoPanel from "@/features/oms/OmsDemoPanel.vue";
import { useAccountOverview } from "@/composables/useAccountOverview";
import { useMarketData } from "@/composables/useMarketData";
import { useMarketSession } from "@/composables/useMarketSession";
import { useSimulatorOverview } from "@/composables/useSimulatorOverview";
import type { AvailabilityCheckRequest } from "@/types/account";

const {
  securities,
  quotesById,
  connectionState,
  loading,
  errorMessage,
  start,
  stop,
} = useMarketData();
const {
  session,
  loading: sessionLoading,
  errorMessage: sessionErrorMessage,
  start: startSession,
  stop: stopSession,
} = useMarketSession("SIM_EQ_A");
const selectedAccountId = ref("acc-001");
const {
  balance,
  positions,
  loading: accountLoading,
  errorMessage: accountErrorMessage,
  previewResult,
  previewLoading,
  previewErrorMessage,
  load: loadAccount,
  preview,
} = useAccountOverview();
const {
  orderBook: simulatorOrderBook,
  executions: simulatorExecutions,
  loading: simulatorLoading,
  errorMessage: simulatorErrorMessage,
  start: startSimulator,
  stop: stopSimulator,
} = useSimulatorOverview("sec-001");

const accountOptions = [
  { id: "acc-001", label: "Tài khoản mô phỏng A" },
  { id: "acc-002", label: "Tài khoản mô phỏng B" },
];

function changeAccount(): void {
  void loadAccount(selectedAccountId.value);
}

function checkAvailability(input: AvailabilityCheckRequest): void {
  void preview(selectedAccountId.value, input);
}

onMounted(() => {
  void start();
  void startSession();
  void loadAccount(selectedAccountId.value);
  startSimulator();
});
onUnmounted(() => {
  stop();
  stopSession();
  stopSimulator();
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
    <section class="mx-auto max-w-7xl">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-300">
        DAY 07 · SẢN PHẨM TUẦN 1
      </p>
      <h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Securities Trading Simulator
      </h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Dữ liệu mô phỏng kết hợp bảng giá, trạng thái phiên và tài sản khả dụng.
        </p>
        <p class="mt-3 text-sm font-medium text-amber-200">
          Dữ liệu mô phỏng. Số dư tài khoản chưa cập nhật theo matching.
        </p>

      <div class="mt-10">
        <MarketSessionPanel
          :session="session"
          :loading="sessionLoading"
          :error-message="sessionErrorMessage"
          class="mb-10"
        />
        <OmsDemoPanel class="mb-10" />
        <section class="mb-10" aria-labelledby="account-overview-title">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="account-overview-title" class="text-lg font-semibold">Tài sản tài khoản</h2>
              <p class="mt-1 text-sm text-slate-400">Số dư fixture, chỉ dùng để đọc và kiểm tra thử.</p>
            </div>
            <label class="grid gap-1 text-sm font-medium text-slate-200">
              Chọn tài khoản
              <select v-model="selectedAccountId" class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" @change="changeAccount">
                <option v-for="account in accountOptions" :key="account.id" :value="account.id">
                  {{ account.label }}
                </option>
              </select>
            </label>
          </div>
          <div class="mt-5 grid gap-5 xl:grid-cols-2">
            <AccountBalancePanel :balance="balance" :loading="accountLoading" :error-message="accountErrorMessage" />
            <AvailabilityCheckForm
              :securities="securities"
              :loading="previewLoading"
              :result="previewResult"
              :error-message="previewErrorMessage"
              @submit="checkAvailability"
            />
            <PositionsPanel
              class="xl:col-span-2"
              :positions="positions"
              :loading="accountLoading"
              :error-message="accountErrorMessage"
            />
          </div>
        </section>
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-lg font-semibold">Bảng giá mô phỏng</h2>
          <ConnectionStatus :state="connectionState" />
        </div>

        <p v-if="loading" class="mt-6 text-sm text-slate-400">
          Đang tải danh mục chứng khoán…
        </p>
        <p
          v-else-if="errorMessage"
          class="mt-6 rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"
        >
          {{ errorMessage }}
        </p>
        <QuoteBoard
          v-else
          :securities="securities"
          :quotes-by-id="quotesById"
          class="mt-6"
        />
        <div class="mt-10 grid gap-5 xl:grid-cols-2">
          <SimulatorOrderBookPanel
            :order-book="simulatorOrderBook"
            :loading="simulatorLoading"
            :error-message="simulatorErrorMessage"
          />
          <SimulatorExecutionsPanel
            :executions="simulatorExecutions"
            :loading="simulatorLoading"
            :error-message="simulatorErrorMessage"
          />
        </div>
      </div>
    </section>
  </main>
</template>
