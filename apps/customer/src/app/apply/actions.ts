"use server";

import {
  ProviderError,
  submitApplication,
  REQUIRED_ID_COUNT,
  type IdSubmission,
  type IdType,
  type ApplicationListingInput,
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

/** The listing rows the form rendered — see ListingsFieldset's `listing_keys` hidden field. */
function readListings(formData: FormData): ApplicationListingInput[] {
  const keys = String(formData.get("listing_keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return keys.map((key) => {
    const photo = formData.get(`listing_photo_${key}`);
    if (!(photo instanceof File)) {
      throw new ProviderError("Add a photo for each item you're selling");
    }
    const priceType = formData.get(`listing_price_type_${key}`) === "negotiable" ? "negotiable" : "fixed";
    return {
      title: String(formData.get(`listing_title_${key}`) ?? ""),
      categoryId: String(formData.get(`listing_category_${key}`) ?? ""),
      priceType,
      priceNaira: priceType === "fixed" ? Number(formData.get(`listing_price_${key}`) ?? 0) : undefined,
      photo,
    };
  });
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
      cityId: String(formData.get("city_id") ?? ""),
      area: String(formData.get("area") ?? ""),
      description: String(formData.get("description") ?? ""),
      profilePhoto,
      ids: readIds(formData),
      listings: readListings(formData),
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
