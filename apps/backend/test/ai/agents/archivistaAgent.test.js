import { test } from "node:test";
import assert from "node:assert/strict";
import createArchivistaAgent from "../../../src/ai/agents/archivistaAgent.js";

// La logica di mapping vera e propria (alias, fallback allo slug, warning sul
// modulo non mappato) è già coperta a fondo da test/utils/moduleMapping.test.js,
// che testa resolveCartella direttamente. Qui verifico solo che l'agente sia un
// wrapper corretto: inoltra modulo e logger a resolveCartella e ne restituisce
// il risultato, senza aggiungere o perdere nulla.

test("selezionaCartella: delega a resolveCartella e restituisce la cartella canonica", () => {
    const archivista = createArchivistaAgent({ logger: { warn() {} } });

    assert.equal(archivista.selezionaCartella("React.js"), "react");
});

test("selezionaCartella: modulo non mappato ricade sullo slug e avvisa il logger iniettato", () => {
    const warnings = [];
    const archivista = createArchivistaAgent({ logger: { warn: (...args) => warnings.push(args) } });

    const cartella = archivista.selezionaCartella("Zig Lang");

    assert.equal(cartella, "zig-lang");
    assert.equal(warnings.length, 1);
});

test("selezionaCartella: funziona anche senza logger", () => {
    const archivista = createArchivistaAgent({});

    assert.equal(archivista.selezionaCartella("Python"), "python");
});
