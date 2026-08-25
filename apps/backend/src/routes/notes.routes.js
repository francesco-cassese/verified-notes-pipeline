import express from "express";
import rateLimit from "express-rate-limit";
import createNotesController from "../controllers/notes.controller.js";
import settings from "../utils/settings.js";

// Solo la generazione costa (ricerca Brave + chiamate LLM, fino a maxAttempts
// tentativi): senza un tetto, chiunque raggiunga l'endpoint potrebbe scatenare
// generazioni illimitate a spese dell'account Anthropic/Brave. Le letture
// dall'archivio restano senza limite, sono solo accessi al filesystem.
const generationRateLimiter = rateLimit({
    windowMs: settings.generationRateLimitWindowMs,
    max: settings.generationRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Troppe richieste di generazione, riprova più tardi." },
});

function createNotesRouter(controller = createNotesController()) {
    const router = express.Router();

    router.post("/", generationRateLimiter, controller.generateNote);
    router.get("/folders", controller.listFolders);
    router.get("/folders/:folder", controller.listNotes);
    router.get("/folders/:folder/:fileName", controller.readNote);

    return router;
}

export default createNotesRouter;
