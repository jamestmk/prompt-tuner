/**
 * Unified API Wrapper for multiple LLM providers
 * Supports OpenAI-compatible APIs natively, and adapts Anthropic/Gemini
 */

const PROVIDER_CONFIG = {
  // OpenAI
  'gpt-4o': { type: 'openai', url: 'https://api.openai.com/v1/chat/completions' },
  'gpt-4-turbo': { type: 'openai', url: 'https://api.openai.com/v1/chat/completions' },
  'gpt-3.5-turbo': { type: 'openai', url: 'https://api.openai.com/v1/chat/completions' },
  
  // Anthropic
  'claude-3-5-sonnet': { type: 'anthropic', url: 'https://api.anthropic.com/v1/messages' },
  'claude-3-opus': { type: 'anthropic', url: 'https://api.anthropic.com/v1/messages' },
  'claude-3-haiku': { type: 'anthropic', url: 'https://api.anthropic.com/v1/messages' },
  
  // Google
  'gemini-1.5-pro': { type: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent' },
  'gemini-1.5-flash': { type: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' },
  
  // DeepSeek
  'deepseek-chat': { type: 'openai', url: 'https://api.deepseek.com/chat/completions' },
  'deepseek-coder': { type: 'openai', url: 'https://api.deepseek.com/chat/completions' },
  
  // Aliyun
  'qwen-max': { type: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  'qwen-plus': { type: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  'qwen-turbo': { type: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  
  // Zhipu / Z.AI
  'glm-5.1': { type: 'openai', url: 'https://api.z.ai/api/paas/v4/chat/completions' },
  'glm-4-plus': { type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  'glm-4-0520': { type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  'glm-4-air': { type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  'glm-4-flash': { type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  'glm-4v-plus': { type: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  
  // Moonshot
  'moonshot-v1-8k': { type: 'openai', url: 'https://api.moonshot.cn/v1/chat/completions' },
  'moonshot-v1-32k': { type: 'openai', url: 'https://api.moonshot.cn/v1/chat/completions' },
  'moonshot-v1-200k': { type: 'openai', url: 'https://api.moonshot.cn/v1/chat/completions' },
  
  // Baichuan
  'baichuan-4': { type: 'openai', url: 'https://api.baichuan-ai.com/v1/chat/completions' },
  'baichuan3-turbo': { type: 'openai', url: 'https://api.baichuan-ai.com/v1/chat/completions' },
};

export const verifyApiKey = async (model, apiKey) => {
  if (!apiKey) return false;
  
  try {
    // 很多国内模型 (比如 Z.AI, GLM, 通义千问等) 不支持 max_tokens 为 1，或者对 payload 限制严格。
    // 因此使用一个最安全的请求体。
    await fetchLLMResponse({
      model,
      apiKey,
      userMessage: "hi",
      maxTokens: 10,
      temperature: 0.1
    });
    return true;
  } catch (error) {
    console.error('API Key Verification Failed:', error.message);
    
    // 如果是 CORS 跨域错误、网络错误或 fetch 本身抛出的非 HTTP 错误，
    // 我们可能无法准确拿到 401 状态码，所以抛出一个特殊的标识，让前端不要强行阻断保存
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'network_error';
    }
    return false;
  }
};

export const fetchLLMResponse = async ({
  model,
  apiKey,
  systemPrompt,
  userMessage,
  history = [], // Array of {role, content}
  temperature,
  topP,
  maxTokens,
  frequencyPenalty,
  presencePenalty
}) => {
  const config = PROVIDER_CONFIG[model] || { type: 'openai', url: 'https://api.openai.com/v1/chat/completions' };
  
  try {
    if (config.type === 'openai') {
      return await fetchOpenAI(config.url, {
        model, apiKey, systemPrompt, userMessage, history,
        temperature, topP, maxTokens, frequencyPenalty, presencePenalty
      });
    } else if (config.type === 'anthropic') {
      return await fetchAnthropic(config.url, {
        model, apiKey, systemPrompt, userMessage, history,
        temperature, topP, maxTokens
      });
    } else if (config.type === 'gemini') {
      return await fetchGemini(config.url, {
        model, apiKey, systemPrompt, userMessage, history,
        temperature, topP, maxTokens
      });
    }
  } catch (error) {
    throw new Error(`API Request failed: ${error.message}`);
  }
};

const fetchOpenAI = async (url, params) => {
  const messages = [];
  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  
  messages.push(...params.history);
  
  if (params.userMessage) {
    messages.push({ role: 'user', content: params.userMessage });
  }

  const payload = {
    model: params.model,
    messages,
    temperature: params.temperature !== undefined ? Number(params.temperature) : 0.7,
  };

  if (params.topP !== undefined) payload.top_p = Number(params.topP);
  if (params.maxTokens !== undefined) payload.max_tokens = Number(params.maxTokens);
  if (params.frequencyPenalty !== undefined) payload.frequency_penalty = Number(params.frequencyPenalty);
  if (params.presencePenalty !== undefined) payload.presence_penalty = Number(params.presencePenalty);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${params.apiKey}`
  };
  
  // 如果是 Z.AI 的请求，增加其官方文档中要求的 Accept-Language
  if (url.includes('z.ai')) {
    headers['Accept-Language'] = 'en-US,en';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    // 根据 URL 动态识别平台，避免引起用户“调错接口”的误解
    let platformName = 'OpenAI';
    if (url.includes('z.ai')) platformName = 'Z.AI';
    else if (url.includes('bigmodel.cn')) platformName = 'Zhipu';
    else if (url.includes('aliyuncs')) platformName = 'Aliyun';
    else if (url.includes('deepseek')) platformName = 'DeepSeek';
    else if (url.includes('moonshot')) platformName = 'Moonshot';
    else if (url.includes('baichuan')) platformName = 'Baichuan';
    
    let userFriendlyError = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error && errorJson.error.message) {
        userFriendlyError = errorJson.error.message;
      }
      
      // 特殊处理 429 错误
      if (response.status === 429) {
        if (platformName === 'Z.AI' && userFriendlyError.includes('Rate limit')) {
          userFriendlyError = '请求太频繁或并发超限 (Rate Limit)。请稍后再试。';
        } else if (userFriendlyError.includes('balance') || userFriendlyError.includes('fund')) {
          userFriendlyError = '账号余额不足。';
        }
      }
    } catch (e) {
      // 忽略解析错误，保持原始文本
    }
    
    throw new Error(`[${platformName} Error] ${response.status} ${response.statusText}\n详情: ${userFriendlyError}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    raw: data
  };
};

const fetchAnthropic = async (url, params) => {
  // 注意：Anthropic 直接调用通常会有 CORS 问题，但在类似 Trae/Electron/开发服务器代理 环境中可能可用。
  const messages = [];
  
  // Anthropic 不支持 role: 'system' 作为消息，它使用顶级的 `system` 字段。
  messages.push(...params.history);
  
  if (params.userMessage) {
    messages.push({ role: 'user', content: params.userMessage });
  }

  const payload = {
    model: params.model.replace('claude-3-5-sonnet', 'claude-3-5-sonnet-20240620')
                 .replace('claude-3-opus', 'claude-3-opus-20240229')
                 .replace('claude-3-haiku', 'claude-3-haiku-20240307'),
    messages,
    max_tokens: params.maxTokens || 4096,
    temperature: params.temperature !== undefined ? Number(params.temperature) : 0.7,
  };

  if (params.systemPrompt) {
    payload.system = params.systemPrompt;
  }
  if (params.topP !== undefined) payload.top_p = Number(params.topP);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerously-allow-browser': 'true' // 如果在浏览器环境需要此头
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Anthropic Error] ${response.status} ${response.statusText}: ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    raw: data
  };
};

const fetchGemini = async (url, params) => {
  // Gemini URL 需要附加 key
  const finalUrl = `${url}?key=${params.apiKey}`;
  
  const contents = [];
  
  // 转换 history 为 Gemini 的 parts 格式
  params.history.forEach(msg => {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  });

  if (params.userMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: params.userMessage }]
    });
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: params.temperature !== undefined ? Number(params.temperature) : 0.7,
    }
  };

  if (params.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: params.systemPrompt }]
    };
  }

  if (params.topP !== undefined) payload.generationConfig.topP = Number(params.topP);
  if (params.maxTokens !== undefined) payload.generationConfig.maxOutputTokens = Number(params.maxTokens);

  const response = await fetch(finalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Gemini Error] ${response.status} ${response.statusText}: ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    raw: data
  };
};
