<template>
  <div class="app-container">
    <div class="header">
      <div class="header-title">
        <h2>✨ Prompt Tuner</h2>
        <div class="header-subtitle">
          LLM 提示词对比调试与 Agent 调优助手
          <span v-if="visitStats" class="visit-stats">
            <icon-eye /> {{ visitStats.totalVisits }} 次访问 · {{ visitStats.uniqueVisitors }} 位访客
          </span>
        </div>
      </div>
      <a-space>
        <a-button :type="currentPage === 'io2p' ? 'primary' : 'outline'" @click="currentPage = currentPage === 'io2p' ? 'tuner' : 'io2p'">
          <template #icon><icon-experiment /></template>
          IO2P
        </a-button>
        <a-button type="outline" status="success" @click="exportData">
          <template #icon><icon-download /></template>
          导出记录
        </a-button>
        <a-button type="outline" status="warning" @click="showDebugPanel = true">
          <template #icon><icon-bug /></template>
          Debug 日志
        </a-button>
        <a-button type="outline" @click="resetData">重置数据</a-button>
      </a-space>
    </div>

    <!-- Main Tuner Page -->
    <div v-show="currentPage === 'tuner'">

    <!-- 全局模型配置 -->
    <div class="global-config-row">
      <div class="global-config-header" @click="globalConfig.expanded ? cancelGlobalConfig() : openGlobalConfig()">
        <span class="global-config-title">
          <icon-settings /> 全局模型配置
        </span>
        <a-space>
          <a-tag size="small" color="blue">{{ globalConfig.model }}</a-tag>
          <a-tag size="small" color="green">并发: {{ globalConfig.concurrency }}</a-tag>
          <icon-down v-if="!globalConfig.expanded" />
          <icon-up v-else />
        </a-space>
      </div>
      <transition name="panel-fade">
        <div v-if="globalConfig.expanded" class="global-config-panel">
          <a-form layout="vertical" :model="tempGlobalConfig" size="small">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="模型选择">
                  <a-select v-model="tempGlobalConfig.model" placeholder="请选择模型">
                    <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                      <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                    </a-optgroup>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="API Key">
                  <a-input-password v-model="tempGlobalConfig.apiKey" placeholder="全局 API Key" allow-clear />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item label="并发数">
                  <a-input-number v-model="tempGlobalConfig.concurrency" :min="1" :max="10" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item label="Temperature">
                  <a-input-number v-model="tempGlobalConfig.temperature" :min="0" :max="2" :step="0.1" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="24">
                <a-form-item label="System Prompt（全局）">
                  <a-textarea v-model="tempGlobalConfig.systemPrompt" placeholder="可选：全局系统级指令，各模块可单独覆盖..." :auto-size="{ minRows: 2, maxRows: 4 }" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="6">
                <a-form-item label="Top P">
                  <a-input-number v-model="tempGlobalConfig.topP" :min="0" :max="1" :step="0.05" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Max Tokens">
                  <a-input-number v-model="tempGlobalConfig.maxTokens" placeholder="默认" :min="1" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Frequency Penalty">
                  <a-input-number v-model="tempGlobalConfig.frequencyPenalty" :min="-2" :max="2" :step="0.1" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Presence Penalty">
                  <a-input-number v-model="tempGlobalConfig.presencePenalty" :min="-2" :max="2" :step="0.1" />
                </a-form-item>
              </a-col>
            </a-row>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
              <a-button @click="cancelGlobalConfig()">取消</a-button>
              <a-button status="warning" @click="resetAllModules()">重置模块配置</a-button>
              <a-button type="primary" @click="saveGlobalConfig()">保存全局配置</a-button>
            </div>
          </a-form>
        </div>
      </transition>
    </div>

    <!-- Module 1 -->
    <div class="module-row">
      <div class="module-header">
        <div class="module-title">模块一：对比组 A</div>
      </div>
      <div class="workflow-row">
        <!-- 左边：Input -->
        <div class="workflow-node">
          <a-card title="Input 数据源" :bordered="false" class="card-col input-card">
            <template #extra>
              <a-space>
                <a-upload :auto-upload="false" accept=".csv" @change="(files) => handleCsvUpload(files[0], 1)" :show-file-list="false">
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
                <a-button type="text" size="small" @click="syncData(1, 'input')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
              </a-space>
            </template>
            <!-- When CSV data exists: show drawer list -->
            <div v-if="m1.csvData && m1.csvData.length > 0" class="data-list-container">
              <div class="data-list-toolbar">
                <a-space size="small">
                  <a-button size="mini" type="outline" @click="selectAll(m1.csvData)">全选</a-button>
                  <a-button size="mini" type="outline" @click="deselectAll(m1.csvData)">全不选</a-button>
                  <span class="data-list-count">已选 {{ getSelectedCount(m1.csvData) }} / 共 {{ m1.csvData.length }} 条</span>
                </a-space>
                <a-space size="small">
                  <a-button size="mini" type="text" @click="exportBatchData(m1.csvData, m1.outputList)">
                    <template #icon><icon-download /></template>
                    导出
                  </a-button>
                  <a-button size="mini" type="text" status="danger" @click="clearCsv(1)">清除</a-button>
                </a-space>
              </div>
              <div class="data-list">
                <div v-for="(item, index) in m1.csvData" :key="item.id" 
                     class="data-item" :class="{ 'data-item-focused': index === m1.csvFocusIndex, 'data-item-expanded': item.expanded }">
                  <div class="data-item-header" @click="item.expanded = !item.expanded">
                    <a-checkbox v-model="item.selected" @click.stop />
                    <span class="data-item-index">#{{ item.id }}</span>
                    <span class="data-item-summary">{{ getSummary(item.content) }}</span>
                    <icon-down v-if="!item.expanded" class="data-item-toggle" />
                    <icon-up v-else class="data-item-toggle" />
                  </div>
                  <div v-if="item.expanded" class="data-item-body">
                    <a-textarea v-model="item.content" :auto-size="{ minRows: 2, maxRows: 8 }" @blur="updateDataItem(m1.csvData, item.id, item.content)" />
                  </div>
                </div>
              </div>
              <div class="data-list-nav">
                <a-button size="mini" type="outline" :disabled="m1.csvFocusIndex === 0" @click="m1.csvFocusIndex = navigateFocus(m1.csvData, m1.csvFocusIndex, 'up')">
                  <template #icon><icon-up /></template>
                </a-button>
                <span class="nav-indicator">{{ m1.csvFocusIndex + 1 }} / {{ m1.csvData.length }}</span>
                <a-button size="mini" type="outline" :disabled="m1.csvFocusIndex === m1.csvData.length - 1" @click="m1.csvFocusIndex = navigateFocus(m1.csvData, m1.csvFocusIndex, 'down')">
                  <template #icon><icon-down /></template>
                </a-button>
              </div>
            </div>
            <!-- When no CSV data: show original textarea -->
            <a-textarea v-else v-model="m1.input" placeholder="输入待处理的原始数据或前置上下文..." :auto-size="{ minRows: 6, maxRows: 15 }" />
          </a-card>
        </div>

        <div class="workflow-edge"></div>

        <!-- 中间：Prompt & Params -->
        <div class="workflow-node">
          <a-card title="Prompt & 模型配置" :bordered="false" class="card-col prompt-card-container">
            <template #extra>
              <a-space>
                <a-button type="text" size="small" @click="showHistory(1)">
                  <template #icon><icon-history /></template>
                  历史记录
                </a-button>
                <a-button type="text" size="small" @click="syncData(1, 'prompt')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
                <a-button type="text" size="small" @click="openParams(1)">
                  <template #icon><icon-settings /></template>
                  参数配置
                </a-button>
              </a-space>
            </template>
            
            <!-- Prompt 历史版本虚线进度条 -->
            <div v-if="m1History.length > 0" class="history-timeline">
              <span class="timeline-label">历史回滚:</span>
              <div class="timeline-track">
                <div v-for="(item, index) in m1History" :key="index" class="timeline-point">
                  <a-tooltip :content="`[${item.time}] 点击回滚`">
                    <div class="point-dot" @click="restorePrompt(1, item.content)"></div>
                  </a-tooltip>
                  <div v-if="index < m1History.length - 1" class="point-line"></div>
                </div>
              </div>
            </div>

            <a-textarea v-model="m1.prompt" placeholder="在此编写 User Prompt（用户指令）..." :auto-size="{ minRows: 6, maxRows: 15 }" @change="savePromptHistory(1)" />
            
            <div class="brief-params-container">
              <div class="brief-params" :class="{ 'params-dimmed': m1.hideBriefParams }">
                <a-space size="large">
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.model && !m1.hideBriefParams }">
                    <icon-robot /> {{ m1.model }}
                  </span>
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.temperature && !m1.hideBriefParams }">
                    <icon-dashboard /> T: {{ m1.temperature }}
                  </span>
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.topP && !m1.hideBriefParams }">
                    <icon-thunderbolt /> P: {{ m1.topP }}
                  </span>
                </a-space>
              </div>
              <a-button type="text" size="mini" class="toggle-brief-btn" @click="m1.hideBriefParams = !m1.hideBriefParams">
                <template #icon>
                  <icon-eye-invisible v-if="!m1.hideBriefParams" />
                  <icon-eye v-else />
                </template>
              </a-button>
            </div>

            <a-button v-if="!m1.loading" type="primary" class="run-btn" long @click="runLinked(m1)" :disabled="linkedRun">
              <template #icon><icon-play-arrow /></template>
              {{ linkedRun ? '联动模式（按中间按钮）' : '运行测试 (Run)' }}
            </a-button>
            <a-button v-else type="primary" status="danger" class="run-btn" long @click="stopRun(1)">
              <template #icon><icon-pause /></template>
              停止运行
            </a-button>

            <!-- 卡片内蒙层：参数配置 -->
            <div class="card-overlay" :class="{ 'overlay-visible': m1.showParams }">
              <div class="overlay-header">
                <div class="overlay-title">模型参数配置</div>
              </div>
              <div class="overlay-content">
                <a-form layout="vertical" :model="tempConfig1" size="small">
                  <div class="form-section-title">基础配置</div>
                  <a-form-item label="模型选择" field="model" style="margin-bottom: 4px;">
                    <a-select v-model="tempConfig1.model" placeholder="请选择模型">
                      <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                        <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                      </a-optgroup>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="API Key" field="apiKey" style="margin-bottom: 4px;">
                    <a-input-password v-model="tempConfig1.apiKey" placeholder="输入对应平台的 API Key" allow-clear />
                  </a-form-item>
                  <a-form-item label="System Prompt" field="systemPrompt" style="margin-bottom: 4px;">
                    <a-textarea v-model="tempConfig1.systemPrompt" placeholder="可选：输入系统级指令，如角色设定、输出格式要求等..." :auto-size="{ minRows: 2, maxRows: 5 }" />
                  </a-form-item>

                  <a-divider style="margin: 8px 0;" />
                  <div class="form-section-title">高级生成参数</div>
                  
                  <a-form-item field="temperature">
                    <template #label>
                      <div class="param-label">
                        <span>Temperature</span>
                        <a-tooltip content="控制生成文本的随机性。值越高输出越随机；值越低输出越确定。">
                          <icon-question-circle class="help-icon" />
                        </a-tooltip>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig1.temperature" :min="0" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig1.temperature" :min="0" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(1)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="topP">
                    <template #label>
                      <div class="param-label">
                        <span>Top P</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig1.topP" :min="0" :max="1" :step="0.05" style="flex: 1;" />
                      <a-input-number v-model="tempConfig1.topP" :min="0" :max="1" :step="0.05" style="width: 70px;" @press-enter="saveParams(1)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="maxTokens">
                    <template #label>
                      <div class="param-label">
                        <span>Max Tokens</span>
                      </div>
                    </template>
                    <a-input-number v-model="tempConfig1.maxTokens" placeholder="默认" :min="1" @press-enter="saveParams(1)" />
                  </a-form-item>

                  <a-form-item field="frequencyPenalty">
                    <template #label>
                      <div class="param-label">
                        <span>Frequency Penalty</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig1.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig1.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(1)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="presencePenalty" style="margin-bottom: 0;">
                    <template #label>
                      <div class="param-label">
                        <span>Presence Penalty</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig1.presencePenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig1.presencePenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(1)" />
                    </div>
                  </a-form-item>
                </a-form>
              </div>
              <div class="overlay-footer">
                <a-button @click="cancelParams(1)" style="margin-right: 12px;">取消</a-button>
                <a-button type="primary" @click="saveParams(1)" :loading="isVerifyingKey[1]">保存配置</a-button>
              </div>
            </div>
          </a-card>
        </div>

        <div class="workflow-edge"></div>

        <!-- 右边：Output -->
        <div class="workflow-node">
          <a-card :bordered="false" class="card-col output-card">
            <template #title>
              <div class="output-card-title">
                <span>Output 生成结果</span>
                <div class="output-stats" v-if="m1.latency || m1.tokenUsage">
                  <a-tag size="small" color="blue" v-if="m1.latency">
                    <template #icon><icon-clock-circle /></template>
                    {{ m1.latency }} ms
                  </a-tag>
                  <a-tag size="small" color="green" v-if="m1.tokenUsage">
                    <template #icon><icon-layers /></template>
                    {{ m1.tokenUsage }} tokens
                  </a-tag>
                </div>
              </div>
            </template>
            <template #extra>
              <a-button type="text" size="small" @click="copyText(m1.output)">
                <template #icon><icon-copy /></template>
                复制结果
              </a-button>
            </template>
            <!-- Output list mode when batch results exist -->
            <div v-if="m1.outputList && m1.outputList.length > 0" class="data-list-container">
              <div v-if="m1.batchProgress" class="batch-progress-bar">
                <a-progress :percent="Math.min(100, m1.batchProgress.total > 0 ? Math.round(m1.batchProgress.completed / m1.batchProgress.total * 100) : 0)" size="small" />
                <a-tag v-if="m1.batchProgress.completed < m1.batchProgress.total" size="small" color="blue">
                  <template #icon><icon-loading class="spin-icon" /></template>
                  {{ formatProgress(m1.batchProgress.completed, m1.batchProgress.total) }}
                </a-tag>
                <a-tag v-else size="small" color="green">已完成</a-tag>
                <a-tag v-if="m1.batchProgress.totalLatency" size="small" color="blue">
                  <template #icon><icon-clock-circle /></template>
                  {{ m1.batchProgress.totalLatency }} ms
                </a-tag>
                <a-tag v-if="m1.batchProgress.totalTokens" size="small" color="green">
                  <template #icon><icon-layers /></template>
                  {{ m1.batchProgress.totalTokens }} tokens
                </a-tag>
                <a-button v-if="m1.loading && m1.batchProgress" size="mini" status="danger" @click="abortBatchRun(1)">中止</a-button>
              </div>
              <div class="data-list">
                <div v-for="(result, index) in m1.outputList" :key="result.id"
                     class="data-item" :class="{ 'data-item-focused': index === m1.csvFocusIndex }">
                  <div class="data-item-header" @click="result.expanded = !result.expanded">
                    <span class="data-item-index">#{{ result.id }}</span>
                    <a-tag size="small" :color="result.status === 'completed' ? 'green' : result.status === 'failed' ? 'red' : result.status === 'running' ? 'blue' : 'gray'">
                      {{ result.status === 'completed' ? '完成' : result.status === 'failed' ? '失败' : result.status === 'running' ? '运行中' : '等待中' }}
                    </a-tag>
                    <span class="data-item-summary">{{ result.status === 'completed' ? getSummary(result.content) : (result.error || '等待运行...') }}</span>
                    <icon-down v-if="!result.expanded" class="data-item-toggle" />
                    <icon-up v-else class="data-item-toggle" />
                  </div>
                  <div v-if="result.expanded" class="data-item-body">
                    <div v-if="result.status === 'completed'" class="output-result-content">{{ result.content }}</div>
                    <div v-else-if="result.status === 'failed'" class="output-result-error">{{ result.error }}</div>
                    <div v-else class="output-result-pending">等待运行...</div>
                    <div v-if="result.status === 'completed' && m1.csvData.find(d => d.id === result.id)?.expectedOutput" class="expected-output-compare">
                      <div class="expected-label">预期输出:</div>
                      <div class="expected-content">{{ m1.csvData.find(d => d.id === result.id).expectedOutput }}</div>
                    </div>
                    <div v-if="result.latency || result.tokenUsage" class="output-result-stats">
                      <a-tag size="small" color="blue" v-if="result.latency"><icon-clock-circle /> {{ result.latency }} ms</a-tag>
                      <a-tag size="small" color="green" v-if="result.tokenUsage"><icon-layers /> {{ result.tokenUsage }} tokens</a-tag>
                    </div>
                  </div>
                </div>
              </div>
              <div class="data-list-nav">
                <a-button size="mini" type="outline" :disabled="m1.csvFocusIndex === 0" @click="m1.csvFocusIndex = navigateFocus(m1.outputList, m1.csvFocusIndex, 'up')">
                  <template #icon><icon-up /></template>
                </a-button>
                <span class="nav-indicator">{{ m1.csvFocusIndex + 1 }} / {{ m1.outputList.length }}</span>
                <a-button size="mini" type="outline" :disabled="m1.csvFocusIndex === m1.outputList.length - 1" @click="m1.csvFocusIndex = navigateFocus(m1.outputList, m1.csvFocusIndex, 'down')">
                  <template #icon><icon-down /></template>
                </a-button>
              </div>
            </div>
            <!-- Original single output mode -->
            <template v-else>
              <a-textarea class="output-textarea" v-model="m1.output" readonly placeholder="模型生成的输出结果将在此显示..." :auto-size="{ minRows: 6, maxRows: 12 }" />
            </template>
            
            <div class="feedback-section">
              <a-divider style="margin: 12px 0;" />
              <div class="feedback-header">
                <span class="feedback-title">对结果不满意？让 Agent 帮你调优：</span>
              </div>
              <div class="feedback-input-group">
                <a-textarea v-model="m1.feedback" placeholder="输入您的修改意见，例如：'语气太生硬了，更活泼一点'..." :auto-size="{ minRows: 2, maxRows: 4 }" />
                <a-button type="primary" class="feedback-submit-btn" @click="submitFeedback(1)" :loading="m1.feedbackLoading">
                  <template #icon><icon-send /></template>
                </a-button>
              </div>
            </div>
          </a-card>
        </div>
      </div>
    </div>

    <!-- 锁定联动按钮 + 跑道连接线 -->
    <div class="link-lock-row" :class="{ 'link-locked': linkedRun }">
      <!-- 同步方向动画 -->
      <transition name="sync-fly">
        <div v-if="syncAnimation.active" class="sync-fly-indicator" :class="['sync-fly-' + syncAnimation.direction, 'sync-pos-' + syncAnimation.type]">
          <icon-arrow-down v-if="syncAnimation.direction === 'down'" />
          <icon-arrow-up v-else />
          <span class="sync-fly-label">{{ syncAnimation.type === 'input' ? 'Input' : 'Prompt' }}</span>
        </div>
      </transition>
      <!-- 联动发射动画 -->
      <transition name="sync-fly">
        <div v-if="linkedRunAnimation" class="linked-run-blast linked-blast-up">
          <icon-play-arrow />
        </div>
      </transition>
      <transition name="sync-fly">
        <div v-if="linkedRunAnimation" class="linked-run-blast linked-blast-down">
          <icon-play-arrow />
        </div>
      </transition>
      <div class="runway-line runway-line-top" :class="{ 'runway-active': linkedRun }">
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
      </div>
      <div class="lock-controls">
        <a-tooltip :content="linkedRun ? '已锁定：点击任一运行按钮同时运行两个模块' : '未锁定：各模块独立运行'">
          <div class="lock-btn-wrapper" :class="{ 'lock-active': linkedRun }" @click="linkedRun = !linkedRun">
            <div class="lock-icon-inner">
              <icon-lock v-if="linkedRun" />
              <icon-unlock v-else />
            </div>
            <div v-if="linkedRun" class="lock-pulse"></div>
            <div v-if="linkedRun" class="lock-pulse lock-pulse-delay"></div>
          </div>
        </a-tooltip>
        <!-- 联动总控按钮 -->
        <transition name="panel-fade">
          <div v-if="linkedRun" class="linked-run-controls">
            <a-button v-if="!m1.loading && !m2.loading" type="primary" size="small" @click="linkedStart" class="linked-run-btn">
              <template #icon><icon-play-arrow /></template>
              联动运行
            </a-button>
            <a-button v-else type="primary" status="danger" size="small" @click="linkedStop" class="linked-run-btn">
              <template #icon><icon-pause /></template>
              全部停止
            </a-button>
          </div>
        </transition>
      </div>
      <span class="link-lock-label" :class="{ 'label-active': linkedRun }">{{ linkedRun ? '联动运行' : '独立运行' }}</span>
      <div class="runway-line runway-line-bottom" :class="{ 'runway-active': linkedRun }">
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
        <span class="runway-dot"></span>
      </div>
    </div>

    <!-- Module 2 -->
    <div class="module-row">
      <div class="module-header">
        <div class="module-title">模块二：对比组 B</div>
      </div>
      <div class="workflow-row">
        <!-- 左边：Input -->
        <div class="workflow-node">
          <a-card title="Input 数据源" :bordered="false" class="card-col input-card">
            <template #extra>
              <a-space>
                <a-upload :auto-upload="false" accept=".csv" @change="(files) => handleCsvUpload(files[0], 2)" :show-file-list="false">
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
                <a-button type="text" size="small" @click="syncData(2, 'input')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
              </a-space>
            </template>
            <!-- When CSV data exists: show drawer list -->
            <div v-if="m2.csvData && m2.csvData.length > 0" class="data-list-container">
              <div class="data-list-toolbar">
                <a-space size="small">
                  <a-button size="mini" type="outline" @click="selectAll(m2.csvData)">全选</a-button>
                  <a-button size="mini" type="outline" @click="deselectAll(m2.csvData)">全不选</a-button>
                  <span class="data-list-count">已选 {{ getSelectedCount(m2.csvData) }} / 共 {{ m2.csvData.length }} 条</span>
                </a-space>
                <a-space size="small">
                  <a-button size="mini" type="text" @click="exportBatchData(m2.csvData, m2.outputList)">
                    <template #icon><icon-download /></template>
                    导出
                  </a-button>
                  <a-button size="mini" type="text" status="danger" @click="clearCsv(2)">清除</a-button>
                </a-space>
              </div>
              <div class="data-list">
                <div v-for="(item, index) in m2.csvData" :key="item.id" 
                     class="data-item" :class="{ 'data-item-focused': index === m2.csvFocusIndex, 'data-item-expanded': item.expanded }">
                  <div class="data-item-header" @click="item.expanded = !item.expanded">
                    <a-checkbox v-model="item.selected" @click.stop />
                    <span class="data-item-index">#{{ item.id }}</span>
                    <span class="data-item-summary">{{ getSummary(item.content) }}</span>
                    <icon-down v-if="!item.expanded" class="data-item-toggle" />
                    <icon-up v-else class="data-item-toggle" />
                  </div>
                  <div v-if="item.expanded" class="data-item-body">
                    <a-textarea v-model="item.content" :auto-size="{ minRows: 2, maxRows: 8 }" @blur="updateDataItem(m2.csvData, item.id, item.content)" />
                  </div>
                </div>
              </div>
              <div class="data-list-nav">
                <a-button size="mini" type="outline" :disabled="m2.csvFocusIndex === 0" @click="m2.csvFocusIndex = navigateFocus(m2.csvData, m2.csvFocusIndex, 'up')">
                  <template #icon><icon-up /></template>
                </a-button>
                <span class="nav-indicator">{{ m2.csvFocusIndex + 1 }} / {{ m2.csvData.length }}</span>
                <a-button size="mini" type="outline" :disabled="m2.csvFocusIndex === m2.csvData.length - 1" @click="m2.csvFocusIndex = navigateFocus(m2.csvData, m2.csvFocusIndex, 'down')">
                  <template #icon><icon-down /></template>
                </a-button>
              </div>
            </div>
            <!-- When no CSV data: show original textarea -->
            <a-textarea v-else v-model="m2.input" placeholder="输入待处理的原始数据或前置上下文..." :auto-size="{ minRows: 6, maxRows: 15 }" />
          </a-card>
        </div>

        <div class="workflow-edge"></div>

        <!-- 中间：Prompt & Params -->
        <div class="workflow-node">
          <a-card title="Prompt & 模型配置" :bordered="false" class="card-col prompt-card-container">
            <template #extra>
              <a-space>
                <a-button type="text" size="small" @click="showHistory(2)">
                  <template #icon><icon-history /></template>
                  历史记录
                </a-button>
                <a-button type="text" size="small" @click="syncData(2, 'prompt')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
                <a-button type="text" size="small" @click="openParams(2)">
                  <template #icon><icon-settings /></template>
                  参数配置
                </a-button>
              </a-space>
            </template>
            
            <!-- Prompt 历史版本虚线进度条 -->
            <div v-if="m2History.length > 0" class="history-timeline">
              <span class="timeline-label">历史回滚:</span>
              <div class="timeline-track">
                <div v-for="(item, index) in m2History" :key="index" class="timeline-point">
                  <a-tooltip :content="`[${item.time}] 点击回滚`">
                    <div class="point-dot" @click="restorePrompt(2, item.content)"></div>
                  </a-tooltip>
                  <div v-if="index < m2History.length - 1" class="point-line"></div>
                </div>
              </div>
            </div>

            <a-textarea v-model="m2.prompt" placeholder="在此编写 User Prompt（用户指令）..." :auto-size="{ minRows: 6, maxRows: 15 }" @change="savePromptHistory(2)" />
            
            <div class="brief-params-container">
              <div class="brief-params" :class="{ 'params-dimmed': m2.hideBriefParams }">
                <a-space size="large">
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.model && !m2.hideBriefParams }">
                    <icon-robot /> {{ m2.model }}
                  </span>
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.temperature && !m2.hideBriefParams }">
                    <icon-dashboard /> T: {{ m2.temperature }}
                  </span>
                  <span class="brief-item" :class="{ 'diff-highlight': diffKeys.topP && !m2.hideBriefParams }">
                    <icon-thunderbolt /> P: {{ m2.topP }}
                  </span>
                </a-space>
              </div>
              <a-button type="text" size="mini" class="toggle-brief-btn" @click="m2.hideBriefParams = !m2.hideBriefParams">
                <template #icon>
                  <icon-eye-invisible v-if="!m2.hideBriefParams" />
                  <icon-eye v-else />
                </template>
              </a-button>
            </div>

            <a-button v-if="!m2.loading" type="primary" class="run-btn" long @click="runLinked(m2)" :disabled="linkedRun">
              <template #icon><icon-play-arrow /></template>
              {{ linkedRun ? '联动模式（按中间按钮）' : '运行测试 (Run)' }}
            </a-button>
            <a-button v-else type="primary" status="danger" class="run-btn" long @click="stopRun(2)">
              <template #icon><icon-pause /></template>
              停止运行
            </a-button>

            <!-- 卡片内蒙层：参数配置 -->
            <div class="card-overlay" :class="{ 'overlay-visible': m2.showParams }">
              <div class="overlay-header">
                <div class="overlay-title">模型参数配置</div>
              </div>
              <div class="overlay-content">
                <a-form layout="vertical" :model="tempConfig2" size="small">
                  <div class="form-section-title">基础配置</div>
                  <a-form-item label="模型选择" field="model" style="margin-bottom: 4px;">
                    <a-select v-model="tempConfig2.model" placeholder="请选择模型">
                      <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                        <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                      </a-optgroup>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="API Key" field="apiKey" style="margin-bottom: 4px;">
                    <a-input-password v-model="tempConfig2.apiKey" placeholder="输入对应平台的 API Key" allow-clear />
                  </a-form-item>
                  <a-form-item label="System Prompt" field="systemPrompt" style="margin-bottom: 4px;">
                    <a-textarea v-model="tempConfig2.systemPrompt" placeholder="可选：输入系统级指令，如角色设定、输出格式要求等..." :auto-size="{ minRows: 2, maxRows: 5 }" />
                  </a-form-item>

                  <a-divider style="margin: 8px 0;" />
                  <div class="form-section-title">高级生成参数</div>
                  
                  <a-form-item field="temperature">
                    <template #label>
                      <div class="param-label">
                        <span>Temperature</span>
                        <a-tooltip content="控制生成文本的随机性。值越高输出越随机；值越低输出越确定。">
                          <icon-question-circle class="help-icon" />
                        </a-tooltip>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig2.temperature" :min="0" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig2.temperature" :min="0" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(2)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="topP">
                    <template #label>
                      <div class="param-label">
                        <span>Top P</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig2.topP" :min="0" :max="1" :step="0.05" style="flex: 1;" />
                      <a-input-number v-model="tempConfig2.topP" :min="0" :max="1" :step="0.05" style="width: 70px;" @press-enter="saveParams(2)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="maxTokens">
                    <template #label>
                      <div class="param-label">
                        <span>Max Tokens</span>
                      </div>
                    </template>
                    <a-input-number v-model="tempConfig2.maxTokens" placeholder="默认" :min="1" @press-enter="saveParams(2)" />
                  </a-form-item>

                  <a-form-item field="frequencyPenalty">
                    <template #label>
                      <div class="param-label">
                        <span>Frequency Penalty</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig2.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig2.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(2)" />
                    </div>
                  </a-form-item>

                  <a-form-item field="presencePenalty" style="margin-bottom: 0;">
                    <template #label>
                      <div class="param-label">
                        <span>Presence Penalty</span>
                      </div>
                    </template>
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                      <a-slider v-model="tempConfig2.presencePenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                      <a-input-number v-model="tempConfig2.presencePenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(2)" />
                    </div>
                  </a-form-item>
                </a-form>
              </div>
              <div class="overlay-footer">
                <a-button @click="cancelParams(2)" style="margin-right: 12px;">取消</a-button>
                <a-button type="primary" @click="saveParams(2)" :loading="isVerifyingKey[2]">保存配置</a-button>
              </div>
            </div>
          </a-card>
        </div>

        <div class="workflow-edge"></div>

        <!-- 右边：Output -->
        <div class="workflow-node">
          <a-card :bordered="false" class="card-col output-card">
            <template #title>
              <div class="output-card-title">
                <span>Output 生成结果</span>
                <div class="output-stats" v-if="m2.latency || m2.tokenUsage">
                  <a-tag size="small" color="blue" v-if="m2.latency">
                    <template #icon><icon-clock-circle /></template>
                    {{ m2.latency }} ms
                  </a-tag>
                  <a-tag size="small" color="green" v-if="m2.tokenUsage">
                    <template #icon><icon-layers /></template>
                    {{ m2.tokenUsage }} tokens
                  </a-tag>
                </div>
              </div>
            </template>
            <template #extra>
              <a-button type="text" size="small" @click="copyText(m2.output)">
                <template #icon><icon-copy /></template>
                复制结果
              </a-button>
            </template>
            <!-- Output list mode when batch results exist -->
            <div v-if="m2.outputList && m2.outputList.length > 0" class="data-list-container">
              <div v-if="m2.batchProgress" class="batch-progress-bar">
                <a-progress :percent="Math.min(100, m2.batchProgress.total > 0 ? Math.round(m2.batchProgress.completed / m2.batchProgress.total * 100) : 0)" size="small" />
                <a-tag v-if="m2.batchProgress.completed < m2.batchProgress.total" size="small" color="blue">
                  <template #icon><icon-loading class="spin-icon" /></template>
                  {{ formatProgress(m2.batchProgress.completed, m2.batchProgress.total) }}
                </a-tag>
                <a-tag v-else size="small" color="green">已完成</a-tag>
                <a-tag v-if="m2.batchProgress.totalLatency" size="small" color="blue">
                  <template #icon><icon-clock-circle /></template>
                  {{ m2.batchProgress.totalLatency }} ms
                </a-tag>
                <a-tag v-if="m2.batchProgress.totalTokens" size="small" color="green">
                  <template #icon><icon-layers /></template>
                  {{ m2.batchProgress.totalTokens }} tokens
                </a-tag>
                <a-button v-if="m2.loading && m2.batchProgress" size="mini" status="danger" @click="abortBatchRun(2)">中止</a-button>
              </div>
              <div class="data-list">
                <div v-for="(result, index) in m2.outputList" :key="result.id"
                     class="data-item" :class="{ 'data-item-focused': index === m2.csvFocusIndex }">
                  <div class="data-item-header" @click="result.expanded = !result.expanded">
                    <span class="data-item-index">#{{ result.id }}</span>
                    <a-tag size="small" :color="result.status === 'completed' ? 'green' : result.status === 'failed' ? 'red' : result.status === 'running' ? 'blue' : 'gray'">
                      {{ result.status === 'completed' ? '完成' : result.status === 'failed' ? '失败' : result.status === 'running' ? '运行中' : '等待中' }}
                    </a-tag>
                    <span class="data-item-summary">{{ result.status === 'completed' ? getSummary(result.content) : (result.error || '等待运行...') }}</span>
                    <icon-down v-if="!result.expanded" class="data-item-toggle" />
                    <icon-up v-else class="data-item-toggle" />
                  </div>
                  <div v-if="result.expanded" class="data-item-body">
                    <div v-if="result.status === 'completed'" class="output-result-content">{{ result.content }}</div>
                    <div v-else-if="result.status === 'failed'" class="output-result-error">{{ result.error }}</div>
                    <div v-else class="output-result-pending">等待运行...</div>
                    <div v-if="result.status === 'completed' && m2.csvData.find(d => d.id === result.id)?.expectedOutput" class="expected-output-compare">
                      <div class="expected-label">预期输出:</div>
                      <div class="expected-content">{{ m2.csvData.find(d => d.id === result.id).expectedOutput }}</div>
                    </div>
                    <div v-if="result.latency || result.tokenUsage" class="output-result-stats">
                      <a-tag size="small" color="blue" v-if="result.latency"><icon-clock-circle /> {{ result.latency }} ms</a-tag>
                      <a-tag size="small" color="green" v-if="result.tokenUsage"><icon-layers /> {{ result.tokenUsage }} tokens</a-tag>
                    </div>
                  </div>
                </div>
              </div>
              <div class="data-list-nav">
                <a-button size="mini" type="outline" :disabled="m2.csvFocusIndex === 0" @click="m2.csvFocusIndex = navigateFocus(m2.outputList, m2.csvFocusIndex, 'up')">
                  <template #icon><icon-up /></template>
                </a-button>
                <span class="nav-indicator">{{ m2.csvFocusIndex + 1 }} / {{ m2.outputList.length }}</span>
                <a-button size="mini" type="outline" :disabled="m2.csvFocusIndex === m2.outputList.length - 1" @click="m2.csvFocusIndex = navigateFocus(m2.outputList, m2.csvFocusIndex, 'down')">
                  <template #icon><icon-down /></template>
                </a-button>
              </div>
            </div>
            <!-- Original single output mode -->
            <template v-else>
              <a-textarea class="output-textarea" v-model="m2.output" readonly placeholder="模型生成的输出结果将在此显示..." :auto-size="{ minRows: 6, maxRows: 12 }" />
            </template>
            
            <div class="feedback-section">
              <a-divider style="margin: 12px 0;" />
              <div class="feedback-header">
                <span class="feedback-title">对结果不满意？让 Agent 帮你调优：</span>
              </div>
              <div class="feedback-input-group">
                <a-textarea v-model="m2.feedback" placeholder="输入您的修改意见，例如：'语气太生硬了，更活泼一点'..." :auto-size="{ minRows: 2, maxRows: 4 }" />
                <a-button type="primary" class="feedback-submit-btn" @click="submitFeedback(2)" :loading="m2.feedbackLoading">
                  <template #icon><icon-send /></template>
                </a-button>
              </div>
            </div>
          </a-card>
        </div>
      </div>
    </div>

    <!-- Agent 模块 -->
    <div class="agent-wrapper" :class="agentStateClass">
      <!-- 状态：全屏 或 气泡对话框 -->
      <div v-show="agentState !== 'minimized'" class="agent-content-container">
        <div v-if="agentState === 'full'" class="module-row agent-row">
          <div class="module-header">
            <div class="module-title">模块三：Agent Prompt 调优</div>
          <a-space>
            <a-button type="text" size="small" class="collapse-btn" @click="openParams(3)">
              <template #icon><icon-settings /></template>
              参数配置
            </a-button>
            <a-button type="text" size="small" class="collapse-btn" @click="agentState = 'popup'">
                <template #icon><icon-shrink /></template>
                缩为气泡
              </a-button>
              <a-button type="text" size="small" class="collapse-btn" @click="agentState = 'minimized'">
                <template #icon><icon-minus /></template>
                最小化
              </a-button>
            </a-space>
          </div>
          <!-- 全屏状态下的卡片容器，与上方的 workflow-row 保持相同层级结构 -->
          <div class="workflow-row">
            <div class="workflow-node" style="flex: 1;">
              <a-card :bordered="false" class="card-col agent-card-inner">
                <transition name="panel-fade" mode="out-in">
                <div v-if="!m3.showParams" key="chat" class="chat-container">
                  <div class="chat-list" id="chatList">
              <div v-for="(msg, index) in chatList" :key="index" :class="['chat-message', msg.role === 'user' ? 'chat-user' : 'chat-agent']">
                
                <!-- 用户发出的反馈消息，增加 Context 折叠面板 -->
                <div v-if="msg.role === 'user' && msg.context" class="chat-context-block">
                  <a-collapse :bordered="false" expand-icon-position="right">
                    <a-collapse-item header="查看附带的上下文" key="1">
                      <div class="context-detail">
                        <div class="context-section">
                          <div class="context-label">【{{ msg.context.sourceModule.label }}（源模块）】</div>
                          <div class="context-text"><span class="ctx-key">模型:</span> {{ msg.context.sourceModule.model }} | T={{ msg.context.sourceModule.temperature }}, P={{ msg.context.sourceModule.topP }}, MaxTokens={{ msg.context.sourceModule.maxTokens ?? '默认' }}, FP={{ msg.context.sourceModule.frequencyPenalty }}, PP={{ msg.context.sourceModule.presencePenalty }}</div>
                          <div class="context-text"><span class="ctx-key">Input:</span> {{ msg.context.sourceModule.input || '无' }}</div>
                          <div class="context-text"><span class="ctx-key">Prompt:</span> {{ msg.context.sourceModule.prompt }}</div>
                          <div class="context-text"><span class="ctx-key">Output:</span> {{ msg.context.sourceModule.output }}</div>
                        </div>
                        <div class="context-section" style="margin-top: 8px;">
                          <div class="context-label">【{{ msg.context.otherModule.label }}（对比模块）】</div>
                          <div class="context-text"><span class="ctx-key">模型:</span> {{ msg.context.otherModule.model }} | T={{ msg.context.otherModule.temperature }}, P={{ msg.context.otherModule.topP }}, MaxTokens={{ msg.context.otherModule.maxTokens ?? '默认' }}, FP={{ msg.context.otherModule.frequencyPenalty }}, PP={{ msg.context.otherModule.presencePenalty }}</div>
                          <div class="context-text"><span class="ctx-key">Input:</span> {{ msg.context.otherModule.input || '无' }}</div>
                          <div class="context-text"><span class="ctx-key">Prompt:</span> {{ msg.context.otherModule.prompt }}</div>
                        </div>
                      </div>
                    </a-collapse-item>
                  </a-collapse>
                </div>
                
                <div>{{ msg.content }}</div>
                
                <!-- Agent 生成的新 Prompt 操作按钮 -->
                <div v-if="msg.action" class="action-buttons">
                  <a-button v-if="msg.action.targetModule === 1 || !msg.action.targetModule" size="mini" type="primary" status="success" @click="applyPrompt(1, msg.action.prompt, msg.action.suggestedParams)">
                    <template #icon><icon-arrow-up /></template>
                    应用到模块一
                  </a-button>
                  <a-button v-if="msg.action.targetModule === 2 || !msg.action.targetModule" size="mini" type="primary" status="warning" @click="applyPrompt(2, msg.action.prompt, msg.action.suggestedParams)">
                    <template #icon><icon-arrow-up /></template>
                    应用到模块二
                  </a-button>
                  <span v-if="msg.action.suggestedParams" class="params-change-summary">
                    <icon-settings /> 参数建议:
                    <template v-for="(val, key) in msg.action.suggestedParams" :key="key">
                      {{ key }}={{ val }}&nbsp;
                    </template>
                  </span>
                </div>
              </div>
              
              <!-- Agent 正在思考的 Loading 状态 -->
              <div v-if="isAgentThinking" class="chat-message chat-agent agent-thinking">
                <icon-loading class="spin-icon" /> 正在分析反馈并调优 Prompt...
              </div>
            </div>
                  <div class="chat-input-area">
                    <a-input-search 
                      v-model="agentInput" 
                      placeholder="输入反馈，例如：帮我把模块一的 Prompt 改得更正式一些..." 
                      button-text="发送反馈" 
                      search-button 
                      @search="sendAgentMessage"
                      @press-enter="sendAgentMessage"
                    />
                  </div>
                </div>

                <!-- 参数配置面板（替代聊天区域） -->
                <div v-else key="params" class="agent-params-panel">
                  <div class="overlay-header">
                    <div class="overlay-title">Agent 模型参数配置</div>
                  </div>
                  <div class="overlay-content">
                    <a-form layout="vertical" :model="tempConfig3" size="small">
                      <div class="form-section-title">基础配置</div>
                      <a-form-item label="模型选择" field="model" style="margin-bottom: 4px;">
                        <a-select v-model="tempConfig3.model" placeholder="请选择模型">
                          <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                            <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                          </a-optgroup>
                        </a-select>
                      </a-form-item>
                      <a-form-item label="API Key" field="apiKey" style="margin-bottom: 4px;">
                        <a-input-password v-model="tempConfig3.apiKey" placeholder="输入对应平台的 API Key" allow-clear />
                      </a-form-item>

                      <a-divider style="margin: 8px 0;" />
                      <div class="form-section-title">高级生成参数</div>
                      
                      <a-form-item field="temperature">
                        <template #label>
                          <div class="param-label">
                            <span>Temperature</span>
                            <a-tooltip content="控制生成文本的随机性。值越高输出越随机；值越低输出越确定。">
                              <icon-question-circle class="help-icon" />
                            </a-tooltip>
                          </div>
                        </template>
                        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                          <a-slider v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="flex: 1;" />
                          <a-input-number v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                        </div>
                      </a-form-item>

                      <a-form-item field="topP">
                        <template #label>
                          <div class="param-label">
                            <span>Top P</span>
                            <a-tooltip content="核采样参数。控制模型考虑的 token 概率范围。">
                              <icon-question-circle class="help-icon" />
                            </a-tooltip>
                          </div>
                        </template>
                        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                          <a-slider v-model="tempConfig3.topP" :min="0" :max="1" :step="0.05" style="flex: 1;" />
                          <a-input-number v-model="tempConfig3.topP" :min="0" :max="1" :step="0.05" style="width: 70px;" @press-enter="saveParams(3)" />
                        </div>
                      </a-form-item>

                      <a-form-item field="maxTokens">
                        <template #label>
                          <div class="param-label">
                            <span>Max Tokens</span>
                            <a-tooltip content="生成文本的最大 token 数量。留空使用模型默认值。">
                              <icon-question-circle class="help-icon" />
                            </a-tooltip>
                          </div>
                        </template>
                        <a-input-number v-model="tempConfig3.maxTokens" placeholder="默认" :min="1" @press-enter="saveParams(3)" />
                      </a-form-item>

                      <a-form-item field="frequencyPenalty">
                        <template #label>
                          <div class="param-label">
                            <span>Frequency Penalty</span>
                            <a-tooltip content="频率惩罚。正值降低模型重复已出现 token 的概率。">
                              <icon-question-circle class="help-icon" />
                            </a-tooltip>
                          </div>
                        </template>
                        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                          <a-slider v-model="tempConfig3.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                          <a-input-number v-model="tempConfig3.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                        </div>
                      </a-form-item>

                      <a-form-item field="presencePenalty" style="margin-bottom: 0;">
                        <template #label>
                          <div class="param-label">
                            <span>Presence Penalty</span>
                            <a-tooltip content="存在惩罚。正值鼓励模型讨论新话题。">
                              <icon-question-circle class="help-icon" />
                            </a-tooltip>
                          </div>
                        </template>
                        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                          <a-slider v-model="tempConfig3.presencePenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                          <a-input-number v-model="tempConfig3.presencePenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                        </div>
                      </a-form-item>
                    </a-form>
                  </div>
                  <div class="overlay-footer">
                    <a-button @click="cancelParams(3)" style="margin-right: 12px;">取消</a-button>
                    <a-button type="primary" @click="saveParams(3)" :loading="isVerifyingKey[3]">保存配置</a-button>
                  </div>
                </div>
                </transition>
              </a-card>
            </div>
          </div>
        </div>

        <!-- 气泡状态下的卡片容器 (保持原样) -->
        <div v-if="agentState === 'popup'" class="agent-card">
          <div class="popup-header arcade-header">
            <div class="popup-title arcade-title">Agent 调优</div>
            <a-space>
              <a-button type="text" size="small" class="collapse-btn arcade-btn" @click="arcadeFlash($event); openParams(3)">
                <template #icon><icon-settings /></template>
              </a-button>
              <a-button type="text" size="small" class="collapse-btn arcade-btn" @click="arcadeFlash($event); agentState = 'full'">
                <template #icon><icon-expand /></template>
              </a-button>
              <a-button type="text" size="small" class="collapse-btn arcade-btn" @click="arcadeFlash($event); agentState = 'minimized'">
                <template #icon><icon-minus /></template>
              </a-button>
            </a-space>
          </div>
          <transition name="panel-fade" mode="out-in">
          <div class="chat-container" v-if="!m3.showParams" key="chat-popup">
            <div class="chat-list" id="chatListPopup">
              <div v-for="(msg, index) in chatList" :key="index" :class="['chat-message', msg.role === 'user' ? 'chat-user' : 'chat-agent']">
                
                <div v-if="msg.role === 'user' && msg.context" class="chat-context-block">
                  <a-collapse :bordered="false" expand-icon-position="right">
                    <a-collapse-item header="查看附带的上下文" key="1">
                      <div class="context-detail">
                        <div class="context-section">
                          <div class="context-label">【{{ msg.context.sourceModule.label }}（源模块）】</div>
                          <div class="context-text"><span class="ctx-key">模型:</span> {{ msg.context.sourceModule.model }} | T={{ msg.context.sourceModule.temperature }}, P={{ msg.context.sourceModule.topP }}</div>
                          <div class="context-text"><span class="ctx-key">Input:</span> {{ msg.context.sourceModule.input || '无' }}</div>
                          <div class="context-text"><span class="ctx-key">Prompt:</span> {{ msg.context.sourceModule.prompt }}</div>
                          <div class="context-text"><span class="ctx-key">Output:</span> {{ msg.context.sourceModule.output }}</div>
                        </div>
                        <div class="context-section" style="margin-top: 8px;">
                          <div class="context-label">【{{ msg.context.otherModule.label }}（对比模块）】</div>
                          <div class="context-text"><span class="ctx-key">模型:</span> {{ msg.context.otherModule.model }} | T={{ msg.context.otherModule.temperature }}, P={{ msg.context.otherModule.topP }}</div>
                          <div class="context-text"><span class="ctx-key">Input:</span> {{ msg.context.otherModule.input || '无' }}</div>
                          <div class="context-text"><span class="ctx-key">Prompt:</span> {{ msg.context.otherModule.prompt }}</div>
                        </div>
                      </div>
                    </a-collapse-item>
                  </a-collapse>
                </div>
                
                <div>{{ msg.content }}</div>
                
                <div v-if="msg.action" class="action-buttons">
                  <a-button v-if="msg.action.targetModule === 1 || !msg.action.targetModule" size="mini" type="primary" status="success" @click="applyPrompt(1, msg.action.prompt, msg.action.suggestedParams)">
                    <template #icon><icon-arrow-up /></template>
                    应用到一
                  </a-button>
                  <a-button v-if="msg.action.targetModule === 2 || !msg.action.targetModule" size="mini" type="primary" status="warning" @click="applyPrompt(2, msg.action.prompt, msg.action.suggestedParams)">
                    <template #icon><icon-arrow-up /></template>
                    应用到二
                  </a-button>
                  <span v-if="msg.action.suggestedParams" class="params-change-summary">
                    <icon-settings /> 参数建议:
                    <template v-for="(val, key) in msg.action.suggestedParams" :key="key">
                      {{ key }}={{ val }}&nbsp;
                    </template>
                  </span>
                </div>
              </div>
              
              <div v-if="isAgentThinking" class="chat-message chat-agent agent-thinking">
                <icon-loading class="spin-icon" /> 正在分析反馈并调优 Prompt...
              </div>
            </div>
            <div class="chat-input-area">
              <a-input-search 
                v-model="agentInput" 
                placeholder="输入反馈..." 
                button-text="发送" 
                search-button 
                @search="sendAgentMessage"
                @press-enter="sendAgentMessage"
              />
            </div>
          </div>

          <!-- 卡片内蒙层：Agent 参数配置 (popup) -->
          <div v-else key="params-popup" class="agent-params-panel">
            <div class="overlay-header">
              <div class="overlay-title">Agent 模型参数配置</div>
            </div>
            <div class="overlay-content">
              <a-form layout="vertical" :model="tempConfig3" size="small">
                <div class="form-section-title">基础配置</div>
                <a-form-item label="模型选择" field="model" style="margin-bottom: 4px;">
                  <a-select v-model="tempConfig3.model" placeholder="请选择模型">
                    <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
                      <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                    </a-optgroup>
                  </a-select>
                </a-form-item>
                <a-form-item label="API Key" field="apiKey" style="margin-bottom: 4px;">
                  <a-input-password v-model="tempConfig3.apiKey" placeholder="输入对应平台的 API Key" allow-clear />
                </a-form-item>

                <a-divider style="margin: 8px 0;" />
                <div class="form-section-title">高级生成参数</div>
                
                <a-form-item field="temperature">
                  <template #label>
                    <div class="param-label">
                      <span>Temperature</span>
                      <a-tooltip content="控制生成文本的随机性。值越高输出越随机；值越低输出越确定。">
                        <icon-question-circle class="help-icon" />
                      </a-tooltip>
                    </div>
                  </template>
                  <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <a-slider v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="flex: 1;" />
                    <a-input-number v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                  </div>
                </a-form-item>

                <a-form-item field="topP">
                  <template #label>
                    <div class="param-label">
                      <span>Top P</span>
                      <a-tooltip content="核采样参数。控制模型考虑的 token 概率范围。">
                        <icon-question-circle class="help-icon" />
                      </a-tooltip>
                    </div>
                  </template>
                  <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <a-slider v-model="tempConfig3.topP" :min="0" :max="1" :step="0.05" style="flex: 1;" />
                    <a-input-number v-model="tempConfig3.topP" :min="0" :max="1" :step="0.05" style="width: 70px;" @press-enter="saveParams(3)" />
                  </div>
                </a-form-item>

                <a-form-item field="maxTokens">
                  <template #label>
                    <div class="param-label">
                      <span>Max Tokens</span>
                      <a-tooltip content="生成文本的最大 token 数量。留空使用模型默认值。">
                        <icon-question-circle class="help-icon" />
                      </a-tooltip>
                    </div>
                  </template>
                  <a-input-number v-model="tempConfig3.maxTokens" placeholder="默认" :min="1" @press-enter="saveParams(3)" />
                </a-form-item>

                <a-form-item field="frequencyPenalty">
                  <template #label>
                    <div class="param-label">
                      <span>Frequency Penalty</span>
                      <a-tooltip content="频率惩罚。正值降低模型重复已出现 token 的概率。">
                        <icon-question-circle class="help-icon" />
                      </a-tooltip>
                    </div>
                  </template>
                  <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <a-slider v-model="tempConfig3.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                    <a-input-number v-model="tempConfig3.frequencyPenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                  </div>
                </a-form-item>

                <a-form-item field="presencePenalty" style="margin-bottom: 0;">
                  <template #label>
                    <div class="param-label">
                      <span>Presence Penalty</span>
                      <a-tooltip content="存在惩罚。正值鼓励模型讨论新话题。">
                        <icon-question-circle class="help-icon" />
                      </a-tooltip>
                    </div>
                  </template>
                  <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <a-slider v-model="tempConfig3.presencePenalty" :min="-2" :max="2" :step="0.1" style="flex: 1;" />
                    <a-input-number v-model="tempConfig3.presencePenalty" :min="-2" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
                  </div>
                </a-form-item>
              </a-form>
            </div>
            <div class="overlay-footer">
              <a-button @click="cancelParams(3)" style="margin-right: 12px;">取消</a-button>
              <a-button type="primary" @click="saveParams(3)" :loading="isVerifyingKey[3]">保存配置</a-button>
            </div>
          </div>
          </transition>
        </div>
      </div>
      
      <!-- 状态：完全最小化悬浮按钮 -->
      <div v-if="agentState === 'minimized'" class="agent-fab" @click="agentState = 'popup'">
        <a-badge :count="chatList.length > 1 ? 1 : 0" dot>
          <div class="fab-icon">
            <icon-message />
          </div>
        </a-badge>
      </div>
    </div>

    </div>

    <!-- IO2P Page -->
    <IO2P
      v-show="currentPage === 'io2p'"
      :model-options="modelOptions"
      :global-config="globalConfig"
      @navigate-back="currentPage = 'tuner'"
    />

    <!-- 历史记录模态框 -->
    <a-modal v-model:visible="historyVisible" :title="historyTitle" @ok="historyVisible = false" @cancel="historyVisible = false">
      <div v-if="currentHistory.length === 0" style="text-align: center; color: #86909c; padding: 20px;">
        暂无历史记录
      </div>
      <div v-else class="history-list">
        <div v-for="(item, index) in currentHistory" :key="index" class="history-item">
          <div class="history-time">{{ item.time }}</div>
          <div class="history-content">{{ item.content }}</div>
          <a-button type="outline" size="mini" @click="restorePrompt(item.content)">恢复此版本</a-button>
        </div>
      </div>
    </a-modal>
    
    <!-- Debug 日志面板 -->
    <a-drawer v-model:visible="showDebugPanel" title="API 请求 Debug 日志" width="500" placement="left" :footer="false">
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #86909c; font-size: 13px;">记录每次 API 调用的请求和响应</span>
        <a-button type="outline" status="danger" size="small" @click="clearLogs">
          <template #icon><icon-delete /></template>
          清空日志
        </a-button>
      </div>
      <div class="debug-logs-container">
        <div v-if="debugLogs.length === 0" style="text-align: center; color: #c9cdd4; padding: 40px 0;">
          暂无日志记录
        </div>
        <div v-for="log in debugLogs" :key="log.id" class="debug-log-item" :class="`log-${log.type}`">
          <div class="log-header">
            <span class="log-time">{{ log.time }}</span>
            <a-tag size="small" :color="log.type === 'error' ? 'red' : log.type === 'api' ? 'blue' : 'gray'">{{ log.module }}</a-tag>
          </div>
          <div class="log-message">{{ log.message }}</div>
          <pre v-if="log.data" class="log-data">{{ log.data }}</pre>
        </div>
      </div>
    </a-drawer>

    <!-- 版权声明 -->
    <div class="app-footer">© 2026 Timekettle SEG. All rights reserved.</div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import Papa from 'papaparse';
import { parseCsvToDataItems, getSummary, updateDataItem, selectAll, deselectAll, getSelectedCount, navigateFocus, formatProgress, exportBatchData } from './utils/dataHelpers';
import IO2P from './components/IO2P.vue';

// 日志系统状态
const debugLogs = ref([]);
const showDebugPanel = ref(false);

const addLog = (type, moduleName, message, data = null) => {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  debugLogs.value.unshift({
    id: Date.now() + Math.random(),
    time: timeStr,
    type, // 'info', 'success', 'warning', 'error', 'api'
    module: moduleName,
    message,
    data: data ? JSON.stringify(data, null, 2) : null
  });
  
  // 最多保留 100 条日志
  if (debugLogs.value.length > 100) {
    debugLogs.value.pop();
  }
};

const clearLogs = () => {
  debugLogs.value = [];
};

// 模型选项列表
const modelOptions = [
  {
    label: 'OpenAI (美国)',
    options: [
      { value: 'gpt-4o', label: 'GPT-4o (最新旗舰)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
    ]
  },
  {
    label: 'Anthropic (美国)',
    options: [
      { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus', label: 'Claude 3 Opus' },
      { value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
    ]
  },
  {
    label: 'Google (美国)',
    options: [
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
    ]
  },
  {
    label: 'DeepSeek 深度求索 (中国)',
    options: [
      { value: 'deepseek-chat', label: 'DeepSeek-V2 (Chat)' },
      { value: 'deepseek-coder', label: 'DeepSeek-Coder' }
    ]
  },
  {
    label: 'Aliyun 阿里云 (中国)',
    options: [
      { value: 'qwen-max', label: '通义千问 Max' },
      { value: 'qwen-plus', label: '通义千问 Plus' },
      { value: 'qwen-turbo', label: '通义千问 Turbo' }
    ]
  },
  {
          label: 'Zhipu 智谱AI / Z.AI (中国)',
          options: [
            { value: 'glm-5.1', label: 'GLM-5.1 (Z.AI)' },
            { value: 'glm-4-plus', label: 'GLM-4 Plus' },
            { value: 'glm-4-0520', label: 'GLM-4 0520' },
            { value: 'glm-4-air', label: 'GLM-4 Air' },
            { value: 'glm-4-flash', label: 'GLM-4 Flash' },
            { value: 'glm-4v-plus', label: 'GLM-4V Plus (多模态)' }
          ]
        },
  {
    label: 'Moonshot 月之暗面 (中国)',
    options: [
      { value: 'moonshot-v1-8k', label: 'Kimi (8K)' },
      { value: 'moonshot-v1-32k', label: 'Kimi (32K)' },
      { value: 'moonshot-v1-200k', label: 'Kimi (200K)' }
    ]
  },
  {
    label: 'Baichuan 百川智能 (中国)',
    options: [
      { value: 'baichuan-4', label: 'Baichuan 4' },
      { value: 'baichuan3-turbo', label: 'Baichuan 3 Turbo' }
    ]
  }
];

const m1 = ref({
  input: '',
  csvData: [],
  csvCurrentIndex: 0,
  csvFocusIndex: 0,
  prompt: '你是一个专业的翻译助手。请翻译以下内容：\n',
  systemPrompt: '',
  model: 'gpt-3.5-turbo',
  apiKey: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  output: '',
  outputList: [],
  loading: false,
  showParams: false,
  hideBriefParams: false,
  feedback: '',
  feedbackLoading: false,
  tokenUsage: null,
  latency: null,
  batchProgress: null,
  overrides: new Set(),
  concurrency: 1
});

const m2 = ref({
  input: '',
  csvData: [],
  csvCurrentIndex: 0,
  csvFocusIndex: 0,
  prompt: '你是一个通俗易懂的解释者。请用小学生的口吻解释以下内容：\n',
  systemPrompt: '',
  model: 'gpt-4',
  apiKey: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  output: '',
  outputList: [],
  loading: false,
  showParams: false,
  hideBriefParams: false,
  feedback: '',
  feedbackLoading: false,
  tokenUsage: null,
  latency: null,
  batchProgress: null,
  overrides: new Set(),
  concurrency: 1
});

// CSV 处理逻辑
const handleCsvUpload = (fileItem, moduleNum) => {
  const file = fileItem.file;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.data && results.data.length > 0) {
        const m = moduleNum === 1 ? m1.value : m2.value;
        m.csvData = parseCsvToDataItems(results.data);
        m.csvFocusIndex = 0;
        m.input = m.csvData[0].content;  // Set first item as current input
        Message.success(`成功导入 ${results.data.length} 条测试数据`);
      } else {
        Message.error('CSV 文件为空或解析失败');
      }
    },
    error: (error) => {
      Message.error(`解析失败: ${error.message}`);
    }
  });
  // 阻止默认上传
  return false;
};

const updateInputFromCsv = (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  if (m.csvData.length > 0) {
    const row = m.csvData[m.csvCurrentIndex];
    // 默认展示为 JSON 格式字符串，用户也可以自己处理
    m.input = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
};

const prevCsvRow = (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  if (m.csvCurrentIndex > 0) {
    m.csvCurrentIndex--;
    updateInputFromCsv(moduleNum);
  }
};

const nextCsvRow = (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  if (m.csvCurrentIndex < m.csvData.length - 1) {
    m.csvCurrentIndex++;
    updateInputFromCsv(moduleNum);
  }
};

const clearCsv = (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  m.csvData = [];
  m.csvFocusIndex = 0;
  m.csvCurrentIndex = 0;
  m.input = '';
  m.outputList = [];
  m.batchProgress = null;
};

const downloadTemplate = () => {
  const bom = '\uFEFF';
  const csv = `input,expected_output
请将以下内容翻译为英文：春天来了,Spring has come
用一句话解释什么是人工智能,AI is the simulation of human intelligence by machines
请列出三种常见的编程语言,Python Java JavaScript
将摄氏100度转换为华氏温度,212°F
请用简单的语言解释量子计算,Quantum computing uses quantum bits to process information`;
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prompt-tuner-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Message.success('模板已下载');
};

const m3 = ref({
  model: 'gpt-4',
  apiKey: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  showParams: false
});

const globalConfig = ref({
  model: 'gpt-3.5-turbo',
  apiKey: '',
  systemPrompt: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  concurrency: 1,
  expanded: false
})
const tempGlobalConfig = ref({})

// 用于在参数配置蒙层中临时绑定的状态
const tempConfig1 = ref({});
const tempConfig2 = ref({});
const tempConfig3 = ref({});

const openParams = (moduleNum) => {
  if (moduleNum === 1) {
    tempConfig1.value = JSON.parse(JSON.stringify({
      model: m1.value.model,
      apiKey: m1.value.apiKey,
      systemPrompt: m1.value.systemPrompt,
      temperature: m1.value.temperature,
      topP: m1.value.topP,
      maxTokens: m1.value.maxTokens,
      frequencyPenalty: m1.value.frequencyPenalty,
      presencePenalty: m1.value.presencePenalty
    }));
    m1.value.showParams = true;
  } else if (moduleNum === 2) {
    tempConfig2.value = JSON.parse(JSON.stringify({
      model: m2.value.model,
      apiKey: m2.value.apiKey,
      systemPrompt: m2.value.systemPrompt,
      temperature: m2.value.temperature,
      topP: m2.value.topP,
      maxTokens: m2.value.maxTokens,
      frequencyPenalty: m2.value.frequencyPenalty,
      presencePenalty: m2.value.presencePenalty
    }));
    m2.value.showParams = true;
  } else {
    tempConfig3.value = JSON.parse(JSON.stringify({
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      temperature: m3.value.temperature,
      topP: m3.value.topP,
      maxTokens: m3.value.maxTokens,
      frequencyPenalty: m3.value.frequencyPenalty,
      presencePenalty: m3.value.presencePenalty
    }));
    m3.value.showParams = true;
  }
};

const cancelParams = (moduleNum) => {
  if (moduleNum === 1) {
    m1.value.showParams = false;
  } else if (moduleNum === 2) {
    m2.value.showParams = false;
  } else {
    m3.value.showParams = false;
  }
};

const openGlobalConfig = () => {
  tempGlobalConfig.value = JSON.parse(JSON.stringify({
    model: globalConfig.value.model,
    apiKey: globalConfig.value.apiKey,
    systemPrompt: globalConfig.value.systemPrompt,
    temperature: globalConfig.value.temperature,
    topP: globalConfig.value.topP,
    maxTokens: globalConfig.value.maxTokens,
    frequencyPenalty: globalConfig.value.frequencyPenalty,
    presencePenalty: globalConfig.value.presencePenalty,
    concurrency: globalConfig.value.concurrency
  }))
  globalConfig.value.expanded = true
}

const saveGlobalConfig = () => {
  Object.assign(globalConfig.value, tempGlobalConfig.value)
  globalConfig.value.expanded = false
  applyGlobalConfig(globalConfig.value, [m1.value, m2.value])
  Message.success('全局配置已保存')
  saveData()
}

const resetAllModules = () => {
  resetModuleOverrides([m1.value, m2.value], globalConfig.value)
  Message.success('所有模块配置已重置为继承全局')
  saveData()
}

const cancelGlobalConfig = () => {
  globalConfig.value.expanded = false
}

import { fetchLLMResponse } from './utils/api';
import { createBatchRunner } from './utils/batchRunner';
import { applyGlobalConfig, resetModuleOverrides } from './utils/configManager';
const isVerifyingKey = ref({ 1: false, 2: false, 3: false });
const activeBatchRunners = ref({ 1: null, 2: null });
const activeAbortControllers = ref({ 1: null, 2: null });

const stopRun = (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  // Abort single run
  if (activeAbortControllers.value[moduleNum]) {
    activeAbortControllers.value[moduleNum].abort();
    activeAbortControllers.value[moduleNum] = null;
  }
  // Abort batch run
  if (activeBatchRunners.value[moduleNum]) {
    activeBatchRunners.value[moduleNum].abort();
    activeBatchRunners.value[moduleNum] = null;
  }
  m.loading = false;
  Message.warning('已停止运行');
};

const saveParams = async (moduleNum) => {
  const tempConfig = moduleNum === 1 ? tempConfig1.value : (moduleNum === 2 ? tempConfig2.value : tempConfig3.value);
  const currentM = moduleNum === 1 ? m1.value : (moduleNum === 2 ? m2.value : m3.value);

  // 移除了 API Key 强校验逻辑，避免前端跨域问题拦截用户正常保存
  
  if (confirm('确认保存修改后的模型参数吗？')) {
    if (moduleNum === 1) {
      Object.assign(m1.value, tempConfig1.value);
      m1.value.showParams = false;
    } else if (moduleNum === 2) {
      Object.assign(m2.value, tempConfig2.value);
      m2.value.showParams = false;
    } else {
      Object.assign(m3.value, tempConfig3.value);
      m3.value.showParams = false;
    }

    // Track overrides for modules 1 and 2
    if (moduleNum === 1 || moduleNum === 2) {
      const configFields = ['model', 'apiKey', 'temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty', 'concurrency']
      const tc = moduleNum === 1 ? tempConfig1.value : tempConfig2.value
      const cm = moduleNum === 1 ? m1.value : m2.value
      for (const field of configFields) {
        if (tc[field] !== globalConfig.value[field]) {
          cm.overrides.add(field)
        }
      }
    }

    Message.success('参数保存成功');
    saveData();
  }
};

// 计算属性：检查参数是否不同，用于高亮
const diffKeys = computed(() => {
  const keys = ['model', 'temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty'];
  const diff = {};
  keys.forEach(key => {
    diff[key] = m1.value[key] !== m2.value[key];
  });
  return diff;
});

const chatList = ref([
  { role: 'agent', content: '你好！我是你的 Prompt 调优助手。你可以在这里输入反馈，我会帮你调整上方两个模块的 Prompt。' }
]);

const agentInput = ref('');
// 代理状态：'full' (全宽), 'popup' (右下角气泡对话框), 'minimized' (仅显示圆形悬浮按钮)
const agentState = ref('full');

// 页面切换状态
const currentPage = ref('tuner');
const isAgentThinking = ref(false);
const linkedRun = ref(false);

const agentStateClass = computed(() => {
  return {
    'agent-full': agentState.value === 'full',
    'agent-popup': agentState.value === 'popup',
    'agent-minimized': agentState.value === 'minimized'
  };
});
const historyVisible = ref(false);
const historyTitle = ref('');
const currentHistory = ref([]);
const currentRestoreTarget = ref(1);

const m1History = ref([]);
const m2History = ref([]);

// 防抖函数，用于保存历史记录
let historyTimeout = null;
const savePromptHistory = (moduleNum) => {
  clearTimeout(historyTimeout);
  historyTimeout = setTimeout(() => {
    const val = moduleNum === 1 ? m1.value.prompt : m2.value.prompt;
    if (!val) return;
    
    const historyArr = moduleNum === 1 ? m1History.value : m2History.value;
    // 避免重复保存相同的内容
    if (historyArr.length > 0 && historyArr[0].content === val) return;
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    historyArr.unshift({
      time: timeStr,
      content: val
    });
    
    // 最多保存 20 条
    if (historyArr.length > 20) {
      historyArr.pop();
    }
  }, 1000);
};

const showHistory = (moduleNum) => {
  // historyVisible.value = true; // No longer needed
};

const restorePrompt = (moduleNum, content) => {
  if (moduleNum === 1) {
    m1.value.prompt = content;
  } else {
    m2.value.prompt = content;
  }
  Message.success('已回滚 Prompt');
};

const syncAnimation = ref({ active: false, direction: '', type: '' });

const syncData = (sourceModule, type) => {
  // Trigger animation
  syncAnimation.value = {
    active: true,
    direction: sourceModule === 1 ? 'down' : 'up',
    type
  };
  setTimeout(() => { syncAnimation.value.active = false; }, 800);

  const src = sourceModule === 1 ? m1.value : m2.value;
  const dst = sourceModule === 1 ? m2.value : m1.value;

  if (type === 'input') {
    dst.input = src.input;
    // Sync CSV data if present
    if (src.csvData && src.csvData.length > 0) {
      dst.csvData = JSON.parse(JSON.stringify(src.csvData));
      dst.csvFocusIndex = 0;
    }
  }
  if (type === 'prompt') {
    dst.prompt = src.prompt;
    savePromptHistory(sourceModule === 1 ? 2 : 1);
  }

  const target = sourceModule === 1 ? '模块二' : '模块一';
  Message.success(`已同步${type === 'input' ? '输入' : 'Prompt'}到${target}`);
};

// 模拟运行改为真实调用

const runMock = async (m) => {
  const moduleNum = m === m1.value ? 1 : 2;
  
  if (!m.apiKey) {
    Message.warning('预览环境：请先在配置中输入 API Key');
    return;
  }
  
  // Check if batch mode (has selected CSV items)
  const selectedItems = m.csvData.filter(item => item.selected);
  
  if (selectedItems.length > 1) {
    // Batch mode
    m.loading = true;
    m.outputList = selectedItems.map(item => ({
      id: item.id,
      status: 'pending',
      content: '',
      expanded: false
    }));
    m.batchProgress = { completed: 0, total: selectedItems.length, totalLatency: 0, totalTokens: 0 };
    
    addLog('info', `模块${moduleNum === 1 ? '一' : '二'}`, `开始批量运行 ${selectedItems.length} 条数据，并发数: ${m.concurrency}`);
    
    // Check if another module is using the same model with concurrency=1
    const otherM = m === m1.value ? m2.value : m1.value;
    if (otherM.loading && otherM.model === m.model && m.concurrency === 1) {
      Message.warning('另一个模块正在使用相同模型，当前并发数为 1，请求将排队执行');
    }

    const runner = createBatchRunner({
      items: selectedItems,
      apiCallFn: async (item) => {
        return await fetchLLMResponse({
          model: m.model,
          apiKey: m.apiKey,
          systemPrompt: m.systemPrompt || undefined,
          userMessage: m.prompt ? `${m.prompt}\n\n${item.content}` : item.content,
          temperature: m.temperature,
          topP: m.topP,
          maxTokens: m.maxTokens,
          frequencyPenalty: m.frequencyPenalty,
          presencePenalty: m.presencePenalty
        });
      },
      concurrency: m.concurrency || 1,
      onItemStart: (id) => {
        const outputItem = m.outputList.find(o => o.id === id);
        if (outputItem) outputItem.status = 'running';
      },
      onItemComplete: (id, result) => {
        const outputItem = m.outputList.find(o => o.id === id);
        if (outputItem) {
          outputItem.status = 'completed';
          outputItem.content = result.content;
          outputItem.latency = result.latency;
          outputItem.tokenUsage = result.tokenUsage;
        }
        if (m.batchProgress) {
          m.batchProgress.completed = Math.min((m.batchProgress.completed || 0) + 1, m.batchProgress.total);
          if (result.latency) m.batchProgress.totalLatency = (m.batchProgress.totalLatency || 0) + result.latency;
          if (result.tokenUsage) m.batchProgress.totalTokens = (m.batchProgress.totalTokens || 0) + result.tokenUsage;
        }
        addLog('success', `模块${moduleNum === 1 ? '一' : '二'}`, `条目 #${id} 完成`);
      },
      onItemError: (id, error) => {
        const outputItem = m.outputList.find(o => o.id === id);
        if (outputItem) {
          outputItem.status = 'failed';
          outputItem.error = error.error;
        }
        if (m.batchProgress) {
          m.batchProgress.completed = Math.min((m.batchProgress.completed || 0) + 1, m.batchProgress.total);
        }
        addLog('error', `模块${moduleNum === 1 ? '一' : '二'}`, `条目 #${id} 失败: ${error.error}`);
      },
      onAllComplete: () => {
        m.loading = false;
        Message.success(`批量运行完成 (${selectedItems.length} 条)`);
        addLog('success', `模块${moduleNum === 1 ? '一' : '二'}`, `批量运行全部完成`);
      }
    });
    
    activeBatchRunners.value[moduleNum] = runner;
    await runner.start();
    activeBatchRunners.value[moduleNum] = null;
    
  } else {
    // Single item mode (original logic)
    m.loading = true;
    m.tokenUsage = null;
    m.latency = null;
    const startTime = Date.now();
    const inputText = selectedItems.length === 1 ? selectedItems[0].content : m.input;
    addLog('api', `模块${moduleNum === 1 ? '一' : '二'}`, `发起 API 请求，调用模型: ${m.model}`);
    
    const abortController = new AbortController();
    activeAbortControllers.value[moduleNum] = abortController;
    
    try {
      const response = await fetchLLMResponse({
        model: m.model,
        apiKey: m.apiKey,
        systemPrompt: m.systemPrompt || undefined,
        userMessage: m.prompt ? `${m.prompt}\n\n${inputText}` : inputText,
        temperature: m.temperature,
        topP: m.topP,
        maxTokens: m.maxTokens,
        frequencyPenalty: m.frequencyPenalty,
        presencePenalty: m.presencePenalty,
        signal: abortController.signal
      });
      
      const endTime = Date.now();
      m.latency = endTime - startTime;
      if (response.raw && response.raw.usage) {
        m.tokenUsage = response.raw.usage.total_tokens || null;
      }
      m.output = response.content;
      
      // If single CSV item, also update outputList
      if (selectedItems.length === 1) {
        m.outputList = [{
          id: selectedItems[0].id,
          status: 'completed',
          content: response.content,
          latency: m.latency,
          tokenUsage: m.tokenUsage,
          expanded: true
        }];
      }
      
      addLog('success', `模块${moduleNum === 1 ? '一' : '二'}`, `请求成功`, response.raw);
    } catch (error) {
      if (error.name === 'AbortError') {
        m.output = '【已停止】';
      } else {
        m.output = `【请求失败】\n\n${error.message}`;
      }
      addLog('error', `模块${moduleNum === 1 ? '一' : '二'}`, error.message);
    } finally {
      m.loading = false;
      activeAbortControllers.value[moduleNum] = null;
    }
  }
};

const linkedRunAnimation = ref(false);

const linkedStart = () => {
  linkedRunAnimation.value = true;
  setTimeout(() => { linkedRunAnimation.value = false; }, 800);
  
  if (m1.value.model === m2.value.model && m1.value.concurrency === 1 && m2.value.concurrency === 1) {
    Message.info('检测到两个模块使用相同模型且并发数为 1，已启用全局并发控制（串行执行）');
  }
  runMock(m1.value);
  runMock(m2.value);
};

const linkedStop = () => {
  linkedRunAnimation.value = true;
  setTimeout(() => { linkedRunAnimation.value = false; }, 800);
  stopRun(1);
  stopRun(2);
};

const runLinked = (m) => {
  if (linkedRun.value) {
    linkedStart();
  } else {
    runMock(m);
  }
};

const abortBatchRun = (moduleNum) => {
  const runner = activeBatchRunners.value[moduleNum];
  if (runner) {
    runner.abort();
    const m = moduleNum === 1 ? m1.value : m2.value;
    m.loading = false;
    Message.warning('批量运行已中止');
  }
};

// 构建完整的反馈上下文
const buildFeedbackContext = (moduleNum) => {
  const source = moduleNum === 1 ? m1.value : m2.value;
  const other = moduleNum === 1 ? m2.value : m1.value;
  return {
    sourceModule: {
      label: moduleNum === 1 ? '模块一' : '模块二',
      input: source.input,
      prompt: source.prompt,
      output: source.output,
      model: source.model,
      temperature: source.temperature,
      topP: source.topP,
      maxTokens: source.maxTokens,
      frequencyPenalty: source.frequencyPenalty,
      presencePenalty: source.presencePenalty
    },
    otherModule: {
      label: moduleNum === 1 ? '模块二' : '模块一',
      input: other.input,
      prompt: other.prompt,
      model: other.model,
      temperature: other.temperature,
      topP: other.topP,
      maxTokens: other.maxTokens,
      frequencyPenalty: other.frequencyPenalty,
      presencePenalty: other.presencePenalty
    }
  };
};

// 提交反馈并自动调优 Prompt
const submitFeedback = async (moduleNum) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  if (!m.feedback.trim()) {
    Message.warning('请输入您的修改意见');
    return;
  }
  if (!m3.value.apiKey) {
    Message.error('请先在右下角 Agent 模块配置 API Key');
    if (agentState.value === 'minimized') {
      agentState.value = 'popup';
    }
    return;
  }
  
  m.feedbackLoading = true;
  const oldPrompt = m.prompt;
  const feedback = m.feedback;
  
  // 记录发送日志
  addLog('info', 'Agent', `收到反馈，准备优化模块${moduleNum === 1 ? '一' : '二'}的Prompt`);
  
  // 构建完整上下文
  const feedbackCtx = buildFeedbackContext(moduleNum);
  
  // 构建 Harness Prompt
  const harnessSystemPrompt = `你是一个顶级的 Prompt Engineering 专家。你的任务是根据用户反馈，优化并输出一个更好的 System Prompt，并在需要时建议调整模型参数。

【源模块：${feedbackCtx.sourceModule.label}】
- 模型: ${feedbackCtx.sourceModule.model}
- 参数: Temperature=${feedbackCtx.sourceModule.temperature}, TopP=${feedbackCtx.sourceModule.topP}, MaxTokens=${feedbackCtx.sourceModule.maxTokens ?? '默认'}, FrequencyPenalty=${feedbackCtx.sourceModule.frequencyPenalty}, PresencePenalty=${feedbackCtx.sourceModule.presencePenalty}
- Input: ${feedbackCtx.sourceModule.input || '无'}
- Prompt: ${feedbackCtx.sourceModule.prompt}
- Output: ${feedbackCtx.sourceModule.output}

【对比模块：${feedbackCtx.otherModule.label}】
- 模型: ${feedbackCtx.otherModule.model}
- 参数: Temperature=${feedbackCtx.otherModule.temperature}, TopP=${feedbackCtx.otherModule.topP}, MaxTokens=${feedbackCtx.otherModule.maxTokens ?? '默认'}, FrequencyPenalty=${feedbackCtx.otherModule.frequencyPenalty}, PresencePenalty=${feedbackCtx.otherModule.presencePenalty}
- Input: ${feedbackCtx.otherModule.input || '无'}
- Prompt: ${feedbackCtx.otherModule.prompt}

【用户的修改反馈意见】
${feedback}

【任务要求】
1. 深入分析用户反馈的意图。
2. 指出原始 Prompt 中的不足。
3. 评估当前模型参数是否合理，如果需要调整，请在 <suggested_params> 标签中输出建议的参数（JSON 格式，仅包含需要修改的字段，可选字段: temperature, topP, maxTokens, frequencyPenalty, presencePenalty）。
4. 输出优化后的全新 Prompt，务必用 XML 标签 <optimized_prompt> 包裹起来。
5. 你的语气要专业、直接，不要说废话。

示例输出格式：
<suggested_params>{"temperature": 0.5, "topP": 0.9}</suggested_params>
<optimized_prompt>优化后的 Prompt 内容</optimized_prompt>`;

  // 模拟发送到大模型
  chatList.value.push({ 
    role: 'user', 
    content: `[来自模块${moduleNum === 1 ? '一' : '二'}反馈] ${feedback}`,
    context: feedbackCtx
  });
  if (agentState.value === 'minimized') {
    agentState.value = 'popup';
  }
  isAgentThinking.value = true;
  scrollToBottom();
  
  try {
    addLog('api', 'Agent', `发起 API 请求，调用模型: ${m3.value.model}`);
    
    const response = await fetchLLMResponse({
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      userMessage: harnessSystemPrompt,
      temperature: m3.value.temperature,
      topP: m3.value.topP,
      maxTokens: m3.value.maxTokens,
      frequencyPenalty: m3.value.frequencyPenalty,
      presencePenalty: m3.value.presencePenalty
    });
    
    const actualResponse = response.content;

    addLog('success', 'Agent', `成功收到优化结果`, response.raw);
    
    // 解析出优化的 Prompt
    const match = actualResponse.match(/<optimized_prompt>([\s\S]*?)<\/optimized_prompt>/);
    let optimizedPrompt = oldPrompt;
    if (match && match[1]) {
      optimizedPrompt = match[1].trim();
    }
    
    // 解析建议的参数
    const paramsMatch = actualResponse.match(/<suggested_params>([\s\S]*?)<\/suggested_params>/);
    let suggestedParams = null;
    if (paramsMatch && paramsMatch[1]) {
      try {
        const parsed = JSON.parse(paramsMatch[1].trim());
        const allowedKeys = ['temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty'];
        suggestedParams = {};
        for (const key of allowedKeys) {
          if (key in parsed) {
            suggestedParams[key] = parsed[key];
          }
        }
        if (Object.keys(suggestedParams).length === 0) suggestedParams = null;
      } catch (e) {
        suggestedParams = null;
      }
    }
    
    isAgentThinking.value = false;
    chatList.value.push({
      role: 'agent',
      content: actualResponse,
      action: { prompt: optimizedPrompt, targetModule: moduleNum, suggestedParams }
    });
    scrollToBottom();
    
    m.feedback = '';
    m.feedbackLoading = false;
    Message.success('Agent 已生成新的 Prompt 建议');
  } catch (error) {
    addLog('error', 'Agent', `API 请求失败: ${error.message}`);
    isAgentThinking.value = false;
    m.feedbackLoading = false;
    Message.error('调优失败，请检查网络或 API Key');
  }
};

// 发送 Agent 消息
const sendAgentMessage = async () => {
  if (!agentInput.value.trim()) return;
  
  if (!m3.value.apiKey) {
    Message.error('请先在右下角 Agent 模块配置 API Key');
    return;
  }
  
  const text = agentInput.value;
  chatList.value.push({ role: 'user', content: text });
  agentInput.value = '';
  isAgentThinking.value = true;
  scrollToBottom();
  
  // 转换历史记录 (去除含有 action/context 的复杂结构，只保留文本)
  const history = chatList.value.slice(0, -1).map(msg => ({
    role: msg.role === 'agent' ? 'assistant' : 'user',
    content: msg.content
  }));
  
  try {
    addLog('api', 'Agent', `发起 API 请求 (自由对话)，调用模型: ${m3.value.model}`);
    
    const response = await fetchLLMResponse({
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      systemPrompt: `你是一个专业的 Prompt Engineering 专家。你的任务是根据用户的需求，帮助用户优化或生成 System Prompt。如果你的回复中包含推荐的 Prompt，请务必用 XML 标签 <optimized_prompt> 包裹起来，这样系统可以识别并允许用户一键应用。`,
      userMessage: text,
      history: history,
      temperature: m3.value.temperature,
      topP: m3.value.topP,
      maxTokens: m3.value.maxTokens,
      frequencyPenalty: m3.value.frequencyPenalty,
      presencePenalty: m3.value.presencePenalty
    });
    
    const actualResponse = response.content;
    addLog('success', 'Agent', `成功收到回复`, response.raw);
    
    // 解析出优化的 Prompt
    const match = actualResponse.match(/<optimized_prompt>([\s\S]*?)<\/optimized_prompt>/);
    let actionObj = null;
    if (match && match[1]) {
      actionObj = { prompt: match[1].trim() };
    }
    
    isAgentThinking.value = false;
    chatList.value.push({
      role: 'agent',
      content: actualResponse,
      ...(actionObj && { action: actionObj })
    });
    scrollToBottom();
    
  } catch (error) {
    addLog('error', 'Agent', `API 请求失败: ${error.message}`);
    isAgentThinking.value = false;
    Message.error('请求失败，请检查网络或 API Key');
  }
};

const applyPrompt = (moduleNum, promptText, suggestedParams = null) => {
  const m = moduleNum === 1 ? m1.value : m2.value;
  m.prompt = promptText;
  if (suggestedParams) {
    const ranges = {
      temperature: [0, 2],
      topP: [0, 1],
      frequencyPenalty: [-2, 2],
      presencePenalty: [-2, 2]
    };
    const allowedKeys = ['temperature', 'topP', 'maxTokens', 'frequencyPenalty', 'presencePenalty'];
    for (const key of allowedKeys) {
      if (key in suggestedParams) {
        let val = suggestedParams[key];
        if (ranges[key]) {
          val = Math.min(Math.max(val, ranges[key][0]), ranges[key][1]);
        }
        m[key] = val;
      }
    }
  }
  Message.success(`已成功应用到模块${moduleNum === 1 ? '一' : '二'}`);
};

const resetData = () => {
  if (confirm('确定要清空所有输入和配置吗？此操作不可恢复。')) {
      m1.value = {
        input: '',
        csvData: [],
        csvCurrentIndex: 0,
        prompt: '',
        model: 'gpt-3.5-turbo',
        apiKey: '',
        temperature: 0.7,
        topP: 1,
        maxTokens: undefined,
        frequencyPenalty: 0,
        presencePenalty: 0,
        output: '',
        loading: false,
        showParams: false,
        hideBriefParams: false,
        feedback: '',
        feedbackLoading: false
      };
      m2.value = {
        input: '',
        csvData: [],
        csvCurrentIndex: 0,
        prompt: '',
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.7,
        topP: 1,
        maxTokens: undefined,
        frequencyPenalty: 0,
        presencePenalty: 0,
        output: '',
        loading: false,
        showParams: false,
        hideBriefParams: false,
        feedback: '',
        feedbackLoading: false
      };
    chatList.value = [
        { role: 'agent', content: '你好！我是你的 Prompt 调优助手。你可以在这里输入反馈，我会帮你调整上方两个模块的 Prompt。' }
      ];
      m1History.value = [];
      m2History.value = [];
      Message.success('数据已重置');
  }
};

const copyText = async (text) => {
  if (!text) {
    Message.warning('没有可复制的内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    Message.success('复制成功');
  } catch (err) {
    Message.error('复制失败，请手动复制');
  }
};

const exportData = () => {
  const exportObj = {
    timestamp: new Date().toISOString(),
    module1: {
      ...m1.value,
      history: m1History.value
    },
    module2: {
      ...m2.value,
      history: m2History.value
    },
    module3_agent: {
      ...m3.value,
      chatHistory: chatList.value
    }
  };
  
  // 移除一些不需要导出的 UI 状态和临时数据
  ['showParams', 'loading', 'feedbackLoading'].forEach(key => {
    delete exportObj.module1[key];
    delete exportObj.module2[key];
    if (exportObj.module3_agent) delete exportObj.module3_agent[key];
  });

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const now = new Date();
  const timeStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  a.download = `prompt-tuner-full-export_${timeStr}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Message.success('全部实验记录导出成功');
};

const arcadeFlash = (event) => {
  // 在按钮位置创建一个全屏闪烁遮罩，模拟街机按钮效果
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;
    pointer-events: none; mix-blend-mode: screen;
  `
  document.body.appendChild(overlay)
  
  const colors = ['#ff0', '#0ff', '#f0f', '#ff0', '#0f0', '#f00', 'transparent']
  let i = 0
  const flash = setInterval(() => {
    if (i >= colors.length) {
      clearInterval(flash)
      overlay.remove()
      return
    }
    overlay.style.backgroundColor = colors[i]
    overlay.style.opacity = i < colors.length - 1 ? '0.15' : '0'
    i++
  }, 60)
};

const scrollToBottom = () => {
  setTimeout(() => {
    const list = document.getElementById('chatList');
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, 100);
};

// 数据持久化
const SAVE_KEY = 'prompt-tuner-data';

const saveData = () => {
  const data = {
    globalConfig: {
      model: globalConfig.value.model,
      apiKey: globalConfig.value.apiKey,
      systemPrompt: globalConfig.value.systemPrompt,
      temperature: globalConfig.value.temperature,
      topP: globalConfig.value.topP,
      maxTokens: globalConfig.value.maxTokens,
      frequencyPenalty: globalConfig.value.frequencyPenalty,
      presencePenalty: globalConfig.value.presencePenalty,
      concurrency: globalConfig.value.concurrency
    },
    m1: {
      input: m1.value.input,
      csvData: m1.value.csvData,
      csvCurrentIndex: m1.value.csvCurrentIndex,
      prompt: m1.value.prompt,
      systemPrompt: m1.value.systemPrompt,
      model: m1.value.model,
      apiKey: m1.value.apiKey,
      temperature: m1.value.temperature,
      topP: m1.value.topP,
      maxTokens: m1.value.maxTokens,
      frequencyPenalty: m1.value.frequencyPenalty,
      presencePenalty: m1.value.presencePenalty,
      hideBriefParams: m1.value.hideBriefParams,
      concurrency: m1.value.concurrency,
      overrides: [...m1.value.overrides]
    },
    m2: {
      input: m2.value.input,
      csvData: m2.value.csvData,
      csvCurrentIndex: m2.value.csvCurrentIndex,
      prompt: m2.value.prompt,
      systemPrompt: m2.value.systemPrompt,
      model: m2.value.model,
      apiKey: m2.value.apiKey,
      temperature: m2.value.temperature,
      topP: m2.value.topP,
      maxTokens: m2.value.maxTokens,
      frequencyPenalty: m2.value.frequencyPenalty,
      presencePenalty: m2.value.presencePenalty,
      hideBriefParams: m2.value.hideBriefParams,
      concurrency: m2.value.concurrency,
      overrides: [...m2.value.overrides]
    },
    m3: {
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      temperature: m3.value.temperature,
      topP: m3.value.topP,
      maxTokens: m3.value.maxTokens,
      frequencyPenalty: m3.value.frequencyPenalty,
      presencePenalty: m3.value.presencePenalty
    },
    chatList: chatList.value,
    m1History: m1History.value,
    m2History: m2History.value,
    agentState: agentState.value
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
};

const loadData = () => {
  const dataStr = localStorage.getItem(SAVE_KEY);
  if (dataStr) {
    try {
      const data = JSON.parse(dataStr);
      if (data.globalConfig) {
        Object.assign(globalConfig.value, data.globalConfig)
      }
      if (data.m1) {
        Object.assign(m1.value, data.m1);
        if (Array.isArray(data.m1.overrides)) {
          m1.value.overrides = new Set(data.m1.overrides)
        } else {
          m1.value.overrides = new Set()
        }
      }
      if (data.m2) {
        Object.assign(m2.value, data.m2);
        if (Array.isArray(data.m2.overrides)) {
          m2.value.overrides = new Set(data.m2.overrides)
        } else {
          m2.value.overrides = new Set()
        }
      }
      if (data.m3) {
        // 向后兼容：旧格式数据可能缺少新字段，使用默认值填充
        const m3Defaults = { topP: 1, maxTokens: undefined, frequencyPenalty: 0, presencePenalty: 0 };
        Object.assign(m3.value, m3Defaults, data.m3);
      }
      if (data.chatList) chatList.value = data.chatList;
      if (data.m1History) m1History.value = data.m1History;
      if (data.m2History) m2History.value = data.m2History;
      if (data.agentState !== undefined) agentState.value = data.agentState;
    } catch (e) {
      console.error('Failed to parse localStorage data');
    }
  }
};

const visitStats = ref(null);
const STATS_API = window.location.hostname === 'localhost' ? 'http://localhost:8081' : `http://${window.location.hostname}:8081`;

onMounted(async () => {
  loadData();
  try {
    const res = await fetch(`${STATS_API}/api/visit`, { method: 'POST' });
    visitStats.value = await res.json();
  } catch (e) {
    // Stats server not available, silently ignore
  }
});

watch([m1, m2, m3, chatList, m1History, m2History, agentState, globalConfig], () => {
  saveData();
}, { deep: true });

</script>

<style scoped>
.app-container {
  padding: 24px 32px 100px;
  background-color: #f2f3f5;
  min-height: 100vh;
}
.header {
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header h2 {
  margin: 0;
  color: #1d2129;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.5px;
}
.header-subtitle {
  color: #86909c;
  font-size: 14px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.visit-stats {
  font-size: 12px;
  color: #c9cdd4;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.module-row {
  margin-bottom: 32px;
  background: transparent;
}
.link-lock-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin: -8px 0 8px;
  position: relative;
  padding: 8px 0;
  transition: all 0.4s ease;
}
.link-lock-row.link-locked {
  margin: 0 0 8px;
}

/* 锁按钮 */
.lock-btn-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid #c9cdd4;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.4s cubic-bezier(0.34, 0.69, 0.1, 1);
  z-index: 2;
}
.lock-btn-wrapper:hover {
  border-color: #165dff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.2);
}
.lock-btn-wrapper.lock-active {
  border-color: #165dff;
  background: linear-gradient(135deg, #165dff 0%, #0e42d2 100%);
  box-shadow: 0 4px 16px rgba(22, 93, 255, 0.4);
  animation: lockBounce 0.5s cubic-bezier(0.34, 0.69, 0.1, 1);
}
.lock-icon-inner {
  font-size: 18px;
  color: #86909c;
  transition: color 0.3s, transform 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock-active .lock-icon-inner {
  color: #fff;
  transform: scale(1.1);
}

/* 脉冲动画 */
.lock-pulse {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 2px solid #165dff;
  animation: lockPulse 2s ease-out infinite;
}
.lock-pulse-delay {
  animation-delay: 1s;
}

@keyframes lockPulse {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes lockBounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.2); }
  50% { transform: scale(0.95); }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* 跑道连接线 */
.runway-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  opacity: 0;
  height: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.34, 0.69, 0.1, 1);
}
.runway-line.runway-active {
  opacity: 1;
  height: 40px;
  padding: 6px 0;
}
.runway-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c9cdd4;
  transition: background 0.3s;
}
.runway-active .runway-dot {
  background: #165dff;
  animation: runwayBlink 1.5s ease-in-out infinite;
}
.runway-line-top .runway-dot:nth-child(1) { animation-delay: 0s; }
.runway-line-top .runway-dot:nth-child(2) { animation-delay: 0.15s; }
.runway-line-top .runway-dot:nth-child(3) { animation-delay: 0.3s; }
.runway-line-top .runway-dot:nth-child(4) { animation-delay: 0.45s; }
.runway-line-top .runway-dot:nth-child(5) { animation-delay: 0.6s; }
.runway-line-bottom .runway-dot:nth-child(1) { animation-delay: 0.6s; }
.runway-line-bottom .runway-dot:nth-child(2) { animation-delay: 0.45s; }
.runway-line-bottom .runway-dot:nth-child(3) { animation-delay: 0.3s; }
.runway-line-bottom .runway-dot:nth-child(4) { animation-delay: 0.15s; }
.runway-line-bottom .runway-dot:nth-child(5) { animation-delay: 0s; }

@keyframes runwayBlink {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.3); box-shadow: 0 0 6px rgba(22, 93, 255, 0.6); }
}

.link-lock-label {
  font-size: 12px;
  color: #86909c;
  margin: 4px 0;
  transition: all 0.3s;
}
.link-lock-label.label-active {
  color: #165dff;
  font-weight: 500;
}

/* 锁定总控按钮 */
.lock-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2;
}
.linked-run-controls {
  display: flex;
  align-items: center;
}
.linked-run-btn {
  border-radius: 20px;
  padding: 0 16px;
  height: 32px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.3);
}

/* 联动发射动画 */
.linked-run-blast {
  position: absolute;
  z-index: 10;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #165dff, #0e42d2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.5);
  pointer-events: none;
}
.linked-blast-up {
  animation: blastUp 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
}
.linked-blast-down {
  animation: blastDown 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
}
@keyframes blastUp {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  50% { opacity: 1; transform: translateY(-50px) scale(1.2); }
  100% { opacity: 0; transform: translateY(-90px) scale(0.6); }
}
@keyframes blastDown {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  50% { opacity: 1; transform: translateY(50px) scale(1.2); }
  100% { opacity: 0; transform: translateY(90px) scale(0.6); }
}

/* 同步方向飞行动画 */
.sync-fly-indicator {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #165dff, #0e42d2);
  color: #fff;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.4);
  pointer-events: none;
}
.sync-pos-input {
  left: 16%;
  transform: translateX(-50%);
}
.sync-pos-prompt {
  left: 50%;
  transform: translateX(-50%);
}
.sync-fly-down.sync-pos-input {
  animation: syncFlyDown 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
  left: 16%;
}
.sync-fly-up.sync-pos-input {
  animation: syncFlyUp 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
  left: 16%;
}
.sync-fly-down.sync-pos-prompt {
  animation: syncFlyDown 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
  left: 50%;
}
.sync-fly-up.sync-pos-prompt {
  animation: syncFlyUp 0.8s cubic-bezier(0.34, 0.69, 0.1, 1) forwards;
  left: 50%;
}
.sync-fly-label {
  white-space: nowrap;
}
@keyframes syncFlyDown {
  0% { opacity: 1; transform: translateY(-40px) scale(1); }
  70% { opacity: 1; transform: translateY(40px) scale(1.05); }
  100% { opacity: 0; transform: translateY(60px) scale(0.8); }
}
@keyframes syncFlyUp {
  0% { opacity: 1; transform: translateY(40px) scale(1); }
  70% { opacity: 1; transform: translateY(-40px) scale(1.05); }
  100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
}
.sync-fly-enter-active {
  transition: opacity 0.1s;
}
.sync-fly-leave-active {
  transition: opacity 0.3s;
}
.sync-fly-enter-from,
.sync-fly-leave-to {
  opacity: 0;
}
.module-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-left: 4px;
}
.module-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  position: relative;
  display: flex;
  align-items: center;
}
.module-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background-color: #165dff;
  border-radius: 2px;
  margin-right: 8px;
}
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
:deep(.arco-textarea:focus) {
  background-color: #fff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2);
}
.output-textarea :deep(.arco-textarea) {
  background-color: #f7f8fa;
  color: #1d2129;
  border-color: transparent;
}
.params-panel {
  background: #f7f8fa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
  border: 1px solid #e5e6eb;
}
.run-btn {
  margin-top: 20px;
  height: 40px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(22, 93, 255, 0.2);
}
.run-btn:hover {
  box-shadow: 0 6px 14px rgba(22, 93, 255, 0.3);
}

/* 卡片内蒙层样式 */
.prompt-card-container {
  position: relative;
  overflow: hidden;
}
.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  z-index: 10;
  display: flex;
  flex-direction: column;
  transform: translateY(-100%);
  transition: transform 0.3s cubic-bezier(0.34, 0.69, 0.1, 1);
}
.card-overlay.overlay-visible {
  transform: translateY(0);
}
.overlay-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fcfcfc;
}
.overlay-title {
  font-weight: 600;
  font-size: 15px;
  color: #1d2129;
}
.overlay-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
.overlay-content :deep(.arco-form-item) {
  margin-bottom: 2px;
}
.overlay-content :deep(.arco-form-item-label-col) {
  margin-bottom: 0px;
  line-height: 1.2;
}
.overlay-content :deep(.arco-slider) {
  margin-top: 4px;
  margin-bottom: 4px;
}
.overlay-footer {
  padding: 12px 16px;
  border-top: 1px solid #f2f3f5;
  background-color: #fcfcfc;
  display: flex;
  justify-content: flex-end;
}

/* 简要参数展示区 */
.brief-params-container {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 12px;
  min-height: 32px;
}
.brief-params {
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 6px;
  font-size: 13px;
  color: #4e5969;
  flex: 1;
  margin-right: 8px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}
.brief-params.params-dimmed {
  filter: blur(4px) grayscale(100%);
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
}
.brief-params.params-dimmed::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.5);
  z-index: 1;
}
.toggle-brief-btn {
  color: #86909c;
  margin-top: 4px;
}
.toggle-brief-btn:hover {
  background-color: #f2f3f5;
  color: #1d2129;
}
.brief-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.3s;
}
.brief-item.diff-highlight {
  background-color: #fff7e8;
  color: #ff7d00;
  font-weight: 500;
  border: 1px solid #ffe4ba;
}

/* 历史回滚虚线进度条 */
.history-timeline {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 4px 8px;
  background-color: #f7f8fa;
  border-radius: 4px;
}
.timeline-label {
  font-size: 12px;
  color: #86909c;
  margin-right: 12px;
  white-space: nowrap;
}
.timeline-track {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  padding-bottom: 2px;
}
.timeline-track::-webkit-scrollbar {
  height: 4px;
}
.timeline-track::-webkit-scrollbar-thumb {
  background-color: #e5e6eb;
  border-radius: 2px;
}
.timeline-point {
  display: flex;
  align-items: center;
}
.point-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #165dff;
  cursor: pointer;
  transition: transform 0.2s;
}
.point-dot:hover {
  transform: scale(1.5);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2);
}
.point-line {
  width: 20px;
  height: 1px;
  border-bottom: 1px dashed #c9cdd4;
  margin: 0 4px;
}

/* Output 卡片与反馈模块 */
.output-card {
  display: flex;
  flex-direction: column;
}
.feedback-section {
  margin-top: auto;
  animation: fadeIn 0.4s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.feedback-header {
  margin-bottom: 8px;
}
.feedback-title {
  font-size: 13px;
  font-weight: 500;
  color: #4e5969;
  display: flex;
  align-items: center;
}
.feedback-title::before {
  content: '✨';
  margin-right: 4px;
}
.feedback-input-group {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #f7f8fa;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.feedback-input-group:focus-within {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
  background: #fff;
}
.feedback-input-group :deep(.arco-textarea) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  font-family: inherit;
}
.feedback-submit-btn {
  border-radius: 6px;
  height: 32px;
  width: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Agent 模块优化 */
.agent-wrapper {
  position: fixed;
  bottom: 24px;
  right: 32px;
  z-index: 100;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform-origin: bottom right;
}
.agent-full {
  width: 100%;
  position: relative;
  bottom: auto;
  right: auto;
  opacity: 1;
  transform: scale(1);
}
.agent-content-container {
  width: 100%;
}
.agent-full .agent-row {
  margin-bottom: 0;
}
.agent-popup {
  width: 450px;
  border-radius: 16px;
  opacity: 1;
  transform: scale(1);
}
.agent-minimized {
  width: 56px;
  height: 56px;
  opacity: 1;
  transform: scale(1);
}
.agent-card {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(22, 93, 255, 0.1);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  overflow: hidden;
  transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
}
.agent-card-inner {
  height: 340px;
  padding: 0;
  position: relative;
  overflow: hidden;
}
.agent-overlay-wrapper {
  position: relative;
  overflow: hidden;
  height: 340px;
  border-radius: 12px;
}
.agent-params-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 面板切换动画 */
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
.agent-card-inner :deep(.arco-card-body) {
  padding: 0;
  height: 100%;
  position: relative;
}
.agent-popup .agent-card {
  height: 500px;
}
.popup-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.8);
}
.popup-title {
  font-weight: 600;
  font-size: 14px;
  color: #1d2129;
}

/* 街机霓虹风格 */
.arcade-header {
  background: linear-gradient(135deg, rgba(10, 10, 30, 0.95), rgba(20, 20, 50, 0.9));
  border-bottom: 2px solid rgba(22, 93, 255, 0.3);
}
.arcade-title {
  color: #00ffcc;
  text-shadow: 0 0 8px rgba(0, 255, 204, 0.6), 0 0 16px rgba(0, 255, 204, 0.3);
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  animation: arcadeGlow 2s ease-in-out infinite alternate;
}
@keyframes arcadeGlow {
  0% { text-shadow: 0 0 8px rgba(0, 255, 204, 0.6), 0 0 16px rgba(0, 255, 204, 0.3); }
  100% { text-shadow: 0 0 12px rgba(0, 255, 204, 0.9), 0 0 24px rgba(0, 255, 204, 0.5), 0 0 36px rgba(0, 255, 204, 0.2); }
}
.arcade-btn {
  color: #ff6ec7;
  border-radius: 4px;
  transition: all 0.15s;
  position: relative;
}
.arcade-btn:hover {
  color: #fff;
  background: rgba(255, 110, 199, 0.2);
  box-shadow: 0 0 8px rgba(255, 110, 199, 0.4), inset 0 0 8px rgba(255, 110, 199, 0.1);
}
.arcade-flash-active {
  animation: arcadeFlashAnim 0.6s ease-out;
}
@keyframes arcadeFlashAnim {
  0% { box-shadow: 0 0 0 rgba(255, 255, 0, 0); background: transparent; }
  15% { box-shadow: 0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 110, 199, 0.4); background: rgba(255, 255, 0, 0.3); }
  30% { box-shadow: 0 0 4px rgba(0, 255, 255, 0.3); background: transparent; }
  45% { box-shadow: 0 0 16px rgba(255, 110, 199, 0.7), 0 0 32px rgba(0, 255, 255, 0.3); background: rgba(255, 110, 199, 0.2); }
  60% { box-shadow: 0 0 2px rgba(255, 255, 0, 0.2); background: transparent; }
  75% { box-shadow: 0 0 10px rgba(0, 255, 204, 0.5); background: rgba(0, 255, 204, 0.1); }
  100% { box-shadow: 0 0 0 transparent; background: transparent; }
}
.collapse-btn {
  color: #86909c;
  border-radius: 4px;
  transition: all 0.2s;
}
.collapse-btn:hover {
  color: #1d2129;
  background-color: #f2f3f5;
}
.agent-fab {
  cursor: pointer;
  z-index: 100;
}
.fab-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #165dff 0%, #0e42d2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 16px rgba(22, 93, 255, 0.4);
  transition: transform 0.3s cubic-bezier(0.34, 0.69, 0.1, 1), box-shadow 0.3s;
}
.fab-icon:hover {
  transform: scale(1.05) translateY(-4px);
  box-shadow: 0 8px 24px rgba(22, 93, 255, 0.5);
}
.agent-card :deep(.arco-card-body) {
  padding: 0;
}
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background-color: #fcfcfc;
}
.chat-message {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  position: relative;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}
.chat-user {
  align-self: flex-end;
  background: linear-gradient(135deg, #165dff 0%, #0e42d2 100%);
  color: #fff;
  border-bottom-right-radius: 2px;
}
.chat-agent {
  align-self: flex-start;
  background: #fff;
  color: #1d2129;
  border: 1px solid #e5e6eb;
  border-bottom-left-radius: 2px;
}
.action-buttons {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed #f2f3f5;
}
.chat-input-area {
  padding: 16px 24px;
  background: #fff;
  border-top: 1px solid #e5e6eb;
}
.chat-input-area :deep(.arco-input-search) {
  border-radius: 20px;
  overflow: hidden;
}
.chat-input-area :deep(.arco-input-wrapper) {
  border-radius: 20px 0 0 20px;
  padding-left: 16px;
}
.chat-input-area :deep(.arco-btn) {
  border-radius: 0 20px 20px 0;
}

/* CSV 控制栏 */
.input-card {
  display: flex;
  flex-direction: column;
}
.csv-pagination {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e6eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.csv-status {
  font-size: 13px;
  color: #4e5969;
  font-variant-numeric: tabular-nums;
}

/* 抽屉内样式 */
.drawer-form {
  padding-bottom: 20px;
}
.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  margin-bottom: 6px;
  margin-top: 4px;
  display: flex;
  align-items: center;
}
.form-section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 14px;
  background-color: #165dff;
  border-radius: 2px;
  margin-right: 8px;
}
.param-label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.help-icon {
  color: #86909c;
  cursor: help;
}

.output-card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.output-stats {
  display: flex;
  gap: 8px;
  font-weight: normal;
}

/* 参数变更摘要 */
.params-change-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #ff7d00;
  background: #fff7e8;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #ffe4ba;
}

/* 上下文详情 */
.context-section {
  margin-bottom: 4px;
}
.ctx-key {
  font-weight: 600;
  color: #1d2129;
  margin-right: 4px;
}
.context-detail {
  font-size: 12px;
  line-height: 1.6;
}
.context-label {
  font-weight: 600;
  color: #165dff;
  margin-bottom: 2px;
}
.context-text {
  color: #4e5969;
  word-break: break-all;
  white-space: pre-wrap;
  margin-bottom: 2px;
  max-height: 80px;
  overflow-y: auto;
}
.chat-context-block {
  margin-bottom: 4px;
}
.chat-context-block :deep(.arco-collapse-item-content) {
  padding: 8px;
  background: #f7f8fa;
  border-radius: 4px;
}
.global-config-row {
  margin-bottom: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}
.global-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.global-config-header:hover {
  background-color: #f7f8fa;
}
.global-config-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d2129;
  display: flex;
  align-items: center;
  gap: 8px;
}
.global-config-panel {
  padding: 16px 20px;
  border-top: 1px solid #f2f3f5;
  background: #fcfcfc;
}

/* 数据列表样式 */
.data-list-container {
  flex: 1;
  overflow-y: auto;
  max-height: 300px;
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
.data-item-focused {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
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
.data-item-body :deep(.arco-textarea) {
  font-size: 13px;
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
.data-list-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
  margin-top: 4px;
  border-top: 1px solid #f2f3f5;
}
.nav-indicator {
  font-size: 12px;
  color: #86909c;
  font-variant-numeric: tabular-nums;
}
.batch-progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 4px;
}
.batch-progress-bar :deep(.arco-progress) {
  flex: 1;
}
.output-result-content {
  font-size: 13px;
  color: #1d2129;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.output-result-error {
  font-size: 13px;
  color: #f53f3f;
  line-height: 1.6;
}
.output-result-pending {
  font-size: 13px;
  color: #86909c;
  font-style: italic;
}
.output-result-stats {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f2f3f5;
}
.expected-output-compare {
  margin-top: 8px;
  padding: 8px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 6px;
}
.expected-label {
  font-size: 11px;
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 4px;
}
.expected-content {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
  white-space: pre-wrap;
}
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.app-footer {
  text-align: center;
  padding: 24px 0 12px;
  font-size: 12px;
  color: #c9cdd4;
}
</style>