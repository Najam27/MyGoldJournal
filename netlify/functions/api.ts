import serverless from "serverless-http";
import type { Handler } from "aws-lambda";
import { createApp } from "../../server/_core/index";

let handlerPromise: Promise<Handler> | undefined;

async function getHandler(): Promise<Handler> {
  if (!handlerPromise) {
    handlerPromise = createApp({ serveFrontend: false }).then(app => serverless(app));
  }
  return handlerPromise;
}

export const handler: Handler = async (event, context) => {
  const delegatedHandler = await getHandler();
  return delegatedHandler(event, context);
};
