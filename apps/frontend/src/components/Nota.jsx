import { slugify } from "../utils/slugify.js";
import MarkdownViewer from "./MarkdownViewer.jsx";

function Nota({ nota, tentativi }) {
    const tag = nota.tag || [];
    const sezioni = nota.sezioni || [];
    const fonti = nota.fonti || [];
    const glossario = nota.glossario || [];
    const keyTakeaways = nota.keyTakeaways || [];
    const erroriComuni = nota.erroriComuni || [];

    return (
        <article className="nota">
            <span className="modulo-badge">{nota.modulo || ""}</span>
            <h2>{nota.titolo || nota.argomento}</h2>
            <div className="meta">
                {tentativi && <>Generato in {tentativi} tentativo{tentativi > 1 ? "i" : ""} &middot; </>}
                {new Date(nota.creatoIl).toLocaleString("it-IT")}
            </div>

            {tag.length > 0 && (
                <div className="tag-list">
                    {tag.map((t) => (
                        <span className="tag" key={t}>{t}</span>
                    ))}
                </div>
            )}

            <nav className="indice">
                <h3>📍 Indice Rapido</h3>
                <ol>
                    {sezioni.map((s) => (
                        <li key={s.titolo}>
                            <a href={`#${slugify(s.titolo)}`}>{s.titolo}</a>
                        </li>
                    ))}
                    <li><a href="#errori-comuni">Errori Comuni</a></li>
                    <li><a href="#risorse">Risorse e Documentazione</a></li>
                    <li><a href="#takeaways">Key Takeaways</a></li>
                    {glossario.length > 0 && <li><a href="#glossario">Glossario</a></li>}
                </ol>
            </nav>

            {sezioni.map((s) => (
                <section className="sezione" id={slugify(s.titolo)} key={s.titolo}>
                    <h3>{s.titolo}</h3>
                    <div className="sezione-contenuto">
                        <MarkdownViewer markdown={s.contenuto} />
                    </div>
                </section>
            ))}

            <section className="errori-comuni" id="errori-comuni">
                <h3>⚠️ Errori Comuni</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Errore</th>
                            <th>Come risolverlo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {erroriComuni.map((e) => (
                            <tr key={e.errore}>
                                <td>{e.errore}</td>
                                <td>{e.soluzione}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="fonti" id="risorse">
                <h3>🔗 Risorse e Documentazione</h3>
                {fonti.length > 0 ? (
                    <ul>
                        {fonti.map((f) => (
                            <li key={f.url}>
                                <a href={f.url} target="_blank" rel="noopener noreferrer">
                                    {f.titolo || f.url}
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Nessuna fonte ufficiale citata.</p>
                )}
            </section>

            <section className="takeaways" id="takeaways">
                <h3>🚀 Key Takeaways</h3>
                <ul>
                    {keyTakeaways.map((k) => (
                        <li key={k}>{k}</li>
                    ))}
                </ul>
            </section>

            {glossario.length > 0 && (
                <section className="glossario" id="glossario">
                    <h3>📖 Glossario</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Termine</th>
                                <th>Definizione Formale</th>
                                <th>Spiegazione Informale</th>
                            </tr>
                        </thead>
                        <tbody>
                            {glossario.map((v) => (
                                <tr key={v.termine}>
                                    <td>{v.termine}</td>
                                    <td>{v.definizioneFormale}</td>
                                    <td>{v.spiegazioneInformale}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <div className="nomefile">Salvato come {nota.percorsoRelativo || nota.nomeFile}</div>
        </article>
    );
}

export default Nota;
