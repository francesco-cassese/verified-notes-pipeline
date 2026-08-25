import { useState } from "react";
import { Link } from "react-router-dom";
import Errore from "../components/Errore.jsx";

function GeneratorPage() {
    const [argomento, setArgomento] = useState("");
    const [generando, setGenerando] = useState(false);
    const [stato, setStato] = useState("");
    const [conferma, setConferma] = useState(null);
    const [errore, setErrore] = useState(null);

    async function handleSubmit(evento) {
        evento.preventDefault();

        const valore = argomento.trim();
        if (valore.length < 3) return;

        setGenerando(true);
        setStato("Avvio della generazione...");
        setConferma(null);
        setErrore(null);

        function gestisciEvento(evento, dati) {
            if (evento === "fase") {
                const tentativoTesto = dati.tentativiMax > 1 ? ` (tentativo ${dati.tentativo} di ${dati.tentativiMax})` : "";
                setStato(dati.messaggio + tentativoTesto);
            } else if (evento === "risultato") {
                if (dati.esito === "successo") {
                    setConferma(dati.nota);
                    setArgomento("");
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
        <main className="page page-generatore">
            <h1>Generatore di appunti tecnici</h1>
            <p className="sottotitolo">
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

            <div className="stato-generazione" role="status" aria-live="polite">{stato}</div>

            {errore && <Errore dati={errore} />}

            {conferma && (
                <div className="conferma-salvataggio">
                    <p className="conferma-titolo">✅ Appunto salvato</p>
                    <p className="conferma-nota-titolo">{conferma.titolo}</p>
                    <p className="conferma-percorso">{conferma.percorsoRelativo}</p>
                    <div className="conferma-azioni">
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
