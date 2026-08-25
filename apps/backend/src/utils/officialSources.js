// Whitelist curata di domini "ufficiali" (documentazione primaria di linguaggi,
// framework, tool e standard). È inevitabilmente parziale: va estesa a mano
// aggiungendo nuove voci qui quando emergono argomenti non coperti.
const OFFICIAL_DOMAINS = [
    // Web / JavaScript / TypeScript
    "developer.mozilla.org",
    "react.dev",
    "vuejs.org",
    "angular.dev",
    "svelte.dev",
    "nodejs.org",
    "expressjs.com",
    "nextjs.org",
    "typescriptlang.org",
    "npmjs.com",
    "w3.org",
    "whatwg.org",
    "ecma-international.org",
    // Python
    "python.org",
    "pypi.org",
    "djangoproject.com",
    "flask.palletsprojects.com",
    // Java / JVM
    "docs.oracle.com",
    "openjdk.org",
    "kotlinlang.org",
    // Altri linguaggi
    "go.dev",
    "rust-lang.org",
    "php.net",
    "ruby-lang.org",
    "learn.microsoft.com",
    "dotnet.microsoft.com",
    "swift.org",
    "developer.apple.com",
    "cppreference.com",
    "isocpp.org",
    // PHP e framework/tool dell'ecosistema (specializzazione)
    "laravel.com",
    "symfony.com",
    "getcomposer.org",
    "phpunit.de",
    "packagist.org",
    "php-fig.org",
    "wordpress.org",
    "developer.wordpress.org",
    // Database
    "postgresql.org",
    "dev.mysql.com",
    "mongodb.com",
    "redis.io",
    "sqlite.org",
    "elastic.co",
    "kafka.apache.org",
    // Infrastruttura / DevOps
    "docs.docker.com",
    "kubernetes.io",
    "git-scm.com",
    "docs.github.com",
    "aws.amazon.com",
    "cloud.google.com",
    "terraform.io",
    "nginx.org",
    // Systems
    "kernel.org",
    "man7.org",
    // Stack di questo progetto
    "zod.dev",
    "js.langchain.com",
    "docs.langchain.com",
    "docs.anthropic.com",
    "pnpm.io",
    // Altri framework/tool comuni
    "graphql.org",
    "spring.io",
    "tailwindcss.com",
    "webpack.js.org",
    "vitejs.dev",
    "jestjs.io",
];

function getHostname(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

// Considera ufficiale anche un sottodominio di un dominio in whitelist
// (es. "docs.python.org" è coperto da "python.org").
function isOfficialUrl(url) {
    const hostname = getHostname(url);
    if (!hostname) return false;
    return OFFICIAL_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export { OFFICIAL_DOMAINS, isOfficialUrl };
