"use server";

import {
  ProviderError,
  submitApplication,
  REQUIRED_ID_COUNT,
  type IdSubmission,
  type IdType,
} from "@/modules/provider";

/**
 * The public vendor application. No session, on purpose: the whole point is that
 * a business that has never heard of Nexa can ask to join.
 */
export interface ApplyState {
  error?: string;
  /** Set once the application is in. The form is replaced by the confirmation. */
  submitted?: boolean;
  email?: string;
}

/** The form numbers its ID fields from 1. Two of them, and they must differ. */
function readIds(formData: FormData): IdSubmission[] {
  const ids: IdSubmission[] = [];

  for (let n = 1; n <= REQUIRED_ID_COUNT; n += 1) {
    const file = formData.get(`id_file_${n}`);
    if (!(file instanceof File)) {
      throw new ProviderError(`Attach a photo of ID ${n}`);
    }
    ids.push({
      idType: String(formData.get(`id_type_${n}`) ?? "") as IdType,
      idNumber: String(formData.get(`id_number_${n}`) ?? ""),
      file,
    });
  }

  return ids;
}

export async function applyAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const email = String(formData.get("email") ?? "").trim();
  const profilePhoto = formData.get("profile_photo");
  if (!(profilePhoto instanceof File) || profilePhoto.size === 0) {
    return { error: "Add a profile photo for your business" };
  }

  try {
    await submitApplication({
      businessName: String(formData.get("business_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email,
      password: String(formData.get("password") ?? ""),
      categoryId: String(formData.get("category_id") ?? ""),
      cityId: String(formData.get("city_id") ?? ""),
      description: String(formData.get("description") ?? ""),
      profilePhoto,
      ids: readIds(formData),
    });
  } catch (e) {
    return {
      error:
        e instanceof ProviderError
          ? e.message
          : "Something went wrong sending your application. Please try again.",
    };
  }

  return { submitted: true, email };
}
