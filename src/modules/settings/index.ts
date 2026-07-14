/**
 * Settings — platform settings and feature flags
 *
 * Nothing else in the codebase should hardcode a payout schedule, a
 * subscription fee, or a "is this feature live" boolean.
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
