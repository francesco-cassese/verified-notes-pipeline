import { test } from "node:test";
import assert from "node:assert/strict";
import createValidatorAgent from "../../../src/ai/agents/validatorAgent.js";

function validDraft(overrides = {}) {
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

test("validate: bozza valida con fonti tra quelle recuperate -> successo", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(validDraft(), ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, true);
});

test("validate: errore di schema -> fallisce con issues leggibili", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(validDraft({ title: "Hi" }), ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, false);
    assert.ok(result.issues.some((i) => i.includes("title")));
});

test("validate: fonte su dominio ufficiale ma non tra quelle recuperate -> possibile invenzione", () => {
    const validator = createValidatorAgent();
    const draft = validDraft({ sources: [{ url: "https://react.dev/una-pagina-mai-vista" }] });
    const result = validator.validate(draft, ["https://react.dev/learn/hooks"]);

    assert.equal(result.success, false);
    assert.ok(result.issues.some((i) => i.includes("possibile fonte inventata")));
});

test("validate: nessuna fonte citata -> il controllo di appartenenza non scatta", () => {
    const validator = createValidatorAgent();
    const result = validator.validate(validDraft({ sources: [] }), []);

    assert.equal(result.success, true);
});
