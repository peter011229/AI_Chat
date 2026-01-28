import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types';

import { Copy, Check } from 'lucide-react';

interface MessageItemProps {
    message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
    const isUser = message.role === 'user';
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex w-full group py-8 ${isUser ? 'bg-white' : 'bg-[#f9fafb] border-y border-gray-50'}`}>
            <div className="max-w-3xl mx-auto flex gap-4 md:gap-6 w-full px-4 md:px-0 relative">
                {/* 头像 */}
                <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 text-xs font-bold shadow-sm ${isUser ? 'bg-blue-600' : 'bg-emerald-500'
                        }`}
                >
                    {isUser ? 'U' : 'AI'}
                </div>

                {/* 消息正文 */}
                <div className="flex-1 space-y-2 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-gray-700">
                            {isUser ? 'admin' : 'AIChat'}
                        </div>
                        {!isUser && message.content && (
                            <button
                                onClick={handleCopy}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 rounded-md transition-all text-gray-400 hover:text-gray-600"
                                title="复制回答"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        )}
                    </div>

                    <div className="prose prose-sm md:prose-base max-w-none break-words text-gray-800 leading-relaxed">
                        <ReactMarkdown
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <div className="my-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                            <div className="bg-gray-800 text-gray-400 text-[10px] px-4 py-1 flex justify-between uppercase">
                                                <span>{match[1]}</span>
                                            </div>
                                            <SyntaxHighlighter
                                                style={vscDarkPlus as any}
                                                language={match[1]}
                                                PreTag="div"
                                                customStyle={{ margin: 0, padding: '1.5rem', fontSize: '0.875rem' }}
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        </div>
                                    ) : (
                                        <code className={`${className} bg-gray-100 text-pink-500 px-1.5 py-0.5 rounded text-sm font-medium`} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageItem;
