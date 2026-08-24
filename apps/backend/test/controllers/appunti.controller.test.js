import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import createAppuntiController from "../../src/controllers/appunti.controller.js";

function creaServer(orchestratorFinto) {
    const app = express();
    app.use(express.json());
    const controller = createAppuntiController(orchestratorFinto, { listCartelle: async () => [] }, "notesDir-test");
    app.post("/api/appunti", controller.generaAppunto);
    return http.createServer(app);
}

function parseEventiSSE(testo) {
    return testo
        .split("\n\n")
        .filter(Boolean)
        .map((blocco) => {
            const righe = blocco.split("\n");
            const evento = righe.find((r) => r.startsWith("event:")).slice("event:".length).trim();
            const dati = JSON.parse(righe.find((r) => r.startsWith("data:")).slice("data:".length).trim());
            return { evento, dati };
        });
}

async function avviaServer(server) {
    await new Promise((resolve) => server.listen(0, resolve));
    return server.address().port;
}

test("generaAppunto: inoltra le fasi dell'orchestrator e chiude con risultato di successo", async () => {
    const orchestratorFinto = {
        run: async (argomento, { onFase }) => {
            onFase({ fase: "ricerca", messaggio: "Ricerca...", tentativo: 1, tentativiMax: 3 });
            onFase({ fase: "generazione", messaggio: "Generazione...", tentativo: 1, tentativiMax: 3 });
            return { status: "success", note: { titolo: "Fake" }, attempts: 1 };
        },
    };
    const server = creaServer(orchestratorFinto);
    const port = await avviaServer(server);

    try {
        const risposta = await fetch(`http://localhost:${port}/api/appunti`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ argomento: "react hooks" }),
        });

        assert.equal(risposta.headers.get("content-type"), "text/event-stream; charset=utf-8");

        const eventi = parseEventiSSE(await risposta.text());

        assert.equal(eventi.length, 3);
        assert.equal(eventi[0].dati.fase, "ricerca");
        assert.equal(eventi[1].dati.fase, "generazione");
        assert.equal(eventi[2].evento, "risultato");
        assert.equal(eventi[2].dati.esito, "successo");
        assert.equal(eventi[2].dati.nota.titolo, "Fake");
    } finally {
        server.close();
    }
});

test("generaAppunto: argomento non valido -> subito un evento risultato di errore, nessuna fase", async () => {
    const orchestratorFinto = { run: async () => { throw new Error("non deve essere chiamato"); } };
    const server = creaServer(orchestratorFinto);
    const port = await avviaServer(server);

    try {
        const risposta = await fetch(`http://localhost:${port}/api/appunti`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ argomento: "ab" }),
        });

        const eventi = parseEventiSSE(await risposta.text());

        assert.equal(eventi.length, 1);
        assert.equal(eventi[0].evento, "risultato");
        assert.equal(eventi[0].dati.esito, "errore");
        assert.ok(eventi[0].dati.issues.length > 0);
    } finally {
        server.close();
    }
});

test("generaAppunto: l'orchestrator fallisce -> evento risultato di errore col motivo", async () => {
    const orchestratorFinto = {
        run: async (argomento, { onFase }) => {
            onFase({ fase: "ricerca", messaggio: "Ricerca...", tentativo: 1, tentativiMax: 3 });
            return { status: "failed", reason: "no_official_source", attempts: 1 };
        },
    };
    const server = creaServer(orchestratorFinto);
    const port = await avviaServer(server);

    try {
        const risposta = await fetch(`http://localhost:${port}/api/appunti`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ argomento: "react hooks" }),
        });

        const eventi = parseEventiSSE(await risposta.text());

        assert.equal(eventi.at(-1).evento, "risultato");
        assert.equal(eventi.at(-1).dati.esito, "errore");
        assert.equal(eventi.at(-1).dati.motivo, "no_official_source");
    } finally {
        server.close();
    }
});
