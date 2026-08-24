import path from "node:path";
import crypto from "node:crypto";
import { AgentError, ErrorCodes } from "./errors.js";

const MAX_SLUG_LENGTH = 80;

// Whitelist di soli [a-z0-9-]: più sicuro di una blacklist di ".." perché
// qualsiasi carattere non previsto (inclusi "/", "\", "..") diventa "-" invece
// di dover essere enumerato esplicitamente come pericoloso.
function slugify(input) {
    if (typeof input !== "string" || input.length === 0 || input.includes("\0")) {
        throw new AgentError(
            "Impossibile generare un nome file: titolo mancante o non valido.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    const slug = input
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // rimuove i diacritici (es. "e" + accento -> "e")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, MAX_SLUG_LENGTH);

    if (slug.length === 0) {
        throw new AgentError(
            "Impossibile generare un nome file: nessun carattere utilizzabile nel titolo.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    return slug;
}

// baseDir è sempre quello fisso da settings.notesDir, mai derivato dalla richiesta.
// Ogni appunto va in <baseDir>/<modulo>/<file>: un solo livello di sottocartella,
// anch'esso passato da slugify (quindi mai un input libero). Il controllo di
// contenimento sotto verifica che il percorso risolto corrisponda esattamente
// a quella struttura prevista, né più annidata né fuori da baseDir.
function resolveSafeNotePath(baseDir, rawTitle, rawModulo) {
    const slug = slugify(rawTitle);
    const cartella = slugify(rawModulo);
    const suffisso = crypto.randomUUID().slice(0, 8);
    const fileName = `${slug}-${suffisso}.md`;
    const percorsoRelativo = path.join(cartella, fileName);

    const resolvedBase = path.resolve(baseDir);
    const filePath = path.resolve(resolvedBase, percorsoRelativo);

    // Controllo di contenimento: è la vera difesa (lo slugify sopra è difesa in
    // profondità). Il percorso risolto deve corrispondere esattamente a
    // "<cartella>/<fileName>" dentro baseDir: niente risalite (..), niente path
    // assoluti, niente livelli di annidamento in più rispetto a quello previsto.
    const relative = path.relative(resolvedBase, filePath);

    if (relative !== percorsoRelativo) {
        throw new AgentError(
            "Percorso del file non sicuro: tentativo di scrittura fuori dalla directory degli appunti.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    return { filePath, fileName, cartella, percorsoRelativo };
}

// Nome cartella/file già slugificato in scrittura (vedi resolveSafeNotePath):
// qui, in lettura, l'input arriva invece grezzo dai parametri URL, quindi va
// validato con una whitelist stretta invece di essere ri-slugificato (un
// nomeFile ri-slugificato non corrisponderebbe più al file realmente su disco).
const NOME_CARTELLA_VALIDO = /^[a-z0-9-]+$/;
const NOME_FILE_VALIDO = /^[a-z0-9-]+\.(md|json)$/;

// Stesso controllo di contenimento di resolveSafeNotePath, ma per la lettura:
// cartella e nomeFile devono già rispettare il formato prodotto in scrittura,
// e il percorso risolto deve restare dentro baseDir senza risalite (..).
function resolveSafeReadPath(baseDir, cartella, nomeFile) {
    if (!NOME_CARTELLA_VALIDO.test(cartella) || !NOME_FILE_VALIDO.test(nomeFile)) {
        throw new AgentError(
            "Percorso non valido: cartella o nome file non ammessi.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    const resolvedBase = path.resolve(baseDir);
    const percorsoRelativo = path.join(cartella, nomeFile);
    const filePath = path.resolve(resolvedBase, percorsoRelativo);
    const relative = path.relative(resolvedBase, filePath);

    if (relative !== percorsoRelativo) {
        throw new AgentError(
            "Percorso del file non sicuro: tentativo di lettura fuori dalla directory degli appunti.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    return filePath;
}

// Usata anche per validare :cartella nell'elenco appunti (non solo nella
// lettura di un singolo file): stessa whitelist, nessuna risalita possibile.
function isNomeCartellaValido(cartella) {
    return NOME_CARTELLA_VALIDO.test(cartella);
}

export { slugify, resolveSafeNotePath, resolveSafeReadPath, isNomeCartellaValido };
