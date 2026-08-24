import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

function MarkdownViewer({ markdown }) {
    return (
        <div className="markdown-viewer">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                {markdown}
            </ReactMarkdown>
        </div>
    );
}

export default MarkdownViewer;
