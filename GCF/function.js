const { createNodeMiddleware, createProbot } = require("probot");
const app = require("./app");

exports.probot = createNodeMiddleware(app, { probot: createProbot() });
exports.probotDerrick = createNodeMiddleware(app, { probot: createProbot() });
