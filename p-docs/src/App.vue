<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

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

const modules = import.meta.glob('../docs/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const documents = Object.entries(modules)
  .map(([file, source]) => {
    const path = file.replace('../docs/', '')
    const id = path.replace(/\.md$/, '')
    const firstHeading = source.match(/^#\s+(.+)$/m)?.[1]

    return {
      id,
      path,
      title: firstHeading?.replace(/[`*_]/g, '') ?? id,
      source,
    }
  })
  .sort((first, second) => {
    if (first.path === 'README.md') return -1
    if (second.path === 'README.md') return 1
    return first.title.localeCompare(second.title, 'vi')
  })

const defaultDocument = documents.find((document) => document.path === 'README.md') ?? documents[0]
const selectedId = ref(readDocumentId())
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
  const documentId = new URLSearchParams(window.location.search).get('doc')
  return documents.some((document) => document.id === documentId)
    ? documentId!
    : defaultDocument?.id ?? ''
}

function selectDocument(id: string) {
  selectedId.value = id
  isNavigationOpen.value = false
  const url = new URL(window.location.href)
  url.searchParams.set('doc', id)
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

onMounted(() => {
  prepareContent()
  window.addEventListener('popstate', () => {
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
          <strong>Securities Trading Simulator</strong>
          <small>Tài liệu học tập</small>
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
      <p class="navigation-label">TÀI LIỆU</p>
      <nav aria-label="Danh sách tài liệu">
        <button
          v-for="documentItem in documents"
          :key="documentItem.id"
          class="document-link"
          :class="{ active: documentItem.id === currentDocument?.id }"
          type="button"
          @click="selectDocument(documentItem.id)"
        >
          {{ documentItem.title }}
        </button>
      </nav>
    </aside>

    <main class="main-content">
      <article v-if="currentDocument" ref="contentElement" class="prose" v-html="renderedContent" />
      <section v-else class="empty-state">
        <h1>Chưa có tài liệu</h1>
        <p>Thêm các tệp <code>.md</code> vào thư mục <code>docs</code> để bắt đầu.</p>
      </section>
    </main>

    <aside v-if="tableOfContents.length" class="table-of-contents" aria-label="Mục lục trang">
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
