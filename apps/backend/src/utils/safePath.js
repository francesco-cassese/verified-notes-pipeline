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
// Ogni appunto va in <baseDir>/<module>/<file>: un solo livello di sottocartella,
// anch'esso passato da slugify (quindi mai un input libero). Il controllo di
// contenimento sotto verifica che il percorso risolto corrisponda esattamente
// a quella struttura prevista, né più annidata né fuori da baseDir.
function resolveSafeNotePath(baseDir, rawTitle, rawModule) {
    const slug = slugify(rawTitle);
    const folder = slugify(rawModule);
    const suffix = crypto.randomUUID().slice(0, 8);
    const fileName = `${slug}-${suffix}.md`;
    const relativePath = path.join(folder, fileName);

    const resolvedBase = path.resolve(baseDir);
    const filePath = path.resolve(resolvedBase, relativePath);

    // Controllo di contenimento: è la vera difesa (lo slugify sopra è difesa in
    // profondità). Il percorso risolto deve corrispondere esattamente a
    // "<folder>/<fileName>" dentro baseDir: niente risalite (..), niente path
    // assoluti, niente livelli di annidamento in più rispetto a quello previsto.
    const relative = path.relative(resolvedBase, filePath);

    if (relative !== relativePath) {
        throw new AgentError(
            "Percorso del file non sicuro: tentativo di scrittura fuori dalla directory degli appunti.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    return { filePath, fileName, folder, relativePath };
}

// Nome cartella/file già slugificato in scrittura (vedi resolveSafeNotePath):
// qui, in lettura, l'input arriva invece grezzo dai parametri URL, quindi va
// validato con una whitelist stretta invece di essere ri-slugificato (un
// fileName ri-slugificato non corrisponderebbe più al file realmente su disco).
const VALID_FOLDER_NAME = /^[a-z0-9-]+$/;
const VALID_FILE_NAME = /^[a-z0-9-]+\.(md|json)$/;

// Stesso controllo di contenimento di resolveSafeNotePath, ma per la lettura:
// folder e fileName devono già rispettare il formato prodotto in scrittura,
// e il percorso risolto deve restare dentro baseDir senza risalite (..).
function resolveSafeReadPath(baseDir, folder, fileName) {
    if (!VALID_FOLDER_NAME.test(folder) || !VALID_FILE_NAME.test(fileName)) {
        throw new AgentError(
            "Percorso non valido: cartella o nome file non ammessi.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    const resolvedBase = path.resolve(baseDir);
    const relativePath = path.join(folder, fileName);
    const filePath = path.resolve(resolvedBase, relativePath);
    const relative = path.relative(resolvedBase, filePath);

    if (relative !== relativePath) {
        throw new AgentError(
            "Percorso del file non sicuro: tentativo di lettura fuori dalla directory degli appunti.",
            ErrorCodes.PATH_TRAVERSAL_ERROR
        );
    }

    return filePath;
}

// Usata anche per validare :folder nell'elenco appunti (non solo nella
// lettura di un singolo file): stessa whitelist, nessuna risalita possibile.
function isValidFolderName(folder) {
    return VALID_FOLDER_NAME.test(folder);
}

export { slugify, resolveSafeNotePath, resolveSafeReadPath, isValidFolderName };
