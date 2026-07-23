import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * Semantic category matching - for when a customer describes what they want
 * without using anything close to the category's own words ("someone to
 * click pictures" for Photography, "make my hall look nice" for Event Decor).
 * The keyword/stem/synonym matching in resolve.ts can't ever cover every way
 * of saying a thing; this is the fallback for when it comes up empty.
 *
 * Optional by design: without OPENAI_API_KEY set, this quietly returns no
 * matches and discovery behaves exactly as it did before this existed.
 */

interface CategoryForMatch {
  name: string;
  slug: string;
}

export async function matchCategoriesSemantically(
  text: string,
  categories: CategoryForMatch[],
): Promise<string[]> {
  const env = serverEnv();
  if (!env.OPENAI_API_KEY || categories.length === 0) return [];

  const validSlugs = categories.map((c) => c.slug);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You match a customer's event-service request to the categories that actually fit it, " +
              'even when they never use the category\'s own words - "someone to click pictures" means ' +
              "Photography, \"make my hall look nice\" means Event Decor. Only return categories that " +
              "genuinely fit; return none if nothing does. Never invent a category outside the list given.",
          },
          {
            role: "user",
            content:
              `Categories:\n${categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n")}\n\n` +
              `Customer message: "${text}"`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "category_match",
            strict: true,
            schema: {
              type: "object",
              properties: {
                slugs: { type: "array", items: { type: "string", enum: validSlugs } },
              },
              required: ["slugs"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { slugs?: string[] };
    const slugs = Array.isArray(parsed.slugs) ? parsed.slugs : [];

    // The schema already constrains this to real slugs, but a parsed
    // response is never trusted blindly regardless.
    return slugs.filter((slug) => validSlugs.includes(slug));
  } catch {
    // Timeout, network failure, malformed response - any of it just means no
    // semantic match this time. The caller already falls back to full-text
    // search over listings, so this never blocks a reply from going out.
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
