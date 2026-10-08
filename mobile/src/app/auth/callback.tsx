import { Redirect } from "expo-router";

// Google нэвтрэлтийн дараа апп энэ хаягаар нээгдвэл нүүр хуудас руу шилжүүлнэ.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
