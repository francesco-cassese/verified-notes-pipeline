import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCartella } from "../../src/utils/moduleMapping.js";

test("resolveCartella: modulo mappato, case-insensitive e con spazi ai bordi", () => {
    assert.equal(resolveCartella("React"), "react");
    assert.equal(resolveCartella(" REACT.JS "), "react");
});

test("resolveCartella: alias diversi confluiscono nella stessa cartella canonica", () => {
    assert.equal(resolveCartella("nextjs"), "react");
    assert.equal(resolveCartella("Next.js"), "react");
});

test("resolveCartella: modulo non mappato ricade sullo slug e avvisa il logger", () => {
    const warnings = [];
    const logger = { warn: (scope, messaggio, meta) => warnings.push({ scope, messaggio, meta }) };

    const cartella = resolveCartella("Zig Lang", logger);

    assert.equal(cartella, "zig-lang");
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].scope, "archivistaAgent");
});

test("resolveCartella: funziona anche senza logger", () => {
    assert.equal(resolveCartella("modulo-sconosciuto-xyz"), "modulo-sconosciuto-xyz");
});
