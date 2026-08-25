import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findNoteByTopic } from "../../src/utils/notesArchive.js";

async function createTempNotesDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), "notes-archive-test-"));
}

async function writeFakeNote(notesDir, folder, fileName, { topic, title }) {
    const dir = path.join(notesDir, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${fileName}.md`), `---\ntitle: "${title}"\n---\n\nbody`, "utf-8");
    await fs.writeFile(
        path.join(dir, `${fileName}.json`),
        JSON.stringify({ topic, title }, null, 2),
        "utf-8"
    );
}

test("findNoteByTopic: trova un appunto esistente con lo stesso argomento (case-insensitive)", async () => {
    const notesDir = await createTempNotesDir();
    try {
        await writeFakeNote(notesDir, "react", "hooks", { topic: "React useEffect hook", title: "Introduzione agli Hooks" });

        const found = await findNoteByTopic(notesDir, "  REACT USEEFFECT HOOK  ");

        assert.deepEqual(found, { folder: "react", fileName: "hooks.md", title: "Introduzione agli Hooks" });
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("findNoteByTopic: trova un appunto con parole riordinate e preposizioni diverse", async () => {
    const notesDir = await createTempNotesDir();
    try {
        await writeFakeNote(notesDir, "php", "foreach", { topic: "PHP foreach", title: "Iterazione con foreach" });

        const found = await findNoteByTopic(notesDir, "foreach in PHP");

        assert.deepEqual(found, { folder: "php", fileName: "foreach.md", title: "Iterazione con foreach" });
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("findNoteByTopic: argomento con una parola chiave in più non è considerato un doppione", async () => {
    const notesDir = await createTempNotesDir();
    try {
        await writeFakeNote(notesDir, "react", "hooks", { topic: "React hooks", title: "Introduzione agli Hooks" });

        const found = await findNoteByTopic(notesDir, "React Router hooks");

        assert.equal(found, null);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("findNoteByTopic: nessun appunto corrispondente -> null", async () => {
    const notesDir = await createTempNotesDir();
    try {
        await writeFakeNote(notesDir, "react", "hooks", { topic: "React useEffect hook", title: "Introduzione agli Hooks" });

        const found = await findNoteByTopic(notesDir, "PHP foreach");

        assert.equal(found, null);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("findNoteByTopic: archivio vuoto -> null senza errori", async () => {
    const notesDir = await createTempNotesDir();
    try {
        const found = await findNoteByTopic(notesDir, "qualsiasi argomento");
        assert.equal(found, null);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
