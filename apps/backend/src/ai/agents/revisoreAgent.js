import { RevisioneSchema } from "../schemas/note.schemas.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";

function buildPromptRevisione(argomento, draft) {
    const sezioniTesto = draft.sezioni
        .map((s) => `### ${s.titolo}\n${s.contenuto}`)
        .join("\n\n");

    return `Sei un revisore tecnico. Valuta SOLO tre aspetti di questa bozza di appunto — non la forma, quella è già verificata altrove:

1. PERIMETRO: il contenuto resta pertinente all'argomento richiesto "${argomento}", senza divagazioni fuori tema?
2. COMPLETEZZA: mancano concetti fondamentali per capire "${argomento}" al suo stesso livello? Valuta questo punto restando ancorato al livello implicito dall'argomento (es. se è un'introduzione, i fondamentali sono quelli di un'introduzione): l'assenza di argomenti avanzati o correlati che meriterebbero un appunto a parte (es. sicurezza, autenticazione, gestione errori in produzione, ottimizzazione) NON è una lacuna, a meno che l'argomento stesso non li nomini esplicitamente.
3. LIVELLO: una o più sezioni spiegano/approfondiscono concetti più avanzati di quanto "${argomento}" richieda, invece di limitarsi al massimo a un accenno? Un semplice riferimento di contesto ("questo si collega a X, che vedrai più avanti") NON è un problema: lo è solo se X viene spiegato per esteso.

Titolo generato: "${draft.titolo}"
Modulo: "${draft.modulo}"

Contenuto:
${sezioniTesto}

Imposta "approvato" a true SOLO se non ci sono problemi di perimetro, lacune rilevanti allo stesso livello dell'argomento, né sezioni che sconfinano nel livello avanzato. Se approvato è false, "motivi" deve elencare in modo specifico e azionabile cosa correggere, un motivo per riga, massimo una frase ciascuno (es. "la sezione 'X' parla di Y, che non è pertinente a ${argomento}", oppure "manca una spiegazione di Z, centrale per questo argomento allo stesso livello", oppure "la sezione 'X' spiega a fondo Y, che è un concetto più avanzato: riducilo a un accenno o rimuovilo").`;
}

// Agente 3.5: controllo semantico (perimetro/gap analysis), distinto dal
// Validatore deterministico. A differenza del Validatore, richiede una
// chiamata LLM: non è gratuito né istantaneo, e il suo giudizio non è mai
// garantito al 100% — resta comunque il modo più efficace per intercettare
// contenuto fuori tema o incompleto che uno schema Zod non può rilevare.
function createRevisoreAgent({ model, logger }) {
    async function revisiona(argomento, draft) {
        try {
            const modelloStrutturato = model.withStructuredOutput(RevisioneSchema);
            const verdetto = await modelloStrutturato.invoke(buildPromptRevisione(argomento, draft));

            if (!verdetto.approvato) {
                logger.warn("revisoreAgent", "Bozza non approvata", { argomento, motivi: verdetto.motivi });
            }

            return verdetto;
        } catch (error) {
            throw new AgentError(
                `Revisione semantica fallita per l'argomento "${argomento}"`,
                ErrorCodes.GENERATION_ERROR,
                error
            );
        }
    }

    return { revisiona };
}

export default createRevisoreAgent;
