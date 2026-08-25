import z from "zod";
import { isOfficialUrl } from "../../utils/officialSources.js";

const TopicInputSchema = z.object({
    topic: z.string()
        .min(3, "L'argomento deve avere almeno 3 caratteri")
        .max(200, "L'argomento non può superare 200 caratteri")
})

// Il refine rende "solo fonti ufficiali" un vincolo verificato dal Validator
// (safeParse), non solo un'istruzione nel prompt: se il modello cita una fonte
// non ufficiale, la validazione fallisce e l'orchestrator ritenta con feedback.
const SourceSchema = z.object({
    url: z.string().url("url deve essere un URL valido"),
    title: z.string().optional(),
}).refine((source) => isOfficialUrl(source.url), {
    message: "La fonte non proviene da una pagina ufficiale",
    path: ["url"],
});

const SectionSchema = z.object({
    title: z.string().min(1, "Il titolo della sezione non può essere vuoto").max(120),
    content: z.string().min(1, "Il contenuto della sezione non può essere vuoto").max(3000),
});

// Coppia definizione-formale / spiegazione-informale ("spiega brutta"): utile
// per fissare in memoria i termini tecnici più ostici, non solo la definizione
// da manuale. Il glossario resta facoltativo: non tutti gli argomenti hanno
// gergo tecnico che vale la pena isolare a parte.
// 450 e non 300 per lo stesso motivo di MistakeSchema.solution più sotto:
// una definizione o spiegazione completa eccede spesso 300 caratteri in
// pratica, causando un OutputParserException non recuperabile a metà
// generazione. Bumpato preventivamente insieme a "mistake" e "solution" (tutti
// e tre campi di testo descrittivo con lo stesso profilo di rischio) invece
// di aspettare che fallisca anche questo con un'altra chiamata reale.
const GlossaryEntrySchema = z.object({
    term: z.string().min(1).max(80),
    formalDefinition: z.string().min(1).max(450),
    informalExplanation: z.string().min(1).max(450),
});

// Errori tipici in cui incorre chi impronta questo argomento per la prima
// volta, distinti dalle "sections": lì si spiega il concetto, qui si isolano
// gli sbagli pratici più comuni e come correggerli, in modo che restino
// facili da ritrovare invece di essere sparsi dentro il contenuto.
const MistakeSchema = z.object({
    // 350 e non 200: stesso motivo di "solution" sotto, osservato in pratica
    // (4 violazioni nello stesso tentativo su un solo argomento).
    mistake: z.string().min(1).max(350),
    // 500 e non 300: il modello scrive spesso soluzioni pratiche con un
    // controesempio (es. "usa X invece di Y"), e 300 caratteri si sono
    // rivelati troppo stretti nella pratica, causando un OutputParserException
    // non recuperabile a metà della generazione (vedi generatorAgent.js).
    solution: z.string().min(1).max(500),
});

const NoteDraftSchema = z.object({
    module: z.string().min(1, "Il modulo non può essere vuoto").max(60),
    title: z.string().min(3, "Il titolo deve avere almeno 3 caratteri").max(150),
    topic: z.string(),
    sections: z.array(SectionSchema)
        .min(1, "Serve almeno una sezione")
        .max(6, "Troppe sezioni nella nota"),
    sources: z.array(SourceSchema)
        .max(10, "Troppe fonti citate nella nota"),
    // 300 e non 200 per lo stesso motivo di MistakeSchema.solution: un
    // key takeaway completo e utile eccede spesso 200 caratteri in pratica,
    // causando lo stesso OutputParserException non recuperabile a metà
    // generazione.
    keyTakeaways: z.array(z.string().min(1).max(300))
        .min(1, "Serve almeno un key takeaway")
        .max(8, "Troppi key takeaways"),
    glossary: z.array(GlossaryEntrySchema)
        .max(10, "Troppe voci nel glossario"),
    commonMistakes: z.array(MistakeSchema)
        .min(2, "Servono almeno due errori comuni")
        .max(6, "Troppi errori comuni nella nota"),
    tags: z.array(z.string())
        .max(5, "Troppi tag associati alla nota"),
});

const NoteSchema = NoteDraftSchema;

// Verdetto del Reviewer (Agente 3.5): un'unica chiamata LLM che valuta tre
// aspetti indipendenti della bozza, distinti dalla conformità strutturale
// già verificata da NoteSchema:
// - "scope": la bozza resta in tema (niente divagazioni fuori tema) e a una
//   profondità adatta a un'introduzione (non troppo avanzata) — non valuta
//   più la "completezza" (concetti mancanti): quel sotto-criterio entrava
//   spesso in contraddizione con "livello" da un tentativo all'altro (un
//   tentativo chiedeva di aggiungere un concetto avanzato, il successivo di
//   toglierlo perché troppo avanzato), quindi è stato rimosso;
// - "adherence": i fatti scritti trovano riscontro negli estratti delle fonti
//   recuperate invece che nella memoria del modello (controllo anti-
//   allucinazione, non toccato da questa modifica);
// - "bestPractice": la bozza non propone sintassi o pattern deprecati al
//   posto delle alternative moderne consigliate oggi per l'argomento.
// Restano verdetti indipendenti con i propri motivi (reasons) in un'unica
// chiamata: dimezza i token di contesto (niente più bozza e fonti duplicate
// in prompt separati) senza annacquare nessuno dei controlli. "reasons" è
// vuoto/non significativo se il relativo verdetto è positivo.
// Niente `.max(5)` sugli array di reasons: reviewerAgent chiama il modello
// con `strict: true` (structured output vincolato lato Anthropic, non solo
// validato lato client), che garantisce tipi e campi corretti così il
// Reviewer non può più restituire "scope" come stringa invece che come
// oggetto o omettere "adherence" del tutto — il crash osservato in pratica su
// argomenti su cui il Reviewer aveva molto da segnalare. La modalità strict
// di Anthropic però rifiuta la richiesta se lo schema contiene `maxItems` su
// un array (verificato con una chiamata reale: 400 "property 'maxItems' is
// not supported"); `maxLength` sulle stringhe invece è supportato, quindi
// resta solo lì. Il numero di reasons restava comunque implicitamente
// limitato dal prompt ("un motivo per riga"), qui perdiamo solo il tetto
// rigido.
const ReviewSchema = z.object({
    scope: z.object({
        approved: z.boolean(),
        // 800 e non 500: stesso motivo di MistakeSchema.solution e
        // keyTakeaways. Un motivo ben argomentato (specifico e azionabile,
        // come richiesto nel prompt) eccede spesso 500 caratteri, causando lo
        // stesso OutputParserException non recuperabile a metà revisione.
        reasons: z.array(z.string().min(1).max(800)),
    }),
    adherence: z.object({
        adherent: z.boolean(),
        reasons: z.array(z.string().min(1).max(800)),
    }),
    bestPractice: z.object({
        upToDate: z.boolean(),
        reasons: z.array(z.string().min(1).max(800)),
    }),
});

const WrittenNoteSchema = NoteSchema.extend({
    id: z.string().uuid(),
    fileName: z.string(),
    createdAt: z.string().datetime()
});

export {
    TopicInputSchema,
    SourceSchema,
    SectionSchema,
    GlossaryEntrySchema,
    MistakeSchema,
    NoteDraftSchema,
    NoteSchema,
    WrittenNoteSchema,
    ReviewSchema,
};
