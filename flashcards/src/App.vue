<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { cards, topics } from './cards'
import { useFlashcards } from './composables/useFlashcards'

const { topic, search, statusFilter, index, revealed, progress, storageError, filtered, current, learned, review, move, mark, shuffle } = useFlashcards()

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, select, textarea, button, a, [contenteditable="true"]')) return
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
  if (event.key === ' ' && current.value) { event.preventDefault(); revealed.value = !revealed.value }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-[#dfe4d9] bg-[#f9faf5]">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="./" class="flex items-center gap-3 text-[#183b2e] no-underline" aria-label="Stocknotes, trang chủ">
          <span class="brand-icon">✳</span><span class="text-xl font-extrabold tracking-[-0.06em]">stocknotes<span class="text-[#85a58f]">.</span></span>
        </a>
        <span class="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#829185] sm:inline">Một chút mỗi ngày, hiểu thêm thị trường</span>
        <span class="rounded-full border border-[#dce6d9] bg-white px-3 py-1.5 text-xs font-bold text-[#50735a]">BỘ THẺ 01</span>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div class="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p class="eyebrow mb-3"><span class="mr-2 text-[#e59b55]">✦</span> GÓC HỌC TẬP CỦA BẠN</p>
          <h1 class="heading text-4xl sm:text-5xl">Hiểu chứng khoán,<br /><span class="text-[#7b9c7d]">từng thẻ một.</span></h1>
          <p class="mt-4 max-w-xl text-sm leading-7 text-[#78877a] sm:text-base">Những khái niệm tưởng chừng phức tạp, giờ trở nên dễ nhớ hơn mỗi ngày.</p>
        </div>
        <div class="flex gap-3">
          <div class="stat"><strong>{{ cards.length }}</strong><span>THẺ KIẾN THỨC</span></div>
          <div class="stat"><strong>{{ learned }}</strong><span>ĐÃ THUỘC</span></div>
        </div>
      </div>

      <div class="grid items-start gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside class="sidebar">
          <div class="mb-5 flex items-center justify-between"><h2 class="section-label">CHỦ ĐỀ</h2><span class="text-xs text-[#a1aea2]">{{ topics.length }} chủ đề</span></div>
          <nav aria-label="Chọn chủ đề" class="flex flex-wrap gap-2 lg:flex-col">
            <button v-for="(item, i) in ['Tất cả', ...topics]" :key="item" type="button" :class="['topic-button', { active: topic === item }]" :aria-pressed="topic === item" @click="topic = item">
              <span class="topic-symbol">{{ ['◈', '◌', '↗', '⇄', '▣', '◷', '⚙'][i] }}</span><span class="flex-1 text-left">{{ item }}</span><span class="topic-count">{{ item === 'Tất cả' ? cards.length : cards.filter(card => card.topic === item).length }}</span>
            </button>
          </nav>
          <div class="mt-8 border-t border-[#e8ece4] pt-6">
            <p class="section-label mb-4">TIẾN ĐỘ CỦA BẠN</p>
            <div class="mb-2 flex justify-between text-xs font-semibold text-[#687b6a]"><span>Đã ghi nhớ</span><span>{{ learned }}/{{ cards.length }}</span></div>
            <div class="h-1.5 overflow-hidden rounded-full bg-[#e9eee6]"><div class="h-full rounded-full bg-[#7fa883]" :style="{ width: `${learned / cards.length * 100}%` }"></div></div>
            <p class="mt-3 text-xs leading-5 text-[#9aa89a]">{{ review }} thẻ cần ôn lại. Cứ từ từ, bạn đang làm rất tốt!</p>
          </div>
        </aside>

        <section aria-label="Ôn tập flashcard" class="min-w-0">
          <div class="mb-5 flex flex-col gap-3 sm:flex-row">
            <label class="search-field"><span aria-hidden="true" class="text-lg">⌕</span><span class="sr-only">Tìm kiếm thẻ</span><input v-model="search" placeholder="Tìm một khái niệm..." type="search" /></label>
            <label class="sr-only" for="status-filter">Lọc theo tiến độ</label>
            <select id="status-filter" v-model="statusFilter" class="select-field"><option value="all">Tất cả trạng thái</option><option value="new">Chưa đánh dấu</option><option value="review">Cần ôn lại</option><option value="learned">Đã thuộc</option></select>
            <button class="shuffle-button" type="button" @click="shuffle"><span aria-hidden="true">⤨</span> Xáo trộn</button>
          </div>

          <div class="mb-4 flex items-center justify-between gap-3"><div><p class="section-label">ĐANG ÔN TẬP</p><h2 class="mt-1 text-xl font-bold tracking-tight text-[#274636]">{{ topic }}</h2></div><span class="text-sm font-semibold text-[#96a399]">{{ filtered.length ? index + 1 : 0 }} <span class="mx-1 text-[#c7d1c5]">/</span> {{ filtered.length }}</span></div>

          <div v-if="current" class="flashcard">
            <div class="flex items-center justify-between gap-3"><span class="card-tag">{{ current.topic }}</span><span class="text-xs font-bold tracking-widest text-[#a6b6a4]">{{ String(index + 1).padStart(2, '0') }} / {{ String(filtered.length).padStart(2, '0') }}</span></div>
            <button type="button" class="card-content" :aria-label="revealed ? 'Ẩn đáp án' : 'Hiện đáp án'" @click="revealed = !revealed">
              <span class="card-sparkle" aria-hidden="true">✳</span>
              <span class="mb-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9cae98]">{{ revealed ? 'ĐÁP ÁN' : 'CÂU HỎI' }}</span>
              <span v-if="!revealed" class="question-text">{{ current.question }}</span>
              <span v-else class="answer-text">{{ current.answer }}<span v-if="current.example" class="example-text">{{ current.example }}</span></span>
              <span class="mt-7 text-xs font-semibold text-[#9bad9c]">{{ revealed ? '↻ Nhấn để xem câu hỏi' : '↻ Nhấn để lật thẻ' }}</span>
            </button>
            <div class="flex flex-wrap items-end justify-between gap-2 border-t border-[#e8eee2] pt-4"><p class="text-xs text-[#9aab99]">Nguồn: <span class="font-medium text-[#6f8971]">p-docs/docs/{{ current.source }}</span></p><span v-if="progress[current.id]" class="text-xs font-bold text-[#749578]">{{ progress[current.id] === 'learned' ? '✓ Đã thuộc' : '↺ Cần ôn lại' }}</span></div>
          </div>
          <div v-else class="empty-state"><span class="text-3xl">⌕</span><h3 class="mt-3 font-bold">Không tìm thấy thẻ phù hợp</h3><p class="mt-2 text-sm">Thử đổi từ khóa, chủ đề hoặc trạng thái nhé.</p></div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex gap-2"><button class="nav-button" type="button" :disabled="!current" aria-label="Thẻ trước" @click="move(-1)">←</button><button class="nav-button" type="button" :disabled="!current" aria-label="Thẻ tiếp theo" @click="move(1)">→</button></div>
            <div class="flex flex-wrap gap-2"><button class="review-button" type="button" :disabled="!current" @click="mark('review')">↺ &nbsp;Cần ôn lại</button><button class="learned-button" type="button" :disabled="!current" @click="mark('learned')">✓ &nbsp;Đã thuộc</button></div>
          </div>
          <p v-if="storageError" role="alert" class="mt-4 text-sm text-red-700">Không thể lưu tiến độ trên trình duyệt này; thay đổi chỉ có hiệu lực trong phiên hiện tại.</p>
          <p class="mt-6 text-center text-xs text-[#a6b1a4]">Dùng phím <kbd>←</kbd> <kbd>→</kbd> để chuyển thẻ · <kbd>Space</kbd> để lật thẻ</p>
        </section>
      </div>
      <footer class="mt-14 border-t border-[#e2e8dd] pt-6 text-center text-xs leading-6 text-[#9aaa9b]">Được tạo ra để học, không phải để tư vấn đầu tư.<br />Kiến thức và quy tắc mô phỏng không thay thế quy định thị trường thực tế.</footer>
    </main>
  </div>
</template>
