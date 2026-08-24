import { test } from "node:test";
import assert from "node:assert/strict";
import { isOfficialUrl } from "../../src/utils/officialSources.js";

test("isOfficialUrl: accetta un dominio esatto in whitelist", () => {
    assert.equal(isOfficialUrl("https://react.dev/learn"), true);
});

test("isOfficialUrl: accetta un sottodominio di un dominio in whitelist", () => {
    assert.equal(isOfficialUrl("https://docs.python.org/3/"), true);
});

test("isOfficialUrl: ignora il prefisso www.", () => {
    assert.equal(isOfficialUrl("https://www.python.org/"), true);
});

test("isOfficialUrl: rifiuta un dominio non in whitelist", () => {
    assert.equal(isOfficialUrl("https://example.com/tutorial-react"), false);
});

test("isOfficialUrl: rifiuta un URL malformato", () => {
    assert.equal(isOfficialUrl("non-un-url"), false);
});

test("isOfficialUrl: rifiuta un dominio ufficiale come suffisso di un'altra label (evilreact.dev)", () => {
    assert.equal(isOfficialUrl("https://evilreact.dev/"), false);
});

test("isOfficialUrl: rifiuta un dominio ufficiale usato come prefisso di un dominio malevolo (react.dev.evil.com)", () => {
    assert.equal(isOfficialUrl("https://react.dev.evil.com/"), false);
});
