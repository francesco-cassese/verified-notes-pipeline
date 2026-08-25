import { useState } from "react";
import { Link } from "react-router-dom";
import Errore from "../components/Errore.jsx";
import styles from "./GeneratorPage.module.css";

function GeneratorPage() {
    const [argomento, setArgomento] = useState("");
    const [generando, setGenerando] = useState(false);
    const [stato, setStato] = useState("");
    const [conferma, setConferma] = useState(null);
    const [duplicato, setDuplicato] = useState(null);
    const [errore, setErrore] = useState(null);

    async function handleSubmit(evento) {
        evento.preventDefault();

        const valore = argomento.trim();
        if (valore.length < 3) return;

        setGenerando(true);
        setStato("Avvio della generazione...");
        setConferma(null);
        setDuplicato(null);
        setErrore(null);

        function gestisciEvento(evento, dati) {
            if (evento === "fase") {
                const tentativoTesto = dati.tentativiMax > 1 ? ` (tentativo ${dati.tentativo} di ${dati.tentativiMax})` : "";
                setStato(dati.messaggio + tentativoTesto);
            } else if (evento === "risultato") {
                if (dati.esito === "successo") {
                    setConferma(dati.nota);
                    setArgomento("");
                } else if (dati.esito === "duplicato") {
                    setDuplicato(dati);
                } else {
                    setErrore(dati);
                }
            }
        }

        try {
            const risposta = await fetch("/api/appunti", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ argomento: valore }),
            });

            // La risposta è uno stream Server-Sent Events (event: ...\ndata: ...\n\n),
            // non un singolo JSON: la leggiamo a blocchi man mano che arrivano, così
            // possiamo mostrare la fase corrente invece di attendere in silenzio
            // fino all'evento finale "risultato".
            const lettore = risposta.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await lettore.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                let fine;
                while ((fine = buffer.indexOf("\n\n")) !== -1) {
                    const blocco = buffer.slice(0, fine);
                    buffer = buffer.slice(fine + 2);

                    const righe = blocco.split("\n");
                    const rigaEvento = righe.find((r) => r.startsWith("event:"));
                    const rigaDati = righe.find((r) => r.startsWith("data:"));
                    if (!rigaEvento || !rigaDati) continue;

                    gestisciEvento(rigaEvento.slice("event:".length).trim(), JSON.parse(rigaDati.slice("data:".length).trim()));
                }
            }

            setStato("");
        } catch (err) {
            setStato("");
            setErrore({ errore: "Impossibile contattare il server: " + err.message });
        } finally {
            setGenerando(false);
        }
    }

    return (
        <main className="page">
            <h1>Generatore di appunti tecnici</h1>
            <p className="subtitle">
                Genera un appunto basato solo su fonti ufficiali. La generazione può richiedere alcuni secondi.
            </p>

            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    id="argomento"
                    name="argomento"
                    placeholder="Es. foreach in PHP"
                    required
                    minLength={3}
                    maxLength={200}
                    autoComplete="off"
                    value={argomento}
                    onChange={(e) => setArgomento(e.target.value)}
                />
                <button type="submit" disabled={generando}>
                    Genera appunto
                </button>
            </form>

            <div className="generationStatus" role="status" aria-live="polite">{stato}</div>

            {duplicato && (
                <div className={styles.duplicateWarning}>
                    <p className={styles.duplicateWarningTitle}>⚠️ Argomento già presente in archivio</p>
                    <p className={styles.confirmationNoteTitle}>{duplicato.titolo}</p>
                    <div className={styles.confirmationActions}>
                        <Link to={`/archivio/${duplicato.cartella}/${duplicato.nomeFile}`}>
                            Apri l'appunto esistente
                        </Link>
                    </div>
                </div>
            )}

            {errore && <Errore dati={errore} />}

            {conferma && (
                <div className={styles.saveConfirmation}>
                    <p className={styles.confirmationTitle}>✅ Appunto salvato</p>
                    <p className={styles.confirmationNoteTitle}>{conferma.titolo}</p>
                    <p className={styles.confirmationPath}>{conferma.percorsoRelativo}</p>
                    <div className={styles.confirmationActions}>
                        <Link to={`/archivio/${conferma.cartella}/${conferma.nomeFile}`}>
                            Apri l'appunto
                        </Link>
                        <Link to={`/archivio/${conferma.cartella}`}>
                            Vai alla cartella "{conferma.cartella}"
                        </Link>
                    </div>
                </div>
            )}
        </main>
    );
}

export default GeneratorPage;
