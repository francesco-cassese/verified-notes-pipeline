import { Link } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import styles from "./ArchivePage.module.css";

function ArchivePage() {
    const { data, isLoading, error } = useFetchJson("/api/notes/folders");

    return (
        <main className="page">
            <h1>Archivio appunti</h1>
            <p className="subtitle">Sfoglia gli appunti generati, organizzati per modulo/tecnologia.</p>

            {isLoading && <p className="generationStatus">Caricamento...</p>}
            {error && <div className="error">{error}</div>}

            {data && data.folders.length === 0 && (
                <p className="generationStatus">Nessun appunto generato finora.</p>
            )}

            {data && data.folders.length > 0 && (
                <div className={styles.foldersGrid}>
                    {data.folders.map((f) => (
                        <Link key={f.folder} to={`/archive/${f.folder}`} className={styles.folderCard}>
                            <span className={styles.folderName}>{f.folder}</span>
                            <span className={styles.folderCount}>
                                {f.noteCount} appunt{f.noteCount > 1 ? "i" : "o"}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}

export default ArchivePage;
