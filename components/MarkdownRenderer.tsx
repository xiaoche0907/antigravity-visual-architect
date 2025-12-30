
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
    content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');

                    if (!inline && match) {
                        return (
                            <CodeBlock
                                language={match[1]}
                                code={codeString}
                                {...props}
                            />
                        );
                    }

                    // Fallback for non-highlighted blocks or unknown languages
                    if (!inline) {
                        return (
                            <CodeBlock
                                language="text"
                                code={codeString}
                                {...props}
                            />
                        );
                    }

                    return (
                        <code className={`${className} bg-black/30 rounded px-1 py-0.5 text-[#e68a00] font-mono text-sm`} {...props}>
                            {children}
                        </code>
                    );
                },
                // Custom link renderer to open in new tab
                a({ node, children, ...props }) {
                    return (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            {children}
                        </a>
                    );
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

const CodeBlock = ({ language, code }: { language: string, code: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-4 rounded-lg overflow-hidden border border-[#3c4043] bg-[#1e1e1e]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3c4043]">
                <span className="text-xs text-gray-400 font-mono uppercase">{language}</span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                    {copied ? (
                        <>
                            <span className="text-green-500">✓</span>
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <span>📋</span>
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                wrapLongLines={true}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};

export default MarkdownRenderer;
