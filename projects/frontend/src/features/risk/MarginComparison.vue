<script setup lang="ts">
import { onMounted, ref } from "vue";
import { simulateMargin } from "@/services/margin-api";
import type { MarginResult } from "./margin.types";

const price = ref(25000);
const quantity = ref(200);
const results = ref<Array<{ scenario: string; result: MarginResult }>>([]);
const loading = ref(false);
const error = ref("");
const money = (value: string | number | null) =>
  value === null ? "—" : BigInt(value).toLocaleString("vi-VN");

async function run() {
  if (
    !Number.isSafeInteger(price.value) ||
    price.value <= 0 ||
    !Number.isSafeInteger(quantity.value) ||
    quantity.value <= 0
  ) {
    error.value = "Giá và số lượng phải là số nguyên dương an toàn.";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const ids = ["scenario-A", "scenario-B", "scenario-A-debt"];
    const values = await Promise.all(
      ids.map((id) => simulateMargin(id, price.value, quantity.value)),
    );
    results.value = ids.map((scenario, index) => ({
      scenario,
      result: values[index]!,
    }));
  } catch (cause) {
    results.value = [];
    error.value =
      cause instanceof Error ? cause.message : "Không thể chạy mô phỏng.";
  } finally {
    loading.value = false;
  }
}
onMounted(() => void run());
</script>

<template>
  <section
    class="mb-10 rounded-xl border border-slate-700 bg-slate-900 p-5"
    aria-labelledby="margin-title"
  >
    <h2 id="margin-title" class="text-lg font-semibold">
      Ngày 12 · Mô phỏng margin
    </h2>
    <p class="mt-2 text-sm text-amber-200">
      Chỉ mô phỏng, không đặt lệnh, giữ tài sản hoặc giải ngân. ALLOW không thay
      thế các kiểm tra đặt lệnh.
    </p>
    <form class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="run">
      <label class="grid gap-1 text-sm"
        >Giá BUY sec-001 (VND)
        <input
          v-model.number="price"
          type="number"
          min="1"
          step="1"
          required
          class="rounded border border-slate-600 bg-slate-950 p-2"
        />
      </label>
      <label class="grid gap-1 text-sm"
        >Số lượng
        <input
          v-model.number="quantity"
          type="number"
          min="1"
          step="1"
          required
          class="rounded border border-slate-600 bg-slate-950 p-2"
        />
      </label>
      <button
        class="rounded bg-cyan-700 px-4 py-2 font-medium hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2"
        :disabled="loading"
      >
        Tính mô phỏng
      </button>
    </form>
    <p v-if="loading" class="mt-4" role="status">Đang tính…</p>
    <p v-else-if="error" class="mt-4 text-rose-300" role="alert">{{ error }}</p>
    <p v-else-if="!results.length" class="mt-4 text-slate-400">
      Chưa có kết quả.
    </p>
    <div v-else class="mt-5 grid gap-5 xl:grid-cols-3">
      <article
        v-for="{ scenario, result } in results"
        :key="scenario"
        class="min-w-0 rounded border border-slate-700 p-4"
      >
        <h3 class="font-semibold">{{ scenario }} · {{ result.decision }}</h3>
        <p class="mt-1 text-xs text-slate-400">
          {{ result.policyCode }} v{{ result.policyVersion }} ·
          {{ result.pricingMode }} · {{ result.evaluatedAt }}
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="mb-2 text-left font-medium">
              Tài sản bảo đảm
            </caption>
            <thead>
              <tr>
                <th>Mã / lượng</th>
                <th>Giá TT / định giá</th>
                <th>Giá trị / năng lực</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in result.collateralBreakdown"
                :key="item.securityId"
                class="border-t border-slate-700 align-top"
              >
                <td class="py-2">
                  {{ item.securityId }}<br />{{
                    item.eligible === null
                      ? "Thiếu policy"
                      : item.eligible
                        ? "Đủ điều kiện"
                        : "Không đủ điều kiện"
                  }}
                  · {{ item.collateralQuantity ?? "—" }}
                </td>
                <td>
                  {{ money(item.marketPrice) }} /
                  {{ money(item.valuationPrice) }}
                </td>
                <td>
                  {{ money(item.recognizedAssetValue) }} /
                  {{ money(item.loanCapacity) }}<br />{{
                    item.collateralRateBps ?? "—"
                  }}
                  bps
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <table class="mt-4 w-full text-left text-sm">
          <caption class="mb-2 text-left font-medium">
            Kiểm tra vốn vay (VND)
          </caption>
          <tbody>
            <tr>
              <th>Tiền khả dụng</th>
              <td>{{ money(result.availableCash) }}</td>
            </tr>
            <tr>
              <th>Năng lực / hạn mức tài khoản</th>
              <td>
                {{ money(result.grossLoanCapacity) }} /
                {{ money(result.accountCreditLimit) }}
              </td>
            </tr>
            <tr>
              <th>Giới hạn hiệu lực − nghĩa vụ</th>
              <td>
                {{ money(result.effectiveLoanLimit) }} −
                {{ money(result.currentExposure) }}
              </td>
            </tr>
            <tr>
              <th>Hạn mức còn lại</th>
              <td>{{ money(result.additionalLoanHeadroom) }}</td>
            </tr>
            <tr>
              <th>Giá trị lệnh / cần vay</th>
              <td>
                {{ money(result.orderValue) }} /
                {{ money(result.requiredLoan) }}
              </td>
            </tr>
            <tr>
              <th>Giới hạn tài trợ lệnh</th>
              <td>{{ money(result.orderFinancingLimit) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-3 text-sm text-amber-200">
          {{
            result.reasonCodes.length
              ? result.reasonCodes.join(", ")
              : "Không có lý do từ chối."
          }}
        </p>
      </article>
    </div>
    <p class="mt-4 text-sm text-slate-400">
      3 triệu tiền mặt + 12 triệu hạn mức không tương đương lệnh 15 triệu: tỷ lệ
      tài trợ 50% giới hạn ngân sách ước tính ở 6 triệu.
    </p>
  </section>
</template>
