import { Link, useParams } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import styles from "./ArchivioAppunti.module.css";

function ArchivioAppunti() {
    const { cartella } = useParams();
    const { dati, caricamento, errore } = useFetchJson(`/api/appunti/cartelle/${cartella}`);

    return (
        <main className="page">
            <Link to="/archivio" className="breadcrumb">← Tutte le cartelle</Link>
            <h1 className={styles.folderTitle}>{cartella}</h1>

            {caricamento && <p className="generationStatus">Caricamento...</p>}
            {errore && <div className="error">{errore}</div>}

            {dati && (
                <ul className={styles.notesList}>
                    {dati.appunti.map((a) => (
                        <li key={a.nomeFile}>
                            <Link to={`/archivio/${cartella}/${a.nomeFile}`} className={styles.noteRow}>
                                <span className={styles.noteTitle}>{a.titolo || a.nomeFile}</span>
                                {a.creatoIl && (
                                    <span className={styles.noteDate}>
                                        {new Date(a.creatoIl).toLocaleDateString("it-IT")}
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

export default ArchivioAppunti;
