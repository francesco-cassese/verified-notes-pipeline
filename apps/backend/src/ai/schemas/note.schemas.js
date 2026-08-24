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
    soluzione: z.string().min(1).max(300),
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
    keyTakeaways: z.array(z.string().min(1).max(200))
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

// Verdetto del Revisore (Agente 3.5): controllo semantico di perimetro
// (fuori tema) e gap analysis, distinto dalla conformità strutturale già
// verificata da NoteSchema. "motivi" è vuoto/non significativo se approvato.
const RevisioneSchema = z.object({
    approvato: z.boolean(),
    motivi: z.array(z.string().min(1).max(500)).max(5),
});

// Verdetto dell'Agente di aderenza: controlla che i fatti scritti nella bozza
// trovino riscontro negli estratti delle fonti recuperate, distinto sia dalla
// conformità strutturale (NoteSchema) sia dal controllo di perimetro/livello
// (RevisioneSchema). "motivi" è vuoto/non significativo se aderente.
const AderenzaSchema = z.object({
    aderente: z.boolean(),
    motivi: z.array(z.string().min(1).max(500)).max(5),
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
    RevisioneSchema,
    AderenzaSchema,
};
