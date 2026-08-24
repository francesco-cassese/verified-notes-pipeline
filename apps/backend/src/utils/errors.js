const ErrorCodes = {
    GENERATION_ERROR: "GENERATION_ERROR",
    WRITE_ERROR: "WRITE_ERROR",
    PATH_TRAVERSAL_ERROR: "PATH_TRAVERSAL_ERROR",
    NO_OFFICIAL_SOURCE_ERROR: "NO_OFFICIAL_SOURCE_ERROR",
    NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
};

class AgentError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.name = "AgentError";
        this.code = code;
        if (cause) this.cause = cause;
    }
}

export { ErrorCodes, AgentError }