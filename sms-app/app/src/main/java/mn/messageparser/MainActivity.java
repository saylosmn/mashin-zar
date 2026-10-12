package mn.messageparser;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class MainActivity extends AppCompatActivity {
    private static final int SMS_PERMISSION_CODE = 100;
    private final SmsAdapter adapter = new SmsAdapter();
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView emptyText;
    private TextView statusText;

    private final BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) { reload(); }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        emptyText = findViewById(R.id.text);
        statusText = findViewById(R.id.status);
        RecyclerView rv = findViewById(R.id.sms_list);
        rv.setLayoutManager(new LinearLayoutManager(this));
        rv.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));
        rv.setAdapter(adapter);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS},
                    SMS_PERMISSION_CODE);
        }

        // Android 14+ дээр экспортын тугийг заавал зааж өгөхгүй бол апп унадаг
        ContextCompat.registerReceiver(this, updateReceiver,
                new IntentFilter(Uploader.ACTION_UPDATED), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onResume() {
        super.onResume();
        reload();
        retryPending(false);
    }

    private void reload() {
        new Thread(() -> {
            List<SmsEntity> list = SmsDbHelper.get(this).all();
            main.post(() -> {
                adapter.setItems(list);
                emptyText.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                updateStatus();
            });
        }).start();
    }

    private void updateStatus() {
        String server = Settings.server(this);
        boolean perm = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        StringBuilder sb = new StringBuilder();
        sb.append(perm ? "SMS зөвшөөрөл: ✓" : "SMS зөвшөөрөл: ✗ (Тохиргоо → Апп → Зөвшөөрөл)");
        sb.append("\nСервер: ").append(server.isEmpty() ? "тохируулаагүй" : server);
        statusText.setText(sb.toString());
    }

    private void retryPending(boolean showToast) {
        new Thread(() -> {
            int n = Uploader.sendPending(this);
            if (showToast) main.post(() -> Toast.makeText(this, n + " мессеж илгээлээ", Toast.LENGTH_SHORT).show());
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        updateStatus();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.setting, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.setting) {
            startActivity(new Intent(this, SettingActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            return true;
        }
        if (item.getItemId() == R.id.retry) {
            retryPending(true);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(updateReceiver);
    }
}
