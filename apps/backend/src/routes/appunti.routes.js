import express from "express";
import createAppuntiController from "../controllers/appunti.controller.js";

function createAppuntiRouter(controller = createAppuntiController()) {
    const router = express.Router();

    router.post("/", controller.generaAppunto);
    router.get("/cartelle", controller.listaCartelle);
    router.get("/cartelle/:cartella", controller.listaAppunti);
    router.get("/cartelle/:cartella/:nomeFile", controller.leggiAppunto);

    return router;
}

export default createAppuntiRouter;
