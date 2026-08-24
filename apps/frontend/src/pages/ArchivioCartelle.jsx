import { Link } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";

function ArchivioCartelle() {
    const { dati, caricamento, errore } = useFetchJson("/api/appunti/cartelle");

    return (
        <main className="page page-archivio">
            <h1>Archivio appunti</h1>
            <p className="sottotitolo">Sfoglia gli appunti generati, organizzati per modulo/tecnologia.</p>

            {caricamento && <p className="stato-generazione">Caricamento...</p>}
            {errore && <div className="errore">{errore}</div>}

            {dati && dati.cartelle.length === 0 && (
                <p className="stato-generazione">Nessun appunto generato finora.</p>
            )}

            {dati && dati.cartelle.length > 0 && (
                <div className="cartelle-grid">
                    {dati.cartelle.map((c) => (
                        <Link key={c.cartella} to={`/archivio/${c.cartella}`} className="cartella-card">
                            <span className="cartella-nome">{c.cartella}</span>
                            <span className="cartella-conteggio">
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
