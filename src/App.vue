<template>
  <div class="app-container">
    <div class="header">
      <div class="header-title">
        <h2>✨ Prompt Tuner</h2>
        <div class="header-subtitle">LLM 提示词对比调试与 Agent 调优助手</div>
      </div>
      <a-space>
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
                <a-button type="text" size="small" @click="syncData(1, 'input')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
              </a-space>
            </template>
            <a-textarea v-model="m1.input" placeholder="输入待处理的原始数据或前置上下文..." :auto-size="{ minRows: 6, maxRows: 15 }" />
            
            <!-- CSV 导航控制栏 -->
            <div v-if="m1.csvData && m1.csvData.length > 0" class="csv-pagination">
              <a-space>
                <a-button size="mini" type="outline" @click="prevCsvRow(1)" :disabled="m1.csvCurrentIndex === 0">
                  <template #icon><icon-left /></template>
                </a-button>
                <span class="csv-status">{{ m1.csvCurrentIndex + 1 }} / {{ m1.csvData.length }}</span>
                <a-button size="mini" type="outline" @click="nextCsvRow(1)" :disabled="m1.csvCurrentIndex === m1.csvData.length - 1">
                  <template #icon><icon-right /></template>
                </a-button>
              </a-space>
              <a-button size="mini" type="text" status="danger" @click="clearCsv(1)">清除数据</a-button>
            </div>
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
                  <template #icon><icon-swap /></template>
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

            <a-textarea v-model="m1.prompt" placeholder="在此编写您的 System Prompt 或指令..." :auto-size="{ minRows: 6, maxRows: 15 }" @change="savePromptHistory(1)" />
            
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

            <a-button type="primary" class="run-btn" long @click="runMock(m1)" :loading="m1.loading">
              <template #icon><icon-play-arrow /></template>
              运行测试 (Run)
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
            <a-textarea class="output-textarea" v-model="m1.output" readonly placeholder="模型生成的输出结果将在此显示..." :auto-size="{ minRows: 6, maxRows: 12 }" />
            
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
                <a-button type="text" size="small" @click="syncData(2, 'input')">
                  <template #icon><icon-sync /></template>
                  同步
                </a-button>
              </a-space>
            </template>
            <a-textarea v-model="m2.input" placeholder="输入待处理的原始数据或前置上下文..." :auto-size="{ minRows: 6, maxRows: 15 }" />
            
            <!-- CSV 导航控制栏 -->
            <div v-if="m2.csvData && m2.csvData.length > 0" class="csv-pagination">
              <a-space>
                <a-button size="mini" type="outline" @click="prevCsvRow(2)" :disabled="m2.csvCurrentIndex === 0">
                  <template #icon><icon-left /></template>
                </a-button>
                <span class="csv-status">{{ m2.csvCurrentIndex + 1 }} / {{ m2.csvData.length }}</span>
                <a-button size="mini" type="outline" @click="nextCsvRow(2)" :disabled="m2.csvCurrentIndex === m2.csvData.length - 1">
                  <template #icon><icon-right /></template>
                </a-button>
              </a-space>
              <a-button size="mini" type="text" status="danger" @click="clearCsv(2)">清除数据</a-button>
            </div>
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
                  <template #icon><icon-swap /></template>
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

            <a-textarea v-model="m2.prompt" placeholder="在此编写您的 System Prompt 或指令..." :auto-size="{ minRows: 6, maxRows: 15 }" @change="savePromptHistory(2)" />
            
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

            <a-button type="primary" class="run-btn" long @click="runMock(m2)" :loading="m2.loading">
              <template #icon><icon-play-arrow /></template>
              运行测试 (Run)
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
            <a-textarea class="output-textarea" v-model="m2.output" readonly placeholder="模型生成的输出结果将在此显示..." :auto-size="{ minRows: 6, maxRows: 12 }" />
            
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
                <div class="chat-container">
                  <div class="chat-list" id="chatList">
              <div v-for="(msg, index) in chatList" :key="index" :class="['chat-message', msg.role === 'user' ? 'chat-user' : 'chat-agent']">
                
                <!-- 用户发出的反馈消息，增加 Context 折叠面板 -->
                <div v-if="msg.role === 'user' && msg.context" class="chat-context-block">
                  <a-collapse :bordered="false" expand-icon-position="right">
                    <a-collapse-item header="查看附带的上下文" key="1">
                      <div class="context-detail">
                        <div class="context-label">【当前模型输出结果】</div>
                        <div class="context-text">{{ msg.context.output }}</div>
                      </div>
                    </a-collapse-item>
                  </a-collapse>
                </div>
                
                <div>{{ msg.content }}</div>
                
                <!-- Agent 生成的新 Prompt 操作按钮 -->
                <div v-if="msg.action" class="action-buttons">
                  <a-button v-if="msg.action.targetModule === 1 || !msg.action.targetModule" size="mini" type="primary" status="success" @click="applyPrompt(1, msg.action.prompt)">
                    <template #icon><icon-arrow-up /></template>
                    应用到模块一
                  </a-button>
                  <a-button v-if="msg.action.targetModule === 2 || !msg.action.targetModule" size="mini" type="primary" status="warning" @click="applyPrompt(2, msg.action.prompt)">
                    <template #icon><icon-arrow-up /></template>
                    应用到模块二
                  </a-button>
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
              </a-card>
            </div>
          </div>
        </div>

        <!-- 气泡状态下的卡片容器 (保持原样) -->
        <div v-if="agentState === 'popup'" class="agent-card">
          <div class="popup-header">
            <div class="popup-title">Agent 调优</div>
            <a-space>
              <a-button type="text" size="small" class="collapse-btn" @click="openParams(3)">
                <template #icon><icon-settings /></template>
              </a-button>
              <a-button type="text" size="small" class="collapse-btn" @click="agentState = 'full'">
                <template #icon><icon-expand /></template>
              </a-button>
              <a-button type="text" size="small" class="collapse-btn" @click="agentState = 'minimized'">
                <template #icon><icon-minus /></template>
              </a-button>
            </a-space>
          </div>
          <div class="chat-container">
            <div class="chat-list" id="chatListPopup">
              <div v-for="(msg, index) in chatList" :key="index" :class="['chat-message', msg.role === 'user' ? 'chat-user' : 'chat-agent']">
                
                <div v-if="msg.role === 'user' && msg.context" class="chat-context-block">
                  <a-collapse :bordered="false" expand-icon-position="right">
                    <a-collapse-item header="查看附带的上下文" key="1">
                      <div class="context-detail">
                        <div class="context-label">【当前模型输出结果】</div>
                        <div class="context-text">{{ msg.context.output }}</div>
                      </div>
                    </a-collapse-item>
                  </a-collapse>
                </div>
                
                <div>{{ msg.content }}</div>
                
                <div v-if="msg.action" class="action-buttons">
                  <a-button v-if="msg.action.targetModule === 1 || !msg.action.targetModule" size="mini" type="primary" status="success" @click="applyPrompt(1, msg.action.prompt)">
                    <template #icon><icon-arrow-up /></template>
                    应用到一
                  </a-button>
                  <a-button v-if="msg.action.targetModule === 2 || !msg.action.targetModule" size="mini" type="primary" status="warning" @click="applyPrompt(2, msg.action.prompt)">
                    <template #icon><icon-arrow-up /></template>
                    应用到二
                  </a-button>
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
    
    <!-- Agent 模块配置蒙层 (抽屉形式) -->
    <a-drawer v-model:visible="m3.showParams" title="Agent 模型参数配置" width="400" placement="right" :footer="false">
      <a-form layout="vertical" :model="tempConfig3" size="medium" class="drawer-form">
        <div class="form-section-title">基础配置</div>
        <a-form-item label="模型选择" field="model" style="margin-bottom: 12px;">
          <a-select v-model="tempConfig3.model" placeholder="请选择模型">
            <a-optgroup v-for="group in modelOptions" :key="group.label" :label="group.label">
              <a-option v-for="opt in group.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-optgroup>
          </a-select>
        </a-form-item>
        <a-form-item label="API Key" field="apiKey" style="margin-bottom: 12px;">
          <a-input-password v-model="tempConfig3.apiKey" placeholder="输入对应平台的 API Key" allow-clear />
        </a-form-item>

        <a-divider style="margin: 12px 0;" />
        <div class="form-section-title">高级生成参数</div>
        
        <a-form-item field="temperature">
          <template #label>
            <div class="param-label">
              <span>Temperature</span>
              <a-tooltip content="控制生成文本的随机性。">
                <icon-question-circle class="help-icon" />
              </a-tooltip>
            </div>
          </template>
          <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <a-slider v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="flex: 1;" />
            <a-input-number v-model="tempConfig3.temperature" :min="0" :max="2" :step="0.1" style="width: 70px;" @press-enter="saveParams(3)" />
          </div>
        </a-form-item>
        
        <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
          <a-button @click="cancelParams(3)" style="margin-right: 12px;">取消</a-button>
          <a-button type="primary" @click="saveParams(3)" :loading="isVerifyingKey[3]">保存配置</a-button>
        </div>
      </a-form>
    </a-drawer>
    
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

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import Papa from 'papaparse';

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
  prompt: '你是一个专业的翻译助手。请翻译以下内容：\n',
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
  feedbackLoading: false,
  tokenUsage: null,
  latency: null
});

const m2 = ref({
  input: '',
  csvData: [],
  csvCurrentIndex: 0,
  prompt: '你是一个通俗易懂的解释者。请用小学生的口吻解释以下内容：\n',
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
  feedbackLoading: false,
  tokenUsage: null,
  latency: null
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
        m.csvData = results.data;
        m.csvCurrentIndex = 0;
        updateInputFromCsv(moduleNum);
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
  m.csvCurrentIndex = 0;
  m.input = '';
};

const m3 = ref({
  model: 'gpt-4',
  apiKey: '',
  temperature: 0.7,
  showParams: false
});

// 用于在参数配置蒙层中临时绑定的状态
const tempConfig1 = ref({});
const tempConfig2 = ref({});
const tempConfig3 = ref({});

const openParams = (moduleNum) => {
  if (moduleNum === 1) {
    tempConfig1.value = JSON.parse(JSON.stringify({
      model: m1.value.model,
      apiKey: m1.value.apiKey,
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
      temperature: m3.value.temperature
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

import { fetchLLMResponse } from './utils/api';
const isVerifyingKey = ref({ 1: false, 2: false, 3: false });

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
const isAgentThinking = ref(false);

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

const syncData = (sourceModule, type) => {
  if (sourceModule === 1) {
    if (type === 'input') m2.value.input = m1.value.input;
    if (type === 'prompt') {
      m2.value.prompt = m1.value.prompt;
      savePromptHistory(2);
    }
  } else {
    if (type === 'input') m1.value.input = m2.value.input;
    if (type === 'prompt') {
      m1.value.prompt = m2.value.prompt;
      savePromptHistory(1);
    }
  }
  Message.success('同步成功');
};

// 模拟运行改为真实调用

const runMock = async (m) => {
  if (!m.apiKey) {
    Message.warning('预览环境：请先在配置中输入 API Key');
    return;
  }
  m.loading = true;
  m.tokenUsage = null;
  m.latency = null;
  const startTime = Date.now();
  addLog('api', `模块${m === m1.value ? '一' : '二'}`, `发起 API 请求，调用模型: ${m.model}`);
  
  try {
    const response = await fetchLLMResponse({
      model: m.model,
      apiKey: m.apiKey,
      systemPrompt: m.prompt,
      userMessage: m.input,
      temperature: m.temperature,
      topP: m.topP,
      maxTokens: m.maxTokens,
      frequencyPenalty: m.frequencyPenalty,
      presencePenalty: m.presencePenalty
    });
    
    const endTime = Date.now();
    m.latency = endTime - startTime;
    
    // 提取 Token 消耗 (大部分 OpenAI 兼容接口都在 usage 字段)
    if (response.raw && response.raw.usage) {
      m.tokenUsage = response.raw.usage.total_tokens || null;
    }
    
    m.output = response.content;
    addLog('success', `模块${m === m1.value ? '一' : '二'}`, `请求成功`, response.raw);
  } catch (error) {
    m.output = `【请求失败】\n\n${error.message}`;
    addLog('error', `模块${m === m1.value ? '一' : '二'}`, error.message);
  } finally {
    m.loading = false;
  }
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
    agentState.value = 'popup';
    return;
  }
  
  m.feedbackLoading = true;
  const oldPrompt = m.prompt;
  const feedback = m.feedback;
  const currentOutput = m.output;
  const currentInput = m.input;
  
  // 记录发送日志
  addLog('info', 'Agent', `收到反馈，准备优化模块${moduleNum === 1 ? '一' : '二'}的Prompt`);
  
  // 构建 Harness Prompt
  const harnessSystemPrompt = `你是一个顶级的 Prompt Engineering 专家。你的任务是根据用户反馈，优化并输出一个更好的 System Prompt。

【当前原始 Prompt】
${oldPrompt}

【当前用户输入数据】
${currentInput || '无'}

【当前模型输出结果】
${currentOutput}

【用户的修改反馈意见】
${feedback}

【任务要求】
1. 深入分析用户反馈的意图。
2. 指出原始 Prompt 中的不足。
3. 输出优化后的全新 Prompt，务必用 XML 标签 <optimized_prompt> 包裹起来。
4. 你的语气要专业、直接，不要说废话。`;

  // 模拟发送到大模型
  chatList.value.push({ 
    role: 'user', 
    content: `[来自模块${moduleNum === 1 ? '一' : '二'}反馈] ${feedback}`,
    context: {
      output: currentOutput
    }
  });
  agentState.value = 'popup';
  isAgentThinking.value = true;
  scrollToBottom();
  
  try {
    addLog('api', 'Agent', `发起 API 请求，调用模型: ${m3.value.model}`);
    
    const response = await fetchLLMResponse({
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      userMessage: harnessSystemPrompt,
      temperature: m3.value.temperature
    });
    
    const actualResponse = response.content;

    addLog('success', 'Agent', `成功收到优化结果`, response.raw);
    
    // 解析出优化的 Prompt
    const match = actualResponse.match(/<optimized_prompt>([\s\S]*?)<\/optimized_prompt>/);
    let optimizedPrompt = oldPrompt;
    if (match && match[1]) {
      optimizedPrompt = match[1].trim();
    }
    
    isAgentThinking.value = false;
    chatList.value.push({
      role: 'agent',
      content: actualResponse,
      action: { prompt: optimizedPrompt, targetModule: moduleNum }
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
      temperature: m3.value.temperature
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

const applyPrompt = (moduleNum, promptText) => {
  if (moduleNum === 1) {
    m1.value.prompt = promptText;
  } else {
    m2.value.prompt = promptText;
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
    m1: {
      input: m1.value.input,
      csvData: m1.value.csvData,
      csvCurrentIndex: m1.value.csvCurrentIndex,
      prompt: m1.value.prompt,
      model: m1.value.model,
      apiKey: m1.value.apiKey,
      temperature: m1.value.temperature,
      topP: m1.value.topP,
      maxTokens: m1.value.maxTokens,
      frequencyPenalty: m1.value.frequencyPenalty,
      presencePenalty: m1.value.presencePenalty,
      hideBriefParams: m1.value.hideBriefParams
    },
    m2: {
      input: m2.value.input,
      csvData: m2.value.csvData,
      csvCurrentIndex: m2.value.csvCurrentIndex,
      prompt: m2.value.prompt,
      model: m2.value.model,
      apiKey: m2.value.apiKey,
      temperature: m2.value.temperature,
      topP: m2.value.topP,
      maxTokens: m2.value.maxTokens,
      frequencyPenalty: m2.value.frequencyPenalty,
      presencePenalty: m2.value.presencePenalty,
      hideBriefParams: m2.value.hideBriefParams
    },
    m3: {
      model: m3.value.model,
      apiKey: m3.value.apiKey,
      temperature: m3.value.temperature
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
      if (data.m1) Object.assign(m1.value, data.m1);
      if (data.m2) Object.assign(m2.value, data.m2);
      if (data.m3) Object.assign(m3.value, data.m3);
      if (data.chatList) chatList.value = data.chatList;
      if (data.m1History) m1History.value = data.m1History;
      if (data.m2History) m2History.value = data.m2History;
      if (data.agentState !== undefined) agentState.value = data.agentState;
    } catch (e) {
      console.error('Failed to parse localStorage data');
    }
  }
};

onMounted(() => {
  loadData();
});

watch([m1, m2, m3, chatList, m1History, m2History, agentState], () => {
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
}
.module-row {
  margin-bottom: 32px;
  background: transparent;
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
}
.agent-card-inner {
  height: 340px;
  padding: 0;
}
.agent-card-inner :deep(.arco-card-body) {
  padding: 0;
  height: 100%;
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
</style>