function formatMeta(meta) {
    if (!meta || Object.keys(meta).length === 0) return "";
    return " " + Object.entries(meta).map(([chiave, valore]) => `${chiave}=${valore}`).join(" ");
}

function scrivi(livello, scope, messaggio, meta) {
    const timestamp = new Date().toISOString();
    const riga = `${timestamp} [${scope}] ${messaggio}${formatMeta(meta)}`;

    if (livello === "error") console.error(riga);
    else if (livello === "warn") console.warn(riga);
    else console.log(riga);
}

// Wrapper minimale su console: aggiunge timestamp e scope a ogni riga per rendere
// tracciabili esecuzioni concorrenti della pipeline (es. [orchestrator][attempt=2]).
// I chiamanti devono passare solo meta serializzabili e non sensibili
// (mai oggetti errore grezzi o l'intero `settings`) per evitare fughe di segreti nei log.
const logger = {
    info: (scope, messaggio, meta) => scrivi("info", scope, messaggio, meta),
    warn: (scope, messaggio, meta) => scrivi("warn", scope, messaggio, meta),
    error: (scope, messaggio, meta) => scrivi("error", scope, messaggio, meta),
};

export default logger;
