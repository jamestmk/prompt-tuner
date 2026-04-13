export class ConcurrencyQueue {
  constructor(concurrency) {
    this._concurrency = Math.max(1, concurrency)
    this._running = 0
    this._queue = []
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this._queue.push({ task, resolve, reject })
      this._run()
    })
  }

  _run() {
    while (this._running < this._concurrency && this._queue.length > 0) {
      const { task, resolve, reject } = this._queue.shift()
      this._running++
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this._running--
          this._run()
        })
    }
  }

  clear() {
    this._queue = []
  }

  get pending() {
    return this._queue.length
  }

  get running() {
    return this._running
  }
}
