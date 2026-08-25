import { test } from "node:test";
import assert from "node:assert/strict";
import createArchivistAgent from "../../../src/ai/agents/archivistAgent.js";

// La logica di mapping vera e propria (alias, fallback allo slug, warning sul
// modulo non mappato) è già coperta a fondo da test/utils/moduleMapping.test.js,
// che testa resolveFolder direttamente. Qui verifico solo che l'agente sia un
// wrapper corretto: inoltra modulo e logger a resolveFolder e ne restituisce
// il risultato, senza aggiungere o perdere nulla.

test("selectFolder: delega a resolveFolder e restituisce la cartella canonica", () => {
    const archivist = createArchivistAgent({ logger: { warn() {} } });

    assert.equal(archivist.selectFolder("React.js"), "react");
});

test("selectFolder: modulo non mappato ricade sullo slug e avvisa il logger iniettato", () => {
    const warnings = [];
    const archivist = createArchivistAgent({ logger: { warn: (...args) => warnings.push(args) } });

    const folder = archivist.selectFolder("Zig Lang");

    assert.equal(folder, "zig-lang");
    assert.equal(warnings.length, 1);
});

test("selectFolder: funziona anche senza logger", () => {
    const archivist = createArchivistAgent({});

    assert.equal(archivist.selectFolder("Python"), "python");
});
