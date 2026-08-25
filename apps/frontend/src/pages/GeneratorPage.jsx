import { useState } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage.jsx";
import styles from "./GeneratorPage.module.css";

function GeneratorPage() {
    const [topic, setTopic] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState("");
    const [confirmation, setConfirmation] = useState(null);
    const [duplicate, setDuplicate] = useState(null);
    const [error, setError] = useState(null);

    async function handleSubmit(event) {
        event.preventDefault();

        const value = topic.trim();
        if (value.length < 3) return;

        setIsGenerating(true);
        setStatus("Avvio della generazione...");
        setConfirmation(null);
        setDuplicate(null);
        setError(null);

        function handleEvent(eventName, data) {
            if (eventName === "phase") {
                const attemptText = data.maxAttempts > 1 ? ` (tentativo ${data.attempt} di ${data.maxAttempts})` : "";
                setStatus(data.message + attemptText);
            } else if (eventName === "result") {
                if (data.outcome === "success") {
                    setConfirmation(data.note);
                    setTopic("");
                } else if (data.outcome === "duplicate") {
                    setDuplicate(data);
                } else {
                    setError(data);
                }
            }
        }

        try {
            const response = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: value }),
            });

            // La risposta è uno stream Server-Sent Events (event: ...\ndata: ...\n\n),
            // non un singolo JSON: la leggiamo a blocchi man mano che arrivano, così
            // possiamo mostrare la fase corrente invece di attendere in silenzio
            // fino all'evento finale "result".
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value: chunk, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(chunk, { stream: true });

                let boundaryIndex;
                while ((boundaryIndex = buffer.indexOf("\n\n")) !== -1) {
                    const block = buffer.slice(0, boundaryIndex);
                    buffer = buffer.slice(boundaryIndex + 2);

                    const lines = block.split("\n");
                    const eventLine = lines.find((r) => r.startsWith("event:"));
                    const dataLine = lines.find((r) => r.startsWith("data:"));
                    if (!eventLine || !dataLine) continue;

                    handleEvent(eventLine.slice("event:".length).trim(), JSON.parse(dataLine.slice("data:".length).trim()));
                }
            }

            setStatus("");
        } catch (err) {
            setStatus("");
            setError({ error: "Impossibile contattare il server: " + err.message });
        } finally {
            setIsGenerating(false);
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
                    id="topic"
                    name="topic"
                    placeholder="Es. foreach in PHP"
                    required
                    minLength={3}
                    maxLength={200}
                    autoComplete="off"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                />
                <button type="submit" disabled={isGenerating}>
                    Genera appunto
                </button>
            </form>

            <div className="generationStatus" role="status" aria-live="polite">{status}</div>

            {duplicate && (
                <div className={styles.duplicateWarning}>
                    <p className={styles.duplicateWarningTitle}>⚠️ Argomento già presente in archivio</p>
                    <p className={styles.confirmationNoteTitle}>{duplicate.title}</p>
                    <div className={styles.confirmationActions}>
                        <Link to={`/archive/${duplicate.folder}/${duplicate.fileName}`}>
                            Apri l'appunto esistente
                        </Link>
                    </div>
                </div>
            )}

            {error && <ErrorMessage data={error} />}

            {confirmation && (
                <div className={styles.saveConfirmation}>
                    <p className={styles.confirmationTitle}>✅ Appunto salvato</p>
                    <p className={styles.confirmationNoteTitle}>{confirmation.title}</p>
                    <p className={styles.confirmationPath}>{confirmation.relativePath}</p>
                    <div className={styles.confirmationActions}>
                        <Link to={`/archive/${confirmation.folder}/${confirmation.fileName}`}>
                            Apri l'appunto
                        </Link>
                        <Link to={`/archive/${confirmation.folder}`}>
                            Vai alla cartella "{confirmation.folder}"
                        </Link>
                    </div>
                </div>
            )}
        </main>
    );
}

export default GeneratorPage;
