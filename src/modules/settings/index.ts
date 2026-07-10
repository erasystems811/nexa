/**
 * Settings — platform settings and feature flags (PRD Sections 10, 17, 20).
 *
 * Nothing else in the codebase should hardcode a commission, a release
 * percentage, a delivery fee, or a "is this feature live" boolean.
 */
export {
  FLAGS,
  getFlags,
  isEnabled,
  setFlag,
  type FlagKey,
} from "./flags";

export {
  SETTINGS,
  getSettings,
  getNumericSetting,
  updateSetting,
  type SettingKey,
} from "./service";
