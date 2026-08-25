import { test } from "node:test";
import assert from "node:assert/strict";
import createNoteOrchestrator from "../../../src/ai/orchestrator/noteOrchestrator.js";
import { AgentError, ErrorCodes } from "../../../src/utils/errors.js";

const silentLogger = { info() {}, warn() {}, error() {} };
const approvingReviewer = {
    review: async () => ({
        scope: { approved: true, reasons: [] },
        adherence: { adherent: true, reasons: [] },
        bestPractice: { upToDate: true, reasons: [] },
    }),
};

test("run: successo al primo tentativo, searchResults arriva al validatore come elenco di URL", async () => {
    const validateCalls = [];
    const generator = {
        generate: async () => ({
            draft: { title: "bozza" },
            searchResults: [{ title: "React", url: "https://react.dev/a", content: "testo" }],
        }),
    };
    const validator = {
        validate: (draft, fetchedSources) => {
            validateCalls.push(fetchedSources);
            return { success: true, data: draft };
        },
    };
    const writer = { write: async (data) => ({ ...data, id: "1" }) };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: approvingReviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("react hooks");

    assert.equal(result.status, "success");
    assert.equal(result.attempts, 1);
    assert.deepEqual(validateCalls[0], ["https://react.dev/a"]);
});

test("run: validazione fallita al primo tentativo, il feedback arriva al tentativo successivo", async () => {
    const generateCalls = [];
    let attempt = 0;
    const generator = {
        generate: async (topic, opts) => {
            attempt += 1;
            generateCalls.push(opts.feedback);
            return { draft: { title: `bozza-${attempt}` }, searchResults: [] };
        },
    };
    const validator = {
        validate: (draft) => (draft.title === "bozza-1"
            ? { success: false, issues: ["titolo troppo generico"] }
            : { success: true, data: draft }),
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: approvingReviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("react hooks");

    assert.equal(result.status, "success");
    assert.equal(result.attempts, 2);
    assert.deepEqual(generateCalls[0], []);
    assert.deepEqual(generateCalls[1], ["titolo troppo generico"]);
});

test("run: le fonti trovate al primo tentativo vengono riusate (in cache) nei retry successivi", async () => {
    const generateCalls = [];
    let attempt = 0;
    const foundSources = [{ title: "React", url: "https://react.dev/a", content: "testo" }];
    const generator = {
        generate: async (topic, opts) => {
            attempt += 1;
            generateCalls.push(opts.searchResultsCache);
            return { draft: { title: `bozza-${attempt}` }, searchResults: foundSources };
        },
    };
    const validator = {
        validate: (draft) => (draft.title === "bozza-1"
            ? { success: false, issues: ["titolo troppo generico"] }
            : { success: true, data: draft }),
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: approvingReviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    await orchestrator.run("react hooks");

    assert.equal(generateCalls[0], null);
    assert.equal(generateCalls[1], foundSources);
});

test("run: nessuna fonte ufficiale -> si ferma subito senza ritentare", async () => {
    let calls = 0;
    const generator = {
        generate: async () => {
            calls += 1;
            throw new AgentError("nessuna fonte", ErrorCodes.NO_OFFICIAL_SOURCE_ERROR);
        },
    };
    const validator = { validate: () => { throw new Error("non deve essere chiamato"); } };
    const reviewer = { review: async () => { throw new Error("non deve essere chiamato"); } };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: silentLogger, maxAttempts: 3 });
    const result = await orchestrator.run("argomento oscuro");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "no_official_source");
    assert.equal(result.attempts, 1);
    assert.equal(calls, 1);
});

test("run: la generazione fallisce sempre -> esaurisce tutti i tentativi", async () => {
    let calls = 0;
    const generator = {
        generate: async () => {
            calls += 1;
            throw new AgentError("boom", ErrorCodes.GENERATION_ERROR);
        },
    };
    const validator = { validate: () => { throw new Error("non deve essere chiamato"); } };
    const reviewer = { review: async () => { throw new Error("non deve essere chiamato"); } };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: silentLogger, maxAttempts: 3 });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "generation");
    assert.equal(result.attempts, 3);
    assert.equal(calls, 3);
});

test("run: la bozza viola lo schema (OutputParserException) -> gli issues arrivano come feedback al tentativo successivo", async () => {
    const generateCalls = [];
    let attempt = 0;
    const generator = {
        generate: async (topic, opts) => {
            attempt += 1;
            generateCalls.push(opts.feedback);
            if (attempt === 1) {
                const error = new AgentError("bozza fuori schema", ErrorCodes.GENERATION_ERROR);
                error.issues = ['Il campo "commonMistakes.1.solution" non rispetta lo schema: troppo lungo'];
                throw error;
            }
            return { draft: { title: "bozza-2" }, searchResults: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: approvingReviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "success");
    assert.deepEqual(generateCalls[0], []);
    assert.deepEqual(generateCalls[1], ['Il campo "commonMistakes.1.solution" non rispetta lo schema: troppo lungo']);
});

test("run: il verdetto del reviewer viola lo schema (OutputParserException) -> gli issues arrivano come feedback al tentativo successivo", async () => {
    const generateCalls = [];
    let attempt = 0;
    const generator = {
        generate: async (topic, opts) => {
            attempt += 1;
            generateCalls.push(opts.feedback);
            return { draft: { title: `bozza-${attempt}` }, searchResults: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => {
            if (attempt === 1) {
                const error = new AgentError("verdetto fuori schema", ErrorCodes.GENERATION_ERROR);
                error.issues = ['Il campo "scope" non rispetta lo schema: atteso oggetto, ricevuta stringa'];
                throw error;
            }
            return { scope: { approved: true, reasons: [] }, adherence: { adherent: true, reasons: [] }, bestPractice: { upToDate: true, reasons: [] } };
        },
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "success");
    assert.deepEqual(generateCalls[0], []);
    assert.deepEqual(generateCalls[1], ['Il campo "scope" non rispetta lo schema: atteso oggetto, ricevuta stringa']);
});

test("run: perimetro mai approvato -> esaurisce i tentativi con motivo 'validation'", async () => {
    const generator = { generate: async () => ({ draft: { title: "x" }, searchResults: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            scope: { approved: false, reasons: ["fuori tema"] },
            adherence: { adherent: true, reasons: [] },
            bestPractice: { upToDate: true, reasons: [] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: silentLogger, maxAttempts: 2 });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "validation");
    assert.deepEqual(result.issues, ["fuori tema"]);
    assert.equal(result.attempts, 2);
});

test("run: bozza non aderente alle fonti -> ripete con feedback e poi ha successo", async () => {
    const reviewCalls = [];
    let attempt = 0;
    const generator = {
        generate: async () => {
            attempt += 1;
            return { draft: { title: `bozza-${attempt}` }, searchResults: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async (topic, data) => {
            reviewCalls.push(data.title);
            return data.title === "bozza-1"
                ? { scope: { approved: true, reasons: [] }, adherence: { adherent: false, reasons: ["descrive un'API non presente negli estratti"] }, bestPractice: { upToDate: true, reasons: [] } }
                : { scope: { approved: true, reasons: [] }, adherence: { adherent: true, reasons: [] }, bestPractice: { upToDate: true, reasons: [] } };
        },
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "success");
    assert.equal(result.attempts, 2);
    assert.deepEqual(reviewCalls, ["bozza-1", "bozza-2"]);
});

test("run: bozza mai aderente alle fonti -> esaurisce i tentativi con motivo 'validation'", async () => {
    const generator = { generate: async () => ({ draft: { title: "x" }, searchResults: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            scope: { approved: true, reasons: [] },
            adherence: { adherent: false, reasons: ["contenuto non supportato dalle fonti"] },
            bestPractice: { upToDate: true, reasons: [] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 2,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "validation");
    assert.deepEqual(result.issues, ["contenuto non supportato dalle fonti"]);
    assert.equal(result.attempts, 2);
});

test("run: né perimetro né aderenza approvati -> il feedback combina i motivi di entrambi", async () => {
    const generator = { generate: async () => ({ draft: { title: "x" }, searchResults: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            scope: { approved: false, reasons: ["fuori tema"] },
            adherence: { adherent: false, reasons: ["contenuto non supportato dalle fonti"] },
            bestPractice: { upToDate: true, reasons: [] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 1,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.deepEqual(result.issues, ["fuori tema", "contenuto non supportato dalle fonti"]);
});

test("run: best practice non rispettata -> ripete con feedback e poi ha successo", async () => {
    const reviewCalls = [];
    let attempt = 0;
    const generator = {
        generate: async () => {
            attempt += 1;
            return { draft: { title: `bozza-${attempt}` }, searchResults: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async (topic, data) => {
            reviewCalls.push(data.title);
            return data.title === "bozza-1"
                ? { scope: { approved: true, reasons: [] }, adherence: { adherent: true, reasons: [] }, bestPractice: { upToDate: false, reasons: ["usa una sintassi deprecata"] } }
                : { scope: { approved: true, reasons: [] }, adherence: { adherent: true, reasons: [] }, bestPractice: { upToDate: true, reasons: [] } };
        },
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "success");
    assert.equal(result.attempts, 2);
    assert.deepEqual(reviewCalls, ["bozza-1", "bozza-2"]);
});

test("run: best practice mai rispettata -> esaurisce i tentativi con motivo 'validation'", async () => {
    const generator = { generate: async () => ({ draft: { title: "x" }, searchResults: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            scope: { approved: true, reasons: [] },
            adherence: { adherent: true, reasons: [] },
            bestPractice: { upToDate: false, reasons: ["usa una sintassi deprecata"] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: silentLogger, maxAttempts: 2,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "validation");
    assert.deepEqual(result.issues, ["usa una sintassi deprecata"]);
    assert.equal(result.attempts, 2);
});

test("run: scrittura su disco fallita -> si ferma subito senza ritentare", async () => {
    let generateCalls = 0;
    const generator = {
        generate: async () => {
            generateCalls += 1;
            return { draft: { title: "x" }, searchResults: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const writer = { write: async () => { throw new AgentError("disco pieno", ErrorCodes.WRITE_ERROR); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: approvingReviewer, writer,
        logger: silentLogger, maxAttempts: 3,
    });
    const result = await orchestrator.run("argomento");

    assert.equal(result.status, "failed");
    assert.equal(result.reason, "write");
    assert.equal(result.attempts, 1);
    assert.equal(generateCalls, 1);
});
