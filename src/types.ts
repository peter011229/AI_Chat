export type Role = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: number;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    updatedAt: number;
}

export interface ChatCompletionResponse {
    id: string;
    choices: {
        delta: {
            content?: string;
        };
        finish_reason: string | null;
        index: number;
    }[];
}
