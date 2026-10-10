import { router, type Href } from "expo-router";

/** Нэвтрээгүй хэрэглэгчийг нэвтрэх дэлгэц рүү; нэвтэрсний дараа `next` рүү буцаана. */
export function requireLogin(next?: string) {
  router.push({ pathname: "/login", params: next ? { next } : {} } as Href);
}
