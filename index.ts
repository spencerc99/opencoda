import type {
  Request as WorkerRequest,
  ExecutionContext,
} from "@cloudflare/workers-types";

// addEventListener("fetch", (event: any) => {
//   event.respondWith(handleRequest(event));
// });

async function handleRequest(
  request: WorkerRequest,
  env: unknown,
  ctx: ExecutionContext
) {
  const CodaApiToken = process.env.CODA_API_TOKEN;
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

  if (!gridId.indexOf("grid-")) {
    return error("Invalid grid ID. Should be in the format of 'grid-123abc'");
  }

  const resp = await fetch(
    `https://coda.io/apis/v1/docs/${docId}/tables/${gridId}/rows?useColumnNames=true&valueFormat=simpleWithArrays&sortBy=natural`,
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
}

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

export default handleRequest;
