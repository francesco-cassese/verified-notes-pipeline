import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import createWriterAgent from "../../../src/ai/agents/writerAgent.js";

const silentLogger = { info() {}, warn() {}, error() {} };

async function createTempNotesDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), "writer-test-"));
}

function validNote(overrides = {}) {
    return {
        module: "React.js",
        title: "Introduzione agli Hooks",
        topic: "hooks react",
        sections: [{ title: "Cos'è un hook", content: "Un hook è una funzione speciale." }],
        sources: [{ url: "https://react.dev/learn/hooks", title: "React Hooks" }],
        keyTakeaways: ["Gli hook si usano solo nei componenti funzione."],
        glossary: [],
        commonMistakes: [
            { mistake: "Chiamare un hook dentro un if", solution: "Chiama gli hook sempre allo stesso livello." },
        ],
        tags: ["react", "hooks"],
        ...overrides,
    };
}

test("write: usa la cartella scelta dall'archivist, non lo slug diretto del modulo", async () => {
    const notesDir = await createTempNotesDir();
    try {
        // "React.js" slugificato darebbe "react-js": l'archivist qui restituisce
        // deliberatamente qualcos'altro, per verificare che write() usi il suo
        // risultato e non ricalcoli la cartella da sé.
        const archivist = { selectFolder: (module) => { assert.equal(module, "React.js"); return "react"; } };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote());

        assert.equal(written.folder, "react");
        assert.equal(written.relativePath.split(path.sep)[0], "react");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il markdown include tutte le sezioni attese e omette il glossario se vuoto", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote({ glossary: [] }));
        const content = await fs.readFile(written.path, "utf-8");

        assert.match(content, /^# Introduzione agli Hooks$/m);
        assert.match(content, /^## 📍 Indice Rapido$/m);
        assert.match(content, /^## Cos'è un hook$/m);
        assert.match(content, /^## ⚠️ Errori Comuni$/m);
        assert.match(content, /^## 🔗 Risorse e Documentazione$/m);
        assert.match(content, /^## 🚀 Key Takeaways$/m);
        assert.doesNotMatch(content, /Glossario/);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il markdown include il glossario quando presente", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote({
            glossary: [{ term: "Hook", formalDefinition: "Funzione che aggancia stato/lifecycle.", informalExplanation: "Un modo per usare stato nei componenti funzione." }],
        }));
        const content = await fs.readFile(written.path, "utf-8");

        assert.match(content, /^## 📖 Glossario$/m);
        assert.match(content, /Hook/);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: fonti vuote mostrano il messaggio placeholder invece di una lista vuota", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote({ sources: [] }));
        const content = await fs.readFile(written.path, "utf-8");

        assert.match(content, /Nessuna fonte ufficiale citata\./);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("write: il risultato include i metadati generati (id, createdAt, fileName, relativePath)", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote());

        assert.match(written.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        assert.ok(!Number.isNaN(Date.parse(written.createdAt)));
        assert.match(written.fileName, /^introduzione-agli-hooks-[0-9a-f]{8}\.md$/);
        assert.equal(written.relativePath, path.join("react", written.fileName));

        // Il sidecar JSON contiene esattamente gli stessi metadati.
        const jsonPath = written.path.replace(/\.md$/, ".json");
        const sidecar = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
        assert.equal(sidecar.id, written.id);
        assert.equal(sidecar.title, "Introduzione agli Hooks");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
