import { ConcurrencyQueue } from './concurrencyQueue.js'

/**
 * Creates a batch runner that processes items through an API call function
 * with concurrency control and lifecycle callbacks.
 *
 * @param {Object} options
 * @param {Array} options.items - DataItem[] to process
 * @param {Function} options.apiCallFn - async (item) => { content, raw }
 * @param {number} options.concurrency - max concurrent requests
 * @param {Function} options.onItemStart - (id) => void
 * @param {Function} options.onItemComplete - (id, result: OutputItem) => void
 * @param {Function} options.onItemError - (id, error: OutputItem) => void
 * @param {Function} options.onAllComplete - () => void
 * @returns {{ start: () => Promise<void>, abort: () => void, progress: { completed: number, total: number } }}
 */
export function createBatchRunner(options) {
  const {
    items,
    apiCallFn,
    concurrency,
    onItemStart,
    onItemComplete,
    onItemError,
    onAllComplete,
  } = options

  const queue = new ConcurrencyQueue(concurrency)
  let aborted = false
  let resolveAll = null

  const progress = {
    completed: 0,
    total: items.length,
  }

  function checkDone() {
    if (progress.completed >= progress.total && resolveAll) {
      resolveAll()
    }
  }

  async function processItem(item) {
    if (aborted) return

    onItemStart(item.id)

    const startTime = Date.now()
    try {
      const { content, raw } = await apiCallFn(item)
      if (aborted) return

      const latency = Date.now() - startTime
      const tokenUsage = raw?.usage?.total_tokens

      progress.completed = Math.min(progress.completed + 1, progress.total)
      onItemComplete(item.id, {
        id: item.id,
        status: 'completed',
        content,
        latency,
        tokenUsage,
      })
    } catch (err) {
      if (aborted) return

      progress.completed = Math.min(progress.completed + 1, progress.total)
      onItemError(item.id, {
        id: item.id,
        status: 'failed',
        content: '',
        error: err?.message || String(err),
      })
    } finally {
      if (!aborted) {
        checkDone()
      }
    }
  }

  async function start() {
    aborted = false
    progress.completed = 0

    if (items.length === 0) {
      onAllComplete()
      return
    }

    const donePromise = new Promise((resolve) => {
      resolveAll = resolve
    })

    for (const item of items) {
      if (aborted) break
      // Fire-and-forget into the queue; completion tracked via progress counter
      queue.add(() => processItem(item)).catch(() => {
        // Swallow rejections from cleared queue tasks
      })
    }

    await donePromise

    if (!aborted) {
      onAllComplete()
    }
  }

  function abort() {
    aborted = true
    queue.clear()
    // Resolve the pending donePromise so start() can return
    if (resolveAll) {
      resolveAll()
      resolveAll = null
    }
  }

  return { start, abort, progress }
}
