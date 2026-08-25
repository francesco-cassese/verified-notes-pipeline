import { NoteSchema } from "../schemas/note.schemas.js";

function createValidatorAgent({ schema = NoteSchema, logger } = {}) {
    // Wrapper puro su safeParse + controllo di appartenenza, nessuna chiamata di
    // rete/LLM: sicuro ed economico eseguirlo a ogni tentativo di retry.
    // fetchedSources è l'elenco degli URL davvero restituiti dalla ricerca per
    // questo tentativo (vedi generatorAgent): isOfficialUrl (nello schema) verifica
    // solo che il dominio sia ufficiale, non basta contro un URL inventato ma
    // plausibile su quel dominio, quindi qui controlliamo anche l'appartenenza
    // esatta a quell'elenco.
    function validate(draft, fetchedSources = []) {
        const result = schema.safeParse(draft);

        if (!result.success) {
            const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
            logger?.warn("validatorAgent", "Validazione dell'appunto fallita", { issues });
            return { success: false, issues };
        }

        const available = new Set(fetchedSources);
        const fabricatedSources = result.data.sources.filter((s) => !available.has(s.url));

        if (fabricatedSources.length > 0) {
            const issues = fabricatedSources.map(
                (s) => `sources: l'URL "${s.url}" non è tra le fonti trovate dalla ricerca per questo argomento (possibile fonte inventata dal modello)`
            );
            logger?.warn("validatorAgent", "Fonti citate non presenti tra quelle recuperate", { issues });
            return { success: false, issues };
        }

        return { success: true, data: result.data };
    }

    return { validate };
}

export default createValidatorAgent;
