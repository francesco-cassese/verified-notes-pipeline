import { Link, useParams } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";
import Nota from "../components/Nota.jsx";
import MarkdownViewer from "../components/MarkdownViewer.jsx";

function ArchivioDettaglio() {
    const { cartella, nomeFile } = useParams();
    const { dati, caricamento, errore } = useFetchJson(
        `/api/appunti/cartelle/${cartella}/${nomeFile}`
    );

    return (
        <main className="page page-archivio">
            <Link to={`/archivio/${cartella}`} className="breadcrumb">← {cartella}</Link>

            {caricamento && <p className="stato-generazione">Caricamento...</p>}
            {errore && <div className="errore">{errore}</div>}

            {dati && dati.formato === "json" && <Nota nota={dati.nota} />}

            {dati && dati.formato === "markdown" && (
                <article className="nota">
                    <span className="modulo-badge">{dati.meta.modulo || ""}</span>
                    <h2>{dati.meta.titolo}</h2>
                    {dati.meta.creatoIl && (
                        <div className="meta">{new Date(dati.meta.creatoIl).toLocaleString("it-IT")}</div>
                    )}
                    <MarkdownViewer markdown={dati.corpo} />
                </article>
            )}
        </main>
    );
}

export default ArchivioDettaglio;
