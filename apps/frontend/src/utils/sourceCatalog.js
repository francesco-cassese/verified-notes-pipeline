// Etichetta ed emoji per le fonti ufficiali più comuni, per categorizzare la
// lista "Risorse e Documentazione" invece di mostrare solo link nudi (stessi
// domini di apps/backend/src/utils/officialSources.js, tenuti a mano in
// sincronia: sono due pacchetti separati, non c'è un modulo condiviso da cui
// importarli in entrambi).
const SOURCE_CATALOG = [
    { domain: "developer.mozilla.org", emoji: "📚", label: "MDN Web Docs" },
    { domain: "react.dev", emoji: "⚛️", label: "React" },
    { domain: "vuejs.org", emoji: "💚", label: "Vue.js" },
    { domain: "angular.dev", emoji: "🅰️", label: "Angular" },
    { domain: "svelte.dev", emoji: "🧡", label: "Svelte" },
    { domain: "nodejs.org", emoji: "🟢", label: "Node.js" },
    { domain: "expressjs.com", emoji: "🚂", label: "Express" },
    { domain: "nextjs.org", emoji: "▲", label: "Next.js" },
    { domain: "typescriptlang.org", emoji: "🔷", label: "TypeScript" },
    { domain: "npmjs.com", emoji: "📦", label: "npm" },
    { domain: "w3.org", emoji: "🌐", label: "W3C" },
    { domain: "whatwg.org", emoji: "🌐", label: "WHATWG" },
    { domain: "ecma-international.org", emoji: "📜", label: "ECMA" },
    { domain: "python.org", emoji: "🐍", label: "Python" },
    { domain: "pypi.org", emoji: "📦", label: "PyPI" },
    { domain: "djangoproject.com", emoji: "🎸", label: "Django" },
    { domain: "flask.palletsprojects.com", emoji: "🧪", label: "Flask" },
    { domain: "docs.oracle.com", emoji: "☕", label: "Oracle Docs" },
    { domain: "openjdk.org", emoji: "☕", label: "OpenJDK" },
    { domain: "kotlinlang.org", emoji: "🅺", label: "Kotlin" },
    { domain: "go.dev", emoji: "🐹", label: "Go" },
    { domain: "rust-lang.org", emoji: "🦀", label: "Rust" },
    { domain: "php.net", emoji: "🐘", label: "PHP" },
    { domain: "ruby-lang.org", emoji: "💎", label: "Ruby" },
    { domain: "learn.microsoft.com", emoji: "🪟", label: "Microsoft Learn" },
    { domain: "dotnet.microsoft.com", emoji: "🟣", label: ".NET" },
    { domain: "swift.org", emoji: "🐦", label: "Swift" },
    { domain: "developer.apple.com", emoji: "🍎", label: "Apple Developer" },
    { domain: "cppreference.com", emoji: "➕", label: "C++ Reference" },
    { domain: "isocpp.org", emoji: "➕", label: "ISO C++" },
    { domain: "laravel.com", emoji: "🔺", label: "Laravel" },
    { domain: "symfony.com", emoji: "🎼", label: "Symfony" },
    { domain: "getcomposer.org", emoji: "🎼", label: "Composer" },
    { domain: "phpunit.de", emoji: "✅", label: "PHPUnit" },
    { domain: "packagist.org", emoji: "📦", label: "Packagist" },
    { domain: "php-fig.org", emoji: "📐", label: "PHP-FIG" },
    { domain: "wordpress.org", emoji: "📝", label: "WordPress" },
    { domain: "developer.wordpress.org", emoji: "📝", label: "WordPress" },
    { domain: "postgresql.org", emoji: "🐘", label: "PostgreSQL" },
    { domain: "dev.mysql.com", emoji: "🐬", label: "MySQL" },
    { domain: "mongodb.com", emoji: "🍃", label: "MongoDB" },
    { domain: "redis.io", emoji: "🟥", label: "Redis" },
    { domain: "sqlite.org", emoji: "🗄️", label: "SQLite" },
    { domain: "elastic.co", emoji: "🔍", label: "Elastic" },
    { domain: "kafka.apache.org", emoji: "📨", label: "Kafka" },
    { domain: "docs.docker.com", emoji: "🐳", label: "Docker" },
    { domain: "kubernetes.io", emoji: "☸️", label: "Kubernetes" },
    { domain: "git-scm.com", emoji: "🔧", label: "Git" },
    { domain: "docs.github.com", emoji: "🐙", label: "GitHub" },
    { domain: "aws.amazon.com", emoji: "☁️", label: "AWS" },
    { domain: "cloud.google.com", emoji: "☁️", label: "Google Cloud" },
    { domain: "terraform.io", emoji: "🏗️", label: "Terraform" },
    { domain: "nginx.org", emoji: "🌐", label: "Nginx" },
    { domain: "kernel.org", emoji: "🐧", label: "Kernel.org" },
    { domain: "man7.org", emoji: "📖", label: "man7" },
    { domain: "zod.dev", emoji: "🧩", label: "Zod" },
    { domain: "js.langchain.com", emoji: "🦜", label: "LangChain" },
    { domain: "docs.langchain.com", emoji: "🦜", label: "LangChain" },
    { domain: "docs.anthropic.com", emoji: "🤖", label: "Anthropic" },
    { domain: "pnpm.io", emoji: "📦", label: "pnpm" },
    { domain: "graphql.org", emoji: "◈", label: "GraphQL" },
    { domain: "spring.io", emoji: "🌱", label: "Spring" },
    { domain: "tailwindcss.com", emoji: "🎨", label: "Tailwind CSS" },
    { domain: "webpack.js.org", emoji: "📦", label: "Webpack" },
    { domain: "vitejs.dev", emoji: "⚡", label: "Vite" },
    { domain: "jestjs.io", emoji: "🃏", label: "Jest" },
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
export function sourceInfo(url) {
    const hostname = getHostname(url);
    if (hostname) {
        const entry = SOURCE_CATALOG.find((e) => hostname === e.domain || hostname.endsWith(`.${e.domain}`));
        if (entry) return { emoji: entry.emoji, label: entry.label };
    }
    return { emoji: "🔗", label: hostname || url };
}
