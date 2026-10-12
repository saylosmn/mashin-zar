package mn.messageparser;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;

        // Урт SMS хэд хэдэн хэсэгт хуваагдаж ирдэг тул илгээгчээр нь нэгтгэнэ
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        for (SmsMessage m : parts) {
            if (m == null) continue;
            String s = m.getOriginatingAddress();
            StringBuilder sb = bySender.get(s);
            if (sb == null) { sb = new StringBuilder(); bySender.put(s, sb); }
            sb.append(m.getMessageBody());
        }

        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
                boolean saved = false;
                for (Map.Entry<String, StringBuilder> e : bySender.entrySet()) {
                    String sender = e.getKey();
                    String body = e.getValue().toString();
                    if (!Settings.senderAllowed(app, sender)) continue;
                    String money = SmsParser.extractMoney(body);
                    if (money == null) continue;
                    String value = SmsParser.extractValue(body);
                    SmsDbHelper.get(app).insert(money, value, body, sender, now);
                    saved = true;
                }
                if (saved) {
                    Uploader.notifyUi(app);
                    Uploader.sendPending(app);
                }
            } finally {
                pending.finish();
            }
        }).start();
    }
}
