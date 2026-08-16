import type { FastifyPluginAsync } from "fastify";
import { getFlags, setFlag, type FlagKey } from "../modules/settings/flags.js";
import { getSettings, updateSetting, type SettingKey } from "../modules/settings/service.js";

/** Both writes require an authenticated admin — request.user is set by the auth plugin from a validated Bearer token. */
function requireAdmin(user: { id: string; role: string } | null): { id: string; role: "admin" } {
  if (!user || user.role !== "admin") {
    const err = new Error("Only an admin may do this");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  return { id: user.id, role: "admin" };
}

const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/flags", async (request) => getFlags(request.supabase));

  app.patch<{ Params: { key: string }; Body: { enabled: boolean } }>("/flags/:key", async (request) => {
    const actor = requireAdmin(request.user);
    await setFlag(request.params.key as FlagKey, request.body.enabled, actor);
    return { ok: true };
  });

  app.get("/values", async (request) => getSettings(request.supabase));

  app.patch<{ Params: { key: string }; Body: { value: number } }>("/values/:key", async (request) => {
    const actor = requireAdmin(request.user);
    await updateSetting(request.supabase, request.params.key as SettingKey, request.body.value, actor);
    return { ok: true };
  });
};

export default settingsRoutes;
