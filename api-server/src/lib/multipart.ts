import type { MultipartFile } from "@fastify/multipart";

/** Fastify's multipart part -> the Web File the ported modules expect (they upload straight to Supabase Storage, which takes File/Blob). */
export async function toFile(part: MultipartFile): Promise<File> {
  const buffer = await part.toBuffer();
  return new File([buffer], part.filename, { type: part.mimetype });
}
