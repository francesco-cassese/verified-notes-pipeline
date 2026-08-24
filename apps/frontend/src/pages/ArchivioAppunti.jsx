import { Link, useParams } from "react-router-dom";
import useFetchJson from "../hooks/useFetchJson.js";

function ArchivioAppunti() {
    const { cartella } = useParams();
    const { dati, caricamento, errore } = useFetchJson(`/api/appunti/cartelle/${cartella}`);

    return (
        <main className="page page-archivio">
            <Link to="/archivio" className="breadcrumb">← Tutte le cartelle</Link>
            <h1 className="titolo-cartella">{cartella}</h1>

            {caricamento && <p className="stato-generazione">Caricamento...</p>}
            {errore && <div className="errore">{errore}</div>}

            {dati && (
                <ul className="appunti-lista">
                    {dati.appunti.map((a) => (
                        <li key={a.nomeFile}>
                            <Link to={`/archivio/${cartella}/${a.nomeFile}`} className="appunto-riga">
                                <span className="appunto-titolo">{a.titolo || a.nomeFile}</span>
                                {a.creatoIl && (
                                    <span className="appunto-data">
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
