import { AderenzaSchema } from "../schemas/note.schemas.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";

function formattaFontiPerVerifica(risultatiRicerca) {
    return risultatiRicerca
        .map((r) => {
            if (!r.contenuto) return `- ${r.url}: nessun estratto disponibile (contenuto non recuperato)`;
            return `- ${r.url}:\n  """\n  ${r.contenuto}\n  """`;
        })
        .join("\n\n");
}

function buildPromptAderenza(argomento, draft, risultatiRicerca) {
    const sezioniTesto = draft.sezioni.map((s) => `### ${s.titolo}\n${s.contenuto}`).join("\n\n");

    return `Sei un verificatore di aderenza alle fonti. Il tuo unico compito è controllare che i fatti, la sintassi e gli esempi scritti nella bozza siano supportati dagli estratti delle fonti forniti sotto, NON dalla conoscenza pregressa di chi ha scritto la bozza sull'argomento "${argomento}".

Estratti disponibili (l'unica base ammessa per i fatti specifici):
${formattaFontiPerVerifica(risultatiRicerca)}

Bozza da verificare:
${sezioniTesto}

Per le fonti senza estratto disponibile, la bozza deve restare generica sui loro dettagli specifici: va bene citarle come link, non va bene descriverne il contenuto come se l'estratto fosse stato letto.

Imposta "aderente" a true SOLO se ogni fatto, sintassi o esempio specifico nella bozza trova riscontro in uno degli estratti forniti. Imposta "aderente" a false se anche una sola sezione descrive dettagli non presenti negli estratti (segno che sono stati scritti a memoria invece che dalle fonti). Se aderente è false, "motivi" deve indicare in modo specifico e azionabile quale affermazione non è supportata e da quale sezione proviene, un motivo per riga, massimo una frase ciascuno.`;
}

// Agente 4.5 (dopo il Revisore): controllo di fedeltà al testo delle fonti,
// distinto sia dalla conformità strutturale (Validatore) sia dal controllo di
// perimetro/livello (Revisore). Come il Revisore, richiede una chiamata LLM e
// il suo giudizio non è garantito al 100%, ma resta l'unico modo per
// intercettare contenuto plausibile ma non verificato che né lo schema né il
// controllo di perimetro possono rilevare.
function createAderenzaAgent({ model, logger }) {
    async function verifica(argomento, draft, risultatiRicerca) {
        try {
            const modelloStrutturato = model.withStructuredOutput(AderenzaSchema);
            const verdetto = await modelloStrutturato.invoke(buildPromptAderenza(argomento, draft, risultatiRicerca));

            if (!verdetto.aderente) {
                logger.warn("aderenzaAgent", "Bozza non aderente alle fonti", { argomento, motivi: verdetto.motivi });
            }

            return verdetto;
        } catch (error) {
            throw new AgentError(
                `Verifica di aderenza alle fonti fallita per l'argomento "${argomento}"`,
                ErrorCodes.GENERATION_ERROR,
                error
            );
        }
    }

    return { verifica };
}

export default createAderenzaAgent;
