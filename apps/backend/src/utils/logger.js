function formatMeta(meta) {
    if (!meta || Object.keys(meta).length === 0) return "";
    return " " + Object.entries(meta).map(([key, value]) => `${key}=${value}`).join(" ");
}

function write(level, scope, message, meta) {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} [${scope}] ${message}${formatMeta(meta)}`;

    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
}

// Wrapper minimale su console: aggiunge timestamp e scope a ogni riga per rendere
// tracciabili esecuzioni concorrenti della pipeline (es. [orchestrator][attempt=2]).
// I chiamanti devono passare solo meta serializzabili e non sensibili
// (mai oggetti errore grezzi o l'intero `settings`) per evitare fughe di segreti nei log.
const logger = {
    info: (scope, message, meta) => write("info", scope, message, meta),
    warn: (scope, message, meta) => write("warn", scope, message, meta),
    error: (scope, message, meta) => write("error", scope, message, meta),
};

export default logger;
