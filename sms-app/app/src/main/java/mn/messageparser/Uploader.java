package mn.messageparser;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Орлогыг сайт руу JSON-оор илгээнэ. */
public final class Uploader {
    public static final String ACTION_UPDATED = "mn.messageparser.NEW_SMS";
    private static final String TAG = "Uploader";

    /** Илгээгээгүй бүх мессежийг илгээнэ (сүлжээ тасарсан үед хоцорсныг нөхнө). Background thread дээр дуудна. */
    public static synchronized int sendPending(Context ctx) {
        SmsDbHelper db = SmsDbHelper.get(ctx);
        int ok = 0;
        for (SmsEntity e : db.unsent()) {
            if (send(ctx, e.money, e.value, e.body, e.sender, e.date) == null) {
                db.markSent(e.id);
                ok++;
            }
        }
        notifyUi(ctx);
        return ok;
    }

    /** @return null бол амжилттай, эс бол алдааны текст */
    public static String send(Context ctx, String money, String value, String body, String sender, String date) {
        String server = Settings.server(ctx);
        if (server.isEmpty()) return "Сервер тохируулаагүй";
        HttpURLConnection conn = null;
        try {
            JSONObject json = new JSONObject();
            json.put("money", money);
            json.put("value", value == null ? "" : value);
            json.put("body", body);
            json.put("sender", sender);
            json.put("date", date);

            conn = (HttpURLConnection) new URL(server).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            String key = Settings.apiKey(ctx);
            if (!key.isEmpty()) conn.setRequestProperty("X-Api-Key", key);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String resp = read(is);
            Log.d(TAG, status + " " + resp);
            if (status < 200 || status >= 300) return "HTTP " + status + " " + resp;

            // {"code":0} эсвэл {"ok":true} эсвэл хоосон 2xx хариуг амжилттай гэж үзнэ
            if (resp.trim().startsWith("{")) {
                JSONObject r = new JSONObject(resp);
                if (r.has("code") && r.getInt("code") != 0) return "code=" + r.get("code");
                if (r.has("ok") && !r.getBoolean("ok")) return "ok=false";
            }
            return null;
        } catch (Exception e) {
            Log.e(TAG, "send failed", e);
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    public static void notifyUi(Context ctx) {
        Intent i = new Intent(ACTION_UPDATED);
        i.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(i);
    }

    private static String read(InputStream is) throws Exception {
        if (is == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }

    private Uploader() { }
}
