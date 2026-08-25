import { test } from "node:test";
import assert from "node:assert/strict";
import createGeneratorAgent from "../../../src/ai/agents/generatorAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const silentLogger = { info() {}, warn() {}, error() {} };

function fakeSearchTool(rawResults) {
    return {
        invoke: async () => JSON.stringify({ topic: "test", rawResults }),
    };
}

test("generate: nessuna fonte trovata -> NO_OFFICIAL_SOURCE_ERROR senza chiamare il modello", async () => {
    let modelCalled = false;
    const model = { withStructuredOutput: () => ({ invoke: async () => { modelCalled = true; } }) };
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool([]), logger: silentLogger });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.NO_OFFICIAL_SOURCE_ERROR
    );
    assert.equal(modelCalled, false);
});

test("generate: fonti trovate ma senza testo estratto -> GENERATION_ERROR senza chiamare il modello", async () => {
    let modelCalled = false;
    const model = { withStructuredOutput: () => ({ invoke: async () => { modelCalled = true; } }) };
    const rawResults = [{ title: "React Docs", url: "https://react.dev/learn", content: null }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(rawResults), logger: silentLogger });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR
    );
    assert.equal(modelCalled, false);
});

test("generate: almeno una fonte con testo -> chiama il modello e restituisce draft + searchResults", async () => {
    const fakeDraft = { title: "Fake" };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeDraft }) };
    const rawResults = [
        { title: "React Docs", url: "https://react.dev/learn", content: "testo estratto" },
        { title: "MDN", url: "https://developer.mozilla.org/x", content: null },
    ];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(rawResults), logger: silentLogger });

    const result = await generator.generate("argomento a caso");

    assert.equal(result.draft, fakeDraft);
    assert.deepEqual(result.searchResults, rawResults);
});

test("generate: con searchResultsCache non chiama il tool di ricerca e riusa le fonti passate", async () => {
    let searchToolCalled = false;
    const searchTool = { invoke: async () => { searchToolCalled = true; return JSON.stringify({ rawResults: [] }); } };
    const fakeDraft = { title: "Fake" };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeDraft }) };
    const cache = [{ title: "React Docs", url: "https://react.dev/learn", content: "testo estratto" }];
    const generator = createGeneratorAgent({ model, searchTool, logger: silentLogger });

    const result = await generator.generate("argomento a caso", { searchResultsCache: cache });

    assert.equal(searchToolCalled, false);
    assert.equal(result.draft, fakeDraft);
    assert.deepEqual(result.searchResults, cache);
});

test("generate: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const originalError = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw originalError; } }) };
    const rawResults = [{ title: "React Docs", url: "https://react.dev/learn", content: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(rawResults), logger: silentLogger });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === originalError && err.issues === null
    );
});

test("generate: OutputParserException (bozza fuori schema) espone issues leggibili per il retry successivo", async () => {
    const parsingError = new Error(
        'Failed to parse. Text: "{...}". Error: [{"code":"too_big","maximum":300,"path":["commonMistakes",1,"solution"],"message":"Too big: expected string to have <=300 characters"}]\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/OUTPUT_PARSING_FAILURE/'
    );
    parsingError.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw parsingError; } }) };
    const rawResults = [{ title: "React Docs", url: "https://react.dev/learn", content: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(rawResults), logger: silentLogger });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => {
            assert.equal(err.code, ErrorCodes.GENERATION_ERROR);
            assert.deepEqual(err.issues, [
                'Il campo "commonMistakes.1.solution" non rispetta lo schema: Too big: expected string to have <=300 characters',
            ]);
            return true;
        }
    );
});

test("generate: errore di parsing con formato inatteso -> issues null, nessun feedback fasullo", async () => {
    const parsingError = new Error('Failed to parse. Text: "{...}". Error: qualcosa di non-JSON');
    parsingError.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw parsingError; } }) };
    const rawResults = [{ title: "React Docs", url: "https://react.dev/learn", content: "testo" }];
    const generator = createGeneratorAgent({ model, searchTool: fakeSearchTool(rawResults), logger: silentLogger });

    await assert.rejects(
        () => generator.generate("argomento a caso"),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.issues === null
    );
});
