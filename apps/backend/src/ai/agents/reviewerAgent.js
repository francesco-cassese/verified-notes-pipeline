import { ReviewSchema } from "../schemas/note.schemas.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";

function formattaFontiPerVerifica(risultatiRicerca) {
    return risultatiRicerca
        .map((r) => {
            if (!r.contenuto) return `- ${r.url}: nessun estratto disponibile (contenuto non recuperato)`;
            return `- ${r.url}:\n  """\n  ${r.contenuto}\n  """`;
        })
        .join("\n\n");
}

// Un solo prompt copre i due giudizi (perimetro/livello e aderenza alle
// fonti) che prima erano due chiamate separate: bozza e fonti vengono
// incollate nel contesto una volta sola invece che due, dimezzando i token
// di input per questo stadio senza ridurre il rigore di nessuno dei due
// controlli, che restano criteri e verdetti indipendenti.
function buildPromptRevisione(argomento, draft, risultatiRicerca) {
    const sezioniTesto = draft.sezioni
        .map((s) => `### ${s.titolo}\n${s.contenuto}`)
        .join("\n\n");

    return `Sei un revisore tecnico. Valuta DUE aspetti indipendenti di questa bozza di appunto e restituisci un verdetto separato per ciascuno (la conformità strutturale è già verificata altrove, non valutarla). Un problema in un aspetto non implica nulla sull'altro: giudicali separatamente.

Titolo generato: "${draft.titolo}"
Modulo: "${draft.modulo}"

Contenuto della bozza:
${sezioniTesto}

Estratti delle fonti ufficiali trovate (l'unica base ammessa per i fatti specifici):
${formattaFontiPerVerifica(risultatiRicerca)}

=== ASPETTO 1: PERIMETRO E LIVELLO (campo "perimetro") ===
1. PERIMETRO: il contenuto resta pertinente all'argomento richiesto "${argomento}", senza divagazioni fuori tema?
2. COMPLETEZZA: mancano concetti fondamentali per capire "${argomento}" al suo stesso livello? Valuta questo punto restando ancorato al livello implicito dall'argomento (es. se è un'introduzione, i fondamentali sono quelli di un'introduzione): l'assenza di argomenti avanzati o correlati che meriterebbero un appunto a parte (es. sicurezza, autenticazione, gestione errori in produzione, ottimizzazione) NON è una lacuna, a meno che l'argomento stesso non li nomini esplicitamente.
3. LIVELLO: una o più sezioni spiegano/approfondiscono concetti più avanzati di quanto "${argomento}" richieda, invece di limitarsi al massimo a un accenno? Un semplice riferimento di contesto ("questo si collega a X, che vedrai più avanti") NON è un problema: lo è solo se X viene spiegato per esteso.

Imposta "perimetro.approvato" a true SOLO se non ci sono problemi di perimetro, lacune rilevanti allo stesso livello dell'argomento, né sezioni che sconfinano nel livello avanzato. Se approvato è false, "perimetro.motivi" deve elencare in modo specifico e azionabile cosa correggere, un motivo per riga, massimo una frase ciascuno (es. "la sezione 'X' parla di Y, che non è pertinente a ${argomento}", oppure "manca una spiegazione di Z, centrale per questo argomento allo stesso livello", oppure "la sezione 'X' spiega a fondo Y, che è un concetto più avanzato: riducilo a un accenno o rimuovilo").

=== ASPETTO 2: ADERENZA ALLE FONTI (campo "aderenza") ===
Controlla che i fatti, la sintassi e gli esempi scritti nella bozza siano supportati dagli estratti delle fonti sopra, NON dalla conoscenza pregressa di chi ha scritto la bozza sull'argomento "${argomento}". Per le fonti senza estratto disponibile, la bozza deve restare generica sui loro dettagli specifici: va bene citarle come link, non va bene descriverne il contenuto come se l'estratto fosse stato letto.

Una parafrasi fedele del significato di un estratto (parole diverse, stesso fatto) È supportata: non bocciare solo perché la bozza non usa la stessa identica formulazione della fonte, o perché una generalizzazione resta coerente con un caso specifico descritto nella fonte. Va bocciato solo ciò che introduce un fatto, un esempio, uno strumento o un dettaglio tecnico che non compare, nemmeno in altre parole o per implicazione diretta, negli estratti forniti (segno che è stato scritto a memoria invece che dalle fonti).

Imposta "aderenza.aderente" a true se ogni fatto, sintassi o esempio specifico nella bozza trova riscontro concettuale (anche parafrasato) in uno degli estratti forniti. Imposta "aderenza.aderente" a false solo se almeno una sezione introduce un'informazione specifica assente dagli estratti. Se aderente è false, "aderenza.motivi" deve indicare in modo specifico e azionabile quale affermazione non è supportata e da quale sezione proviene, un motivo per riga, massimo una frase ciascuno — e deve trattarsi di un'informazione assente dagli estratti, non solo di una formulazione diversa dello stesso fatto.`;
}

// Agente 3.5: controllo semantico della bozza, distinto dalla conformità
// strutturale già verificata dal Validator. Copre in un'unica chiamata LLM
// due giudizi indipendenti che prima erano due agenti separati (Revisore
// perimetro/livello + Agente di aderenza alle fonti): stesso rigore su
// entrambi i fronti, ma bozza e fonti vengono inviate al modello una sola
// volta invece che due. Come prima, il giudizio non è mai garantito al 100%,
// ma resta il modo più efficace per intercettare sia contenuto fuori
// tema/incompleto sia contenuto plausibile ma non verificato.
function createReviewerAgent({ model, logger }) {
    async function review(argomento, draft, risultatiRicerca) {
        try {
            const modelloStrutturato = model.withStructuredOutput(ReviewSchema);
            const verdetto = await modelloStrutturato.invoke(
                buildPromptRevisione(argomento, draft, risultatiRicerca)
            );

            if (!verdetto.perimetro.approvato) {
                logger.warn("reviewerAgent", "Bozza fuori perimetro o livello non adeguato", {
                    argomento,
                    motivi: verdetto.perimetro.motivi,
                });
            }
            if (!verdetto.aderenza.aderente) {
                logger.warn("reviewerAgent", "Bozza non aderente alle fonti", {
                    argomento,
                    motivi: verdetto.aderenza.motivi,
                });
            }

            return verdetto;
        } catch (error) {
            throw new AgentError(
                `Revisione fallita per l'argomento "${argomento}"`,
                ErrorCodes.GENERATION_ERROR,
                error
            );
        }
    }

    return { review };
}

export default createReviewerAgent;
