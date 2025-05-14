const ERROR_CODES = {
    400: 400,
    401: 401,
    403: 403,
    404: 404,
    409: 409,
    429: 429,
    500: 500,
    503: 503,
  };
  
  // Errors list for the different types of errors
  export const ERROR = Object.freeze({
    SOMETHING_WENT_WRONG: {
      statusCode: ERROR_CODES[500],
      message: "Something went wrong.",
    },
    INVALID_MONGO_ID: {
      statusCode: ERROR_CODES[404],
      message: "Invalid MongoDB ID.",
    },
    BUILDERS: {
      ALREADY_WATCHED: {
        statusCode: ERROR_CODES[400],
        message: "Builder is already present in the watch list.",
      },
      NOT_WATCHED: {
        statusCode: ERROR_CODES[400],
        message: "Builder is not present in the watch list.",
      },
    },
    USERS: {
      EMAIL_ALREADY_EXISTS: {
        statusCode: ERROR_CODES[409],
        message: "Email already exists.",
      },
      NOT_FOUND: {
        statusCode: ERROR_CODES[404],
        message: "User not found.",
      },
    }
  });