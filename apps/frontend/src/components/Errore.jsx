function Errore({ dati }) {
    const dettagli = dati.issues ? dati.issues.join("\n") : "";
    const motivo = dati.motivo ? ` (${dati.motivo})` : "";
    const messaggio = (dati.errore || "Errore sconosciuto") + motivo;

    return (
        <div className="error">
            {messaggio}
            {dettagli ? `\n${dettagli}` : ""}
        </div>
    );
}

export default Errore;
