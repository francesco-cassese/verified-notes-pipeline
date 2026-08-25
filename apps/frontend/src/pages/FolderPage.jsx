import { Link, useParams } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import styles from "./FolderPage.module.css";

function FolderPage() {
    const { folder } = useParams();
    const { data, isLoading, error } = useFetchJson(`/api/notes/folders/${folder}`);

    return (
        <main className="page">
            <Link to="/archive" className="breadcrumb">← Tutte le cartelle</Link>
            <h1 className={styles.folderTitle}>{folder}</h1>

            {isLoading && <p className="generationStatus">Caricamento...</p>}
            {error && <div className="error">{error}</div>}

            {data && (
                <ul className={styles.notesList}>
                    {data.notes.map((n) => (
                        <li key={n.fileName}>
                            <Link to={`/archive/${folder}/${n.fileName}`} className={styles.noteRow}>
                                <span className={styles.noteTitle}>{n.title || n.fileName}</span>
                                {n.createdAt && (
                                    <span className={styles.noteDate}>
                                        {new Date(n.createdAt).toLocaleDateString("it-IT")}
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

export default FolderPage;
