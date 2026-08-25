import { slugify } from "../utils/slugify.js";
import { sourceInfo } from "../utils/sourceCatalog.js";
import MarkdownViewer from "./MarkdownViewer.jsx";
import styles from "./Note.module.css";

// Estrae i sottotitoli (### ...) dal markdown di una sezione, per mostrarli
// come voci annidate 1.1/1.2 nell'indice: ignora quelli dentro un blocco di
// codice (una riga tipo "### commento" in un esempio non è un sottotitolo) e
// non cattura per errore un h4 "####", che inizia comunque con "###".
function extractSubheadings(markdown) {
    const subheadings = [];
    let inCodeBlock = false;
    for (const line of markdown.split("\n")) {
        if (/^```/.test(line.trim())) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) continue;
        const match = line.match(/^###\s+(.+)$/);
        if (match) subheadings.push(match[1].trim());
    }
    return subheadings;
}

function Note({ note, attempts }) {
    const tags = note.tags || [];
    const sections = note.sections || [];
    const sources = note.sources || [];
    const glossary = note.glossary || [];
    const keyTakeaways = note.keyTakeaways || [];
    const commonMistakes = note.commonMistakes || [];

    return (
        <article className="note">
            <span className="moduleBadge">{note.module || ""}</span>
            <h2>{note.title || note.topic}</h2>
            <div className="meta">
                {attempts && <>Generato in {attempts} tentativo{attempts > 1 ? "i" : ""} &middot; </>}
                {new Date(note.createdAt).toLocaleString("it-IT")}
            </div>

            {tags.length > 0 && (
                <div className={styles.tagList}>
                    {tags.map((t) => (
                        <span className={styles.tag} key={t}>{t}</span>
                    ))}
                </div>
            )}

            <nav className={styles.tableOfContents}>
                <h3>📍 Indice Rapido</h3>
                <ol>
                    {sections.map((s, i) => {
                        const subheadings = extractSubheadings(s.content);
                        return (
                            <li key={s.title}>
                                <a href={`#${slugify(s.title)}`}>{s.title}</a>
                                {subheadings.length > 0 && (
                                    <ol className={styles.tableOfContentsSubList}>
                                        {subheadings.map((sub, j) => (
                                            <li key={sub}>{i + 1}.{j + 1} {sub}</li>
                                        ))}
                                    </ol>
                                )}
                            </li>
                        );
                    })}
                    <li><a href="#errori-comuni">Errori Comuni</a></li>
                    <li><a href="#risorse">Risorse e Documentazione</a></li>
                    <li><a href="#takeaways">Key Takeaways</a></li>
                    {glossary.length > 0 && <li><a href="#glossario">Glossario</a></li>}
                </ol>
            </nav>

            {sections.map((s, i) => (
                <section className={styles.section} id={slugify(s.title)} key={s.title}>
                    <h3>{i + 1}. {s.title}</h3>
                    <div className={styles.sectionContent}>
                        <MarkdownViewer markdown={s.content} sectionNumber={i + 1} noTopMargin />
                    </div>
                </section>
            ))}

            <section id="errori-comuni">
                <h3>⚠️ Errori Comuni</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Errore</th>
                            <th>Come risolverlo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commonMistakes.map((m) => (
                            <tr key={m.mistake}>
                                <td>{m.mistake}</td>
                                <td>{m.solution}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className={styles.sources} id="risorse">
                <h3>🔗 Risorse e Documentazione</h3>
                {sources.length > 0 ? (
                    <ul>
                        {sources.map((s) => {
                            const { emoji, label } = sourceInfo(s.url);
                            return (
                                <li key={s.url}>
                                    {emoji} <strong>{label}:</strong>{" "}
                                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                                        {s.title || s.url}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p>Nessuna fonte ufficiale citata.</p>
                )}
            </section>

            <section className={styles.takeaways} id="takeaways">
                <h3>🚀 Key Takeaways</h3>
                <p className={styles.sectionSubtitle}>I punti fondamentali da ricordare.</p>
                <ul>
                    {keyTakeaways.map((k) => (
                        <li key={k}>{k}</li>
                    ))}
                </ul>
            </section>

            {glossary.length > 0 && (
                <section className={styles.glossary} id="glossario">
                    <h3>📖 Glossario</h3>
                    <p className={styles.sectionSubtitle}>Termini tecnici spiegati in modo semplice, a fianco della definizione formale.</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Termine</th>
                                <th>Definizione Formale</th>
                                <th>Spiegazione Informale</th>
                            </tr>
                        </thead>
                        <tbody>
                            {glossary.map((g) => (
                                <tr key={g.term}>
                                    <td>{g.term}</td>
                                    <td>{g.formalDefinition}</td>
                                    <td>{g.informalExplanation}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <div className={styles.fileName}>Salvato come {note.relativePath || note.fileName}</div>
        </article>
    );
}

export default Note;
