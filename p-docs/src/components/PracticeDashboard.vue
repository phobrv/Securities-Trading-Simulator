<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

type Status =
  "in_progress" | "ready" | "awaiting_grade" | "passed" | "needs_review";
type Attempt = {
  id: number;
  title: string;
  version: number;
  status: Status;
  answered: number;
  total: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  evaluations_count: number;
};
type Criterion = {
  question_id: string;
  score: number;
  evidence: string;
  feedback: string;
};
type Detail = Attempt & {
  scenario: string;
  questions: {
    id: string;
    number: number;
    prompt: string | null;
    answer: string | null;
    updated_at: string | null;
  }[];
  evaluations: {
    id: number;
    grader: string;
    passed: boolean;
    created_at: string;
    result: { summary: string; criteria: Criterion[] };
  }[];
};

const labels: Record<Status, string> = {
  in_progress: "Đang làm dở",
  ready: "Đủ câu, chưa nộp",
  awaiting_grade: "Đã nộp, chờ chấm",
  passed: "Đã chấm · Đạt",
  needs_review: "Đã chấm · Cần củng cố",
};
const attempts = ref<Attempt[]>([]);
const detail = ref<Detail | null>(null);
const status = ref("all");
const search = ref("");
const loading = ref(false);
const error = ref("");
const copied = ref("");
const busy = ref(false);
const drafts = ref<Record<string, string>>({});
const editing = ref<string | null>(null);
const filtered = computed(() =>
  attempts.value.filter(
    (item) =>
      (status.value === "all" || item.status === status.value) &&
      String(item.id).includes(search.value.trim()),
  ),
);

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Practice-Client": "p-docs",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error ??
        "Không thể kết nối API luyện tập. Hãy khởi động API cục bộ.",
    );
  return data as T;
}

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const result = await request<{ attempts: Attempt[] }>(
      "/api/practice/attempts",
    );
    attempts.value = result.attempts;
    if (detail.value)
      detail.value = await request<Detail>(
        `/api/practice/attempts/${detail.value.id}`,
      );
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message !== "Failed to fetch"
        ? cause.message
        : "Không kết nối được API luyện tập. Từ thư mục p-docs, hãy chạy python3 ../practice/server.py và làm mới.";
  } finally {
    loading.value = false;
  }
}

async function open(item: Attempt) {
  error.value = "";
  try {
    detail.value = await request<Detail>(`/api/practice/attempts/${item.id}`);
    drafts.value = {};
    editing.value = null;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Không thể tải lượt luyện tập.";
  }
}

async function mutate(path: string, body: object, attemptId?: number) {
  busy.value = true;
  error.value = "";
  try {
    const result = await request<{ attempt_id: number }>(path, body);
    const id = attemptId ?? result.attempt_id;
    detail.value = await request<Detail>(`/api/practice/attempts/${id}`);
    attempts.value = (
      await request<{ attempts: Attempt[] }>("/api/practice/attempts")
    ).attempts;
    return true;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Không thể lưu dữ liệu luyện tập.";
    return false;
  } finally {
    busy.value = false;
  }
}

async function start(testId: string) {
  drafts.value = {};
  editing.value = null;
  await mutate("/api/practice/attempts", { test_id: testId });
}

async function saveAnswer(question: Detail["questions"][number]) {
  if (!detail.value) return;
  const answer = drafts.value[question.id] ?? "";
  if (!answer.trim()) {
    error.value = "Câu trả lời không được để trống.";
    return;
  }
  if (
    await mutate(
      `/api/practice/attempts/${detail.value.id}/answer`,
      { question_id: question.id, answer },
      detail.value.id,
    )
  ) {
    delete drafts.value[question.id];
    editing.value = null;
  }
}

async function submit() {
  if (
    !detail.value ||
    !window.confirm("Nộp bài? Bạn sẽ không thể sửa câu trả lời sau khi nộp.")
  )
    return;
  await mutate(
    `/api/practice/attempts/${detail.value.id}/submit`,
    {},
    detail.value.id,
  );
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = `Đã sao chép ${value}`;
  } catch {
    copied.value = `Không thể sao chép tự động. Hãy sao chép: ${value}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("vi-VN");
}
function onVisible() {
  if (document.visibilityState === "visible") void refresh();
}
onMounted(() => {
  void refresh();
  document.addEventListener("visibilitychange", onVisible);
});
onUnmounted(() => document.removeEventListener("visibilitychange", onVisible));
</script>

<template>
  <section class="mx-auto max-w-screen-2xl text-slate-800">
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">
        Bài luyện tập
      </h1>
      <button
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? "Đang tải…" : "Làm mới" }}
      </button>
    </header>

    <p
      v-if="error"
      role="alert"
      class="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      {{ error }}
    </p>
    <p v-if="copied" role="status" class="mb-5 text-sm text-emerald-700">
      {{ copied }}
    </p>

    <template v-if="!detail">
      <div class="grid gap-8 md:grid-cols-[1fr_2fr]">
        <section aria-labelledby="practice-tests-heading" class="min-w-0">
          <h2
            id="practice-tests-heading"
            class="mb-4 text-lg font-bold text-slate-900"
          >
            Danh sách bài luyện tập
          </h2>
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" class="px-4 py-3">Bài luyện tập</th>
                  <th scope="col" class="px-4 py-3">Số câu</th>
                  <th scope="col" class="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr>
                  <th
                    scope="row"
                    class="px-4 py-3 font-semibold text-slate-900"
                  >
                    Bài luyện tập buổi 01
                  </th>
                  <td class="px-4 py-3">3</td>
                  <td class="px-4 py-3">
                    <button
                      class="whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      :disabled="busy"
                      @click="start('01')"
                      aria-label="Bắt đầu bài luyện tập buổi 01"
                    >
                      Bắt đầu
                    </button>
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    class="px-4 py-3 font-semibold text-slate-900"
                  >
                    Bài dài buổi 01
                  </th>
                  <td class="px-4 py-3">10</td>
                  <td class="px-4 py-3">
                    <button
                      class="whitespace-nowrap rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      :disabled="busy"
                      @click="start('01-long')"
                      aria-label="Bắt đầu bài dài buổi 01"
                    >
                      Bắt đầu
                    </button>
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    class="px-4 py-3 font-semibold text-slate-900"
                  >
                    Bài luyện tập buổi 02
                  </th>
                  <td class="px-4 py-3">5</td>
                  <td class="px-4 py-3">
                    <button
                      class="whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      :disabled="busy"
                      @click="start('02')"
                      aria-label="Bắt đầu bài luyện tập buổi 02"
                    >
                      Bắt đầu
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="practice-attempts-heading" class="min-w-0">
          <h2
            id="practice-attempts-heading"
            class="mb-4 text-lg font-bold text-slate-900"
          >
            Các lượt đã luyện tập
          </h2>
          <div class="mb-5 flex flex-wrap gap-3">
            <label class="text-sm text-slate-600"
              >Tìm ID
              <input
                v-model="search"
                class="ml-2 w-28 rounded-lg border border-slate-300 px-3 py-2"
                inputmode="numeric"
                placeholder="Ví dụ: 12"
            /></label>
            <label class="text-sm text-slate-600"
              >Trạng thái
              <select
                v-model="status"
                class="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="all">Tất cả</option>
                <option v-for="(label, key) in labels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select></label
            >
          </div>
          <div
            v-if="!loading && !error && !attempts.length"
            class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"
          >
            Chưa có lượt luyện tập. Bắt đầu bài luyện tập buổi 01 để làm bài.
          </div>
          <p
            v-else-if="!loading && !error && !filtered.length"
            class="py-8 text-center text-sm text-slate-500"
          >
            Không có lượt phù hợp với bộ lọc.
          </p>
          <div
            v-else-if="filtered.length"
            class="overflow-x-auto rounded-xl border border-slate-200"
          >
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" class="px-4 py-3">Lượt</th>
                  <th scope="col" class="px-4 py-3">Bài luyện tập</th>
                  <th scope="col" class="px-4 py-3">Trạng thái</th>
                  <th scope="col" class="px-4 py-3">Tiến độ</th>
                  <th scope="col" class="px-4 py-3">Đề</th>
                  <th scope="col" class="px-4 py-3">Cập nhật</th>
                  <th scope="col" class="px-4 py-3">Lần chấm</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  v-for="item in filtered"
                  :key="item.id"
                  class="hover:bg-slate-50"
                >
                  <td class="whitespace-nowrap px-4 py-3">
                    <button
                      class="font-semibold text-emerald-700 hover:underline"
                      :aria-label="`Xem lượt luyện tập ${item.id}: ${item.title}`"
                      @click="open(item)"
                    >
                      #{{ item.id }}
                    </button>
                  </td>
                  <th
                    scope="row"
                    class="px-4 py-3 font-semibold text-slate-900"
                  >
                    {{ item.title }}
                  </th>
                  <td class="px-4 py-3">{{ labels[item.status] }}</td>
                  <td class="whitespace-nowrap px-4 py-3">
                    {{ item.answered }}/{{ item.total }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    v{{ item.version }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    {{ formatDate(item.updated_at) }}
                  </td>
                  <td class="px-4 py-3">{{ item.evaluations_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <button
        class="mb-5 text-sm font-semibold text-emerald-700 hover:underline"
        @click="
          detail = null;
          copied = '';
        "
      >
        ← Danh sách lượt luyện tập
      </button>
      <div class="rounded-xl border border-slate-200 p-5">
        <div class="flex flex-wrap justify-between gap-3">
          <div>
            <p class="text-xs font-bold text-emerald-700">
              LƯỢT #{{ detail.id }} · ĐỀ V{{ detail.version }}
            </p>
            <h2 class="mt-1 text-xl font-bold">{{ detail.title }}</h2>
          </div>
          <span
            class="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"
            >{{ labels[detail.status] }}</span
          >
        </div>
        <p class="mt-3 text-sm text-slate-500">
          {{ detail.answered }}/{{ detail.total }} câu · Bắt đầu
          {{ formatDate(detail.created_at) }} · Cập nhật
          {{ formatDate(detail.updated_at) }}
        </p>
        <p class="mt-4 whitespace-pre-wrap text-sm leading-6">
          {{ detail.scenario }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-if="detail.status === 'ready'"
            class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            :disabled="busy || editing !== null"
            @click="submit"
          >
            Nộp bài</button
          ><button
            v-if="
              detail.status === 'awaiting_grade' ||
              detail.status === 'passed' ||
              detail.status === 'needs_review'
            "
            class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            @click="copy(`/practice-grade ${detail.id}`)"
          >
            Sao chép lệnh
            {{ detail.status === "awaiting_grade" ? "chấm" : "chấm lại" }}
          </button>
        </div>
        <p
          v-if="detail.status === 'awaiting_grade'"
          class="mt-3 text-sm text-slate-600"
        >
          Mở OpenCode tại thư mục p-docs và chạy
          <code>/practice-grade {{ detail.id }}</code
          >, sau đó làm mới trang để xem kết quả.
        </p>
      </div>
      <h3 class="mb-3 mt-8 text-lg font-bold">Câu hỏi và câu trả lời</h3>
      <div class="grid gap-3">
        <article
          v-for="question in detail.questions"
          :key="question.id"
          class="rounded-xl border border-slate-200 p-5"
        >
          <p class="text-xs font-bold text-slate-500">
            CÂU {{ question.number }}
          </p>
          <p v-if="question.prompt" class="mt-2 font-semibold leading-6">
            {{ question.prompt }}
          </p>
          <p v-else class="mt-2 text-sm italic text-slate-400">
            Câu hỏi chưa được mở trong lượt này.
          </p>
          <template
            v-if="
              (detail.status === 'in_progress' || detail.status === 'ready') &&
              question.prompt &&
              (question.answer === null || editing === question.id)
            "
          >
            <label
              :for="`answer-${question.id}`"
              class="mt-3 block text-sm font-semibold"
              >Câu trả lời</label
            >
            <textarea
              :id="`answer-${question.id}`"
              v-model="drafts[question.id]"
              rows="5"
              class="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
              placeholder="Nhập câu trả lời của bạn"
            ></textarea>
            <div class="mt-2 flex gap-2">
              <button
                class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="busy"
                @click="saveAnswer(question)"
              >
                Lưu câu trả lời</button
              ><button
                v-if="question.answer !== null"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                :disabled="busy"
                @click="
                  editing = null;
                  delete drafts[question.id];
                "
              >
                Hủy sửa
              </button>
            </div>
          </template>
          <template v-else
            ><div
              v-if="question.answer !== null"
              class="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6"
            >
              {{ question.answer }}
            </div>
            <p v-else class="mt-3 text-sm text-slate-400">Chưa trả lời</p>
            <button
              v-if="
                question.answer !== null &&
                (detail.status === 'in_progress' || detail.status === 'ready')
              "
              class="mt-2 text-sm font-semibold text-emerald-700 hover:underline"
              :disabled="busy"
              @click="
                editing = question.id;
                drafts[question.id] = question.answer;
              "
            >
              Sửa câu trả lời
            </button></template
          >
          <p v-if="question.updated_at" class="mt-2 text-xs text-slate-400">
            Đã lưu {{ formatDate(question.updated_at) }}
          </p>
        </article>
      </div>
      <h3 class="mb-3 mt-8 text-lg font-bold">Lịch sử chấm</h3>
      <p
        v-if="!detail.evaluations.length"
        class="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500"
      >
        Chưa có kết quả chấm.
      </p>
      <article
        v-for="evaluation in detail.evaluations"
        :key="evaluation.id"
        class="mb-3 rounded-xl border border-slate-200 p-5"
      >
        <div class="flex flex-wrap justify-between gap-2">
          <strong
            >{{ evaluation.passed ? "Đạt" : "Cần củng cố" }} ·
            {{
              evaluation.result.criteria.reduce(
                (sum, item) => sum + item.score,
                0,
              )
            }}/{{ evaluation.result.criteria.length * 2 }}</strong
          ><span class="text-xs text-slate-500"
            >{{ formatDate(evaluation.created_at) }} ·
            {{ evaluation.grader }}</span
          >
        </div>
        <p class="mt-3 whitespace-pre-wrap text-sm">
          {{ evaluation.result.summary }}
        </p>
        <div
          v-for="criterion in evaluation.result.criteria"
          :key="criterion.question_id"
          class="mt-4 border-t border-slate-100 pt-3 text-sm"
        >
          <strong>{{ criterion.question_id }} · {{ criterion.score }}/2</strong>
          <p class="mt-1 whitespace-pre-wrap">{{ criterion.feedback }}</p>
          <p class="mt-1 whitespace-pre-wrap text-slate-500">
            Bằng chứng: {{ criterion.evidence }}
          </p>
        </div>
      </article>
    </template>
  </section>
</template>
