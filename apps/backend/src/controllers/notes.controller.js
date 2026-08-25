import { TopicInputSchema } from "../ai/schemas/note.schemas.js";
import defaultOrchestrator from "../ai/orchestrator/compose.js";
import * as defaultArchive from "../utils/notesArchive.js";
import settings from "../utils/settings.js";
import { ErrorCodes } from "../utils/errors.js";
import logger from "../utils/logger.js";

function createNotesController(orchestrator = defaultOrchestrator, archive = defaultArchive, notesDir = settings.notesDir) {
    // La generazione può richiedere diverse chiamate LLM in sequenza (vedi
    // noteOrchestrator): invece di far attendere il client a occhi chiusi fino
    // alla risposta finale, la connessione resta aperta come Server-Sent Events
    // e ogni fase (ricerca, generazione, controlli, salvataggio) viene inoltrata
    // non appena l'orchestrator la raggiunge. L'esito (successo/errore) arriva
    // come ultimo evento "result": da qui in poi lo stato HTTP della singola
    // risposta non ha più senso (è già 200, lo stream è aperto), quindi
    // successo/errore vengono distinti dal campo "outcome" nel payload, non
    // dallo status code.
    async function generateNote(req, res) {
        const parsed = TopicInputSchema.safeParse(req.body);

        res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        });

        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
            sendEvent("result", { outcome: "error", error: "Richiesta non valida", issues });
            return res.end();
        }

        try {
            const existingNote = await archive.findNoteByTopic(notesDir, parsed.data.topic);
            if (existingNote) {
                sendEvent("result", { outcome: "duplicate", ...existingNote });
                return res.end();
            }
        } catch (error) {
            // Il controllo dei doppioni è solo un'ottimizzazione: se la lettura
            // dell'archivio fallisce non blocchiamo la generazione per questo,
            // proseguiamo come se non fosse stato trovato nulla.
            logger.warn("notesController", "Controllo doppioni fallito, proseguo con la generazione", {
                error: error.message,
            });
        }

        try {
            const result = await orchestrator.run(parsed.data.topic, {
                onPhase: (phase) => sendEvent("phase", phase),
            });

            if (result.status === "success") {
                sendEvent("result", { outcome: "success", note: result.note, attempts: result.attempts });
            } else {
                sendEvent("result", {
                    outcome: "error",
                    error: "Generazione dell'appunto fallita",
                    reason: result.reason,
                    issues: result.issues,
                    attempts: result.attempts,
                });
            }
        } catch (error) {
            // Non possiamo più delegare al middleware di errore finale (server.js):
            // gli header sono già stati inviati con res.writeHead sopra.
            logger.error("notesController", error.message, { code: error.code });
            sendEvent("result", { outcome: "error", error: "Errore interno del server" });
        }

        res.end();
    }

    async function listFolders(req, res, next) {
        try {
            const folders = await archive.listFolders(notesDir);
            return res.status(200).json({ folders });
        } catch (error) {
            next(error);
        }
    }

    async function listNotes(req, res, next) {
        try {
            const notes = await archive.listNotes(notesDir, req.params.folder);
            return res.status(200).json({ notes });
        } catch (error) {
            if (error.code === ErrorCodes.NOT_FOUND_ERROR) {
                return res.status(404).json({ error: error.message });
            }
            next(error);
        }
    }

    async function readNote(req, res, next) {
        try {
            const data = await archive.readNote(notesDir, req.params.folder, req.params.fileName);
            return res.status(200).json(data);
        } catch (error) {
            if ([ErrorCodes.NOT_FOUND_ERROR, ErrorCodes.PATH_TRAVERSAL_ERROR].includes(error.code)) {
                const status = error.code === ErrorCodes.NOT_FOUND_ERROR ? 404 : 400;
                return res.status(status).json({ error: error.message });
            }
            next(error);
        }
    }

    return { generateNote, listFolders, listNotes, readNote };
}

export default createNotesController;
