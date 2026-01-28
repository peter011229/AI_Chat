import type { Message } from './types';

const BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export async function* fetchChatCompletionStream(messages: Message[]) {
    // 优先从环境变量读取，如果不存在则从 localStorage 读取
    const envKey = import.meta.env.VITE_ZHIPU_AI_API_KEY;
    const localKey = localStorage.getItem('custom_api_key');
    const finalKey = (envKey && envKey !== 'your_api_key_here') ? envKey : localKey;

    if (!finalKey) {
        throw new Error('未检测到有效的 API Key。请点击左下角设置图标进行配置。');
    }

    // 智谱 AI API 要求的格式
    const formattedMessages = messages.map(({ role, content }) => ({
        role,
        content,
    }));

    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalKey}`,
        },
        body: JSON.stringify({
            model: 'glm-4', // 使用标准模型，可根据需要调整
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
