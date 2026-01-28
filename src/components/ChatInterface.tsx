import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, PlusCircle, MessageSquare, User, Menu, X, Settings, Info } from 'lucide-react';
import type { Message, ChatSession } from '../types';
import { fetchChatCompletionStream } from '../api';
import MessageItem from './MessageItem';

const ChatInterface: React.FC = () => {
    // 会话列表状态
    const [sessions, setSessions] = useState<ChatSession[]>(() => {
        try {
            const saved = localStorage.getItem('chat_sessions');
            if (saved) {
                const parsedSessions = JSON.parse(saved);
                if (parsedSessions.length > 0) {
                    return parsedSessions;
                }
            }
            const initialSession: ChatSession = {
                id: Date.now().toString(),
                title: '新对话',
                messages: [],
                updatedAt: Date.now(),
            };
            return [initialSession];
        } catch (e) {
            console.error('加载会话失败:', e);
            return [{
                id: Date.now().toString(),
                title: '新对话',
                messages: [],
                updatedAt: Date.now(),
            }];
        }
    });

    // 当前活跃会话 ID
    const [activeSessionId, setActiveSessionId] = useState<string>(() => {
        const savedActive = localStorage.getItem('active_session_id');
        const savedSessions = localStorage.getItem('chat_sessions');
        if (savedActive && savedSessions) {
            try {
                const parsed = JSON.parse(savedSessions) as ChatSession[];
                if (parsed.some(s => s.id === savedActive)) return savedActive;
            } catch (e) { }
        }
        return sessions.length > 0 ? sessions[0].id : '';
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // 设置相关状态
    const [showKeySettings, setShowKeySettings] = useState(false);
    const [customKey, setCustomKey] = useState(() => localStorage.getItem('custom_api_key') || '');
    const [customBaseUrl, setCustomBaseUrl] = useState(() => localStorage.getItem('custom_base_url') || '');
    const [customModel, setCustomModel] = useState(() => localStorage.getItem('custom_model') || '');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

    // 自动滚动
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSession?.messages, activeSession?.messages[activeSession.messages.length - 1]?.content]);

    // 持久化保存
    useEffect(() => {
        localStorage.setItem('chat_sessions', JSON.stringify(sessions));
        localStorage.setItem('active_session_id', activeSessionId);
    }, [sessions, activeSessionId]);

    // 确定当前 activeSessionId
    useEffect(() => {
        if (!sessions.some(s => s.id === activeSessionId) && sessions.length > 0) {
            setActiveSessionId(sessions[0].id);
        }
    }, [sessions, activeSessionId]);

    const createNewChat = () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [],
            updatedAt: Date.now(),
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const deleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (sessions.length === 1 && sessions[0].id === id) {
            setSessions([{ ...sessions[0], messages: [], title: '新对话', updatedAt: Date.now() }]);
            return;
        }
        const filtered = sessions.filter(s => s.id !== id);
        setSessions(filtered);
        if (activeSessionId === id && filtered.length > 0) {
            setActiveSessionId(filtered[0].id);
        }
    };

    const saveSettings = () => {
        localStorage.setItem('custom_api_key', customKey);
        localStorage.setItem('custom_base_url', customBaseUrl);
        localStorage.setItem('custom_model', customModel);
        setShowKeySettings(false);
        alert('配置已成功应用！说明：如果不填写，将默认使用智谱 AI 接口。');
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !activeSession) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now(),
        };

        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        const updatedMessages = [...activeSession.messages, userMessage, assistantMessage];

        let newTitle = activeSession.title;
        if (activeSession.messages.length === 0) {
            newTitle = input.slice(0, 15) + (input.length > 15 ? '...' : '');
        }

        setSessions(prev => prev.map(s =>
            s.id === activeSessionId
                ? { ...s, messages: updatedMessages, title: newTitle, updatedAt: Date.now() }
                : s
        ));

        setInput('');
        setIsLoading(true);

        try {
            const stream = fetchChatCompletionStream(updatedMessages.slice(0, -1));
            let fullContent = '';
            for await (const chunk of stream) {
                fullContent += chunk;
                setSessions(prev => prev.map(s =>
                    s.id === activeSessionId
                        ? {
                            ...s,
                            messages: s.messages.map(m =>
                                m.id === assistantMessageId ? { ...m, content: fullContent } : m
                            )
                        }
                        : s
                ));
            }
        } catch (error: any) {
            console.error('AI 响应错误:', error);
            const errorMessage = error.message?.includes('API key')
                ? '未检测到有效的 API Key。请点击左下角设置图标进行配置。'
                : (error.message || '服务异常，请检查接口配置是否正确');

            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? {
                        ...s,
                        messages: s.messages.map(m =>
                            m.id === assistantMessageId
                                ? { ...m, content: `❌ 错误: ${errorMessage}` }
                                : m
                        )
                    }
                    : s
            ));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f9fafb] text-gray-900 overflow-hidden">
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-md shadow-sm"
            >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <aside className={`
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                fixed md:relative z-40 w-64 h-full bg-[#f3f4f6] border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col shrink-0
            `}>
                <div className="p-4">
                    <button
                        onClick={createNewChat}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                    >
                        <PlusCircle size={18} />
                        <span>新建对话</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1 no-scrollbar">
                    <div className="text-[11px] font-semibold text-gray-400 px-3 py-2 uppercase tracking-wider">最近对话</div>
                    {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map(s => (
                        <div
                            key={s.id}
                            onClick={() => {
                                setActiveSessionId(s.id);
                                if (window.innerWidth < 768) setIsSidebarOpen(false);
                            }}
                            className={`
                                group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors relative
                                ${activeSessionId === s.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-200/50'}
                            `}
                        >
                            <MessageSquare size={16} className={`${activeSessionId === s.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="flex-1 text-sm truncate pr-6">{s.title}</span>
                            <button
                                onClick={(e) => deleteSession(e, s.id)}
                                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-200 bg-[#edeff2] space-y-3">
                    <button
                        onClick={() => setShowKeySettings(true)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-600 hover:text-gray-900"
                    >
                        <Settings size={18} />
                        <span className="text-sm font-medium">模型服务配置</span>
                    </button>

                    {showKeySettings && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-800">万能模型配置</h3>
                                    <button onClick={() => setShowKeySettings(false)} className="text-gray-400 hover:text-gray-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">API Key</label>
                                        <input
                                            type="password"
                                            value={customKey}
                                            onChange={(e) => setCustomKey(e.target.value)}
                                            placeholder="厂商的 API Key (sk-...)"
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">接口地址 (Base URL)</label>
                                        <input
                                            type="text"
                                            value={customBaseUrl}
                                            onChange={(e) => setCustomBaseUrl(e.target.value)}
                                            placeholder="为空则使用智谱默认接口"
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">模型标识 (Model)</label>
                                        <input
                                            type="text"
                                            value={customModel}
                                            onChange={(e) => setCustomModel(e.target.value)}
                                            placeholder="例如: glm-4, deepseek-chat"
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>

                                    <div className="bg-blue-50/50 p-3 rounded-lg flex items-start gap-3 mt-4">
                                        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-800 leading-relaxed">
                                            配置完成后将保存在本地浏览器中，支持所有兼容 <strong>OpenAI 协议</strong> 的大模型厂商（如 DeepSeek, Moonshot 等）。
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setShowKeySettings(false)}
                                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={saveSettings}
                                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-200"
                                    >
                                        保存配置
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                            <User size={16} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 truncate">admin</span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full bg-white relative min-w-0">
                <header className="h-14 border-b border-gray-100 flex items-center justify-center px-6 shrink-0 bg-white/80 backdrop-blur-md z-10 sticky top-0">
                    <div className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 cursor-default hover:bg-gray-50 px-3 py-1 rounded-md transition-colors">
                        <span>AIChat</span>
                        <span className="text-[10px] opacity-40">▼</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pt-4 no-scrollbar">
                    <div className="max-w-3xl mx-auto px-4 md:px-0">
                        {activeSession?.messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center pt-32 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                                    <MessageSquare size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">今天想聊点什么？</h2>
                                <p className="text-gray-500 max-w-sm">
                                    您的 AI 助手已就绪。您可以问我关于编程、学习建议或任何感兴趣的话题。
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-32">
                                {activeSession.messages.map((msg) => (
                                    <MessageItem key={msg.id} message={msg} />
                                ))}
                                {isLoading && activeSession.messages[activeSession.messages.length - 1]?.content === '' && (
                                    <div className="flex gap-4 ml-4 animate-pulse">
                                        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-[10px]">AI</div>
                                        <div className="text-sm text-gray-400 self-center">正在思考...</div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-white via-white/95 to-transparent">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] p-2 pr-3 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all">
                            <textarea
                                rows={1}
                                value={input}
                                autoFocus
                                disabled={isLoading}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="给 AI 发送消息..."
                                className="flex-1 resize-none bg-transparent border-none py-3 px-3 focus:outline-none text-gray-800 min-h-[44px] max-h-48 text-[15px] placeholder-gray-400"
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className={`
                                    flex items-center justify-center p-2 rounded-lg transition-all h-9 w-9 mb-1
                                    ${isLoading || !input.trim()
                                        ? 'text-gray-300'
                                        : 'bg-black text-white hover:bg-gray-800 shadow-md transform active:scale-95'
                                    }
                                `}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 text-center mt-3 tracking-tight">
                            AI 生成的内容可能不准确，请核实重要信息。
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ChatInterface;
