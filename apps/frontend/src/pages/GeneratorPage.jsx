import { Link } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage.jsx";
import { useGeneration } from "../context/GenerationContext.jsx";
import styles from "./GeneratorPage.module.css";

function GeneratorPage() {
    const { topic, setTopic, isGenerating, status, confirmation, duplicate, error, startGeneration } = useGeneration();

    function handleSubmit(event) {
        event.preventDefault();
        startGeneration(topic);
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
