/**
 * harnessPrompt.js - 推理模型 Harness Prompt 构建器
 * 
 * 负责构建发送给推理模型的 Prompt，以及从推理模型响应中提取生成的 Prompt。
 */

/**
 * 构建首轮 Harness Prompt
 * @param {{ taskDescription: string, ioSamples: Array<{ content: string, expectedOutput: string }> }} context
 * @returns {string}
 */
export function buildHarnessPrompt({ taskDescription, ioSamples }) {
  const samplesText = ioSamples.map((s, i) =>
    `样本 ${i + 1}:\n  输入: ${s.content}\n  预期输出: ${s.expectedOutput}`
  ).join('\n\n')

  return `你是一个 Prompt 工程专家。你的任务是根据用户提供的输入-输出样本对，生成一个最优的 Prompt，使目标 LLM 在接收到该 Prompt 和输入后，能够产生尽可能接近预期输出的结果。

## 任务描述
${taskDescription}

## 输入-输出样本
${samplesText}

## 要求
1. 分析所有样本，理解输入到输出的转换规律
2. 生成一个通用的 Prompt，使其适用于所有样本
3. Prompt 应该清晰、具体、可执行
4. 用 <PROMPT> 和 </PROMPT> 标签包裹你生成的 Prompt

## 严格禁止
- 禁止将预期输出的具体内容、原文或变体作为示例（few-shot examples）放入 Prompt 中
- 禁止在 Prompt 中硬编码任何样本的输入或输出文本
- 你生成的 Prompt 必须是通用的规则和指令，而不是记忆具体样本
- 目标是让模型通过理解规则来产生正确输出，而不是通过记忆示例来复制答案

请生成 Prompt：`
}

/**
 * 构建后续轮次的 Follow-Up Prompt
 * @param {{ taskDescription: string, ioSamples: Array<{ content: string, expectedOutput: string }>, previousRounds: Array<{ roundNumber: number, prompt: string, outputs: Array<{ input: string, expectedOutput: string, actualOutput: string, status: string }> }> }} context
 * @returns {string}
 */
export function buildFollowUpPrompt({ taskDescription, ioSamples, previousRounds }) {
  const samplesText = ioSamples.map((s, i) =>
    `样本 ${i + 1}:\n  输入: ${s.content}\n  预期输出: ${s.expectedOutput}`
  ).join('\n\n')

  const lastRound = previousRounds[previousRounds.length - 1]
  const comparisonText = lastRound.outputs.map((o, i) =>
    `样本 ${i + 1}:\n  输入: ${o.input}\n  预期输出: ${o.expectedOutput}\n  实际输出: ${o.actualOutput}\n  状态: ${o.status}`
  ).join('\n\n')

  return `你是一个 Prompt 工程专家。你之前生成的 Prompt 已经被测试，以下是结果。请分析差异并生成改进后的 Prompt。

## 任务描述
${taskDescription}

## 输入-输出样本
${samplesText}

## 上一轮 Prompt（第 ${lastRound.roundNumber} 轮）
${lastRound.prompt}

## 上一轮测试结果
${comparisonText}

## 差异分析要求
1. 逐条对比实际输出与预期输出的差异
2. 识别系统性的偏差模式
3. 针对性地改进 Prompt 以缩小差距
4. 用 <PROMPT> 和 </PROMPT> 标签包裹改进后的 Prompt

## 严格禁止
- 禁止将预期输出的具体内容、原文或变体作为示例（few-shot examples）放入 Prompt 中
- 禁止在 Prompt 中硬编码任何样本的输入或输出文本
- 你生成的 Prompt 必须是通用的规则和指令，而不是记忆具体样本
- 目标是让模型通过理解规则来产生正确输出，而不是通过记忆示例来复制答案

请生成改进后的 Prompt：`
}

/**
 * 从推理模型响应中提取 Prompt
 * 使用正则匹配 <PROMPT>...</PROMPT> 标签提取内容
 * 未找到标签时回退到返回整个响应内容（去除首尾空白）
 * @param {string} response
 * @returns {string}
 */
export function extractPromptFromResponse(response) {
  if (!response) return ''
  const match = response.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return response.trim()
}
