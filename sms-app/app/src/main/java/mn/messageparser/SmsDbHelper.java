package mn.messageparser;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/** Ирсэн орлогын SMS-үүдийг хадгална. Хүснэгтийг кодоор үүсгэдэг тул assets/sms.db хэрэггүй. */
public class SmsDbHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "sms_v2.db";
    private static final int DB_VERSION = 1;
    private static SmsDbHelper instance;

    public static synchronized SmsDbHelper get(Context ctx) {
        if (instance == null) instance = new SmsDbHelper(ctx.getApplicationContext());
        return instance;
    }

    private SmsDbHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE message (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "money TEXT," +          // дүн
                "value TEXT," +          // гүйлгээний утга
                "body TEXT," +           // SMS-ийн бүтэн текст
                "sender TEXT," +
                "date TEXT," +
                "mode INTEGER DEFAULT 0)"); // 0 = илгээгээгүй, 1 = сервер хүлээж авсан
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }

    public synchronized long insert(String money, String value, String body, String sender, String date) {
        ContentValues v = new ContentValues();
        v.put("money", money);
        v.put("value", value);
        v.put("body", body);
        v.put("sender", sender);
        v.put("date", date);
        v.put("mode", 0);
        return getWritableDatabase().insert("message", null, v);
    }

    public synchronized void markSent(long id) {
        ContentValues v = new ContentValues();
        v.put("mode", 1);
        getWritableDatabase().update("message", v, "id=?", new String[]{String.valueOf(id)});
    }

    public synchronized List<SmsEntity> all() {
        return query("SELECT id, money, value, body, sender, date, mode FROM message ORDER BY id DESC LIMIT 500");
    }

    public synchronized List<SmsEntity> unsent() {
        return query("SELECT id, money, value, body, sender, date, mode FROM message WHERE mode = 0 ORDER BY id ASC");
    }

    private List<SmsEntity> query(String sql) {
        List<SmsEntity> list = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery(sql, null)) {
            while (c.moveToNext()) {
                list.add(new SmsEntity(c.getInt(0), c.getString(1), c.getString(2),
                        c.getString(3), c.getString(4), c.getString(5), c.getInt(6)));
            }
        }
        return list;
    }
}
