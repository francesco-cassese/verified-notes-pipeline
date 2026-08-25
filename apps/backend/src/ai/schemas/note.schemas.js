import z from "zod";
import { isOfficialUrl } from "../../utils/officialSources.js";

const TopicInputSchema = z.object({
    argomento: z.string()
        .min(3, "L'argomento deve avere almeno 3 caratteri")
        .max(200, "L'argomento non può superare 200 caratteri")
})

// Il refine rende "solo fonti ufficiali" un vincolo verificato dal Validator
// (safeParse), non solo un'istruzione nel prompt: se il modello cita una fonte
// non ufficiale, la validazione fallisce e l'orchestrator ritenta con feedback.
const FonteSchema = z.object({
    url: z.string().url("url deve essere un URL valido"),
    titolo: z.string().optional(),
}).refine((fonte) => isOfficialUrl(fonte.url), {
    message: "La fonte non proviene da una pagina ufficiale",
    path: ["url"],
});

const SezioneSchema = z.object({
    titolo: z.string().min(1, "Il titolo della sezione non può essere vuoto").max(120),
    contenuto: z.string().min(1, "Il contenuto della sezione non può essere vuoto").max(3000),
});

// Coppia definizione-formale / spiegazione-informale ("spiega brutta"): utile
// per fissare in memoria i termini tecnici più ostici, non solo la definizione
// da manuale. Il glossario resta facoltativo: non tutti gli argomenti hanno
// gergo tecnico che vale la pena isolare a parte.
const GlossarioVoceSchema = z.object({
    termine: z.string().min(1).max(80),
    definizioneFormale: z.string().min(1).max(300),
    spiegazioneInformale: z.string().min(1).max(300),
});

// Errori tipici in cui incorre chi impronta questo argomento per la prima
// volta, distinti dalle sezioni "sezioni": lì si spiega il concetto, qui si
// isolano gli sbagli pratici più comuni e come correggerli, in modo che
// restino facili da ritrovare invece di essere sparsi dentro il contenuto.
const ErroreComuneSchema = z.object({
    errore: z.string().min(1).max(200),
    // 500 e non 300: il modello scrive spesso soluzioni pratiche con un
    // controesempio (es. "usa X invece di Y"), e 300 caratteri si sono
    // rivelati troppo stretti nella pratica, causando un OutputParserException
    // non recuperabile a metà della generazione (vedi generatorAgent.js).
    soluzione: z.string().min(1).max(500),
});

const NoteDraftSchema = z.object({
    modulo: z.string().min(1, "Il modulo non può essere vuoto").max(60),
    titolo: z.string().min(3, "Il titolo deve avere almeno 3 caratteri").max(150),
    argomento: z.string(),
    sezioni: z.array(SezioneSchema)
        .min(1, "Serve almeno una sezione")
        .max(6, "Troppe sezioni nella nota"),
    fonti: z.array(FonteSchema)
        .max(10, "Troppe fonti citate nella nota"),
    // 300 e non 200 per lo stesso motivo di ErroreComuneSchema.soluzione: un
    // key takeaway completo e utile eccede spesso 200 caratteri in pratica,
    // causando lo stesso OutputParserException non recuperabile a metà
    // generazione.
    keyTakeaways: z.array(z.string().min(1).max(300))
        .min(1, "Serve almeno un key takeaway")
        .max(8, "Troppi key takeaways"),
    glossario: z.array(GlossarioVoceSchema)
        .max(10, "Troppe voci nel glossario"),
    erroriComuni: z.array(ErroreComuneSchema)
        .min(2, "Servono almeno due errori comuni")
        .max(6, "Troppi errori comuni nella nota"),
    tag: z.array(z.string())
        .max(5, "Troppi tag associati alla nota"),
});

const NoteSchema = NoteDraftSchema;

// Verdetto del Reviewer (Agente 3.5): un'unica chiamata LLM che valuta due
// aspetti indipendenti della bozza, distinti dalla conformità strutturale
// già verificata da NoteSchema:
// - "perimetro": la bozza resta in tema e al livello giusto (fuori tema/gap/
//   troppo avanzato);
// - "aderenza": i fatti scritti trovano riscontro negli estratti delle fonti
//   recuperate invece che nella memoria del modello.
// Erano due chiamate separate perché sono due giudizi concettualmente
// distinti, ma valutano la stessa bozza+fonti: unirle in una sola chiamata
// dimezza i token di contesto (niente più bozza e fonti duplicate in due
// prompt) senza annacquare nessuno dei due controlli, che restano verdetti
// indipendenti con i propri motivi. "motivi" è vuoto/non significativo se il
// relativo verdetto è positivo.
// Niente `.max(5)` sugli array di motivi: reviewerAgent chiama il modello con
// `strict: true` (structured output vincolato lato Anthropic, non solo
// validato lato client), che garantisce tipi e campi corretti così il
// Reviewer non può più restituire "perimetro" come stringa invece che come
// oggetto o omettere "aderenza" del tutto — il crash osservato in pratica su
// argomenti su cui il Reviewer aveva molto da segnalare. La modalità strict
// di Anthropic però rifiuta la richiesta se lo schema contiene `maxItems` su
// un array (verificato con una chiamata reale: 400 "property 'maxItems' is
// not supported"); `maxLength` sulle stringhe invece è supportato, quindi
// resta solo lì. Il numero di motivi restava comunque implicitamente limitato
// dal prompt ("un motivo per riga"), qui perdiamo solo il tetto rigido.
const ReviewSchema = z.object({
    perimetro: z.object({
        approvato: z.boolean(),
        // 800 e non 500: stesso motivo di ErroreComuneSchema.soluzione e
        // keyTakeaways. Un motivo ben argomentato (specifico e azionabile,
        // come richiesto nel prompt) eccede spesso 500 caratteri, causando lo
        // stesso OutputParserException non recuperabile a metà revisione.
        motivi: z.array(z.string().min(1).max(800)),
    }),
    aderenza: z.object({
        aderente: z.boolean(),
        motivi: z.array(z.string().min(1).max(800)),
    }),
});

const WrittenNoteSchema = NoteSchema.extend({
    id: z.string().uuid(),
    nomeFile: z.string(),
    creatoIl: z.string().datetime()
});

export {
    TopicInputSchema,
    FonteSchema,
    SezioneSchema,
    GlossarioVoceSchema,
    ErroreComuneSchema,
    NoteDraftSchema,
    NoteSchema,
    WrittenNoteSchema,
    ReviewSchema,
};
