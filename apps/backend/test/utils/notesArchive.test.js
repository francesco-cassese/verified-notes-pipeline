import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { trovaAppuntoPerArgomento } from "../../src/utils/notesArchive.js";

async function creaNotesDirTemporanea() {
    return fs.mkdtemp(path.join(os.tmpdir(), "appunti-archive-test-"));
}

async function scriviAppuntoFinto(notesDir, cartella, nomeFile, { argomento, titolo }) {
    const dir = path.join(notesDir, cartella);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${nomeFile}.md`), `---\ntitolo: "${titolo}"\n---\n\ncorpo`, "utf-8");
    await fs.writeFile(
        path.join(dir, `${nomeFile}.json`),
        JSON.stringify({ argomento, titolo }, null, 2),
        "utf-8"
    );
}

test("trovaAppuntoPerArgomento: trova un appunto esistente con lo stesso argomento (case-insensitive)", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        await scriviAppuntoFinto(notesDir, "react", "hooks", { argomento: "React useEffect hook", titolo: "Introduzione agli Hooks" });

        const trovato = await trovaAppuntoPerArgomento(notesDir, "  REACT USEEFFECT HOOK  ");

        assert.deepEqual(trovato, { cartella: "react", nomeFile: "hooks.md", titolo: "Introduzione agli Hooks" });
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("trovaAppuntoPerArgomento: nessun appunto corrispondente -> null", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        await scriviAppuntoFinto(notesDir, "react", "hooks", { argomento: "React useEffect hook", titolo: "Introduzione agli Hooks" });

        const trovato = await trovaAppuntoPerArgomento(notesDir, "PHP foreach");

        assert.equal(trovato, null);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});

test("trovaAppuntoPerArgomento: archivio vuoto -> null senza errori", async () => {
    const notesDir = await creaNotesDirTemporanea();
    try {
        const trovato = await trovaAppuntoPerArgomento(notesDir, "qualsiasi argomento");
        assert.equal(trovato, null);
    } finally {
        await fs.rm(notesDir, { recursive: true, force: true });
    }
});
