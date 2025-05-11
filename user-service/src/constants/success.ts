const SUCCESS_CODES = {
    200: 200,
    201: 201,
    202 : 202,
    204: 204,
  };
  
  // All the success response of any API are listed here,
  // anyone success response can be used based on the request type and response
  export const SUCCESS = Object.freeze({
    // GET response
    GET_200: {
      statusCode: SUCCESS_CODES[200],
      message: "Success",
    },
    GET_200_DATA: {
      statusCode: SUCCESS_CODES[200],
      message: "Success",
      data: null, // add your response data
    },
  
    GET_202: {
      statusCode: SUCCESS_CODES[202],
      message: "Accepted",
      data: null, // add your response data
    },
  
    LEAD_ENRICHMENT_SUCCESS: {
      statusCode: SUCCESS_CODES[202],
      message: "Lead enrichment successful. Data will be updated in 1-2 minutes.",
    },
    // POST response
    POST_201: {
      // Location: /v1/items/12 - in headers
      statusCode: SUCCESS_CODES[200],
      message: "The item was created successfully.",
    },
    POST_201_DATA: {
      statusCode: SUCCESS_CODES[201],
      message: "Inserted",
    },
    //PUT response
    PUT_200_DATA: {
      statusCode: SUCCESS_CODES[200],
      message: "Updated",
    },
    PUT_204: {
      // Location: /v1/items/12 - in headers
      statusCode: SUCCESS_CODES[204],
      message: "Updated",
    },
    //PATCH response
    PATCH_200_DATA: {
      statusCode: SUCCESS_CODES[200],
      message: "Updated",
      response: null, // add your response data
    },
    PATCH_204: {
      // Location: /v1/items/12 - in headers
      statusCode: SUCCESS_CODES[204],
      message: "Updated",
    },
    // DELETE response
    DELETE_204: {
      statusCode: SUCCESS_CODES[204],
      message: "Deleted",
    },
    EMAIL_SUCCESS: {
      statusCode: 200,
      message: "Message sent successfully",
      response: {},
    },
    DELETION_SUCCESS: {
      statusCode: 200,
      message: "Item was deleted successfully",
    },
    ARCHIVE_SUCCESS: {
      statusCode: 200,
      message: "Item was archived successfully",
    },
    PRODUCT_ASSIGNMENT_SUCCESS: {
      statusCode: 200,
      message: "Product assigned successfully",
    },
    WATCH_BUILDER_SUCCESS: {
      statusCode: 201,
      message: "Builder added to watchlist successfully",
    },
    UNWATCH_BUILDER_SUCCESS: {
      statusCode: 200,
      message: "Builder removed from watchlist successfully",
    },
  });
  
  export const SUCCESS_MESSAGE = {
    SUCCESS: "SUCCESS",
  };