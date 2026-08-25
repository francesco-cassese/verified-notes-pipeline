import { ReviewSchema } from "../schemas/note.schemas.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";
import { buildIstruzioneLivelloIntroduttivo } from "./livelloIntroduttivo.js";
import { estraiIssuesDaOutputParserException } from "../outputParsingIssues.js";

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
//
// Bozza e fonti PRIMA, criteri di giudizio DOPO — stesso motivo del Generator
// (vedi generatorAgent.js): con estratti fino a 20.000 caratteri per fonte,
// i criteri di valutazione vanno tenuti nell'ultima parte del prompt, il
// punto di massimo richiamo per il modello, non prima del materiale che deve
// giudicare.
function buildPromptRevisione(argomento, draft, risultatiRicerca) {
    const sezioniTesto = draft.sezioni
        .map((s) => `### ${s.titolo}\n${s.contenuto}`)
        .join("\n\n");

    return `Di seguito trovi la bozza di un appunto sull'argomento "${argomento}" e gli estratti delle fonti ufficiali usate per scriverla. Il tuo compito di valutazione — cosa giudicare e come — è spiegato per intero dopo questi due blocchi.

Titolo generato: "${draft.titolo}"
Modulo: "${draft.modulo}"

Contenuto della bozza:
${sezioniTesto}

Estratti delle fonti ufficiali trovate (l'unica base ammessa per i fatti specifici):
${formattaFontiPerVerifica(risultatiRicerca)}

---

Sei un revisore tecnico. Valuta DUE aspetti indipendenti della bozza mostrata sopra e restituisci un verdetto separato per ciascuno (la conformità strutturale è già verificata altrove, non valutarla). Un problema in un aspetto non implica nulla sull'altro: giudicali separatamente.

=== ASPETTO 1: PERIMETRO E LIVELLO (campo "perimetro") ===
1. PERIMETRO: il contenuto resta pertinente all'argomento richiesto "${argomento}", senza divagazioni fuori tema?
2. LIVELLO: la bozza rispetta questo criterio — lo stesso dato al Generator per scriverla, applicalo identico, non definirne uno tuo:

${buildIstruzioneLivelloIntroduttivo(argomento)}

Una sezione lo viola SOLO se spiega/approfondisce per esteso il perché interno di un comportamento, un meccanismo che si manifesta solo in modalità/ambienti speciali, o uno strumento diverso citato come alternativa — non se spiega un comportamento osservabile (cosa cambia nel risultato in base a cosa scrive il lettore), che è nucleo per definizione anche se richiede più frasi.
3. COMPLETEZZA: mancano concetti CENTRALI per usare "${argomento}" al suo stesso livello introduttivo (es. la sintassi di base, un parametro essenziale, un caso d'uso comune, o un comportamento osservabile rilevante)? L'assenza di un dettaglio che il criterio sopra esclude (perché interno di implementazione, comportamenti di modalità/ambienti speciali, strumenti alternativi) NON è MAI una lacuna, anche se le fonti ne parlano diffusamente: non chiederne mai l'aggiunta. L'assenza di un comportamento osservabile rilevante invece SÌ, è una lacuna da segnalare.

Imposta "perimetro.approvato" a true SOLO se non ci sono problemi di perimetro, nessuna lacuna sui concetti centrali, né sezioni che violano il criterio di livello sopra. Se approvato è false, "perimetro.motivi" deve elencare in modo specifico e azionabile cosa correggere, un motivo per riga, massimo una frase ciascuno (es. "la sezione 'X' parla di Y, che non è pertinente a ${argomento}", oppure "manca la spiegazione di Z, un concetto centrale per questo argomento allo stesso livello", oppure "la sezione 'X' spiega a fondo Y, che rientra tra i punti sempre esclusi da un'introduzione: riducilo a un accenno o rimuovilo").

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
            // strict: true vincola la generazione lato Anthropic (non solo la
            // validazione lato client): il modello non può produrre un tipo
            // sbagliato o omettere un campo richiesto, eliminando il crash di
            // parsing osservato quando il Reviewer aveva molto da segnalare.
            const modelloStrutturato = model.withStructuredOutput(ReviewSchema, { strict: true });
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
            const agentError = new AgentError(
                `Revisione fallita per l'argomento "${argomento}"`,
                ErrorCodes.GENERATION_ERROR,
                error
            );
            agentError.issues = estraiIssuesDaOutputParserException(error);
            throw agentError;
        }
    }

    return { review };
}

export default createReviewerAgent;
