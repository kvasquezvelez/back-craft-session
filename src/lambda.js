const serverless = require("serverless-http");
const app = require("./app");
 
const serverlessHandler = serverless(app);
 
exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
 
    try {
        return await serverlessHandler(event, context);
    } catch (error) {
        console.error("Error ejecutando Lambda:", error);
 
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "Error interno del servidor"
            })
        };
    }
};