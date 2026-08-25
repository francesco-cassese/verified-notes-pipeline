import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import styles from "./MarkdownViewer.module.css";

// Con sectionNumber impostato (solo dentro una sezione numerata di Nota.jsx),
// prefissa i sottotitoli con la numerazione gerarchica del template (1.1,
// 1.1.2, ...). rehype-slug ha già assegnato l'id all'header in base al testo
// originale prima che arrivi qui: aggiungere solo il prefisso visivo al testo
// renderizzato non lo tocca, gli ancoraggi restano quelli originali.
function buildHeadingComponents(sectionNumber) {
    if (sectionNumber == null) return undefined;

    let h3Count = 0;
    let h4Count = 0;

    return {
        h3({ children, ...props }) {
            h3Count += 1;
            h4Count = 0;
            return <h3 {...props}>{`${sectionNumber}.${h3Count} `}{children}</h3>;
        },
        h4({ children, ...props }) {
            h4Count += 1;
            return <h4 {...props}>{`${sectionNumber}.${h3Count}.${h4Count} `}{children}</h4>;
        },
    };
}

function MarkdownViewer({ markdown, sectionNumber, senzaMargineSuperiore }) {
    const classi = senzaMargineSuperiore
        ? `${styles.markdownViewer} ${styles.noTopMargin}`
        : styles.markdownViewer;

    return (
        <div className={classi}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={buildHeadingComponents(sectionNumber)}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}

export default MarkdownViewer;
