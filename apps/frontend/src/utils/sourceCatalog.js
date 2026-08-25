// Etichetta ed emoji per le fonti ufficiali più comuni, per categorizzare la
// lista "Risorse e Documentazione" invece di mostrare solo link nudi (stessi
// domini di apps/backend/src/utils/officialSources.js, tenuti a mano in
// sincronia: sono due pacchetti separati, non c'è un modulo condiviso da cui
// importarli in entrambi).
const CATALOGO_FONTI = [
    { dominio: "developer.mozilla.org", emoji: "📚", etichetta: "MDN Web Docs" },
    { dominio: "react.dev", emoji: "⚛️", etichetta: "React" },
    { dominio: "vuejs.org", emoji: "💚", etichetta: "Vue.js" },
    { dominio: "angular.dev", emoji: "🅰️", etichetta: "Angular" },
    { dominio: "svelte.dev", emoji: "🧡", etichetta: "Svelte" },
    { dominio: "nodejs.org", emoji: "🟢", etichetta: "Node.js" },
    { dominio: "expressjs.com", emoji: "🚂", etichetta: "Express" },
    { dominio: "nextjs.org", emoji: "▲", etichetta: "Next.js" },
    { dominio: "typescriptlang.org", emoji: "🔷", etichetta: "TypeScript" },
    { dominio: "npmjs.com", emoji: "📦", etichetta: "npm" },
    { dominio: "w3.org", emoji: "🌐", etichetta: "W3C" },
    { dominio: "whatwg.org", emoji: "🌐", etichetta: "WHATWG" },
    { dominio: "ecma-international.org", emoji: "📜", etichetta: "ECMA" },
    { dominio: "python.org", emoji: "🐍", etichetta: "Python" },
    { dominio: "pypi.org", emoji: "📦", etichetta: "PyPI" },
    { dominio: "djangoproject.com", emoji: "🎸", etichetta: "Django" },
    { dominio: "flask.palletsprojects.com", emoji: "🧪", etichetta: "Flask" },
    { dominio: "docs.oracle.com", emoji: "☕", etichetta: "Oracle Docs" },
    { dominio: "openjdk.org", emoji: "☕", etichetta: "OpenJDK" },
    { dominio: "kotlinlang.org", emoji: "🅺", etichetta: "Kotlin" },
    { dominio: "go.dev", emoji: "🐹", etichetta: "Go" },
    { dominio: "rust-lang.org", emoji: "🦀", etichetta: "Rust" },
    { dominio: "php.net", emoji: "🐘", etichetta: "PHP" },
    { dominio: "ruby-lang.org", emoji: "💎", etichetta: "Ruby" },
    { dominio: "learn.microsoft.com", emoji: "🪟", etichetta: "Microsoft Learn" },
    { dominio: "dotnet.microsoft.com", emoji: "🟣", etichetta: ".NET" },
    { dominio: "swift.org", emoji: "🐦", etichetta: "Swift" },
    { dominio: "developer.apple.com", emoji: "🍎", etichetta: "Apple Developer" },
    { dominio: "cppreference.com", emoji: "➕", etichetta: "C++ Reference" },
    { dominio: "isocpp.org", emoji: "➕", etichetta: "ISO C++" },
    { dominio: "laravel.com", emoji: "🔺", etichetta: "Laravel" },
    { dominio: "symfony.com", emoji: "🎼", etichetta: "Symfony" },
    { dominio: "getcomposer.org", emoji: "🎼", etichetta: "Composer" },
    { dominio: "phpunit.de", emoji: "✅", etichetta: "PHPUnit" },
    { dominio: "packagist.org", emoji: "📦", etichetta: "Packagist" },
    { dominio: "php-fig.org", emoji: "📐", etichetta: "PHP-FIG" },
    { dominio: "wordpress.org", emoji: "📝", etichetta: "WordPress" },
    { dominio: "developer.wordpress.org", emoji: "📝", etichetta: "WordPress" },
    { dominio: "postgresql.org", emoji: "🐘", etichetta: "PostgreSQL" },
    { dominio: "dev.mysql.com", emoji: "🐬", etichetta: "MySQL" },
    { dominio: "mongodb.com", emoji: "🍃", etichetta: "MongoDB" },
    { dominio: "redis.io", emoji: "🟥", etichetta: "Redis" },
    { dominio: "sqlite.org", emoji: "🗄️", etichetta: "SQLite" },
    { dominio: "elastic.co", emoji: "🔍", etichetta: "Elastic" },
    { dominio: "kafka.apache.org", emoji: "📨", etichetta: "Kafka" },
    { dominio: "docs.docker.com", emoji: "🐳", etichetta: "Docker" },
    { dominio: "kubernetes.io", emoji: "☸️", etichetta: "Kubernetes" },
    { dominio: "git-scm.com", emoji: "🔧", etichetta: "Git" },
    { dominio: "docs.github.com", emoji: "🐙", etichetta: "GitHub" },
    { dominio: "aws.amazon.com", emoji: "☁️", etichetta: "AWS" },
    { dominio: "cloud.google.com", emoji: "☁️", etichetta: "Google Cloud" },
    { dominio: "terraform.io", emoji: "🏗️", etichetta: "Terraform" },
    { dominio: "nginx.org", emoji: "🌐", etichetta: "Nginx" },
    { dominio: "kernel.org", emoji: "🐧", etichetta: "Kernel.org" },
    { dominio: "man7.org", emoji: "📖", etichetta: "man7" },
    { dominio: "zod.dev", emoji: "🧩", etichetta: "Zod" },
    { dominio: "js.langchain.com", emoji: "🦜", etichetta: "LangChain" },
    { dominio: "docs.langchain.com", emoji: "🦜", etichetta: "LangChain" },
    { dominio: "docs.anthropic.com", emoji: "🤖", etichetta: "Anthropic" },
    { dominio: "pnpm.io", emoji: "📦", etichetta: "pnpm" },
    { dominio: "graphql.org", emoji: "◈", etichetta: "GraphQL" },
    { dominio: "spring.io", emoji: "🌱", etichetta: "Spring" },
    { dominio: "tailwindcss.com", emoji: "🎨", etichetta: "Tailwind CSS" },
    { dominio: "webpack.js.org", emoji: "📦", etichetta: "Webpack" },
    { dominio: "vitejs.dev", emoji: "⚡", etichetta: "Vite" },
    { dominio: "jestjs.io", emoji: "🃏", etichetta: "Jest" },
];

function getHostname(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

// Fallback per un dominio ufficiale non ancora presente nel catalogo sopra:
// emoji generica, etichetta ricavata dall'hostname invece di lasciare la riga
// senza alcuna categorizzazione.
export function infoFonte(url) {
    const hostname = getHostname(url);
    if (hostname) {
        const voce = CATALOGO_FONTI.find((v) => hostname === v.dominio || hostname.endsWith(`.${v.dominio}`));
        if (voce) return { emoji: voce.emoji, etichetta: voce.etichetta };
    }
    return { emoji: "🔗", etichetta: hostname || url };
}
