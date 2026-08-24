import { ChatAnthropic } from "@langchain/anthropic";
import settings from "../../utils/settings.js";

const model = new ChatAnthropic({
    model: settings.modelName,
    apiKey: settings.claudeApiKey,
    timeout: settings.modelTimeoutMs
})

export default model;