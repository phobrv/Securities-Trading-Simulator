import { ref } from "vue";

import {
  fetchAccountBalance,
  fetchAccountPositions,
  previewAccountAvailability,
} from "@/services/account-api";
import type {
  AccountBalance,
  AccountPosition,
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
} from "@/types/account";

export function useAccountOverview() {
  const balance = ref<AccountBalance | null>(null);
  const positions = ref<AccountPosition[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);
  const previewResult = ref<AvailabilityCheckResult | null>(null);
  const previewLoading = ref(false);
  const previewErrorMessage = ref<string | null>(null);
  let loadSequence = 0;

  async function load(accountId: string): Promise<void> {
    const sequence = ++loadSequence;
    loading.value = true;
    errorMessage.value = null;
    previewResult.value = null;
    previewErrorMessage.value = null;

    try {
      const [nextBalance, nextPositions] = await Promise.all([
        fetchAccountBalance(accountId),
        fetchAccountPositions(accountId),
      ]);
      if (sequence !== loadSequence) {
        return;
      }

      balance.value = nextBalance;
      positions.value = nextPositions;
    } catch {
      if (sequence === loadSequence) {
        balance.value = null;
        positions.value = [];
        errorMessage.value = "Không thể tải số dư tài khoản.";
      }
    } finally {
      if (sequence === loadSequence) {
        loading.value = false;
      }
    }
  }

  async function preview(
    accountId: string,
    input: AvailabilityCheckRequest,
  ): Promise<void> {
    previewLoading.value = true;
    previewErrorMessage.value = null;
    previewResult.value = null;

    try {
      previewResult.value = await previewAccountAvailability(accountId, input);
    } catch {
      previewErrorMessage.value = "Không thể kiểm tra tài sản vào lúc này.";
    } finally {
      previewLoading.value = false;
    }
  }

  return {
    balance,
    positions,
    loading,
    errorMessage,
    previewResult,
    previewLoading,
    previewErrorMessage,
    load,
    preview,
  };
}
