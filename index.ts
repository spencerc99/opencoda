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

    if (url.pathname === "/") {
      return new Response("", {
        status: 302,
        headers: {
          location: "https://github.com/spencerc99/opencoda#readme",
        },
      });
    }

    let [docId, gridId] = url.pathname
      .slice(1)
      .split("/")
      .filter((x) => x);

    const params = url.search ? deriveParamsFromSearch(url.search) : {};

    if (gridId.indexOf("grid-") === -1) {
      return error("Invalid grid ID. Should be in the format of 'grid-123abc'");
    }

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
    const dataMetadata = respBody.items;
    const data = dataMetadata.map((d) => d.values);
    const apiResponse = new Response(JSON.stringify(data), {
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
