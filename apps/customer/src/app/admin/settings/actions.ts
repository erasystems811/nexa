"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PERMISSIONS as P } from "@/modules/admin";
import {
  setFlag,
  updateSetting,
  type FlagKey,
  type SettingKey,
} from "@/modules/settings";

export interface ActionState {
  error?: string;
  message?: string;
}

/**
 * Both actions re-check the role server-side. The admin layout already gates the
 * page, but a Server Action is a POST endpoint the browser can call directly —
 * a layout does not run in front of it.
 */

export async function toggleFlagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requirePermission(P.settingsManage);

  const key = String(formData.get("key")) as FlagKey;
  const enabled = formData.get("enabled") === "true";

  try {
    await setFlag(key, enabled, { id: userId, role: "admin" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the flag" };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { message: `${key} is now ${enabled ? "on" : "off"}` };
}

export async function updateSettingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = String(formData.get("key")) as SettingKey;
  const userId = await requirePermission(P.settingsManage);

  const raw = String(formData.get("value") ?? "");
  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return { error: `"${raw}" is not a number` };
  }

  try {
    await updateSetting(key, value, { id: userId, role: "admin" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the setting" };
  }

  revalidatePath("/admin/settings");
  return { message: "Saved" };
}
