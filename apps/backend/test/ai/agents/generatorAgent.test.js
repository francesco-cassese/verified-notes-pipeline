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

test("generate: con risultatiRicercaCache non chiama il tool di ricerca e riusa le fonti passate", async () => {
    let searchToolChiamato = false;
    const searchTool = { invoke: async () => { searchToolChiamato = true; return JSON.stringify({ dati_grezzi: [] }); } };
    const draftFinto = { titolo: "Fake" };
    const model = { withStructuredOutput: () => ({ invoke: async () => draftFinto }) };
    const cache = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: "testo estratto" }];
    const generator = createGeneratorAgent({ model, searchTool, logger: loggerSilenzioso });

    const risultato = await generator.generate("argomento a caso", { risultatiRicercaCache: cache });

    assert.equal(searchToolChiamato, false);
    assert.equal(risultato.draft, draftFinto);
    assert.deepEqual(risultato.risultatiRicerca, cache);
});

test("generate: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const erroreOriginale = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreOriginale; } }) };
    const datiGrezzi = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === erroreOriginale && err.issues === null
    );
});

test("generate: OutputParserException (bozza fuori schema) espone issues leggibili per il retry successivo", async () => {
    const erroreParsing = new Error(
        'Failed to parse. Text: "{...}". Error: [{"code":"too_big","maximum":300,"path":["erroriComuni",1,"soluzione"],"message":"Too big: expected string to have <=300 characters"}]\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/OUTPUT_PARSING_FAILURE/'
    );
    erroreParsing.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreParsing; } }) };
    const datiGrezzi = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => {
            assert.equal(err.code, ErrorCodes.GENERATION_ERROR);
            assert.deepEqual(err.issues, [
                'Il campo "erroriComuni.1.soluzione" non rispetta lo schema: Too big: expected string to have <=300 characters',
            ]);
            return true;
        }
    );
});

test("generate: errore di parsing con formato inatteso -> issues null, nessun feedback fasullo", async () => {
    const erroreParsing = new Error('Failed to parse. Text: "{...}". Error: qualcosa di non-JSON');
    erroreParsing.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreParsing; } }) };
    const datiGrezzi = [{ title: "React Docs", url: "https://react.dev/learn", contenuto: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(datiGrezzi), logger: loggerSilenzioso });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.issues === null
    );
});
