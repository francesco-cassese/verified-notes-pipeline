import { Link } from "react-router-dom";

function NotFound() {
    return (
        <main className="page">
            <h1>Pagina non trovata</h1>
            <p className="subtitle">L'indirizzo richiesto non corrisponde a nessuna pagina di questa app.</p>
            <Link to="/" className="breadcrumb">← Torna alla home</Link>
        </main>
    );
}

export default NotFound;
