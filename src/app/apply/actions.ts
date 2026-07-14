"use server";

import { ProviderError, submitApplication, type IdType } from "@/modules/provider";

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

export async function applyAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const idFile = formData.get("id_file");
  const email = String(formData.get("email") ?? "").trim();

  if (!(idFile instanceof File)) {
    return { error: "Attach a photo of your ID" };
  }

  try {
    await submitApplication({
      businessName: String(formData.get("business_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email,
      categoryId: String(formData.get("category_id") ?? ""),
      cityId: String(formData.get("city_id") ?? ""),
      description: String(formData.get("description") ?? ""),
      idType: String(formData.get("id_type") ?? "") as IdType,
      idNumber: String(formData.get("id_number") ?? ""),
      idFile,
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
