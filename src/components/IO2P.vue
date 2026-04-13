<template>
  <div class="io2p-container">
    <!-- Header -->
    <div class="io2p-header">
      <div class="io2p-header-left">
        <a-button type="text" @click="$emit('navigate-back')">
          <template #icon><icon-arrow-left /></template>
          返回
        </a-button>
        <h2 class="io2p-title">🧪 IO2P 自动 Prompt 工程</h2>
      </div>
      <div class="io2p-header-subtitle">
        上传 IO 样本 → 推理模型自动生成 Prompt → 目标模型验证 → 多轮迭代优化
      </div>
    </div>

    <!-- 3-column layout -->
    <div class="workflow-row">
      <!-- LEFT COLUMN: IO Samples -->
      <div class="workflow-node">
        <a-card title="IO 样本数据" :bordered="false" class="card-col input-card">
          <template #extra>
            <a-space>
              <a-upload :auto-upload="false" accept=".csv" @change="handleCsvUpload" :show-file-list="false">
                <template #button>
                  <a-button type="text" size="small">
                    <template #icon><icon-upload /></template>
                    导入 CSV
                  </a-button>
                </template>
              </a-upload>
              <a-button type="text" size="small" @click="downloadTemplate">
                <template #icon><icon-download /></template>
                模板
              </a-button>
            </a-space>
          </template>

          <div v-if="io2pState.ioSamples.length > 0" class="data-list-container">
            <div class="data-list-toolbar">
              <a-space size="small">
                <a-button size="mini" type="outline" @click="selectAll(io2pState.ioSamples)">全选</a-button>
                <a-button size="mini" type="outline" @click="deselectAll(io2pState.ioSamples)">全不选</a-button>
                <span class="data-list-count">已选 {{ getSelectedCount(io2pState.ioSamples) }} / 共 {{ io2pState.ioSamples.length }} 条</span>
              </a-space>
              <a-space size="small">
                <a-button size="mini" type="text" @click="handleExport">
                  <template #icon><icon-download /></template>
                  导出
                </a-button>
                <a-button size="mini" type="text" status="danger" @click="clearSamples">清除</a-button>
              </a-space>
            </div>
            <div class="data-list">
              <div v-for="(item, index) in io2pState.ioSamples" :key="item.id"
                   class="data-item" :class="{ 'data-item-expanded': item.expanded }">
                <div class="data-item-header" @click="item.expanded = !item.expanded">
                  <a-checkbox v-model="item.selected" @click.stop />
                  <span class="data-item-index">#{{ item.id }}</span>
                  <span class="data-item-summary">{{ getSummary(item.content) }}</span>
                  <a-tag size="small" color="green" style="flex-shrink: 0;">{{ getSummary(item.expectedOutput).slice(0, 20) }}</a-tag>
                  <icon-down v-if="!item.expanded" class="data-item-toggle" />
                  <icon-up v-else class="data-item-toggle" />
                </div>
                <div v-if="item.expanded" class="data-item-body">
                  <div class="io-pair-detail">
                    <div class="io-pair-section">
                      <div class="io-pair-label">输入 (Input):</div>
                      <div class="io-pair-content">{{ item.content }}</div>
                    </div>
                    <div class="io-pair-section">
                      <div class="io-pair-label io-pair-label-expected">预期输出 (Expected Output):</div>
                      <div class="io-pair-content">{{ item.expectedOutput }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-samples">
            <icon-file style="font-size: 32px; color: #c9cdd4;" />
            <p>请上传包含 <code>input</code> 和 <code>expected_output</code> 列的 CSV 文件</p>
          </div>
        </a-card>
      </div>

      <div class="workflow-edge"></div>

      <!-- MIDDLE COLUMN: Task & Config -->
      <div class="workflow-node">
        <a-card title="任务描述 & 配置" :bordered="false" class="card-col prompt-card-container">
          <!-- Task Description -->
          <div class="config-section-label">📝 任务描述</div>
          <a-textarea
            v-model="io2pState.taskDescription"
            placeholder="描述你希望模型完成的任务，例如：将中文翻译为英文..."
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />

          <a-divider style="margin: 16px 0;" />

          <!-- Target Model Config (Blue) -->
          <div class="config-block config-block-blue">
            <div class="config-block-header" @click="io2pState.targetModel.showParams = !io2pState.targetModel.showParams">
              <span class="config-block-title">
                <a-tag color="blue" size="small">目标</a-tag>
                目标模型配置
              </span>
              <a-space size="small">
                <a-tag size="small" color="blue" v-if="io2pState.targetModel.model">{{ io2pState.targetModel.model }}</a-tag>
                <a-tag size="small" :color="io2pState.targetModel.apiKey ? 'green' : 'red'">
                  {{ io2pState.targetModel.apiKey ? 'Key ✓' : 'Key ✗' }}
                </a-tag>
                <icon-down v-if="!io2pState.targetModel.showParams" />
                <icon-up v-else />
              </a-space>
            </div>
            <transition name="panel-fade">
              <div v-if="io2pState.targetModel.showParams" class="config-block-body">
                <a-form layout="vertical" :model="tempTargetConfig" size="small">
                  <a-form-item label="模型选择" style="margin-bottom: 4px;">
                    <a-select v-model="tempTargetConfig.model" placeholder="请选择模型">
                      <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                        <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                      </a-optgroup>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="API Key" style="margin-bottom: 4px;">
                    <a-input-password v-model="tempTargetConfig.apiKey" placeholder="输入 API Key" allow-clear />
                  </a-form-item>
                  <a-form-item label="System Prompt" style="margin-bottom: 4px;">
                    <a-textarea v-model="tempTargetConfig.systemPrompt" placeholder="可选：系统级指令..." :auto-size="{ minRows: 1, maxRows: 3 }" />
                  </a-form-item>
                  <a-row :gutter="8">
                    <a-col :span="8">
                      <a-form-item label="Temperature" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.temperature" :min="0" :max="2" :step="0.1" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="Top P" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.topP" :min="0" :max="1" :step="0.05" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="Max Tokens" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.maxTokens" placeholder="默认" :min="1" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="8">
                    <a-col :span="8">
                      <a-form-item label="Freq Penalty" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.frequencyPenalty" :min="-2" :max="2" :step="0.1" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="Pres Penalty" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.presencePenalty" :min="-2" :max="2" :step="0.1" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="并发数" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempTargetConfig.concurrency" :min="1" :max="10" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <a-button size="small" @click="cancelTargetConfig">取消</a-button>
                    <a-button size="small" type="primary" @click="saveTargetConfig">保存</a-button>
                  </div>
                </a-form>
              </div>
            </transition>
          </div>

          <!-- Reasoning Model Config (Purple) -->
          <div class="config-block config-block-purple" style="margin-top: 12px;">
            <div class="config-block-header" @click="io2pState.reasoningModel.showParams = !io2pState.reasoningModel.showParams">
              <span class="config-block-title">
                <a-tag color="purple" size="small">推理</a-tag>
                推理模型配置
              </span>
              <a-space size="small">
                <a-tag size="small" color="purple" v-if="io2pState.reasoningModel.model">{{ io2pState.reasoningModel.model }}</a-tag>
                <a-tag size="small" :color="io2pState.reasoningModel.apiKey ? 'green' : 'red'">
                  {{ io2pState.reasoningModel.apiKey ? 'Key ✓' : 'Key ✗' }}
                </a-tag>
                <icon-down v-if="!io2pState.reasoningModel.showParams" />
                <icon-up v-else />
              </a-space>
            </div>
            <transition name="panel-fade">
              <div v-if="io2pState.reasoningModel.showParams" class="config-block-body">
                <a-form layout="vertical" :model="tempReasoningConfig" size="small">
                  <a-form-item label="模型选择" style="margin-bottom: 4px;">
                    <a-select v-model="tempReasoningConfig.model" placeholder="请选择模型">
                      <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                        <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                      </a-optgroup>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="API Key" style="margin-bottom: 4px;">
                    <a-input-password v-model="tempReasoningConfig.apiKey" placeholder="输入 API Key" allow-clear />
                  </a-form-item>
                  <a-row :gutter="8">
                    <a-col :span="8">
                      <a-form-item label="Temperature" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempReasoningConfig.temperature" :min="0" :max="2" :step="0.1" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="Top P" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempReasoningConfig.topP" :min="0" :max="1" :step="0.05" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="Max Tokens" style="margin-bottom: 4px;">
                        <a-input-number v-model="tempReasoningConfig.maxTokens" placeholder="默认" :min="1" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <a-button size="small" @click="cancelReasoningConfig">取消</a-button>
                    <a-button size="small" type="primary" status="normal" @click="saveReasoningConfig">保存</a-button>
                  </div>
                </a-form>
              </div>
            </transition>
          </div>

          <a-divider style="margin: 16px 0;" />

          <!-- Iteration Count & Run -->
          <div class="run-control-section">
            <div class="iteration-config">
              <span class="iteration-label">迭代轮次:</span>
              <a-input-number v-model="io2pState.maxRounds" :min="1" :max="20" size="small" style="width: 80px;" />
            </div>

            <!-- Progress display when running -->
            <div v-if="io2pState.isRunning" class="run-progress-info">
              <a-tag color="blue" size="small">
                <template #icon><icon-loading class="spin-icon" /></template>
                第 {{ io2pState.currentRound }} 轮 / 共 {{ io2pState.maxRounds }} 轮
              </a-tag>
              <a-progress
                v-if="sampleProgress.total > 0"
                :percent="Math.round(sampleProgress.completed / sampleProgress.total * 100)"
                size="small"
                style="flex: 1;"
              />
            </div>

            <a-button
              v-if="!io2pState.isRunning"
              type="primary"
              long
              class="run-btn"
              :disabled="!canRun"
              @click="startRun"
            >
              <template #icon><icon-play-arrow /></template>
              开始迭代优化
            </a-button>
            <a-button
              v-else
              type="primary"
              status="danger"
              long
              class="run-btn"
              @click="stopRun"
            >
              <template #icon><icon-pause /></template>
              停止迭代
            </a-button>

            <!-- Validation hints -->
            <div v-if="!canRun && !io2pState.isRunning" class="validation-hints">
              <span v-if="!io2pState.reasoningModel.model || !io2pState.reasoningModel.apiKey" class="hint-item">⚠ 请配置推理模型</span>
              <span v-if="!io2pState.targetModel.model || !io2pState.targetModel.apiKey" class="hint-item">⚠ 请配置目标模型</span>
              <span v-if="!io2pState.taskDescription.trim()" class="hint-item">⚠ 请输入任务描述</span>
              <span v-if="getSelectedCount(io2pState.ioSamples) === 0" class="hint-item">⚠ 请上传并选择 IO 样本</span>
            </div>
          </div>
        </a-card>
      </div>

      <div class="workflow-edge"></div>

      <!-- RIGHT COLUMN: Iteration History -->
      <div class="workflow-node">
        <a-card title="迭代历史" :bordered="false" class="card-col">
          <template #extra>
            <a-tag v-if="io2pState.iterationHistory.length > 0" size="small" color="blue">
              {{ io2pState.iterationHistory.length }} 轮
            </a-tag>
          </template>

          <div v-if="io2pState.iterationHistory.length > 0 || io2pState.isRunning" class="history-list">
            <!-- Current running round indicator -->
            <div v-if="io2pState.isRunning && io2pState.currentRound > 0" class="history-round history-round-running">
              <div class="round-header">
                <a-tag color="blue" size="small">
                  <template #icon><icon-loading class="spin-icon" /></template>
                  第 {{ io2pState.currentRound }} 轮
                </a-tag>
                <span class="round-status-text">运行中...</span>
              </div>
              <div v-if="currentRoundPrompt" class="round-prompt-preview">
                <div class="round-section-label">生成的 Prompt:</div>
                <div class="round-prompt-text">{{ currentRoundPrompt }}</div>
              </div>
            </div>

            <!-- Completed rounds -->
            <div v-for="(round, rIdx) in reversedHistory" :key="round.roundNumber"
                 class="history-round" :class="{ 'history-round-failed': round.status === 'failed' }">
              <div class="round-header" @click="toggleRound(round.roundNumber)">
                <div class="round-header-left">
                  <a-tag :color="round.status === 'completed' ? 'green' : 'red'" size="small">
                    第 {{ round.roundNumber }} 轮
                  </a-tag>
                  <a-tag size="small" :color="round.status === 'completed' ? 'green' : 'red'">
                    {{ round.status === 'completed' ? '完成' : '失败' }}
                  </a-tag>
                </div>
                <icon-down v-if="!expandedRounds[round.roundNumber]" class="data-item-toggle" />
                <icon-up v-else class="data-item-toggle" />
              </div>

              <div v-if="expandedRounds[round.roundNumber]" class="round-detail">
                <!-- Generated Prompt -->
                <div class="round-section">
                  <div class="round-section-label">生成的 Prompt:</div>
                  <div class="round-prompt-text">{{ round.generatedPrompt }}</div>
                </div>

                <!-- Output comparison list -->
                <div class="round-section">
                  <div class="round-section-label">输出对比 ({{ round.outputs.length }} 条):</div>
                  <div class="round-outputs">
                    <div v-for="output in round.outputs" :key="output.id" class="round-output-item">
                      <div class="round-output-header">
                        <span class="data-item-index">#{{ output.id }}</span>
                        <a-tag size="small" :color="output.status === 'completed' ? 'green' : 'red'">
                          {{ output.status === 'completed' ? '完成' : '失败' }}
                        </a-tag>
                      </div>
                      <div v-if="output.status === 'completed'" class="output-compare-grid">
                        <div class="compare-col">
                          <div class="compare-label">实际输出:</div>
                          <div class="compare-content">{{ output.actualOutput }}</div>
                        </div>
                        <div class="compare-col compare-col-expected">
                          <div class="compare-label compare-label-expected">预期输出:</div>
                          <div class="compare-content">{{ output.expectedOutput }}</div>
                        </div>
                      </div>
                      <div v-else-if="output.status === 'failed'" class="output-result-error">
                        {{ output.error || '请求失败' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-history">
            <icon-history style="font-size: 32px; color: #c9cdd4;" />
            <p>运行迭代后，历史记录将在此显示</p>
          </div>
        </a-card>
      </div>
    </div>

    <!-- Harness Prompt 预览 -->
    <div class="harness-preview-section">
      <div class="harness-preview-header" @click="showHarnessPreview = !showHarnessPreview">
        <span class="harness-preview-title">
          <icon-code /> Harness Prompt 预览
        </span>
        <a-space size="small">
          <a-tag size="small" color="gray">发送给推理模型的完整 Prompt</a-tag>
          <icon-down v-if="!showHarnessPreview" />
          <icon-up v-else />
        </a-space>
      </div>
      <transition name="panel-fade">
        <div v-if="showHarnessPreview" class="harness-preview-body">
          <div v-if="currentHarnessPrompt" class="harness-prompt-text">{{ currentHarnessPrompt }}</div>
          <div v-else class="harness-prompt-empty">配置好任务描述和 IO 样本后，此处将预览发送给推理模型的 Prompt</div>
        </div>
      </transition>
    </div>

    <!-- 版权声明 -->
    <div class="io2p-footer">© 2026 Timekettle SEG. All rights reserved.</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import Papa from 'papaparse'
import { parseCsvToDataItems, getSummary, selectAll, deselectAll, getSelectedCount, exportBatchData } from '../utils/dataHelpers'
import { createIO2PEngine } from '../utils/io2pEngine'
import { buildHarnessPrompt, buildFollowUpPrompt } from '../utils/harnessPrompt'

const props = defineProps({
  modelOptions: {
    type: Array,
    required: true
  },
  globalConfig: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate-back'])

// ─── Page State ───
const io2pState = reactive({
  ioSamples: [],
  taskDescription: '',
  targetModel: {
    model: 'gpt-3.5-turbo',
    apiKey: '',
    systemPrompt: '',
    temperature: 0.7,
    topP: 1,
    maxTokens: undefined,
    frequencyPenalty: 0,
    presencePenalty: 0,
    concurrency: 3,
    showParams: false
  },
  reasoningModel: {
    model: 'gpt-4o',
    apiKey: '',
    temperature: 0.3,
    topP: 1,
    maxTokens: 4096,
    showParams: false
  },
  maxRounds: 3,
  currentRound: 0,
  isRunning: false,
  iterationHistory: []
})

// ─── Temp configs for editing ───
const tempTargetConfig = reactive({
  model: 'gpt-3.5-turbo',
  apiKey: '',
  systemPrompt: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  concurrency: 3
})

const tempReasoningConfig = reactive({
  model: 'gpt-4o',
  apiKey: '',
  temperature: 0.3,
  topP: 1,
  maxTokens: 4096
})

// ─── Sample progress tracking ───
const sampleProgress = reactive({ completed: 0, total: 0 })
const currentRoundPrompt = ref('')

// ─── Round expand state ───
const expandedRounds = reactive({})

// ─── Engine reference ───
let engineRef = null

// ─── Harness preview ───
const showHarnessPreview = ref(false)

const currentHarnessPrompt = computed(() => {
  const selected = io2pState.ioSamples.filter(s => s.selected)
  if (!io2pState.taskDescription.trim() || selected.length === 0) return ''
  
  if (io2pState.iterationHistory.length === 0) {
    return buildHarnessPrompt({ taskDescription: io2pState.taskDescription, ioSamples: selected })
  } else {
    const prevRounds = io2pState.iterationHistory.map(h => ({
      roundNumber: h.roundNumber,
      prompt: h.generatedPrompt,
      outputs: h.outputs
    }))
    return buildFollowUpPrompt({ taskDescription: io2pState.taskDescription, ioSamples: selected, previousRounds: prevRounds })
  }
})

// ─── Computed ───
const canRun = computed(() => {
  return (
    io2pState.reasoningModel.model &&
    io2pState.reasoningModel.apiKey &&
    io2pState.targetModel.model &&
    io2pState.targetModel.apiKey &&
    io2pState.taskDescription.trim().length > 0 &&
    getSelectedCount(io2pState.ioSamples) > 0
  )
})

const reversedHistory = computed(() => {
  return [...io2pState.iterationHistory].reverse()
})

// ─── CSV Upload ───
function handleCsvUpload(fileList) {
  const fileItem = fileList[0]
  if (!fileItem) return
  const file = fileItem.file
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (!results.data || results.data.length === 0) {
        Message.error('CSV 文件为空或解析失败')
        return
      }
      const headers = Object.keys(results.data[0])
      const hasInput = headers.some(h => h.toLowerCase() === 'input')
      const hasExpected = headers.some(h => h.toLowerCase() === 'expected_output')
      if (!hasInput || !hasExpected) {
        Message.error('CSV 文件必须包含 input 和 expected_output 列')
        return
      }
      io2pState.ioSamples = parseCsvToDataItems(results.data)
      Message.success(`成功导入 ${io2pState.ioSamples.length} 条 IO 样本`)
    },
    error: (err) => {
      Message.error(`CSV 解析失败: ${err.message}`)
    }
  })
}

function downloadTemplate() {
  const csv = 'input,expected_output\n"你好","Hello"\n"谢谢","Thank you"\n'
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'io2p-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function clearSamples() {
  io2pState.ioSamples = []
}

function handleExport() {
  exportBatchData(io2pState.ioSamples, [])
}

// ─── Target Model Config ───
function saveTargetConfig() {
  Object.assign(io2pState.targetModel, {
    model: tempTargetConfig.model,
    apiKey: tempTargetConfig.apiKey,
    systemPrompt: tempTargetConfig.systemPrompt,
    temperature: tempTargetConfig.temperature,
    topP: tempTargetConfig.topP,
    maxTokens: tempTargetConfig.maxTokens,
    frequencyPenalty: tempTargetConfig.frequencyPenalty,
    presencePenalty: tempTargetConfig.presencePenalty,
    concurrency: tempTargetConfig.concurrency
  })
  io2pState.targetModel.showParams = false
  Message.success('目标模型配置已保存')
}

function cancelTargetConfig() {
  Object.assign(tempTargetConfig, {
    model: io2pState.targetModel.model,
    apiKey: io2pState.targetModel.apiKey,
    systemPrompt: io2pState.targetModel.systemPrompt,
    temperature: io2pState.targetModel.temperature,
    topP: io2pState.targetModel.topP,
    maxTokens: io2pState.targetModel.maxTokens,
    frequencyPenalty: io2pState.targetModel.frequencyPenalty,
    presencePenalty: io2pState.targetModel.presencePenalty,
    concurrency: io2pState.targetModel.concurrency
  })
  io2pState.targetModel.showParams = false
}

// ─── Reasoning Model Config ───
function saveReasoningConfig() {
  Object.assign(io2pState.reasoningModel, {
    model: tempReasoningConfig.model,
    apiKey: tempReasoningConfig.apiKey,
    temperature: tempReasoningConfig.temperature,
    topP: tempReasoningConfig.topP,
    maxTokens: tempReasoningConfig.maxTokens
  })
  io2pState.reasoningModel.showParams = false
  Message.success('推理模型配置已保存')
}

function cancelReasoningConfig() {
  Object.assign(tempReasoningConfig, {
    model: io2pState.reasoningModel.model,
    apiKey: io2pState.reasoningModel.apiKey,
    temperature: io2pState.reasoningModel.temperature,
    topP: io2pState.reasoningModel.topP,
    maxTokens: io2pState.reasoningModel.maxTokens
  })
  io2pState.reasoningModel.showParams = false
}

// ─── Round expand toggle ───
function toggleRound(roundNumber) {
  expandedRounds[roundNumber] = !expandedRounds[roundNumber]
}

// ─── Run / Stop ───
function startRun() {
  if (!canRun.value) return

  io2pState.isRunning = true
  io2pState.currentRound = 0
  io2pState.iterationHistory = []
  currentRoundPrompt.value = ''
  sampleProgress.completed = 0
  sampleProgress.total = 0
  // Reset expanded rounds
  Object.keys(expandedRounds).forEach(k => delete expandedRounds[k])

  const engine = createIO2PEngine({
    taskDescription: io2pState.taskDescription,
    ioSamples: io2pState.ioSamples,
    reasoningConfig: {
      model: io2pState.reasoningModel.model,
      apiKey: io2pState.reasoningModel.apiKey,
      temperature: io2pState.reasoningModel.temperature,
      topP: io2pState.reasoningModel.topP,
      maxTokens: io2pState.reasoningModel.maxTokens
    },
    targetConfig: {
      model: io2pState.targetModel.model,
      apiKey: io2pState.targetModel.apiKey,
      systemPrompt: io2pState.targetModel.systemPrompt,
      temperature: io2pState.targetModel.temperature,
      topP: io2pState.targetModel.topP,
      maxTokens: io2pState.targetModel.maxTokens,
      frequencyPenalty: io2pState.targetModel.frequencyPenalty,
      presencePenalty: io2pState.targetModel.presencePenalty,
      concurrency: io2pState.targetModel.concurrency
    },
    maxRounds: io2pState.maxRounds,
    onRoundStart: (round, total) => {
      io2pState.currentRound = round
      currentRoundPrompt.value = ''
      sampleProgress.completed = 0
      sampleProgress.total = getSelectedCount(io2pState.ioSamples)
    },
    onPromptGenerated: (round, prompt) => {
      currentRoundPrompt.value = prompt
    },
    onSampleProgress: (round, completed, total) => {
      sampleProgress.completed = completed
      sampleProgress.total = total
    },
    onRoundComplete: (roundData) => {
      io2pState.iterationHistory.push(roundData)
      // Auto-expand latest round, collapse others
      Object.keys(expandedRounds).forEach(k => { expandedRounds[k] = false })
      expandedRounds[roundData.roundNumber] = true
    },
    onAllComplete: (history) => {
      io2pState.isRunning = false
      currentRoundPrompt.value = ''
      Message.success(`迭代完成！共 ${history.length} 轮`)
    },
    onError: (round, errorMsg) => {
      io2pState.isRunning = false
      currentRoundPrompt.value = ''
      Message.error(`第 ${round} 轮出错: ${errorMsg}`)
    }
  })

  engineRef = engine
  engine.start()
}

function stopRun() {
  if (engineRef) {
    engineRef.abort()
    engineRef = null
  }
  io2pState.isRunning = false
  currentRoundPrompt.value = ''
  Message.warning('迭代已停止')
}
</script>

<style scoped>
.io2p-container {
  padding: 24px 32px 60px;
  background-color: #f2f3f5;
  min-height: 100vh;
}

/* Header */
.io2p-header {
  margin-bottom: 24px;
}
.io2p-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.io2p-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1d2129;
  letter-spacing: -0.5px;
}
.io2p-header-subtitle {
  color: #86909c;
  font-size: 13px;
  margin-left: 4px;
}

/* 3-column layout (reuse App.vue patterns) */
.workflow-row {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.workflow-node {
  flex: 1;
  min-width: 0;
}
.workflow-edge {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  position: relative;
}
.workflow-edge::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 3px;
  background-color: #c9cdd4;
  border-radius: 2px;
}
.workflow-edge::after {
  content: '';
  position: absolute;
  right: 4px;
  width: 10px;
  height: 10px;
  border-top: 3px solid #c9cdd4;
  border-right: 3px solid #c9cdd4;
  transform: rotate(45deg);
  border-radius: 1px;
}

/* Card */
.card-col {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}
.card-col:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
:deep(.arco-card-header) {
  border-bottom: 1px solid #f2f3f5;
  padding: 16px 20px;
}
:deep(.arco-card-header-title) {
  font-weight: 600;
  color: #4e5969;
}
:deep(.arco-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}
:deep(.arco-textarea) {
  border-radius: 8px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
}

/* Data list (reuse App.vue patterns) */
.data-list-container {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}
.data-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.data-item {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s;
}
.data-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  background: #fafafa;
  transition: background-color 0.2s;
}
.data-item-header:hover {
  background: #f2f3f5;
}
.data-item-index {
  font-size: 12px;
  color: #86909c;
  font-weight: 600;
  min-width: 28px;
}
.data-item-summary {
  flex: 1;
  font-size: 13px;
  color: #4e5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-item-toggle {
  color: #86909c;
  font-size: 12px;
  flex-shrink: 0;
}
.data-item-body {
  padding: 8px 12px;
  border-top: 1px solid #f2f3f5;
  background: #fff;
}
.data-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 4px;
  border-bottom: 1px solid #f2f3f5;
}
.data-list-count {
  font-size: 12px;
  color: #86909c;
}

/* IO pair detail */
.io-pair-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.io-pair-section {
  padding: 6px 8px;
  border-radius: 4px;
  background: #f7f8fa;
}
.io-pair-label {
  font-size: 11px;
  font-weight: 600;
  color: #165dff;
  margin-bottom: 4px;
}
.io-pair-label-expected {
  color: #67c23a;
}
.io-pair-content {
  font-size: 13px;
  color: #1d2129;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Empty states */
.empty-samples, .empty-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: #86909c;
  font-size: 13px;
  text-align: center;
}
.empty-samples code {
  background: #f2f3f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* Config section label */
.config-section-label {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  margin-bottom: 8px;
}

/* Config blocks */
.config-block {
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  overflow: hidden;
}
.config-block-blue {
  border-color: rgba(22, 93, 255, 0.2);
}
.config-block-purple {
  border-color: rgba(114, 46, 209, 0.2);
}
.config-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.config-block-blue .config-block-header {
  background: rgba(22, 93, 255, 0.03);
}
.config-block-blue .config-block-header:hover {
  background: rgba(22, 93, 255, 0.06);
}
.config-block-purple .config-block-header {
  background: rgba(114, 46, 209, 0.03);
}
.config-block-purple .config-block-header:hover {
  background: rgba(114, 46, 209, 0.06);
}
.config-block-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-block-body {
  padding: 12px;
  border-top: 1px solid #f2f3f5;
  background: #fff;
}
.config-block-body :deep(.arco-form-item) {
  margin-bottom: 2px;
}
.config-block-body :deep(.arco-form-item-label-col) {
  margin-bottom: 0;
  line-height: 1.2;
}

/* Run control */
.run-control-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.iteration-config {
  display: flex;
  align-items: center;
  gap: 12px;
}
.iteration-label {
  font-size: 13px;
  font-weight: 500;
  color: #4e5969;
}
.run-btn {
  height: 40px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(22, 93, 255, 0.2);
}
.run-progress-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.validation-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hint-item {
  font-size: 12px;
  color: #ff7d00;
  background: #fff7e8;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #ffe4ba;
}

/* History list */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
}
.history-round {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
}
.history-round-running {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
}
.history-round-failed {
  border-color: #f53f3f;
}
.round-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  background: #fafafa;
  transition: background-color 0.2s;
}
.round-header:hover {
  background: #f2f3f5;
}
.round-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.round-status-text {
  font-size: 12px;
  color: #165dff;
  font-weight: 500;
}
.round-detail {
  padding: 12px;
  border-top: 1px solid #f2f3f5;
  background: #fff;
}
.round-section {
  margin-bottom: 12px;
}
.round-section:last-child {
  margin-bottom: 0;
}
.round-section-label {
  font-size: 12px;
  font-weight: 600;
  color: #4e5969;
  margin-bottom: 6px;
}
.round-prompt-text {
  font-size: 13px;
  color: #1d2129;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f8fa;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #e5e6eb;
  max-height: 200px;
  overflow-y: auto;
}
.round-prompt-preview {
  padding: 8px 12px;
  border-top: 1px solid #f2f3f5;
}

/* Output comparison */
.round-outputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.round-output-item {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: hidden;
}
.round-output-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fafafa;
}
.output-compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #e5e6eb;
}
.compare-col {
  padding: 8px 10px;
  background: #fff;
}
.compare-col-expected {
  background: #f0f9eb;
}
.compare-label {
  font-size: 11px;
  font-weight: 600;
  color: #165dff;
  margin-bottom: 4px;
}
.compare-label-expected {
  color: #67c23a;
}
.compare-content {
  font-size: 13px;
  color: #1d2129;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.output-result-error {
  font-size: 13px;
  color: #f53f3f;
  padding: 8px 10px;
  line-height: 1.6;
}

/* Panel transition */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Spin animation */
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Harness Prompt 预览 */
.harness-preview-section {
  margin-top: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}
.harness-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.harness-preview-header:hover {
  background-color: #f7f8fa;
}
.harness-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  display: flex;
  align-items: center;
  gap: 8px;
}
.harness-preview-body {
  padding: 16px 20px;
  border-top: 1px solid #f2f3f5;
  background: #fcfcfc;
}
.harness-prompt-text {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #1d2129;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f8fa;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  max-height: 400px;
  overflow-y: auto;
}
.harness-prompt-empty {
  font-size: 13px;
  color: #86909c;
  text-align: center;
  padding: 20px;
}
.io2p-footer {
  text-align: center;
  padding: 24px 0 12px;
  font-size: 12px;
  color: #c9cdd4;
}
</style>
