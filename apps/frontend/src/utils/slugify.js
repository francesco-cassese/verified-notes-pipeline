// Stessa logica di slugify usata lato server (apps/backend/utils/safePath.js) per
// generare id di sezione coerenti con i link dell'indice: minuscolo,
// niente diacritici, solo [a-z0-9-].
export function slugify(text) {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
