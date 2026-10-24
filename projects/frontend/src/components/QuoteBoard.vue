<script setup lang="ts">
import QuoteRow from "@/components/QuoteRow.vue";
import type { QuotesById, Security } from "@/types/market-data";

defineProps<{
  securities: Security[];
  quotesById: QuotesById;
}>();

const columns = [
  "Mã / thị trường",
  "Trạng thái",
  "TC",
  "Trần",
  "Sàn",
  "Mua tốt nhất",
  "KL mua",
  "Giá khớp",
  "KL khớp",
  "Bán tốt nhất",
  "KL bán",
  "Tổng KL",
  "Cập nhật lúc",
];
</script>

<template>
  <div
    class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/70 shadow-2xl"
  >
    <table class="min-w-max w-full border-collapse">
      <thead
        class="bg-slate-900 text-xs uppercase tracking-wide text-slate-400"
      >
        <tr>
          <th
            v-for="column in columns"
            :key="column"
            class="whitespace-nowrap px-4 py-4 text-right font-semibold first:text-left"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <QuoteRow
          v-for="security in securities"
          :key="security.id"
          :security="security"
          :quote="quotesById[security.id]"
        />
      </tbody>
    </table>
  </div>
</template>
