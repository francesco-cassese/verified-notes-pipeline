import { NoteDraftSchema } from "../schemas/note.schemas.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";
import { buildIstruzioneLivelloIntroduttivo } from "./livelloIntroduttivo.js";
import { estraiIssuesDaOutputParserException } from "../outputParsingIssues.js";

function formattaFonti(risultati) {
    return risultati
        .map((r) => {
            if (!r.contenuto) return `- ${r.title}: ${r.url} (estratto non disponibile)`;
            return `- ${r.title}: ${r.url}\n  Estratto della pagina:\n  """\n  ${r.contenuto}\n  """`;
        })
        .join("\n\n");
}

function formattaFeedback(feedback) {
    if (!feedback || feedback.length === 0) return "";
    const elenco = feedback.map((f) => `- ${f}`).join("\n");
    return `\n\nIl tentativo precedente non ha superato la validazione per questi motivi, correggili:\n${elenco}`;
}

// A questo punto risultatiRicerca è sempre non vuoto: se non ci sono fonti
// ufficiali, generate() interrompe prima di arrivare qui (vedi sotto).
// Il vincolo "solo ufficiali" viene comunque istruito esplicitamente qui e
// imposto di nuovo, in modo deterministico, dal Validator via FonteSchema:
// due strati di difesa contro il rischio che il modello citi una fonte a
// memoria non verificata invece di una di quelle fornite.
//
// Ordine del prompt: fonti PRIMA, istruzioni/vincoli DOPO — non il contrario.
// Con estratti fino a 20.000 caratteri per fonte, mettere il vincolo di
// perimetro prima del testo delle fonti lo relegava nel punto di minor
// richiamo del contesto (il classico effetto "lost in the middle": Anthropic
// stessa raccomanda di posizionare i documenti lunghi in cima e le istruzioni
// alla fine, per massimizzare quanto il modello le "ricorda" nel momento in
// cui genera). Qui i vincoli restano quindi le ULTIME righe che il modello
// legge prima di scrivere, non le prime.
function buildPrompt(argomento, risultatiRicerca, feedback) {
    return `Di seguito trovi alcune pagine ufficiali trovate tramite ricerca web sull'argomento "${argomento}", alcune con un estratto del loro contenuto. Il compito esatto — cosa scrivere, in che formato, con quali vincoli — è spiegato per intero DOPO gli estratti: leggili con attenzione, le istruzioni operative arrivano subito dopo.

${formattaFonti(risultatiRicerca)}

---

Genera un appunto tecnico di programmazione, in italiano, con tono professionale e diretto (niente ironia o linguaggio scherzoso), sull'argomento: "${argomento}".

Usa un linguaggio semplice e chiaro, adatto a uno studente che sta muovendo i primi passi su questo argomento: frasi brevi, dirette, senza fronzoli. Se usi un termine tecnico non ovvio, spiegalo subito la prima volta che compare, con parole semplici, invece di darlo per scontato. Preferisci esempi concreti a descrizioni astratte.

Struttura l'appunto seguendo esattamente questi campi:

- "modulo": la categoria/tecnologia principale a cui appartiene l'argomento, dedotta da te (es. "React", "Git", "Python", "PostgreSQL").
- "titolo": un titolo chiaro e specifico per l'appunto (non deve coincidere necessariamente con l'argomento richiesto).
- "sezioni": da 2 a 6 sezioni, ciascuna con un "titolo" breve e un "contenuto" approfondito in Markdown. Copri concetti, sintassi/esempi pratici e casi d'uso. Ogni esempio di codice, anche una singola riga, va SEMPRE racchiuso in un blocco di codice Markdown con i backtick tripli e il linguaggio indicato (es. \`\`\`php\n$x = 1;\n\`\`\`), mai scritto come testo semplice: senza le triple backtick le andate a capo vengono perse e il codice diventa illeggibile. Non dedicare qui una sezione agli errori comuni: vanno nel campo "erroriComuni" descritto sotto.
- "keyTakeaways": da 3 a 6 punti chiave da ricordare, frasi brevi e dirette.
- "glossario": SOLO se l'argomento introduce termini tecnici non ovvi, una lista di voci con "termine", "definizioneFormale" (rigorosa) e "spiegazioneInformale" (la stessa idea spiegata in modo semplice e diretto, senza tecnicismi). Se non ci sono termini che meritano una voce a parte, lascia questo campo come lista vuota.
- "erroriComuni": da 2 a 6 errori tipici in cui incorre chi usa "${argomento}" per la prima volta (errori di sintassi, fraintendimenti concettuali, casi limite dimenticati), ciascuno con "errore" (cosa si sbaglia, breve) e "soluzione" (come evitarlo o correggerlo, in modo pratico e diretto). Vale anche qui il vincolo di perimetro spiegato sotto: non nominare funzioni, metodi o strumenti alternativi a "${argomento}", nemmeno come suggerimento nella soluzione.
- "tag": alcune parole chiave pertinenti (massimo 5).

${buildIstruzioneLivelloIntroduttivo(argomento)}

Basa i fatti, la sintassi e gli esempi che scrivi sugli estratti mostrati sopra, non sulla tua conoscenza pregressa: se un estratto è disponibile e contraddice quello che ricordi, segui l'estratto (potrebbe essere più aggiornato). Se per una fonte l'estratto non è disponibile, resta prudente e generico sui dettagli specifici di quella pagina invece di inventarli.

Non nominare, confrontare o suggerire come alternativa altre funzioni, metodi, classi o linguaggi diversi da "${argomento}", anche se corretti secondo la tua conoscenza pregressa o descritti in una delle fonti trovate: resta strettamente nel perimetro di "${argomento}", senza divagazioni comparative. Questo vale anche se una delle pagine trovate dalla ricerca è in realtà la documentazione di un'altra funzione/metodo/hook correlato ma distinto (es. una variante più avanzata, o un'API citata come riferimento incrociato nella stessa documentazione): il suo estratto non è materiale da cui attingere fatti, sintassi o esempi per questo appunto, resta valido solo per l'eventuale accenno di una frase già previsto sopra.

Lo stesso vale quando è la STESSA pagina fonte a trattare, oltre a "${argomento}", anche un argomento adiacente ma concettualmente distinto (es. una guida su come dichiarare variabili che tratta diffusamente anche come si confrontano o convertono i valori tra loro): includilo solo se è indispensabile per capire "${argomento}" stesso, altrimenti è materiale per un appunto futuro dedicato a quell'argomento, non per questo. Nel dubbio se un paragrafo della fonte appartenga a "${argomento}" o a un argomento adiacente, chiediti se serve per rispondere alla domanda "come uso ${argomento} nel caso comune?": se la risposta è no, omettilo.

Se l'argomento è generico e le fonti trovate appartengono a ecosistemi o linguaggi di programmazione chiaramente diversi e incompatibili tra loro (non una variante più avanzata dello stesso strumento, ma tecnologie scollegate che condividono solo la terminologia cercata), NON fonderle in un'unica bozza: scegli come unica base la fonte che risponde in modo più specifico e diretto all'argomento, e ignora del tutto le altre, come se non fossero state trovate. Il campo "modulo" deve riflettere solo la tecnologia scelta.

Nel campo "fonti" riporta solo ed esclusivamente URL presi dall'elenco mostrato sopra (massimo 10). Non citare altre pagine anche se le conosci: se non compaiono in quell'elenco non sono ammesse.${formattaFeedback(feedback)}`;
}

// Brave classifica i risultati anche in base alla lingua delle parole nella
// query, non solo in base al suffisso "official documentation": per un
// argomento scritto in italiano (es. "tipi di variabili in javascript"),
// anche con quel suffisso Brave può restituire solo tutorial/blog italiani
// in prima pagina, zero risultati su domini ufficiali, e la ricerca fallisce
// con NO_OFFICIAL_SOURCE_ERROR nonostante la documentazione ufficiale esista.
// Traducendo l'argomento in inglese prima di interrogare Brave si evita
// questo bias linguistico. Se la traduzione fallisce (rete/quota), ripiega
// sull'argomento originale: meglio tentare la ricerca nella lingua originale
// che non cercare affatto.
async function traduciPerRicerca(model, argomento, logger) {
    try {
        const risposta = await model.invoke(
            `Traduci in inglese la seguente frase, che descrive un argomento di programmazione, restituendo SOLO la traduzione letterale, senza virgolettatura né altro testo: "${argomento}"`
        );
        const testo = typeof risposta.content === "string" ? risposta.content : risposta.content?.[0]?.text;
        return testo?.trim() || argomento;
    } catch (error) {
        logger.warn("generatorAgent", "Traduzione della query di ricerca fallita, uso l'argomento originale", {
            argomento,
            errore: error.message,
        });
        return argomento;
    }
}

function createGeneratorAgent({ model, searchTool, logger }) {
    async function generate(argomento, opts = {}) {
        const { feedback = [], onFase, risultatiRicercaCache } = opts;

        let risultatiRicerca;

        // Se un tentativo precedente in questa stessa run ha già trovato fonti
        // (il retry è scattato per un rifiuto del validator/controllo qualità,
        // non per un fallimento della ricerca), le riusiamo: l'argomento non è
        // cambiato, quindi la ricerca darebbe con ogni probabilità lo stesso
        // risultato. Risparmia la chiamata a Brave e il fetch delle pagine ad
        // ogni retry, senza intaccare nessuna delle verifiche a valle (usano le
        // stesse fonti di prima, solo verificate su una bozza nuova).
        if (risultatiRicercaCache) {
            risultatiRicerca = risultatiRicercaCache;
        } else {
            onFase?.({ fase: "ricerca", messaggio: "Ricerca delle fonti ufficiali sul web..." });

            try {
                const queryRicerca = await traduciPerRicerca(model, argomento, logger);
                const rawOutput = await searchTool.invoke({ query: queryRicerca });
                const parsedOutput = JSON.parse(rawOutput);
                risultatiRicerca = parsedOutput.dati_grezzi ?? [];
            } catch (error) {
                // Problema transitorio (rete/quota Brave): l'orchestrator ritenta,
                // la ricerca potrebbe andare a buon fine al tentativo successivo.
                throw new AgentError(
                    `Ricerca di fonti ufficiali fallita per l'argomento "${argomento}"`,
                    ErrorCodes.GENERATION_ERROR,
                    error
                );
            }

            // Nessuna fonte ufficiale trovata: ci fermiamo qui, PRIMA di spendere una
            // chiamata al modello, per non sprecare token su un appunto che la policy
            // "solo fonti ufficiali" scarterebbe comunque. Non è un problema
            // transitorio (la stessa ricerca darebbe lo stesso risultato vuoto anche
            // ritentando), quindi l'orchestrator non deve ritentare questo caso.
            if (risultatiRicerca.length === 0) {
                logger.warn("generatorAgent", "Nessuna fonte ufficiale trovata, generazione saltata", { argomento });
                throw new AgentError(
                    `Nessuna fonte ufficiale trovata per l'argomento "${argomento}"`,
                    ErrorCodes.NO_OFFICIAL_SOURCE_ERROR
                );
            }

            // Fonti trovate ma nessuna con testo estratto (pagina JS-rendered, timeout,
            // non-HTML: vedi fetchPageText): a differenza del caso sopra, qui NON è
            // detto che sia deterministico (un timeout di rete può non ripetersi), quindi
            // resta un GENERATION_ERROR normale che l'orchestrator ritenta. Ci fermiamo
            // comunque PRIMA di chiamare il modello, perché senza estratti scriverebbe
            // l'appunto solo dalla propria memoria nonostante l'istruzione di restare
            // generico: meglio ritentare (magari il fetch va a buon fine) che rischiare
            // contenuto non verificato.
            if (risultatiRicerca.every((r) => !r.contenuto)) {
                logger.warn("generatorAgent", "Fonti trovate ma senza testo estratto, generazione saltata", { argomento });
                throw new AgentError(
                    `Nessun contenuto estratto dalle fonti ufficiali trovate per l'argomento "${argomento}"`,
                    ErrorCodes.GENERATION_ERROR
                );
            }
        }

        const prompt = buildPrompt(argomento, risultatiRicerca, feedback);

        onFase?.({ fase: "generazione", messaggio: "Generazione della bozza dell'appunto..." });

        try {
            const modelloStrutturato = model.withStructuredOutput(NoteDraftSchema);
            const draft = await modelloStrutturato.invoke(prompt);
            // risultatiRicerca (title/url/contenuto) viaggia insieme alla bozza, non
            // solo i suoi URL: il Validatore la usa per controllare che ogni fonte
            // citata sia una di quelle davvero trovate (isOfficialUrl controlla solo
            // il dominio, non l'esistenza reale della pagina), l'Agente di aderenza
            // la usa per confrontare i fatti scritti con il testo delle fonti.
            return { draft, risultatiRicerca };
        } catch (error) {
            const agentError = new AgentError(
                `Generazione dell'appunto fallita per l'argomento "${argomento}"`,
                ErrorCodes.GENERATION_ERROR,
                error
            );
            agentError.issues = estraiIssuesDaOutputParserException(error);
            throw agentError;
        }
    }

    return { generate };
}

export default createGeneratorAgent;
