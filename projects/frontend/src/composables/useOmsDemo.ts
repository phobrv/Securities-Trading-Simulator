import { ref } from "vue";
import { createOmsOrder, fetchOmsEvents, fetchOmsOrder, simulateOmsEvent } from "@/services/oms-api";
import type { OmsEvent, OmsOrder, OmsOrderInput, SimulatedEvent } from "@/features/oms/oms.types";

export function useOmsDemo() {
  const order = ref<OmsOrder | null>(null);
  const events = ref<OmsEvent[] | null>(null);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);
  const notice = ref<string | null>(null);

  async function run(action: () => Promise<void>): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    errorMessage.value = null;
    notice.value = null;
    try {
      await action();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Không thể thực hiện yêu cầu OMS.";
    } finally {
      loading.value = false;
    }
  }

  async function loadEvents(id: string): Promise<void> {
    events.value = null;
    try {
      events.value = await fetchOmsEvents(id);
    } catch (error) {
      throw new Error(`Đã tải lệnh nhưng chưa tải được timeline: ${error instanceof Error ? error.message : "Lỗi kết nối."}`);
    }
  }

  function create(input: OmsOrderInput): Promise<void> {
    return run(async () => {
      const created = await createOmsOrder(input);
      order.value = created;
      notice.value = "Đã ghi nhận yêu cầu; lệnh đang chờ phản hồi tiếp nhận.";
      await loadEvents(created.id);
    });
  }

  function load(id: string): Promise<void> {
    return run(async () => {
      const result = await fetchOmsOrder(id);
      order.value = result;
      await loadEvents(result.id);
    });
  }

  function simulate(event: SimulatedEvent): Promise<void> {
    const id = order.value?.id;
    if (!id) return Promise.resolve();
    return run(async () => {
      order.value = await simulateOmsEvent(id, event);
      notice.value = "Đã áp dụng phản hồi mô phỏng.";
      await loadEvents(id);
    });
  }

  return { order, events, loading, errorMessage, notice, create, load, simulate };
}
