import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The shadcn/ui convention every ported ui/* primitive imports from "@/lib/utils". */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
