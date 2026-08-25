import { test } from "node:test";
import assert from "node:assert/strict";
import createReviewerAgent from "../../../src/ai/agents/reviewerAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const silentLogger = { info() {}, warn() {}, error() {} };

const minimalDraft = {
    title: "Introduzione agli Hooks",
    module: "React",
    sections: [{ title: "Cos'è un hook", content: "Un hook è una funzione speciale." }],
};

const minimalSearchResults = [{ title: "React Docs", url: "https://react.dev/learn/hooks", content: "I hook sono funzioni speciali." }];

test("review: verdetto con tutti gli aspetti approvati restituito così com'è", async () => {
    const fakeVerdict = {
        scope: { approved: true, reasons: [] },
        adherence: { adherent: true, reasons: [] },
        bestPractice: { upToDate: true, reasons: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeVerdict }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    const result = await reviewer.review("hooks react", minimalDraft, minimalSearchResults);

    assert.equal(result, fakeVerdict);
});

test("review: perimetro non approvato restituito con i motivi", async () => {
    const fakeVerdict = {
        scope: { approved: false, reasons: ["la sezione 'Cos'è un hook' spiega a fondo il reconciler, fuori perimetro"] },
        adherence: { adherent: true, reasons: [] },
        bestPractice: { upToDate: true, reasons: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeVerdict }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    const result = await reviewer.review("hooks react", minimalDraft, minimalSearchResults);

    assert.equal(result.scope.approved, false);
    assert.deepEqual(result.scope.reasons, fakeVerdict.scope.reasons);
});

test("review: aderenza non superata restituita con i motivi", async () => {
    const fakeVerdict = {
        scope: { approved: true, reasons: [] },
        adherence: { adherent: false, reasons: ["la sezione 'Cos'è un hook' descrive un'API non presente negli estratti"] },
        bestPractice: { upToDate: true, reasons: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeVerdict }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    const result = await reviewer.review("hooks react", minimalDraft, minimalSearchResults);

    assert.equal(result.adherence.adherent, false);
    assert.deepEqual(result.adherence.reasons, fakeVerdict.adherence.reasons);
});

test("review: best practice non rispettata restituita con i motivi", async () => {
    const fakeVerdict = {
        scope: { approved: true, reasons: [] },
        adherence: { adherent: true, reasons: [] },
        bestPractice: { upToDate: false, reasons: ["la sezione 'Cos'è un hook' mostra componentWillMount, che le fonti segnalano come deprecato in favore di useEffect"] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakeVerdict }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    const result = await reviewer.review("hooks react", minimalDraft, minimalSearchResults);

    assert.equal(result.bestPractice.upToDate, false);
    assert.deepEqual(result.bestPractice.reasons, fakeVerdict.bestPractice.reasons);
});

test("review: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const originalError = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw originalError; } }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    await assert.rejects(
        () => reviewer.review("hooks react", minimalDraft, minimalSearchResults),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === originalError && err.issues === null
    );
});

test("review: OutputParserException (verdetto fuori schema) espone issues leggibili per il retry successivo", async () => {
    const parsingError = new Error(
        'Failed to parse. Text: "{...}". Error: [{"code":"invalid_type","expected":"object","path":["scope"],"message":"Invalid input: expected object, received string"}]\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/OUTPUT_PARSING_FAILURE/'
    );
    parsingError.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw parsingError; } }) };
    const reviewer = createReviewerAgent({ model, logger: silentLogger });

    await assert.rejects(
        () => reviewer.review("hooks react", minimalDraft, minimalSearchResults),
        (err) => {
            assert.equal(err.code, ErrorCodes.GENERATION_ERROR);
            assert.deepEqual(err.issues, [
                'Il campo "scope" non rispetta lo schema: Invalid input: expected object, received string',
            ]);
            return true;
        }
    );
});
