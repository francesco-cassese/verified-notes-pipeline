import { Link } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import styles from "./ArchivioCartelle.module.css";

function ArchivioCartelle() {
    const { dati, caricamento, errore } = useFetchJson("/api/appunti/cartelle");

    return (
        <main className="page">
            <h1>Archivio appunti</h1>
            <p className="subtitle">Sfoglia gli appunti generati, organizzati per modulo/tecnologia.</p>

            {caricamento && <p className="generationStatus">Caricamento...</p>}
            {errore && <div className="error">{errore}</div>}

            {dati && dati.cartelle.length === 0 && (
                <p className="generationStatus">Nessun appunto generato finora.</p>
            )}

            {dati && dati.cartelle.length > 0 && (
                <div className={styles.foldersGrid}>
                    {dati.cartelle.map((c) => (
                        <Link key={c.cartella} to={`/archivio/${c.cartella}`} className={styles.folderCard}>
                            <span className={styles.folderName}>{c.cartella}</span>
                            <span className={styles.folderCount}>
                                {c.numeroAppunti} appunt{c.numeroAppunti > 1 ? "i" : "o"}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}

export default ArchivioCartelle;
