import { buildHarnessPrompt, buildFollowUpPrompt, extractPromptFromResponse } from './harnessPrompt.js'
import { createBatchRunner } from './batchRunner.js'
import { fetchLLMResponse } from './api.js'

/**
 * Creates an IO2P iteration engine.
 * @param {Object} options
 * @param {string} options.taskDescription
 * @param {Array} options.ioSamples - DataItem[] with content and expectedOutput
 * @param {Object} options.reasoningConfig - { model, apiKey, temperature, topP, maxTokens }
 * @param {Object} options.targetConfig - { model, apiKey, systemPrompt, temperature, topP, maxTokens, frequencyPenalty, presencePenalty, concurrency }
 * @param {number} options.maxRounds
 * @param {Function} options.onRoundStart - (round, total) => void
 * @param {Function} options.onPromptGenerated - (round, prompt) => void
 * @param {Function} options.onSampleProgress - (round, completed, total) => void
 * @param {Function} options.onRoundComplete - (roundData: IterationRound) => void
 * @param {Function} options.onAllComplete - (history: IterationRound[]) => void
 * @param {Function} options.onError - (round, errorMessage) => void
 * @returns {{ start: () => Promise<void>, abort: () => void }}
 */
export function createIO2PEngine(options) {
  const {
    taskDescription, ioSamples, reasoningConfig, targetConfig, maxRounds,
    onRoundStart, onPromptGenerated, onSampleProgress, onRoundComplete, onAllComplete, onError
  } = options

  let aborted = false
  let currentBatchRunner = null
  const history = []

  async function callReasoningModel(prompt) {
    const response = await fetchLLMResponse({
      model: reasoningConfig.model,
      apiKey: reasoningConfig.apiKey,
      userMessage: prompt,
      temperature: reasoningConfig.temperature,
      topP: reasoningConfig.topP,
      maxTokens: reasoningConfig.maxTokens
    })
    return response.content
  }

  async function runTargetModelBatch(generatedPrompt, roundNumber) {
    return new Promise((resolve, reject) => {
      const outputs = []
      const selectedSamples = ioSamples.filter(s => s.selected)
      let sampleCompleted = 0

      const runner = createBatchRunner({
        items: selectedSamples,
        apiCallFn: async (item) => {
          return await fetchLLMResponse({
            model: targetConfig.model,
            apiKey: targetConfig.apiKey,
            systemPrompt: generatedPrompt,
            userMessage: item.content,
            temperature: targetConfig.temperature,
            topP: targetConfig.topP,
            maxTokens: targetConfig.maxTokens,
            frequencyPenalty: targetConfig.frequencyPenalty,
            presencePenalty: targetConfig.presencePenalty
          })
        },
        concurrency: targetConfig.concurrency || 1,
        onItemStart: () => {},
        onItemComplete: (id, result) => {
          const sample = selectedSamples.find(s => s.id === id)
          outputs.push({
            id,
            input: sample.content,
            expectedOutput: sample.expectedOutput,
            actualOutput: result.content,
            status: 'completed',
            latency: result.latency
          })
          sampleCompleted++
          onSampleProgress(roundNumber, sampleCompleted, selectedSamples.length)
        },
        onItemError: (id, error) => {
          const sample = selectedSamples.find(s => s.id === id)
          outputs.push({
            id,
            input: sample.content,
            expectedOutput: sample.expectedOutput,
            actualOutput: '',
            status: 'failed',
            error: error.error
          })
          sampleCompleted++
          onSampleProgress(roundNumber, sampleCompleted, selectedSamples.length)
        },
        onAllComplete: () => {
          resolve(outputs)
        }
      })

      currentBatchRunner = runner
      runner.start().catch(reject)
    })
  }

  async function start() {
    aborted = false
    history.length = 0

    for (let round = 1; round <= maxRounds; round++) {
      if (aborted) break

      onRoundStart(round, maxRounds)

      // Step 1: Call reasoning model
      let harnessPrompt
      if (round === 1) {
        harnessPrompt = buildHarnessPrompt({ taskDescription, ioSamples: ioSamples.filter(s => s.selected) })
      } else {
        const prevRoundsForPrompt = history.map(h => ({
          roundNumber: h.roundNumber,
          prompt: h.generatedPrompt,
          outputs: h.outputs
        }))
        harnessPrompt = buildFollowUpPrompt({ taskDescription, ioSamples: ioSamples.filter(s => s.selected), previousRounds: prevRoundsForPrompt })
      }

      let generatedPrompt
      try {
        const reasoningResponse = await callReasoningModel(harnessPrompt)
        if (aborted) break
        generatedPrompt = extractPromptFromResponse(reasoningResponse)
        onPromptGenerated(round, generatedPrompt)
      } catch (err) {
        if (!aborted) {
          onError(round, `推理模型调用失败: ${err.message}`)
        }
        break
      }

      // Step 2: Run target model on all samples
      let outputs
      try {
        outputs = await runTargetModelBatch(generatedPrompt, round)
        if (aborted) break
      } catch (err) {
        if (!aborted) {
          onError(round, `目标模型批量推理失败: ${err.message}`)
        }
        break
      }

      // Check if all failed
      const allFailed = outputs.every(o => o.status === 'failed')

      const roundData = {
        roundNumber: round,
        generatedPrompt,
        outputs,
        status: allFailed ? 'failed' : 'completed',
        timestamp: new Date().toISOString()
      }
      history.push(roundData)
      onRoundComplete(roundData)

      if (allFailed) {
        onError(round, '所有样本均失败，请检查目标模型配置')
        break
      }
    }

    if (!aborted) {
      onAllComplete([...history])
    }
  }

  function abort() {
    aborted = true
    if (currentBatchRunner) {
      currentBatchRunner.abort()
      currentBatchRunner = null
    }
  }

  return { start, abort }
}
