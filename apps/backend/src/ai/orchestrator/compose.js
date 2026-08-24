import settings from "../../utils/settings.js";
import model from "../models/anthropic.js";
import searchTool from "../tools/searchTool.js";
import logger from "../../utils/logger.js";
import createGeneratorAgent from "../agents/generatorAgent.js";
import createValidatorAgent from "../agents/validatorAgent.js";
import createReviewerAgent from "../agents/reviewerAgent.js";
import createArchivistAgent from "../agents/archivistAgent.js";
import createWriterAgent from "../agents/writerAgent.js";
import createNoteOrchestrator from "./noteOrchestrator.js";

// Unico punto in cui i singleton reali vengono assemblati: il resto dell'app
// (route incluse) importa solo `noteOrchestrator` da qui, mai gli agenti o
// `ai/models`/`ai/tools` direttamente.
const archivist = createArchivistAgent({ logger });

const noteOrchestrator = createNoteOrchestrator({
    generator: createGeneratorAgent({ model, searchTool, logger }),
    validator: createValidatorAgent({ logger }),
    reviewer: createReviewerAgent({ model, logger }),
    writer: createWriterAgent({ notesDir: settings.notesDir, logger, archivist }),
    logger,
    maxAttempts: settings.maxGenerationAttempts,
});

export default noteOrchestrator;
