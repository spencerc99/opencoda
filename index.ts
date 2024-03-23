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
    const url = new URL(request.url);

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
      return error("Invalid grid ID. Should be in the format of 'grid-123abc'");
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
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=30`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Origin, X-Requested-With, Content-Type, Accept",
      },
    });
    return apiResponse;
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
