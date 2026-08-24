import { slugify } from "./safePath.js";

// Mapping "modulo dedotto dal Sintetizzatore" (case-insensitive) -> cartella
// canonica. Evita la deriva di cartelle quasi-duplicate che si creerebbe usando
// lo slug grezzo del modulo (es. "React" vs "React.js" vs "ReactJS" finirebbero
// altrimenti in 3 cartelle diverse). Va estesa a mano quando compaiono nuovi
// moduli ricorrenti non ancora mappati.
const MODULE_FOLDER_MAP = {
    "react": "react",
    "react.js": "react",
    "reactjs": "react",
    "next.js": "react",
    "nextjs": "react",
    "vue": "vue",
    "vue.js": "vue",
    "vuejs": "vue",
    "angular": "angular",
    "svelte": "svelte",
    "node": "node",
    "node.js": "node",
    "nodejs": "node",
    "express": "node",
    "express.js": "node",
    "typescript": "typescript",
    "javascript": "javascript",
    "js": "javascript",
    "python": "python",
    "django": "python",
    "flask": "python",
    "java": "java",
    "kotlin": "kotlin",
    "go": "go",
    "golang": "go",
    "rust": "rust",
    "php": "php",
    "laravel": "php",
    "symfony": "php",
    "composer": "php",
    "phpunit": "php",
    "wordpress": "php",
    "ruby": "ruby",
    "c#": "dotnet",
    "csharp": "dotnet",
    ".net": "dotnet",
    "dotnet": "dotnet",
    "sql": "database",
    "postgresql": "database",
    "postgres": "database",
    "mysql": "database",
    "mongodb": "database",
    "redis": "database",
    "sqlite": "database",
    "docker": "devops",
    "kubernetes": "devops",
    "k8s": "devops",
    "git": "git",
    "github": "git",
    "aws": "cloud",
    "azure": "cloud",
    "gcp": "cloud",
    "google cloud": "cloud",
    "linux": "sistemi",
    "html": "web",
    "css": "web",
};

// Modulo non presente in mappa: fallback allo slug diretto (stesso identico
// esito di prima) ma segnalato nei log, così la mappa può crescere nel tempo
// senza mai bloccare la generazione di un appunto.
function resolveCartella(modulo, logger) {
    const chiave = String(modulo).trim().toLowerCase();
    const cartella = MODULE_FOLDER_MAP[chiave];

    if (cartella) return cartella;

    logger?.warn("archivistaAgent", "Modulo non presente nella mappa, uso slug diretto", { modulo });
    return slugify(modulo);
}

export { MODULE_FOLDER_MAP, resolveCartella };
