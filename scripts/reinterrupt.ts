import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import { Image } from "../backend/agents/types.js";

async function getInterrupts(client: Client) {
  const interrupts = await client.threads.search({
    status: "interrupted",
    limit: 1000,
  });
  return interrupts;
}

// Note: Image URL signing functionality removed as Supabase storage is no longer used
async function updateImageUrls(
  values: Record<string, any> & { image?: Image; imageOptions?: string[] },
): Promise<Record<string, any>> {
  // Simply return values without modification since we no longer use Supabase storage
  return values;
}

export async function redoInterrupts() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
  });

  const allInterrupts = await getInterrupts(client);
  const interrupts = [allInterrupts[9]];

  for await (const item of interrupts) {
    const values = item.values as Record<string, any>;

    console.log("values BEFORE:");
    console.dir(
      {
        image: values.image,
        imageOptions: values.imageOptions,
      },
      { depth: null },
    );
    const updatedValues = await updateImageUrls(values);

    console.log("updatedValues:");
    console.dir(
      {
        image: updatedValues.image,
        imageOptions: updatedValues.imageOptions,
      },
      { depth: null },
    );

    console.log("item.thread_id", item.thread_id);

    await client.runs.create(item.thread_id, "generate_post", {
      command: {
        update: {
          ...updatedValues,
        },
        goto: "humanNode",
      },
    });
  }
}

redoInterrupts().catch(console.error);

export async function getAllRuns() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
  });
  const threads = await client.threads.search({
    status: "interrupted",
    limit: 1000,
  });
  console.log("threads", threads.length);

  for (const { thread_id } of threads) {
    const runs = await client.runs.list(thread_id);
    await Promise.all(runs.map((r) => client.runs.delete(thread_id, r.run_id)));
    await client.threads.delete(thread_id);
  }
}

// getAllRuns().catch(console.error);
