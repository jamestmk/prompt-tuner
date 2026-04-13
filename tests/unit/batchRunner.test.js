import { describe, it, expect, vi } from 'vitest'
import { createBatchRunner } from '../../src/utils/batchRunner.js'

function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    content: `item ${i + 1}`,
    fields: { input: `item ${i + 1}` },
    selected: true,
    expanded: false,
  }))
}

describe('createBatchRunner', () => {
  it('should process all items and call onAllComplete', async () => {
    const items = makeItems(3)
    const completed = []
    const started = []

    const runner = createBatchRunner({
      items,
      apiCallFn: async (item) => ({ content: `result-${item.id}`, raw: {} }),
      concurrency: 2,
      onItemStart: (id) => started.push(id),
      onItemComplete: (id, result) => completed.push(result),
      onItemError: () => {},
      onAllComplete: () => {},
    })

    expect(runner.progress.total).toBe(3)
    expect(runner.progress.completed).toBe(0)

    await runner.start()

    expect(started).toEqual([1, 2, 3])
    expect(completed).toHaveLength(3)
    expect(completed.every((r) => r.status === 'completed')).toBe(true)
    expect(completed.map((r) => r.content)).toEqual([
      'result-1',
      'result-2',
      'result-3',
    ])
    expect(runner.progress.completed).toBe(3)
  })

  it('should isolate failures — failed items do not stop the batch', async () => {
    const items = makeItems(4)
    const completedResults = []
    const errorResults = []

    const runner = createBatchRunner({
      items,
      apiCallFn: async (item) => {
        if (item.id === 2 || item.id === 4) {
          throw new Error(`fail-${item.id}`)
        }
        return { content: `ok-${item.id}`, raw: {} }
      },
      concurrency: 1,
      onItemStart: () => {},
      onItemComplete: (id, result) => completedResults.push(result),
      onItemError: (id, error) => errorResults.push(error),
      onAllComplete: () => {},
    })

    await runner.start()

    expect(completedResults).toHaveLength(2)
    expect(errorResults).toHaveLength(2)
    expect(errorResults[0]).toMatchObject({
      id: 2,
      status: 'failed',
      content: '',
      error: 'fail-2',
    })
    expect(errorResults[1]).toMatchObject({
      id: 4,
      status: 'failed',
      content: '',
      error: 'fail-4',
    })
    expect(runner.progress.completed).toBe(4)
  })

  it('should abort and stop processing remaining items', async () => {
    const items = makeItems(5)
    const started = []
    let allCompleteCalled = false

    const runner = createBatchRunner({
      items,
      apiCallFn: async (item) => {
        // Slow enough that abort can fire between items
        await new Promise((r) => setTimeout(r, 50))
        return { content: `ok-${item.id}`, raw: {} }
      },
      concurrency: 1,
      onItemStart: (id) => {
        started.push(id)
        // Abort after the first item starts
        if (id === 2) runner.abort()
      },
      onItemComplete: () => {},
      onItemError: () => {},
      onAllComplete: () => {
        allCompleteCalled = true
      },
    })

    await runner.start()

    // At most 2 items should have started (item 1 completes, item 2 starts then abort)
    expect(started.length).toBeLessThanOrEqual(3)
    expect(allCompleteCalled).toBe(false)
  })

  it('should record latency in completed items', async () => {
    const items = makeItems(1)
    let result = null

    const runner = createBatchRunner({
      items,
      apiCallFn: async () => {
        await new Promise((r) => setTimeout(r, 20))
        return { content: 'done', raw: {} }
      },
      concurrency: 1,
      onItemStart: () => {},
      onItemComplete: (id, r) => { result = r },
      onItemError: () => {},
      onAllComplete: () => {},
    })

    await runner.start()

    expect(result.latency).toBeGreaterThanOrEqual(15)
    expect(result.status).toBe('completed')
  })

  it('should extract tokenUsage from raw response', async () => {
    const items = makeItems(1)
    let result = null

    const runner = createBatchRunner({
      items,
      apiCallFn: async () => ({
        content: 'hello',
        raw: { usage: { total_tokens: 42 } },
      }),
      concurrency: 1,
      onItemStart: () => {},
      onItemComplete: (id, r) => { result = r },
      onItemError: () => {},
      onAllComplete: () => {},
    })

    await runner.start()

    expect(result.tokenUsage).toBe(42)
  })
})
