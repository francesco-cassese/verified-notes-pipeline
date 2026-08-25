import fs from "node:fs/promises";
import path from "node:path";
import { AgentError, ErrorCodes } from "./errors.js";
import { resolveSafeReadPath, isNomeCartellaValido } from "./safePath.js";

// Estrae solo i campi che servono per l'elenco/anteprima da un frontmatter
// YAML scritto da writerAgent (formato fisso, vedi buildMarkdown): una regex
// mirata basta ed evita di aggiungere un parser YAML completo solo per questo.
function estraiFrontmatter(contenuto) {
    const match = contenuto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, corpo: contenuto };

    const [, blocco, corpo] = match;
    const campo = (nome) => blocco.match(new RegExp(`^${nome}: "(.*)"$`, "m"))?.[1]
        ?? blocco.match(new RegExp(`^${nome}: (.+)$`, "m"))?.[1];

    return {
        meta: {
            titolo: campo("titolo") ?? "",
            modulo: campo("modulo") ?? "",
            argomento: campo("argomento") ?? "",
            id: campo("id") ?? "",
            creatoIl: campo("creatoIl") ?? "",
        },
        corpo: corpo.trim(),
    };
}

async function esisteCartella(baseDir, cartella) {
    try {
        const stat = await fs.stat(path.join(baseDir, cartella));
        return stat.isDirectory();
    } catch {
        return false;
    }
}

// Elenca le sottocartelle di baseDir (una per modulo/tecnologia) con il
// numero di appunti (.md) contenuti, ordinate alfabeticamente.
async function listCartelle(baseDir) {
    let voci;
    try {
        voci = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
        return [];
    }

    const cartelle = voci.filter((v) => v.isDirectory()).map((v) => v.name);

    const risultati = await Promise.all(
        cartelle.map(async (cartella) => {
            const file = await fs.readdir(path.join(baseDir, cartella));
            const numeroAppunti = file.filter((f) => f.endsWith(".md")).length;
            return { cartella, numeroAppunti };
        })
    );

    return risultati
        .filter((r) => r.numeroAppunti > 0)
        .sort((a, b) => a.cartella.localeCompare(b.cartella));
}

// Elenca gli appunti (.md) di una cartella con i metadati minimi per una
// lista (titolo, data): legge il sidecar .json quando c'è (più veloce e
// affidabile), altrimenti ripiega sul frontmatter del .md.
async function listAppunti(baseDir, cartella) {
    if (!isNomeCartellaValido(cartella)) {
        throw new AgentError("Nome cartella non valido.", ErrorCodes.PATH_TRAVERSAL_ERROR);
    }

    if (!(await esisteCartella(baseDir, cartella))) {
        throw new AgentError(`Cartella "${cartella}" non trovata.`, ErrorCodes.NOT_FOUND_ERROR);
    }

    const dir = path.join(baseDir, cartella);
    const file = await fs.readdir(dir);
    const nomiMd = file.filter((f) => f.endsWith(".md"));

    const appunti = await Promise.all(
        nomiMd.map(async (nomeFile) => {
            const jsonPath = path.join(dir, nomeFile.replace(/\.md$/, ".json"));

            try {
                const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
                return { nomeFile, titolo: json.titolo, creatoIl: json.creatoIl, id: json.id };
            } catch {
                const contenuto = await fs.readFile(path.join(dir, nomeFile), "utf-8");
                const { meta } = estraiFrontmatter(contenuto);
                return { nomeFile, titolo: meta.titolo, creatoIl: meta.creatoIl, id: meta.id };
            }
        })
    );

    return appunti.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
}

// Legge un singolo appunto: preferisce il sidecar .json (dati strutturati,
// stesso formato usato subito dopo la generazione) e ripiega sul .md grezzo
// (frontmatter + corpo markdown) per gli appunti scritti prima che il
// sidecar esistesse.
async function leggiAppunto(baseDir, cartella, nomeFile) {
    const mdPath = resolveSafeReadPath(baseDir, cartella, nomeFile);
    const jsonPath = mdPath.replace(/\.md$/, ".json");

    try {
        const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
        return { formato: "json", nota: json };
    } catch {
        let contenuto;
        try {
            contenuto = await fs.readFile(mdPath, "utf-8");
        } catch {
            throw new AgentError(`Appunto "${cartella}/${nomeFile}" non trovato.`, ErrorCodes.NOT_FOUND_ERROR);
        }
        const { meta, corpo } = estraiFrontmatter(contenuto);
        return { formato: "markdown", meta, corpo };
    }
}

// Parole di collegamento (italiano/inglese, i due idiomi in cui un argomento
// viene tipicamente digitato) ignorate nel confronto tra argomenti: senza
// questo filtro "foreach in PHP" e "PHP foreach" risultano argomenti diversi
// solo per l'ordine delle parole e una preposizione, mentre sono chiaramente
// la stessa richiesta.
const PAROLE_IGNORATE = new Set([
    "il", "lo", "la", "i", "gli", "le", "un", "uno", "una",
    "di", "del", "dello", "della", "dei", "degli", "delle",
    "a", "al", "allo", "alla", "ai", "agli", "alle",
    "in", "con", "su", "per", "tra", "fra", "e", "ed", "o",
    "the", "an", "of", "on", "for", "to", "and",
]);

// Riduce un argomento a un insieme ordinato di parole significative
// (minuscolo, senza punteggiatura, senza duplicati, senza parole di
// collegamento): due argomenti con le stesse parole chiave ma ordine o
// preposizioni diversi producono la stessa chiave, quindi risultano uguali.
function chiaveArgomento(testo) {
    const parole = (testo.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        .filter((parola) => !PAROLE_IGNORATE.has(parola));
    return [...new Set(parole)].sort().join(" ");
}

// Cerca tra tutti gli appunti già salvati uno con lo stesso argomento
// (confronto per parole chiave sul campo "argomento", non sul titolo scelto
// dal modello, che può differire dalla richiesta originale): permette al
// controller di rifiutare una generazione duplicata prima di avviare la
// pipeline (ricerca + più chiamate LLM, tutte a pagamento) invece di scoprire
// il doppione solo a fine generazione. Stessa strategia json-poi-frontmatter
// di listAppunti/leggiAppunto sopra.
async function trovaAppuntoPerArgomento(baseDir, argomento) {
    const chiaveCercata = chiaveArgomento(argomento);
    const cartelle = await listCartelle(baseDir);

    for (const { cartella } of cartelle) {
        const dir = path.join(baseDir, cartella);
        const nomiMd = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));

        for (const nomeFile of nomiMd) {
            const jsonPath = path.join(dir, nomeFile.replace(/\.md$/, ".json"));
            let argomentoSalvato;
            let titolo;

            try {
                const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
                argomentoSalvato = json.argomento;
                titolo = json.titolo;
            } catch {
                const contenuto = await fs.readFile(path.join(dir, nomeFile), "utf-8");
                ({ argomento: argomentoSalvato, titolo } = estraiFrontmatter(contenuto).meta);
            }

            if (argomentoSalvato && chiaveArgomento(argomentoSalvato) === chiaveCercata) {
                return { cartella, nomeFile, titolo };
            }
        }
    }

    return null;
}

export { listCartelle, listAppunti, leggiAppunto, trovaAppuntoPerArgomento };
