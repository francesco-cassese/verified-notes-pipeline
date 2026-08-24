import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import settings from "./utils/settings.js";
import logger from "./utils/logger.js";
import createAppuntiRouter from "./routes/appunti.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(express.json());

app.use(express.static(publicDir));

app.use("/api/appunti", createAppuntiRouter());

// Fallback SPA: qualunque GET non /api e non un file statico esistente (es.
// /archivio/react, ricaricata o aperta direttamente) va comunque a index.html,
// così React Router prende in mano la navigazione lato client.
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

// Middleware di errore finale: mai esporre err.stack al client, solo un
// messaggio e uno status coerente col tipo di errore.
app.use((err, req, res, next) => {
    logger.error("server", err.message, { codice: err.code });
    const status = err.code === "PATH_TRAVERSAL_ERROR" ? 400 : 500;
    res.status(status).json({ errore: err.message });
});

app.listen(settings.port, () => {
    console.log('Server in ascolto sulla porta', settings.port);
})
