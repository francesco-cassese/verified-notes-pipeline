import { ErrorCodes } from "../../utils/errors.js";

function createNoteOrchestrator({ generator, validator, reviewer, writer, logger, maxAttempts }) {
    async function run(topic, opts = {}) {
        const { onPhase } = opts;
        let lastIssues = [];
        // Le fonti trovate dipendono solo dall'argomento, non dal contenuto della
        // bozza: se un retry è scattato per un rifiuto di validator/reviewer
        // (non per un fallimento della ricerca stessa), le fonti del tentativo
        // precedente sono ancora valide. Le teniamo in cache per evitare di rifare
        // ricerca web + fetch delle pagine ad ogni retry, che non cambierebbe nulla
        // nel risultato ma costerebbe tempo e chiamate all'API di ricerca.
        let searchResultsCache = null;

        // Solo il ciclo generate -> validate viene ripetuto: è l'unico passaggio
        // realmente non deterministico. La scrittura su disco resta fuori dal
        // ciclo (vedi sotto): un errore lì non va ritentato alla cieca.
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            logger.info("orchestrator", "Tentativo di generazione", { topic, attempt });

            // Arricchisce ogni evento di fase con il tentativo corrente: così chi
            // emette l'evento (qui o dentro generator.generate) non deve conoscere
            // maxAttempts, lo aggiunge un solo punto centrale.
            const emitPhase = (event) => onPhase?.({ ...event, attempt, maxAttempts });

            let draft;
            let searchResults;
            try {
                ({ draft, searchResults } = await generator.generate(topic, {
                    feedback: lastIssues,
                    onPhase: emitPhase,
                    searchResultsCache,
                }));
                searchResultsCache = searchResults;
            } catch (error) {
                if (error.code === ErrorCodes.NO_OFFICIAL_SOURCE_ERROR) {
                    // Non retryabile: la ricerca per questo argomento è deterministica,
                    // un nuovo tentativo darebbe lo stesso risultato vuoto e sprecherebbe
                    // solo altre chiamate. Ci fermiamo qui, senza aver speso token sul modello.
                    logger.warn("orchestrator", "Nessuna fonte ufficiale, interrotto senza ritentare", {
                        topic,
                        attempt,
                    });
                    return { status: "failed", reason: "no_official_source", attempts: attempt };
                }

                // Se la bozza ha violato lo schema (es. un campo troppo lungo), il
                // parser lancia prima ancora che il codice la veda: senza questo
                // feedback specifico il tentativo successivo ripeterebbe alla cieca
                // lo stesso errore, invece di sapere cosa correggere.
                if (error.issues) {
                    lastIssues = error.issues;
                }

                logger.error("orchestrator", "Generazione fallita", {
                    topic,
                    attempt,
                    error: error.message,
                    cause: error.cause?.message ?? error.cause,
                });
                if (attempt === maxAttempts) {
                    return { status: "failed", reason: "generation", attempts: attempt };
                }
                continue;
            }

            emitPhase({ phase: "structure-check", message: "Controllo della struttura e delle fonti..." });
            const result = validator.validate(draft, searchResults.map((r) => r.url));

            if (!result.success) {
                lastIssues = result.issues;
                logger.warn("orchestrator", "Validazione fallita, ripeto con feedback", {
                    topic,
                    attempt,
                    issues: lastIssues,
                });
                continue;
            }

            // Conformità strutturale OK: passa alla revisione semantica, che in
            // un'unica chiamata LLM valuta il perimetro/livello (la bozza resta
            // in tema e non è troppo approfondita per un'introduzione),
            // l'aderenza alle fonti (i fatti scritti vengono dagli estratti, non
            // dalla memoria del modello: il Validatore verifica solo che gli URL
            // citati siano reali, non che il testo generato sia fedele al loro
            // contenuto) e le best practice (niente pattern che le fonti stesse
            // segnalano come superati). I tre giudizi restano indipendenti nello
            // schema e nel prompt, solo la chiamata è unica: dimezza i token di
            // contesto (bozza+fonti incollate una volta sola) rispetto a chiamate
            // separate.
            emitPhase({ phase: "review", message: "Controllo del contenuto, del livello, delle fonti e delle best practice..." });
            let reviewResult;
            try {
                reviewResult = await reviewer.review(topic, result.data, searchResults);
            } catch (error) {
                // Come per il generator: se la risposta del Reviewer ha violato lo
                // schema (es. un campo annidato arrivato come stringa invece che
                // come oggetto), portiamo avanti il feedback specifico invece di
                // ritentare alla cieca.
                if (error.issues) {
                    lastIssues = error.issues;
                }

                logger.error("orchestrator", "Revisione fallita", {
                    topic,
                    attempt,
                    error: error.message,
                    cause: error.cause?.message ?? error.cause,
                });
                if (attempt === maxAttempts) {
                    return { status: "failed", reason: "generation", attempts: attempt };
                }
                continue;
            }

            const scopeIssues = reviewResult.scope.approved ? [] : reviewResult.scope.reasons;
            const adherenceIssues = reviewResult.adherence.adherent ? [] : reviewResult.adherence.reasons;
            const bestPracticeIssues = reviewResult.bestPractice.upToDate ? [] : reviewResult.bestPractice.reasons;

            if (scopeIssues.length > 0 || adherenceIssues.length > 0 || bestPracticeIssues.length > 0) {
                lastIssues = [...scopeIssues, ...adherenceIssues, ...bestPracticeIssues];
                logger.warn("orchestrator", "Revisione non superata, ripeto con feedback", {
                    topic,
                    attempt,
                    reasons: lastIssues,
                });
                continue;
            }

            emitPhase({ phase: "saving", message: "Formattazione e salvataggio del documento..." });
            try {
                const written = await writer.write(result.data);
                return { status: "success", note: written, attempts: attempt };
            } catch (error) {
                // Rifiuto di sicurezza (path traversal) o errore disco: non retryabile,
                // fallisce subito l'intera esecuzione con un motivo distinto.
                logger.error("orchestrator", "Scrittura dell'appunto fallita", {
                    topic,
                    attempt,
                    code: error.code,
                    error: error.message,
                });
                return { status: "failed", reason: "write", attempts: attempt };
            }
        }

        return { status: "failed", reason: "validation", issues: lastIssues, attempts: maxAttempts };
    }

    return { run };
}

export default createNoteOrchestrator;
