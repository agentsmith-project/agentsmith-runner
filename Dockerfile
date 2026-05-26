# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ARG CONTRACT_TGZ=__missing_runner_contract_artifact__.tgz

COPY package.json tsconfig.json ./
COPY src ./src
COPY builtin-skills ./builtin-skills
COPY ${CONTRACT_TGZ} /tmp/agent-runner-contract.tgz

RUN test -n "$CONTRACT_TGZ" \
  && test -f /tmp/agent-runner-contract.tgz
RUN npm install --no-save --package-lock=false --no-audit --no-fund /tmp/agent-runner-contract.tgz
RUN npm run build
RUN npm prune --omit=dev --package-lock=false --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/builtin-skills ./builtin-skills
COPY --from=build /app/node_modules ./node_modules

ENTRYPOINT ["node", "dist/index.js"]
