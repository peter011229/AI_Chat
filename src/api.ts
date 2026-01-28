import type { Message } from './types';

// 默认值 - 智谱 AI
const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_MODEL = 'glm-4';

export async function* fetchChatCompletionStream(messages: Message[]) {
    // 优先从环境变量读取，如果不存在则从 localStorage 读取
    const envKey = import.meta.env.VITE_ZHIPU_AI_API_KEY;
    const localKey = localStorage.getItem('custom_api_key');
    const finalKey = (envKey && envKey !== 'your_api_key_here') ? envKey : localKey;

    // 读取动态配置，如果没有则使用默认值
    const finalBaseUrl = localStorage.getItem('custom_base_url') || DEFAULT_BASE_URL;
    const finalModel = localStorage.getItem('custom_model') || DEFAULT_MODEL;

    if (!finalKey) {
        throw new Error('未检测到有效的 API Key。请点击左下角设置图标进行配置。');
    }

    // 格式化消息
    const formattedMessages = messages.map(({ role, content }) => ({
        role,
        content,
    }));

    const response = await fetch(finalBaseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalKey}`,
        },
        body: JSON.stringify({
            model: finalModel,
            messages: formattedMessages,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
                try {
                    const jsonString = trimmedLine.slice(6);
                    const data = JSON.parse(jsonString);
                    const content = data.choices?.[0]?.delta?.content;
                    if (content) {
                        yield content;
                    }
                } catch (e) {
                    console.error('解析流数据失败:', e, trimmedLine);
                }
            }
        }
    }
}
