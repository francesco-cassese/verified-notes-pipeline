import { test } from "node:test";
import assert from "node:assert/strict";
import createNoteOrchestrator from "../../../src/ai/orchestrator/noteOrchestrator.js";
import { AgentError, ErrorCodes } from "../../../src/utils/errors.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };
const reviewerApprova = {
    review: async () => ({
        perimetro: { approvato: true, motivi: [] },
        aderenza: { aderente: true, motivi: [] },
    }),
};

test("run: successo al primo tentativo, risultatiRicerca arriva al validatore come elenco di URL", async () => {
    const chiamateValidate = [];
    const generator = {
        generate: async () => ({
            draft: { titolo: "bozza" },
            risultatiRicerca: [{ title: "React", url: "https://react.dev/a", contenuto: "testo" }],
        }),
    };
    const validator = {
        validate: (draft, fontiRecuperate) => {
            chiamateValidate.push(fontiRecuperate);
            return { success: true, data: draft };
        },
    };
    const writer = { write: async (data) => ({ ...data, id: "1" }) };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: reviewerApprova, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("react hooks");

    assert.equal(risultato.status, "success");
    assert.equal(risultato.attempts, 1);
    assert.deepEqual(chiamateValidate[0], ["https://react.dev/a"]);
});

test("run: validazione fallita al primo tentativo, il feedback arriva al tentativo successivo", async () => {
    const chiamateGenerate = [];
    let tentativo = 0;
    const generator = {
        generate: async (argomento, opts) => {
            tentativo += 1;
            chiamateGenerate.push(opts.feedback);
            return { draft: { titolo: `bozza-${tentativo}` }, risultatiRicerca: [] };
        },
    };
    const validator = {
        validate: (draft) => (draft.titolo === "bozza-1"
            ? { success: false, issues: ["titolo troppo generico"] }
            : { success: true, data: draft }),
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: reviewerApprova, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("react hooks");

    assert.equal(risultato.status, "success");
    assert.equal(risultato.attempts, 2);
    assert.deepEqual(chiamateGenerate[0], []);
    assert.deepEqual(chiamateGenerate[1], ["titolo troppo generico"]);
});

test("run: le fonti trovate al primo tentativo vengono riusate (in cache) nei retry successivi", async () => {
    const chiamateGenerate = [];
    let tentativo = 0;
    const fontiTrovate = [{ title: "React", url: "https://react.dev/a", contenuto: "testo" }];
    const generator = {
        generate: async (argomento, opts) => {
            tentativo += 1;
            chiamateGenerate.push(opts.risultatiRicercaCache);
            return { draft: { titolo: `bozza-${tentativo}` }, risultatiRicerca: fontiTrovate };
        },
    };
    const validator = {
        validate: (draft) => (draft.titolo === "bozza-1"
            ? { success: false, issues: ["titolo troppo generico"] }
            : { success: true, data: draft }),
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: reviewerApprova, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    await orchestrator.run("react hooks");

    assert.equal(chiamateGenerate[0], null);
    assert.equal(chiamateGenerate[1], fontiTrovate);
});

test("run: nessuna fonte ufficiale -> si ferma subito senza ritentare", async () => {
    let chiamate = 0;
    const generator = {
        generate: async () => {
            chiamate += 1;
            throw new AgentError("nessuna fonte", ErrorCodes.NO_OFFICIAL_SOURCE_ERROR);
        },
    };
    const validator = { validate: () => { throw new Error("non deve essere chiamato"); } };
    const reviewer = { review: async () => { throw new Error("non deve essere chiamato"); } };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: loggerSilenzioso, maxAttempts: 3 });
    const risultato = await orchestrator.run("argomento oscuro");

    assert.equal(risultato.status, "failed");
    assert.equal(risultato.reason, "no_official_source");
    assert.equal(risultato.attempts, 1);
    assert.equal(chiamate, 1);
});

test("run: la generazione fallisce sempre -> esaurisce tutti i tentativi", async () => {
    let chiamate = 0;
    const generator = {
        generate: async () => {
            chiamate += 1;
            throw new AgentError("boom", ErrorCodes.GENERATION_ERROR);
        },
    };
    const validator = { validate: () => { throw new Error("non deve essere chiamato"); } };
    const reviewer = { review: async () => { throw new Error("non deve essere chiamato"); } };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: loggerSilenzioso, maxAttempts: 3 });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "failed");
    assert.equal(risultato.reason, "generation");
    assert.equal(risultato.attempts, 3);
    assert.equal(chiamate, 3);
});

test("run: la bozza viola lo schema (OutputParserException) -> gli issues arrivano come feedback al tentativo successivo", async () => {
    const chiamateGenerate = [];
    let tentativo = 0;
    const generator = {
        generate: async (argomento, opts) => {
            tentativo += 1;
            chiamateGenerate.push(opts.feedback);
            if (tentativo === 1) {
                const errore = new AgentError("bozza fuori schema", ErrorCodes.GENERATION_ERROR);
                errore.issues = ['Il campo "erroriComuni.1.soluzione" non rispetta lo schema: troppo lungo'];
                throw errore;
            }
            return { draft: { titolo: "bozza-2" }, risultatiRicerca: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: reviewerApprova, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "success");
    assert.deepEqual(chiamateGenerate[0], []);
    assert.deepEqual(chiamateGenerate[1], ['Il campo "erroriComuni.1.soluzione" non rispetta lo schema: troppo lungo']);
});

test("run: il verdetto del reviewer viola lo schema (OutputParserException) -> gli issues arrivano come feedback al tentativo successivo", async () => {
    const chiamateGenerate = [];
    let tentativo = 0;
    const generator = {
        generate: async (argomento, opts) => {
            tentativo += 1;
            chiamateGenerate.push(opts.feedback);
            return { draft: { titolo: `bozza-${tentativo}` }, risultatiRicerca: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => {
            if (tentativo === 1) {
                const errore = new AgentError("verdetto fuori schema", ErrorCodes.GENERATION_ERROR);
                errore.issues = ['Il campo "perimetro" non rispetta lo schema: atteso oggetto, ricevuta stringa'];
                throw errore;
            }
            return { perimetro: { approvato: true, motivi: [] }, aderenza: { aderente: true, motivi: [] } };
        },
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "success");
    assert.deepEqual(chiamateGenerate[0], []);
    assert.deepEqual(chiamateGenerate[1], ['Il campo "perimetro" non rispetta lo schema: atteso oggetto, ricevuta stringa']);
});

test("run: perimetro mai approvato -> esaurisce i tentativi con motivo 'validation'", async () => {
    const generator = { generate: async () => ({ draft: { titolo: "x" }, risultatiRicerca: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            perimetro: { approvato: false, motivi: ["fuori tema"] },
            aderenza: { aderente: true, motivi: [] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({ generator, validator, reviewer, writer, logger: loggerSilenzioso, maxAttempts: 2 });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "failed");
    assert.equal(risultato.reason, "validation");
    assert.deepEqual(risultato.issues, ["fuori tema"]);
    assert.equal(risultato.attempts, 2);
});

test("run: bozza non aderente alle fonti -> ripete con feedback e poi ha successo", async () => {
    const chiamateControllo = [];
    let tentativo = 0;
    const generator = {
        generate: async () => {
            tentativo += 1;
            return { draft: { titolo: `bozza-${tentativo}` }, risultatiRicerca: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async (argomento, data) => {
            chiamateControllo.push(data.titolo);
            return data.titolo === "bozza-1"
                ? { perimetro: { approvato: true, motivi: [] }, aderenza: { aderente: false, motivi: ["descrive un'API non presente negli estratti"] } }
                : { perimetro: { approvato: true, motivi: [] }, aderenza: { aderente: true, motivi: [] } };
        },
    };
    const writer = { write: async (data) => data };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "success");
    assert.equal(risultato.attempts, 2);
    assert.deepEqual(chiamateControllo, ["bozza-1", "bozza-2"]);
});

test("run: bozza mai aderente alle fonti -> esaurisce i tentativi con motivo 'validation'", async () => {
    const generator = { generate: async () => ({ draft: { titolo: "x" }, risultatiRicerca: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            perimetro: { approvato: true, motivi: [] },
            aderenza: { aderente: false, motivi: ["contenuto non supportato dalle fonti"] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: loggerSilenzioso, maxAttempts: 2,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "failed");
    assert.equal(risultato.reason, "validation");
    assert.deepEqual(risultato.issues, ["contenuto non supportato dalle fonti"]);
    assert.equal(risultato.attempts, 2);
});

test("run: né perimetro né aderenza approvati -> il feedback combina i motivi di entrambi", async () => {
    const generator = { generate: async () => ({ draft: { titolo: "x" }, risultatiRicerca: [] }) };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const reviewer = {
        review: async () => ({
            perimetro: { approvato: false, motivi: ["fuori tema"] },
            aderenza: { aderente: false, motivi: ["contenuto non supportato dalle fonti"] },
        }),
    };
    const writer = { write: async () => { throw new Error("non deve essere chiamato"); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer, writer,
        logger: loggerSilenzioso, maxAttempts: 1,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "failed");
    assert.deepEqual(risultato.issues, ["fuori tema", "contenuto non supportato dalle fonti"]);
});

test("run: scrittura su disco fallita -> si ferma subito senza ritentare", async () => {
    let chiamateGenerate = 0;
    const generator = {
        generate: async () => {
            chiamateGenerate += 1;
            return { draft: { titolo: "x" }, risultatiRicerca: [] };
        },
    };
    const validator = { validate: (draft) => ({ success: true, data: draft }) };
    const writer = { write: async () => { throw new AgentError("disco pieno", ErrorCodes.WRITE_ERROR); } };

    const orchestrator = createNoteOrchestrator({
        generator, validator, reviewer: reviewerApprova, writer,
        logger: loggerSilenzioso, maxAttempts: 3,
    });
    const risultato = await orchestrator.run("argomento");

    assert.equal(risultato.status, "failed");
    assert.equal(risultato.reason, "write");
    assert.equal(risultato.attempts, 1);
    assert.equal(chiamateGenerate, 1);
});
