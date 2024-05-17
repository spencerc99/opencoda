import type { ExportedHandler } from "@cloudflare/workers-types";

interface Env {
  CODA_API_TOKEN: string;
}

function withQueryParams(url: string, params: Record<string, any>) {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) =>
    urlObj.searchParams.set(key, value)
  );
  return urlObj.toString();
}

function deriveParamsFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

const handler: ExportedHandler = {
  async fetch(request, env: Env, ctx) {
    const CodaApiToken = env.CODA_API_TOKEN;
    const method = request.method;
    const url = new URL(request.url);
    const responseHeaders = {
      "Content-Type": "application/json",
      "Cache-Control": `s-maxage=30`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    };

    if (method === "GET") {
      let [docId, gridId] = url.pathname
        .slice(1)
        .split("/")
        .filter((x) => x);

      const params = url.search ? deriveParamsFromSearch(url.search) : {};

      if (url.pathname === "/" || !docId) {
        return error(
          "Please provide a doc ID and grid ID in the url path. See https://github.com/spencerc99/opencoda#readme for more info."
        );
      }

      if (gridId?.indexOf("grid-") === -1) {
        return error(
          "Invalid grid ID. Should be in the format of 'grid-123abc'"
        );
      }

      const results = [];
      let nextPageToken = undefined;
      do {
        const resp = await fetch(
          withQueryParams(
            `https://coda.io/apis/v1/docs/${docId}/tables/${gridId}/rows`,
            {
              useColumnNames: true,
              valueFormat: "simpleWithArrays",
              sortBy: "natural",
              ...params,
            }
          ),
          {
            headers: {
              Authorization: `Bearer ${CodaApiToken}`,
            },
          }
        );
        const respBody = await resp.json();
        if (!respBody?.items) {
          return error(
            `Error with fetching: ${JSON.stringify(respBody, null, 2)}`
          );
        }
        const dataMetadata = respBody.items;
        nextPageToken = respBody.nextPageToken;
        const data = dataMetadata.map((d) => d.values);
        results.push(...data);
      } while (nextPageToken);
      const apiResponse = new Response(JSON.stringify(results), {
        headers: responseHeaders,
      });
      return apiResponse;
    }

    if (method === "POST") {
      let [docId] = url.pathname
        .slice(1)
        .split("/")
        .filter((x) => x);
      const body = await request.json();

      if (url.pathname === "/" || !docId) {
        return error(
          "Please provide a doc ID corresponding to a form. See https://github.com/spencerc99/opencoda#readme for more info."
        );
      }
      if (!body) {
        return error(
          "Please provide your form fields in the request body. See https://github.com/spencerc99/opencoda#readme for more info."
        );
      }
      const resp = await fetch(`https://coda.io/form/${docId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ row: body }),
      });

      if (!resp.ok) {
        return error(`Response ${resp.status}: ${resp.statusText}`);
      }

      return new Response("ok", {
        headers: responseHeaders,
      });
    }
  },
};

const error = (message, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
};

export default handler;
