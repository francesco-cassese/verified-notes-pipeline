import express from "express";
import rateLimit from "express-rate-limit";
import createAppuntiController from "../controllers/appunti.controller.js";
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
    message: { errore: "Troppe richieste di generazione, riprova più tardi." },
});

function createAppuntiRouter(controller = createAppuntiController()) {
    const router = express.Router();

    router.post("/", generationRateLimiter, controller.generaAppunto);
    router.get("/cartelle", controller.listaCartelle);
    router.get("/cartelle/:cartella", controller.listaAppunti);
    router.get("/cartelle/:cartella/:nomeFile", controller.leggiAppunto);

    return router;
}

export default createAppuntiRouter;
