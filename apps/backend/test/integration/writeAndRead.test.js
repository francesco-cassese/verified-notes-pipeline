import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import createWriterAgent from "../../src/ai/agents/writerAgent.js";
import { listCartelle, listAppunti, leggiAppunto } from "../../src/utils/notesArchive.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

async function creaNotesDirTemporanea() {
    return fs.mkdtemp(path.join(os.tmpdir(), "appunti-test-"));
}

function notaValida(overrides = {}) {
    return {
        modulo: "React",
        titolo: "Introduzione agli Hooks",
        argomento: "hooks react",
        sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
        fonti: [{ url: "https://react.dev/learn/hooks", titolo: "React Hooks" }],
        keyTakeaways: ["Gli hook si usano solo nei componenti funzione."],
        glossario: [],
        erroriComuni: [
            { errore: "Chiamare un hook dentro un if", soluzione: "Chiama gli hook sempre allo stesso livello, mai dentro condizioni o cicli." },
            { errore: "Usare un hook fuori da un componente funzione", soluzione: "Gli hook vanno chiamati solo dentro componenti funzione o altri hook." },
        ],
        tag: ["react", "hooks"],
        ...overrides,
    };
}

test("writerAgent + notesArchive: un appunto scritto è poi elencabile e leggibile", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida());

        const cartelle = await listCartelle(notesDir);
        assert.deepEqual(cartelle, [{ cartella: "react", numeroAppunti: 1 }]);

        const appunti = await listAppunti(notesDir, "react");
        assert.equal(appunti.length, 1);
        assert.equal(appunti[0].nomeFile, scritta.nomeFile);
        assert.equal(appunti[0].titolo, "Introduzione agli Hooks");

        const letto = await leggiAppunto(notesDir, "react", scritta.nomeFile);
        assert.equal(letto.formato, "json");
        assert.equal(letto.nota.titolo, "Introduzione agli Hooks");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("writerAgent: un titolo con backslash e newline produce un frontmatter YAML valido", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "regex" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        // "\d" letterale (comune in un appunto su regex) e una newline reale nel
        // titolo: senza escaping corretto il backslash lascia le virgolette non
        // bilanciate, e la newline spezza lo scalare YAML su più righe.
        const titoloProblematico = 'Pattern "\\d" su più righe\ntitolo';
        const scritta = await writer.write(notaValida({ titolo: titoloProblematico }));

        const contenuto = await fs.readFile(scritta.percorso, "utf-8");
        const righeTitolo = contenuto.split("\n").filter((riga) => riga.startsWith("titolo:"));

        assert.equal(righeTitolo.length, 1, "il valore deve restare su una sola riga");
        // Stringa tra virgolette con escape bilanciati: ogni backslash deve
        // essere seguito da un carattere che chiude una coppia di escape,
        // altrimenti una `"` interna verrebbe letta come chiusura anticipata
        // (o un backslash finale "mangerebbe" la virgoletta di chiusura vera).
        assert.match(righeTitolo[0], /^titolo: "(?:[^"\\]|\\.)*"$/);

        // Il sidecar JSON (mai passato per l'escaping YAML) resta fedele all'originale.
        const letto = await leggiAppunto(notesDir, "regex", scritta.nomeFile);
        assert.equal(letto.nota.titolo, titoloProblematico);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("writerAgent: un titolo con tentativo di path traversal produce comunque un file contenuto nella notesDir", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida({ titolo: "../../../etc/passwd" }));
        const percorsoRisolto = path.resolve(scritta.percorso);
        const relative = path.relative(path.resolve(notesDir), percorsoRisolto);

        assert.ok(!relative.startsWith(".."));
        assert.ok(!path.isAbsolute(relative));
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
