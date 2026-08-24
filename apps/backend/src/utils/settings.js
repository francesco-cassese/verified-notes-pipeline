import z from "zod";

/**
 * Definisco uno schema con Zod per validare le variabili d'ambiente.
 * Questa è una best practice: preferisco che il programma si blocchi subito (fail fast)
 * all'avvio piuttosto che andare in errore dopo ore di esecuzione perché mancava una chiave.
 */
const EnvSchema = z.object({
    CLAUDE_API_KEY: z.string().min(1, "CLAUDE_API_KEY mancante: impostala nel file .env"),
    BRAVE_API_KEY: z.string().min(1, "BRAVE_API_KEY mancante: impostala nel file .env"),
    PORT: z.coerce.number().int().positive().default(3000),
    MODEL_NAME: z.string().default("claude-haiku-4-5"),
    NOTES_DIR: z.string().default("data/appunti"),
    MAX_GENERATION_ATTEMPTS: z.coerce.number().int().positive().default(3),
    MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    PAGE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
    GENERATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
    GENERATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
});

// Provo a validare process.env contro lo schema
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    // Se la validazione fallisce, creo un messaggio di errore leggibile che mi 
    // dice esattamente quale variabile manca o è sbagliata.
    const messaggio = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
    throw new Error(`Configurazione non valida: ${messaggio}`);
}

// Esporto un oggetto 'settings' pulito. Così, nel resto dell'app, non dovrò mai
// richiamare process.env direttamente, ma userò questo oggetto sicuro e tipizzato.
const settings = {
    port: parsed.data.PORT,
    claudeApiKey: parsed.data.CLAUDE_API_KEY,
    braveApiKey: parsed.data.BRAVE_API_KEY,
    modelName: parsed.data.MODEL_NAME,
    notesDir: parsed.data.NOTES_DIR,
    maxGenerationAttempts: parsed.data.MAX_GENERATION_ATTEMPTS,
    modelTimeoutMs: parsed.data.MODEL_TIMEOUT_MS,
    searchTimeoutMs: parsed.data.SEARCH_TIMEOUT_MS,
    pageFetchTimeoutMs: parsed.data.PAGE_FETCH_TIMEOUT_MS,
    generationRateLimitWindowMs: parsed.data.GENERATION_RATE_LIMIT_WINDOW_MS,
    generationRateLimitMax: parsed.data.GENERATION_RATE_LIMIT_MAX,
};

export default settings;