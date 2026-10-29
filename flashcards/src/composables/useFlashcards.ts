import { computed, ref, watch } from 'vue'
import { cards } from '../cards'

type Status = 'learned' | 'review'
type Progress = Record<string, Status>
const storageKey = 'stocknotes-progress-v1'

function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, status]) => status === 'learned' || status === 'review')) as Progress
  } catch {
    return {}
  }
}

export function useFlashcards() {
  const topic = ref('Tất cả')
  const search = ref('')
  const statusFilter = ref('all')
  const order = ref(cards.map(card => card.id))
  const index = ref(0)
  const revealed = ref(false)
  const progress = ref<Progress>(readProgress())
  const storageError = ref(false)

  const filtered = computed(() => {
    const query = search.value.trim().toLocaleLowerCase('vi')
    return order.value.map(id => cards.find(card => card.id === id)!).filter(card =>
      (topic.value === 'Tất cả' || card.topic === topic.value) &&
      (statusFilter.value === 'all' || (statusFilter.value === 'new' ? !progress.value[card.id] : progress.value[card.id] === statusFilter.value)) &&
      (!query || `${card.question} ${card.answer} ${card.example ?? ''}`.toLocaleLowerCase('vi').includes(query)),
    )
  })
  const current = computed(() => filtered.value[index.value])
  const learned = computed(() => cards.filter(card => progress.value[card.id] === 'learned').length)
  const review = computed(() => cards.filter(card => progress.value[card.id] === 'review').length)

  watch([topic, search, statusFilter], () => { index.value = 0; revealed.value = false })
  watch(filtered, () => {
    if (index.value >= filtered.value.length) index.value = Math.max(0, filtered.value.length - 1)
  })
  watch(() => current.value?.id, () => { revealed.value = false })

  function move(direction: number) {
    if (!filtered.value.length) return
    index.value = (index.value + direction + filtered.value.length) % filtered.value.length
    revealed.value = false
  }

  function mark(status: Status) {
    if (!current.value) return
    progress.value = { ...progress.value, [current.value.id]: status }
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress.value))
      storageError.value = false
    } catch {
      storageError.value = true
    }
  }

  function shuffle() {
    const shuffled = [...order.value]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
    }
    order.value = shuffled
    index.value = 0
    revealed.value = false
  }

  return { topic, search, statusFilter, index, revealed, progress, storageError, filtered, current, learned, review, move, mark, shuffle }
}
