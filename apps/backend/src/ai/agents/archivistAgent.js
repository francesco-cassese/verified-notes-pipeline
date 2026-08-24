import { resolveCartella } from "../../utils/moduleMapping.js";

// Agente 5: seleziona la cartella di destinazione in base a un mapping
// hardcoded (utils/moduleMapping.js), non al modulo grezzo dedotto dal
// modello. Deterministico, nessuna chiamata LLM.
function createArchivistAgent({ logger }) {
    function selectFolder(modulo) {
        return resolveCartella(modulo, logger);
    }

    return { selectFolder };
}

export default createArchivistAgent;
