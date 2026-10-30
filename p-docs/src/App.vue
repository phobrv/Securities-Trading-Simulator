<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import PracticeDashboard from './components/PracticeDashboard.vue'

type DocumentItem = {
  id: string
  path: string
  title: string
  source: string
}

type TableOfContentsItem = {
  id: string
  label: string
  level: number
}

type NavigationGroup = {
  label: string
  documents: DocumentItem[]
}

const modules = import.meta.glob(['../docs/**/*.md', '../archive/lo-trinh-28-ngay/**/*.md'], {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const documents = Object.entries(modules)
  .map(([file, source]) => {
    const path = file.replace('../', '')
    const id = path.replace(/^docs\//, '').replace(/\.md$/, '')
    const firstHeading = source.match(/^#\s+(.+)$/m)?.[1]

    return {
      id,
      path,
      title: firstHeading?.replace(/[`*_]/g, '') ?? id,
      source,
    }
  })
  .sort((first, second) => {
    if (first.path === 'docs/README.md') return -1
    if (second.path === 'docs/README.md') return 1

    const firstDay = Number(first.path.match(/\/ngay-(\d+)-/)?.[1])
    const secondDay = Number(second.path.match(/\/ngay-(\d+)-/)?.[1])
    const hasFirstDay = Number.isFinite(firstDay)
    const hasSecondDay = Number.isFinite(secondDay)

    if (hasFirstDay && hasSecondDay) return firstDay - secondDay
    if (hasFirstDay) return 1
    if (hasSecondDay) return -1

    return first.title.localeCompare(second.title, 'vi')
  })

const defaultDocument = documents.find((document) => document.path === 'docs/README.md') ?? documents[0]
const mainRoadmapDocument = documents.find((document) => document.path === 'docs/lo-trinh-nghiep-vu-fullstack.md')
const courseOrder = [
  'docs/01-buc-tranh-thi-truong-va-hanh-trinh-giao-dich.md',
  'docs/02-chung-khoan-va-du-lieu-danh-muc.md',
  'docs/03-bang-gia-va-du-lieu-thi-truong.md',
  'docs/04-phien-giao-dich-va-loai-lenh.md',
  'docs/05-so-lenh-va-khop-lenh.md',
  'docs/06-tai-khoan-va-tai-san-kha-dung.md',
  'docs/07-oms-va-vong-doi-lenh.md',
  'docs/08-tu-giao-dien-den-xu-ly-lenh.md',
  'docs/09-giu-tai-san-danh-muc-va-suc-mua.md',
  'docs/09-bo-sung-danh-muc-gia-von-va-margin.md',
  'docs/10-thanh-toan-va-doi-soat.md',
  'docs/11-ranh-gioi-he-thong-va-kha-nang-phuc-hoi.md',
  'docs/11-bo-sung-nhat-quan-va-phuc-hoi-he-thong.md',
  'docs/12-truy-vet-va-dieu-tra-su-co.md',
  'docs/on-tap-va-tinh-huong-cong-viec.md',
]
const courseDocuments = courseOrder.flatMap((path) => {
  const document = documents.find((item) => item.path === path)
  return document ? [document] : []
})
const courseGroups: NavigationGroup[] = [
  { label: 'PHẦN 1 · NỀN TẢNG', documents: courseDocuments.slice(0, 6) },
  { label: 'PHẦN 2 · GIAO DỊCH & TÀI SẢN', documents: courseDocuments.slice(6, 11) },
  { label: 'PHẦN 3 · ĐỘ TIN CẬY', documents: courseDocuments.slice(11, 14) },
  { label: 'ÔN TẬP', documents: courseDocuments.slice(14) },
]
const referenceDocuments = documents.filter((document) => document.path.startsWith('archive/lo-trinh-28-ngay/'))
const selectedId = ref(readDocumentId())
const isPracticeView = ref(new URLSearchParams(window.location.search).get('view') === 'practice')
const isNavigationOpen = ref(false)
const contentElement = ref<HTMLElement>()
const tableOfContents = ref<TableOfContentsItem[]>([])

const currentDocument = computed(
  () => documents.find((document) => document.id === selectedId.value) ?? defaultDocument,
)

const renderedContent = computed(() => {
  if (!currentDocument.value) return ''
  return DOMPurify.sanitize(marked.parse(currentDocument.value.source, { gfm: true, async: false }))
})

function readDocumentId() {
  const requestedId = new URLSearchParams(window.location.search).get('doc')
  let documentId = requestedId
  if (requestedId?.startsWith('khoa-hoc/')) documentId = requestedId.slice('khoa-hoc/'.length)
  if (requestedId && /^(ngay-\d+-|lo-trinh-28-ngay$|kien-truc-va-quy-uoc$)/.test(requestedId)) {
    documentId = `archive/lo-trinh-28-ngay/${requestedId}`
  }
  return documents.some((document) => document.id === documentId)
    ? documentId!
    : defaultDocument?.id ?? ''
}

function selectDocument(id: string) {
  selectedId.value = id
  isPracticeView.value = false
  isNavigationOpen.value = false
  const url = new URL(window.location.href)
  url.searchParams.set('doc', id)
  url.searchParams.delete('view')
  url.hash = ''
  window.history.pushState({}, '', url)
}

function selectPractice() {
  isPracticeView.value = true
  isNavigationOpen.value = false
  const url = new URL(window.location.href)
  url.searchParams.delete('doc')
  url.searchParams.set('view', 'practice')
  url.hash = ''
  window.history.pushState({}, '', url)
}

function createSlug(value: string, occurrences: Map<string, number>) {
  const base = value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-') || 'section'
  const count = occurrences.get(base) ?? 0
  occurrences.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function resolveMarkdownLinks() {
  if (!contentElement.value || !currentDocument.value) return

  contentElement.value.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || !href.endsWith('.md')) return

    const sourceUrl = new URL(currentDocument.value.path, 'https://docs.local/')
    const targetUrl = new URL(href, sourceUrl)
    const target = documents.find((document) => document.path === targetUrl.pathname.slice(1))
    if (!target) return

    link.href = `?doc=${encodeURIComponent(target.id)}`
    link.addEventListener('click', (event) => {
      event.preventDefault()
      selectDocument(target.id)
    })
  })
}

function decorateHeadings() {
  if (!contentElement.value) return

  const occurrences = new Map<string, number>()
  tableOfContents.value = Array.from(contentElement.value.querySelectorAll<HTMLElement>('h2, h3')).map(
    (heading) => {
      const id = createSlug(heading.textContent ?? '', occurrences)
      heading.id = id
      return { id, label: heading.textContent ?? '', level: Number(heading.tagName.slice(1)) }
    },
  )
}

async function renderDiagrams() {
  if (!contentElement.value) return
  const diagramBlocks = Array.from(contentElement.value.querySelectorAll<HTMLElement>('pre > code.language-mermaid'))
  if (diagramBlocks.length === 0) return

  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })

  await Promise.all(
    diagramBlocks.map(async (code, index) => {
      const container = code.parentElement
      if (!container) return
      try {
        const { svg } = await mermaid.render(`diagram-${currentDocument.value?.id}-${index}`, code.textContent ?? '')
        container.outerHTML = `<div class="diagram" role="img" aria-label="Sơ đồ Mermaid">${svg}</div>`
      } catch {
        container.classList.add('diagram-error')
        container.insertAdjacentHTML('afterend', '<p class="diagram-message">Không thể hiển thị sơ đồ này.</p>')
      }
    }),
  )
}

async function prepareContent() {
  await nextTick()
  decorateHeadings()
  resolveMarkdownLinks()
  await renderDiagrams()
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(renderedContent, prepareContent, { flush: 'post' })
watch(isPracticeView, (practice) => { if (!practice) void prepareContent() }, { flush: 'post' })

onMounted(() => {
  prepareContent()
  window.addEventListener('popstate', () => {
    isPracticeView.value = new URLSearchParams(window.location.search).get('view') === 'practice'
    selectedId.value = readDocumentId()
  })
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="?doc=README" @click.prevent="selectDocument(defaultDocument?.id ?? '')">
        <span class="brand-mark">ST</span>
        <span>
          <strong>Nghiệp vụ chứng khoán</strong>
          <small>Dành cho dev fullstack</small>
        </span>
      </a>
      <button
        class="menu-button"
        type="button"
        :aria-expanded="isNavigationOpen"
        aria-controls="document-navigation"
        @click="isNavigationOpen = !isNavigationOpen"
      >
        {{ isNavigationOpen ? 'Đóng danh mục' : 'Danh mục' }}
      </button>
    </header>

    <aside id="document-navigation" class="navigation" :class="{ 'is-open': isNavigationOpen }">
      <nav aria-label="Danh sách tài liệu">
        <p class="navigation-label">BẮT ĐẦU</p>
        <button
          v-if="defaultDocument"
          class="document-link"
          :class="{ active: !isPracticeView && defaultDocument.id === currentDocument?.id }"
          type="button"
          @click="selectDocument(defaultDocument.id)"
        >
          {{ defaultDocument.title }}
        </button>
        <button
          v-if="mainRoadmapDocument"
          class="document-link"
          :class="{ active: !isPracticeView && mainRoadmapDocument.id === currentDocument?.id }"
          type="button"
          @click="selectDocument(mainRoadmapDocument.id)"
        >
          {{ mainRoadmapDocument.title }}
        </button>
        <button class="document-link" :class="{ active: isPracticeView }" type="button" @click="selectPractice">Bài luyện tập</button>
        <template v-for="group in courseGroups" :key="group.label">
          <p class="navigation-label navigation-section">{{ group.label }}</p>
          <button
            v-for="documentItem in group.documents"
            :key="documentItem.id"
            class="document-link"
            :class="{ active: !isPracticeView && documentItem.id === currentDocument?.id }"
            type="button"
            @click="selectDocument(documentItem.id)"
          >
            {{ documentItem.title }}
          </button>
        </template>
        <p class="navigation-label navigation-section">THAM KHẢO · 28 NGÀY</p>
        <button
          v-for="documentItem in referenceDocuments"
          :key="documentItem.id"
          class="document-link"
          :class="{ active: !isPracticeView && documentItem.id === currentDocument?.id }"
          type="button"
          @click="selectDocument(documentItem.id)"
        >
          {{ documentItem.title }}
        </button>
      </nav>
    </aside>

    <main class="main-content">
      <PracticeDashboard v-if="isPracticeView" />
      <article v-else-if="currentDocument" ref="contentElement" class="prose" v-html="renderedContent" />
      <section v-else class="empty-state">
        <h1>Chưa có tài liệu</h1>
        <p>Thêm các tệp <code>.md</code> vào thư mục <code>docs</code> để bắt đầu.</p>
      </section>
    </main>

    <aside v-if="!isPracticeView && tableOfContents.length" class="table-of-contents" aria-label="Mục lục trang">
      <p class="navigation-label">TRONG TÀI LIỆU</p>
      <button
        v-for="item in tableOfContents"
        :key="item.id"
        class="toc-link"
        :class="`toc-level-${item.level}`"
        type="button"
        @click="scrollToSection(item.id)"
      >
        {{ item.label }}
      </button>
    </aside>
  </div>
</template>
