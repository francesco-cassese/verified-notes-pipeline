import { ErrorCodes } from "../../utils/errors.js";

function createNoteOrchestrator({ generator, validator, revisore, aderenza, writer, logger, maxAttempts }) {
    async function run(argomento, opts = {}) {
        const { onFase } = opts;
        let lastIssues = [];

        // Solo il ciclo generate -> validate viene ripetuto: è l'unico passaggio
        // realmente non deterministico. La scrittura su disco resta fuori dal
        // ciclo (vedi sotto): un errore lì non va ritentato alla cieca.
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            logger.info("orchestrator", "Tentativo di generazione", { argomento, attempt });

            // Arricchisce ogni evento di fase con il tentativo corrente: così chi
            // emette l'evento (qui o dentro generator.generate) non deve conoscere
            // maxAttempts, lo aggiunge un solo punto centrale.
            const emettiFase = (evento) => onFase?.({ ...evento, tentativo: attempt, tentativiMax: maxAttempts });

            let draft;
            let risultatiRicerca;
            try {
                ({ draft, risultatiRicerca } = await generator.generate(argomento, { feedback: lastIssues, onFase: emettiFase }));
            } catch (error) {
                if (error.code === ErrorCodes.NO_OFFICIAL_SOURCE_ERROR) {
                    // Non retryabile: la ricerca per questo argomento è deterministica,
                    // un nuovo tentativo darebbe lo stesso risultato vuoto e sprecherebbe
                    // solo altre chiamate. Ci fermiamo qui, senza aver speso token sul modello.
                    logger.warn("orchestrator", "Nessuna fonte ufficiale, interrotto senza ritentare", {
                        argomento,
                        attempt,
                    });
                    return { status: "failed", reason: "no_official_source", attempts: attempt };
                }

                logger.error("orchestrator", "Generazione fallita", {
                    argomento,
                    attempt,
                    errore: error.message,
                    causa: error.cause?.message ?? error.cause,
                });
                if (attempt === maxAttempts) {
                    return { status: "failed", reason: "generation", attempts: attempt };
                }
                continue;
            }

            emettiFase({ fase: "controllo-struttura", messaggio: "Controllo della struttura e delle fonti..." });
            const result = validator.validate(draft, risultatiRicerca.map((r) => r.url));

            if (!result.success) {
                lastIssues = result.issues;
                logger.warn("orchestrator", "Validazione fallita, ripeto con feedback", {
                    argomento,
                    attempt,
                    issues: lastIssues,
                });
                continue;
            }

            // Conformità strutturale OK: passa al controllo semantico (perimetro
            // e gap analysis). È l'unico step che richiede una seconda chiamata
            // LLM nel ciclo, quindi gira solo dopo che lo schema è già passato,
            // non su ogni bozza.
            emettiFase({ fase: "controllo-perimetro", messaggio: "Controllo del contenuto e del livello..." });
            let revisione;
            try {
                revisione = await revisore.revisiona(argomento, result.data);
            } catch (error) {
                logger.error("orchestrator", "Revisione semantica fallita", {
                    argomento,
                    attempt,
                    errore: error.message,
                    causa: error.cause?.message ?? error.cause,
                });
                if (attempt === maxAttempts) {
                    return { status: "failed", reason: "generation", attempts: attempt };
                }
                continue;
            }

            if (!revisione.approvato) {
                lastIssues = revisione.motivi;
                logger.warn("orchestrator", "Revisione semantica non approvata, ripeto con feedback", {
                    argomento,
                    attempt,
                    motivi: lastIssues,
                });
                continue;
            }

            // Ultimo controllo prima della scrittura: la bozza rispetta lo schema
            // ed è in tema (Revisore), ma i fatti che contiene potrebbero comunque
            // venire dalla memoria del modello invece che dagli estratti delle fonti
            // (il Validatore verifica solo che gli URL citati siano reali, non che
            // il testo generato sia fedele al loro contenuto).
            emettiFase({ fase: "controllo-aderenza", messaggio: "Verifica di aderenza alle fonti..." });
            let verificaAderenza;
            try {
                verificaAderenza = await aderenza.verifica(argomento, result.data, risultatiRicerca);
            } catch (error) {
                logger.error("orchestrator", "Verifica di aderenza alle fonti fallita", {
                    argomento,
                    attempt,
                    errore: error.message,
                    causa: error.cause?.message ?? error.cause,
                });
                if (attempt === maxAttempts) {
                    return { status: "failed", reason: "generation", attempts: attempt };
                }
                continue;
            }

            if (!verificaAderenza.aderente) {
                lastIssues = verificaAderenza.motivi;
                logger.warn("orchestrator", "Bozza non aderente alle fonti, ripeto con feedback", {
                    argomento,
                    attempt,
                    motivi: lastIssues,
                });
                continue;
            }

            emettiFase({ fase: "salvataggio", messaggio: "Formattazione e salvataggio del documento..." });
            try {
                const written = await writer.write(result.data);
                return { status: "success", note: written, attempts: attempt };
            } catch (error) {
                // Rifiuto di sicurezza (path traversal) o errore disco: non retryabile,
                // fallisce subito l'intera esecuzione con un motivo distinto.
                logger.error("orchestrator", "Scrittura dell'appunto fallita", {
                    argomento,
                    attempt,
                    codice: error.code,
                    errore: error.message,
                });
                return { status: "failed", reason: "write", attempts: attempt };
            }
        }

        return { status: "failed", reason: "validation", issues: lastIssues, attempts: maxAttempts };
    }

    return { run };
}

export default createNoteOrchestrator;
