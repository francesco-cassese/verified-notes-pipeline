import { Link, useParams } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import Note from "../components/Note.jsx";
import MarkdownViewer from "../components/MarkdownViewer.jsx";

function NotePage() {
    const { folder, fileName } = useParams();
    const { data, isLoading, error } = useFetchJson(
        `/api/notes/folders/${folder}/${fileName}`
    );

    return (
        <main className="page">
            <Link to={`/archive/${folder}`} className="breadcrumb">← {folder}</Link>

            {isLoading && <p className="generationStatus">Caricamento...</p>}
            {error && <div className="error">{error}</div>}

            {data && data.format === "json" && <Note note={data.note} />}

            {data && data.format === "markdown" && (
                <article className="note">
                    <span className="moduleBadge">{data.meta.module || ""}</span>
                    <h2>{data.meta.title}</h2>
                    {data.meta.createdAt && (
                        <div className="meta">{new Date(data.meta.createdAt).toLocaleString("it-IT")}</div>
                    )}
                    <MarkdownViewer markdown={data.body} />
                </article>
            )}
        </main>
    );
}

export default NotePage;
