import type { Message } from './types';

const API_KEY = import.meta.env.VITE_ZHIPU_AI_API_KEY;
const BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export async function* fetchChatCompletionStream(messages: Message[]) {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        throw new Error('请在 .env 文件中配置有效的 VITE_ZHIPU_AI_API_KEY');
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
            'Authorization': `Bearer ${API_KEY}`,
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

        // 智谱流式响应以 "data: " 开头，每行一个 JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最后一个可能是不完整的行

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
