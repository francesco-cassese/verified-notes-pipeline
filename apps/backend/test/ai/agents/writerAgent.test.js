import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import createWriterAgent from "../../../src/ai/agents/writerAgent.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

async function creaNotesDirTemporanea() {
    return fs.mkdtemp(path.join(os.tmpdir(), "writer-test-"));
}

function notaValida(overrides = {}) {
    return {
        modulo: "React.js",
        titolo: "Introduzione agli Hooks",
        argomento: "hooks react",
        sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
        fonti: [{ url: "https://react.dev/learn/hooks", titolo: "React Hooks" }],
        keyTakeaways: ["Gli hook si usano solo nei componenti funzione."],
        glossario: [],
        erroriComuni: [
            { errore: "Chiamare un hook dentro un if", soluzione: "Chiama gli hook sempre allo stesso livello." },
        ],
        tag: ["react", "hooks"],
        ...overrides,
    };
}

test("write: usa la cartella scelta dall'archivista, non lo slug diretto del modulo", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        // "React.js" slugificato darebbe "react-js": l'archivista qui restituisce
        // deliberatamente qualcos'altro, per verificare che write() usi il suo
        // risultato e non ricalcoli la cartella da sé.
        const archivista = { selezionaCartella: (modulo) => { assert.equal(modulo, "React.js"); return "react"; } };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida());

        assert.equal(scritta.cartella, "react");
        assert.equal(scritta.percorsoRelativo.split(path.sep)[0], "react");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il markdown include tutte le sezioni attese e omette il glossario se vuoto", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida({ glossario: [] }));
        const contenuto = await fs.readFile(scritta.percorso, "utf-8");

        assert.match(contenuto, /^# Introduzione agli Hooks$/m);
        assert.match(contenuto, /^## 📍 Indice Rapido$/m);
        assert.match(contenuto, /^## Cos'è un hook$/m);
        assert.match(contenuto, /^## ⚠️ Errori Comuni$/m);
        assert.match(contenuto, /^## 🔗 Risorse e Documentazione$/m);
        assert.match(contenuto, /^## 🚀 Key Takeaways$/m);
        assert.doesNotMatch(contenuto, /Glossario/);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il markdown include il glossario quando presente", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida({
            glossario: [{ termine: "Hook", definizioneFormale: "Funzione che aggancia stato/lifecycle.", spiegazioneInformale: "Un modo per usare stato nei componenti funzione." }],
        }));
        const contenuto = await fs.readFile(scritta.percorso, "utf-8");

        assert.match(contenuto, /^## 📖 Glossario$/m);
        assert.match(contenuto, /Hook/);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: fonti vuote mostrano il messaggio placeholder invece di una lista vuota", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida({ fonti: [] }));
        const contenuto = await fs.readFile(scritta.percorso, "utf-8");

        assert.match(contenuto, /Nessuna fonte ufficiale citata\./);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il risultato include i metadati generati (id, creatoIl, nomeFile, percorsoRelativo)", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const archivista = { selezionaCartella: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: loggerSilenzioso, archivista });

        const scritta = await writer.write(notaValida());

        assert.match(scritta.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        assert.ok(!Number.isNaN(Date.parse(scritta.creatoIl)));
        assert.match(scritta.nomeFile, /^introduzione-agli-hooks-[0-9a-f]{8}\.md$/);
        assert.equal(scritta.percorsoRelativo, path.join("react", scritta.nomeFile));

        // Il sidecar JSON contiene esattamente gli stessi metadati.
        const jsonPath = scritta.percorso.replace(/\.md$/, ".json");
        const sidecar = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
        assert.equal(sidecar.id, scritta.id);
        assert.equal(sidecar.titolo, "Introduzione agli Hooks");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
