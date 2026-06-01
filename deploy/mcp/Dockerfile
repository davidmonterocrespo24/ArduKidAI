# MongoDB MCP server sidecar for the Cloud Run multi-container service.
# Runs the official mongodb-mcp-server over HTTP on localhost:3030; the backend
# container reaches it at http://localhost:3030 (containers in a Cloud Run
# service share the network namespace). The Atlas connection string is injected
# as MDB_MCP_CONNECTION_STRING from Secret Manager.
FROM node:24-alpine

RUN npm install -g mongodb-mcp-server

EXPOSE 3030

CMD ["npx", "mongodb-mcp-server", "--transport", "http", "--httpPort", "3030", "--httpHost", "0.0.0.0"]
