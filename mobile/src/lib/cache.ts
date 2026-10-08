import type { PublicAd } from "./types";
import type { StaffAd } from "./staff";

/**
 * Жагсаалтаас нээсэн зарын мэдээллийг түр хадгална — дэлгэрэнгүй хуудас
 * сүлжээ хүлээлгүйгээр шууд гарч ирээд, ард нь шинэчлэгдэнэ.
 */
export const adCache = new Map<string, PublicAd>();
export const staffAdCache = new Map<string, StaffAd>();
