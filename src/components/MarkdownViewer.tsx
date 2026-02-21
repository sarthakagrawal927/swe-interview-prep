import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-invert prose-base max-w-none
      prose-headings:font-bold prose-headings:tracking-tight
      prose-h1:text-4xl prose-h1:text-gray-50 prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-gray-800
      prose-h2:text-3xl prose-h2:text-gray-100 prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-gray-800/50
      prose-h3:text-2xl prose-h3:text-gray-100 prose-h3:mt-8 prose-h3:mb-4
      prose-h4:text-xl prose-h4:text-gray-200 prose-h4:mt-6 prose-h4:mb-3
      prose-h5:text-lg prose-h5:text-gray-200 prose-h5:mt-5 prose-h5:mb-2
      prose-h6:text-base prose-h6:text-gray-300 prose-h6:mt-4 prose-h6:mb-2
      prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-4
      prose-a:text-blue-400 prose-a:no-underline prose-a:font-medium hover:prose-a:text-blue-300 hover:prose-a:underline
      prose-strong:text-gray-100 prose-strong:font-semibold
      prose-em:text-gray-300 prose-em:italic
      prose-code:text-emerald-400 prose-code:bg-gray-900/80 prose-code:border prose-code:border-gray-800
      prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
      prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-lg
      prose-pre:p-4 prose-pre:my-6 prose-pre:overflow-x-auto prose-pre:shadow-lg
      prose-ul:text-gray-300 prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
      prose-ol:text-gray-300 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
      prose-li:text-gray-300 prose-li:my-2 prose-li:leading-relaxed
      prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:pl-4
      prose-blockquote:italic prose-blockquote:text-gray-400 prose-blockquote:bg-gray-900/30
      prose-blockquote:py-2 prose-blockquote:my-6 prose-blockquote:rounded-r
      prose-table:border-collapse prose-table:w-full prose-table:my-6
      prose-table:border prose-table:border-gray-800 prose-table:rounded-lg prose-table:overflow-hidden
      prose-thead:bg-gray-900
      prose-th:text-gray-200 prose-th:font-semibold prose-th:px-4 prose-th:py-3 prose-th:border-b
      prose-th:border-gray-700 prose-th:text-left
      prose-td:text-gray-300 prose-td:px-4 prose-td:py-3 prose-td:border-b prose-td:border-gray-800
      prose-tr:hover:bg-gray-900/50
      prose-img:rounded-xl prose-img:border prose-img:border-gray-800 prose-img:my-8 prose-img:shadow-2xl
      prose-hr:border-gray-800 prose-hr:my-8
      prose-kbd:bg-gray-900 prose-kbd:border prose-kbd:border-gray-700 prose-kbd:rounded
      prose-kbd:px-2 prose-kbd:py-1 prose-kbd:text-sm prose-kbd:font-mono prose-kbd:text-gray-300"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
