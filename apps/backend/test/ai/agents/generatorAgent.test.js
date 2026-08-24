import { test } from "node:test";
import assert from "node:assert/strict";
import createGeneratorAgent from "../../../src/ai/agents/generatorAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

function fakeSearchTool(datiGrezzi) {
    return {
        invoke: async () => JSON.stringify({ argomento: "test", dati_grezzi: datiGrezzi }),
    };
}

test("generate: nessuna fonte trovata -> NO_OFFICIAL_SOURCE_ERROR senza chiamare il modello", async () => {
    let modelChiamato = false;
    const model = { withStructuredOutput: () => ({ invoke: async () => { modelChiamato = true; } }) };
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool([]), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.NO_OFFICIAL_SOURCE_ERROR
    );
    assert.equal(modelChiamato, false);
});

test("generate: fonti trovate ma senza testo estratto -> GENERATION_ERROR senza chiamare il modello", async () => {
    let modelChiamato = false;
    const model = { withStructuredOutput: () => ({ invoke: async () => { modelChiamato = true; } }) };
    const datiGrezzi = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: null }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR
    );
    assert.equal(modelChiamato, false);
});

test("generate: almeno una fonte con testo -> chiama il modello e restituisce draft + risultatiRicerca", async () => {
    const draftFinto = { titolo: "Fake" };
    const model = { withStructuredOutput: () => ({ invoke: async () => draftFinto }) };
    const datiGrezzi = [
        { title: "React Docs", url: "https://react.dev/learn", contenuto: "testo estratto" },
        { title: "MDN", url: "https://developer.mozilla.org/x", contenuto: null },
    ];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    const risultato = await generator.generate("argomento a caso");

    assert.equal(risultato.draft, draftFinto);
    assert.deepEqual(risultato.risultatiRicerca, datiGrezzi);
});

test("generate: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const erroreOriginale = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreOriginale; } }) };
    const datiGrezzi = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === erroreOriginale
    );
});
