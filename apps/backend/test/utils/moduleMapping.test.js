import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFolder } from "../../src/utils/moduleMapping.js";

test("resolveFolder: modulo mappato, case-insensitive e con spazi ai bordi", () => {
    assert.equal(resolveFolder("React"), "react");
    assert.equal(resolveFolder(" REACT.JS "), "react");
});

test("resolveFolder: alias diversi confluiscono nella stessa cartella canonica", () => {
    assert.equal(resolveFolder("nextjs"), "react");
    assert.equal(resolveFolder("Next.js"), "react");
});

test("resolveFolder: modulo non mappato ricade sullo slug e avvisa il logger", () => {
    const warnings = [];
    const logger = { warn: (scope, message, meta) => warnings.push({ scope, message, meta }) };

    const folder = resolveFolder("Zig Lang", logger);

    assert.equal(folder, "zig-lang");
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].scope, "archivistAgent");
});

test("resolveFolder: funziona anche senza logger", () => {
    assert.equal(resolveFolder("modulo-sconosciuto-xyz"), "modulo-sconosciuto-xyz");
});
