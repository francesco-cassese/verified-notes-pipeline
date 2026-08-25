import { TopicInputSchema } from "../ai/schemas/note.schemas.js";
import defaultOrchestrator from "../ai/orchestrator/compose.js";
import * as defaultArchive from "../utils/notesArchive.js";
import settings from "../utils/settings.js";
import { ErrorCodes } from "../utils/errors.js";
import logger from "../utils/logger.js";

function createAppuntiController(orchestrator = defaultOrchestrator, archive = defaultArchive, notesDir = settings.notesDir) {
    // La generazione può richiedere diverse chiamate LLM in sequenza (vedi
    // noteOrchestrator): invece di far attendere il client a occhi chiusi fino
    // alla risposta finale, la connessione resta aperta come Server-Sent Events
    // e ogni fase (ricerca, generazione, controlli, salvataggio) viene inoltrata
    // non appena l'orchestrator la raggiunge. L'esito (successo/errore) arriva
    // come ultimo evento "risultato": da qui in poi lo stato HTTP della singola
    // risposta non ha più senso (è già 200, lo stream è aperto), quindi
    // successo/errore vengono distinti dal campo "esito" nel payload, non dallo
    // status code.
    async function generaAppunto(req, res) {
        const parsed = TopicInputSchema.safeParse(req.body);

        res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        });

        const inviaEvento = (evento, dati) => {
            res.write(`event: ${evento}\ndata: ${JSON.stringify(dati)}\n\n`);
        };

        if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
            inviaEvento("risultato", { esito: "errore", errore: "Richiesta non valida", issues });
            return res.end();
        }

        try {
            const esistente = await archive.trovaAppuntoPerArgomento(notesDir, parsed.data.argomento);
            if (esistente) {
                inviaEvento("risultato", { esito: "duplicato", ...esistente });
                return res.end();
            }
        } catch (error) {
            // Il controllo dei doppioni è solo un'ottimizzazione: se la lettura
            // dell'archivio fallisce non blocchiamo la generazione per questo,
            // proseguiamo come se non fosse stato trovato nulla.
            logger.warn("appuntiController", "Controllo doppioni fallito, proseguo con la generazione", {
                errore: error.message,
            });
        }

        try {
            const result = await orchestrator.run(parsed.data.argomento, {
                onFase: (fase) => inviaEvento("fase", fase),
            });

            if (result.status === "success") {
                inviaEvento("risultato", { esito: "successo", nota: result.note, tentativi: result.attempts });
            } else {
                inviaEvento("risultato", {
                    esito: "errore",
                    errore: "Generazione dell'appunto fallita",
                    motivo: result.reason,
                    issues: result.issues,
                    tentativi: result.attempts,
                });
            }
        } catch (error) {
            // Non possiamo più delegare al middleware di errore finale (server.js):
            // gli header sono già stati inviati con res.writeHead sopra.
            logger.error("appuntiController", error.message, { codice: error.code });
            inviaEvento("risultato", { esito: "errore", errore: "Errore interno del server" });
        }

        res.end();
    }

    async function listaCartelle(req, res, next) {
        try {
            const cartelle = await archive.listCartelle(notesDir);
            return res.status(200).json({ cartelle });
        } catch (error) {
            next(error);
        }
    }

    async function listaAppunti(req, res, next) {
        try {
            const appunti = await archive.listAppunti(notesDir, req.params.cartella);
            return res.status(200).json({ appunti });
        } catch (error) {
            if (error.code === ErrorCodes.NOT_FOUND_ERROR) {
                return res.status(404).json({ errore: error.message });
            }
            next(error);
        }
    }

    async function leggiAppunto(req, res, next) {
        try {
            const dati = await archive.leggiAppunto(notesDir, req.params.cartella, req.params.nomeFile);
            return res.status(200).json(dati);
        } catch (error) {
            if ([ErrorCodes.NOT_FOUND_ERROR, ErrorCodes.PATH_TRAVERSAL_ERROR].includes(error.code)) {
                const status = error.code === ErrorCodes.NOT_FOUND_ERROR ? 404 : 400;
                return res.status(status).json({ errore: error.message });
            }
            next(error);
        }
    }

    return { generaAppunto, listaCartelle, listaAppunti, leggiAppunto };
}

export default createAppuntiController;
