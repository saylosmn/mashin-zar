package mn.messageparser;

import android.content.Context;
import android.content.SharedPreferences;

/** Сервер, банкны дугаар, нууц түлхүүрийг хадгална. */
public final class Settings {
    private static final String P = "settings";

    private static SharedPreferences p(Context c) {
        return c.getApplicationContext().getSharedPreferences(P, Context.MODE_PRIVATE);
    }

    public static String server(Context c) { return p(c).getString("server", ""); }
    public static String phones(Context c) { return p(c).getString("phone", ""); }
    public static String apiKey(Context c) { return p(c).getString("apikey", ""); }

    public static void save(Context c, String server, String phones, String apiKey) {
        p(c).edit().putString("server", server.trim())
                .putString("phone", phones.trim())
                .putString("apikey", apiKey.trim()).apply();
    }

    /** Илгээгч зөвшөөрөгдсөн эсэх. Хоосон бол бүх илгээгчээс хүлээж авна. Таслалаар олон дугаар. */
    public static boolean senderAllowed(Context c, String sender) {
        String list = phones(c);
        if (list.isEmpty()) return true;
        if (sender == null) return false;
        String s = normalize(sender);
        for (String ph : list.split(",")) {
            String n = normalize(ph);
            if (!n.isEmpty() && (s.equals(n) || s.endsWith(n) || n.endsWith(s))) return true;
        }
        return false;
    }

    private static String normalize(String s) {
        return s.replace(" ", "").replace("-", "").replace("+976", "").trim().toLowerCase();
    }

    private Settings() { }
}
