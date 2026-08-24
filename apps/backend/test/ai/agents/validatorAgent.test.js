import { test } from "node:test";
import assert from "node:assert/strict";
import createValidatorAgent from "../../../src/ai/agents/validatorAgent.js";

function draftValido(overrides = {}) {
    return {
        modulo: "React",
        titolo: "Introduzione agli Hooks",
        argomento: "hooks react",
        sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
        fonti: [{ url: "https://react.dev/learn/hooks", titolo: "React Hooks" }],
        keyTakeaways: ["Gli hook si usano solo nei componenti funzione."],
        glossario: [],
        erroriComuni: [
            { errore: "Chiamare un hook dentro un if", soluzione: "Chiama gli hook sempre allo stesso livello, mai dentro condizioni o cicli." },
            { errore: "Usare un hook fuori da un componente funzione", soluzione: "Gli hook vanno chiamati solo dentro componenti funzione o altri hook." },
        ],
        tag: ["react", "hooks"],
        ...overrides,
    };
}

test("validate: bozza valida con fonti tra quelle recuperate -> successo", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(draftValido(), ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, true);
});

test("validate: errore di schema -> fallisce con issues leggibili", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(draftValido({ titolo: "Hi" }), ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, false);
    assert.ok(result.issues.some((i) => i.includes("titolo")));
});

test("validate: fonte su dominio ufficiale ma non tra quelle recuperate -> possibile invenzione", () => {
    const validator = createValidatorAgent();
    const draft = draftValido({ fonti: [{ url: "https://react.dev/una-pagina-mai-vista" }] });
    const result = validator.validate(draft, ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, false);
    assert.ok(result.issues.some((i) => i.includes("possibile fonte inventata")));
});

test("validate: nessuna fonte citata -> il controllo di appartenenza non scatta", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(draftValido({ fonti: [] }), []);

    assert.equal(result.success, true);
});
