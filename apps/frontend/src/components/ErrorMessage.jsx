function ErrorMessage({ data }) {
    const details = data.issues ? data.issues.join("\n") : "";
    const reason = data.reason ? ` (${data.reason})` : "";
    const message = (data.error || "Errore sconosciuto") + reason;

    return (
        <div className="error">
            {message}
            {details ? `\n${details}` : ""}
        </div>
    );
}

export default ErrorMessage;
