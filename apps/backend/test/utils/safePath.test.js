import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { slugify, resolveSafeNotePath, resolveSafeReadPath, isNomeCartellaValido } from "../../src/utils/safePath.js";
import { ErrorCodes } from "../../src/utils/errors.js";

test("slugify: minuscolo, spazi e simboli diventano un trattino singolo", () => {
    assert.equal(slugify("Ciao Mondo!!"), "ciao-mondo");
});

test("slugify: rimuove i diacritici", () => {
    assert.equal(slugify("Città è più bella"), "citta-e-piu-bella");
});

test("slugify: taglia a MAX_SLUG_LENGTH (80) caratteri", () => {
    assert.equal(slugify("a".repeat(200)).length, 80);
});

test("slugify: rifiuta input non stringa", () => {
    assert.throws(() => slugify(null), (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR);
});

test("slugify: rifiuta stringa vuota", () => {
    assert.throws(() => slugify(""), (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR);
});

test("slugify: rifiuta null byte", () => {
    assert.throws(() => slugify("a\0b"), (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR);
});

test("slugify: rifiuta input che non produce alcun carattere ammesso", () => {
    assert.throws(() => slugify("!!!"), (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR);
});

test("resolveSafeNotePath: un titolo con tentativo di risalita resta comunque contenuto in baseDir", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    const { filePath } = resolveSafeNotePath(baseDir, "../../../etc/passwd", "../../etc");
    const relative = path.relative(path.resolve(baseDir), filePath);

    assert.ok(!relative.startsWith(".."));
    assert.ok(!path.isAbsolute(relative));
});

test("resolveSafeNotePath: il percorso risultante rispetta <cartella>/<slug>-<suffisso>.md", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    const { fileName, cartella, percorsoRelativo } = resolveSafeNotePath(baseDir, "Il Mio Titolo", "React");

    assert.match(fileName, /^il-mio-titolo-[0-9a-f]{8}\.md$/);
    assert.equal(cartella, "react");
    assert.equal(percorsoRelativo, path.join("react", fileName));
});

test("resolveSafeReadPath: accetta cartella e nomeFile nel formato prodotto in scrittura", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    const filePath = resolveSafeReadPath(baseDir, "react", "hooks-abc12345.md");

    assert.equal(filePath, path.join(path.resolve(baseDir), "react", "hooks-abc12345.md"));
});

test("resolveSafeReadPath: rifiuta una cartella con risalita (..)", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    assert.throws(
        () => resolveSafeReadPath(baseDir, "..", "hooks.md"),
        (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR
    );
});

test("resolveSafeReadPath: rifiuta un nomeFile con separatori di percorso", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    assert.throws(
        () => resolveSafeReadPath(baseDir, "react", "../../etc/passwd.md"),
        (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR
    );
});

test("resolveSafeReadPath: rifiuta estensioni diverse da .md/.json", () => {
    const baseDir = path.join(process.cwd(), "note-di-test");
    assert.throws(
        () => resolveSafeReadPath(baseDir, "react", "hooks.txt"),
        (err) => err.code === ErrorCodes.PATH_TRAVERSAL_ERROR
    );
});

test("isNomeCartellaValido: valida solo [a-z0-9-]", () => {
    assert.equal(isNomeCartellaValido("react-native"), true);
    assert.equal(isNomeCartellaValido("../etc"), false);
    assert.equal(isNomeCartellaValido("React"), false);
});
