package mn.messageparser;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Банкны орлогын SMS-ээс дүн болон гүйлгээний утгыг гаргана.
 * Банкны SMS-ийн хэлбэр өөрчлөгдвөл энд засна.
 */
public final class SmsParser {

    /** Орлого биш (зарлага) мессежийг алгасахын тулд орлогын түлхүүр үг байгаа эсэхийг шалгана. */
    public static boolean isIncome(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        return m.contains("orlogo") || m.contains("orlogiin") || m.contains("орлого") || m.contains("орлогын");
    }

    public static String extractMoney(String msg) {
        if (msg == null || !isIncome(msg)) return null;
        try {
            // Хаан банк: "... ORLOGO: 20,000.00 MNT ..."
            String r = between(msg, "ORLOGO:", "MNT");
            if (r != null) return clean(r);

            // М банк: "... dansand 20,000 MNT orlogiin guilgee hiigdlee"
            if (msg.contains("orlogiin guilgee hiigdlee") && msg.contains("MNT")) {
                r = between(msg, "dansand ", "MNT");
                if (r != null) return clean(r);
            }

            // Голомт банк: "... dansand 20,000.00 dungeer orlogiin guilgee ..."
            if (msg.contains("dungeer orlogiin guilgee")) {
                r = between(msg, "dansand", "dungeer orlogiin guilgee");
                if (r != null) return clean(r);
            }

            // Ерөнхий: орлогын мессеж доторх "20,000.00 MNT" / "20000₮" хэлбэрийн эхний дүн
            Matcher mm = Pattern.compile("([0-9][0-9,\\s]*(?:\\.[0-9]{1,2})?)\\s*(?:MNT|₮|төг)",
                    Pattern.CASE_INSENSITIVE).matcher(msg);
            if (mm.find()) return clean(mm.group(1));
        } catch (Exception ignored) { }
        return null;
    }

    /** Гүйлгээний утга. Олдохгүй бол null — сервер бүтэн текстээс кодыг хайна. */
    public static String extractValue(String msg) {
        if (msg == null) return null;
        Matcher m = Pattern.compile(
                "(?:guilgeenii\\s+utga|guil\\.?\\s*utga|utga|гүйлгээний\\s+утга|утга)\\s*[:：-]\\s*([^,;\\n]+)",
                Pattern.CASE_INSENSITIVE).matcher(msg);
        if (m.find()) return m.group(1).trim();
        return null;
    }

    private static String between(String msg, String a, String b) {
        int i = msg.indexOf(a);
        if (i == -1) return null;
        int start = i + a.length();
        int end = msg.indexOf(b, start);
        if (end == -1 || end - start > 30) return null;
        return msg.substring(start, end);
    }

    private static String clean(String s) {
        String r = s.replace(",", "").replace(" ", "").trim();
        if (r.endsWith(".00")) r = r.substring(0, r.length() - 3);
        if (r.endsWith(".0")) r = r.substring(0, r.length() - 2);
        return r.matches("[0-9]+(\\.[0-9]+)?") ? r : null;
    }

    private SmsParser() { }
}
