export enum SUCCESS_CODES {

    OK = 200, // GET, HEAD
    CREATED = 201, // POST, PUT, PATCH
    ACCEPTED = 202, // if the request has been accepted for processing, but the processing has not been completed
    NO_CONTENT = 204, //if no content is returned

}

export enum CLIENT_ERROR_CODES {
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,  
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,
    CONTENT_TOO_LARGE = 413,
}

export enum SERVER_ERROR_CODES {
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503,
}
