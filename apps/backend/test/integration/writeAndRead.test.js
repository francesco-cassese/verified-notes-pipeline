import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import createWriterAgent from "../../src/ai/agents/writerAgent.js";
import { listFolders, listNotes, readNote } from "../../src/utils/notesArchive.js";

const silentLogger = { info() {}, warn() {}, error() {} };

async function createTempNotesDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
}

function validNote(overrides = {}) {
    return {
        module: "React",
        title: "Introduzione agli Hooks",
        topic: "hooks react",
        sections: [{ title: "Cos'è un hook", content: "Un hook è una funzione speciale." }],
        sources: [{ url: "https://react.dev/learn/hooks", title: "React Hooks" }],
        keyTakeaways: ["Gli hook si usano solo nei componenti funzione."],
        glossary: [],
        commonMistakes: [
            { mistake: "Chiamare un hook dentro un if", solution: "Chiama gli hook sempre allo stesso livello, mai dentro condizioni o cicli." },
            { mistake: "Usare un hook fuori da un componente funzione", solution: "Gli hook vanno chiamati solo dentro componenti funzione o altri hook." },
        ],
        tags: ["react", "hooks"],
        ...overrides,
    };
}

test("writerAgent + notesArchive: un appunto scritto è poi elencabile e leggibile", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote());

        const folders = await listFolders(notesDir);
        assert.deepEqual(folders, [{ folder: "react", noteCount: 1 }]);

        const notes = await listNotes(notesDir, "react");
        assert.equal(notes.length, 1);
        assert.equal(notes[0].fileName, written.fileName);
        assert.equal(notes[0].title, "Introduzione agli Hooks");

        const read = await readNote(notesDir, "react", written.fileName);
        assert.equal(read.format, "json");
        assert.equal(read.note.title, "Introduzione agli Hooks");
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("writerAgent: un titolo con backslash e newline produce un frontmatter YAML valido", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "regex" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        // "\d" letterale (comune in un appunto su regex) e una newline reale nel
        // titolo: senza escaping corretto il backslash lascia le virgolette non
        // bilanciate, e la newline spezza lo scalare YAML su più righe.
        const problematicTitle = 'Pattern "\\d" su più righe\ntitolo';
        const written = await writer.write(validNote({ title: problematicTitle }));

        const content = await fs.readFile(written.path, "utf-8");
        const titleLines = content.split("\n").filter((line) => line.startsWith("title:"));

        assert.equal(titleLines.length, 1, "il valore deve restare su una sola riga");
        // Stringa tra virgolette con escape bilanciati: ogni backslash deve
        // essere seguito da un carattere che chiude una coppia di escape,
        // altrimenti una `"` interna verrebbe letta come chiusura anticipata
        // (o un backslash finale "mangerebbe" la virgoletta di chiusura vera).
        assert.match(titleLines[0], /^title: "(?:[^"\\]|\\.)*"$/);

        // Il sidecar JSON (mai passato per l'escaping YAML) resta fedele all'originale.
        const read = await readNote(notesDir, "regex", written.fileName);
        assert.equal(read.note.title, problematicTitle);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("writerAgent: un titolo con tentativo di path traversal produce comunque un file contenuto nella notesDir", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const archivist = { selectFolder: () => "react" };
        const writer = createWriterAgent({ notesDir, logger: silentLogger, archivist });

        const written = await writer.write(validNote({ title: "../../../etc/passwd" }));
        const resolvedPath = path.resolve(written.path);
        const relative = path.relative(path.resolve(notesDir), resolvedPath);

        assert.ok(!relative.startsWith(".."));
        assert.ok(!path.isAbsolute(relative));
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
