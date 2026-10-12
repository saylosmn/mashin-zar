package mn.messageparser;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.MenuItem;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SettingActivity extends AppCompatActivity {
    private EditText serverText, phoneText, keyText;
    private TextView resultText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_setting);
        setTitle("Сервер тохируулах");
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);

        serverText = findViewById(R.id.server);
        phoneText = findViewById(R.id.phone);
        keyText = findViewById(R.id.apikey);
        resultText = findViewById(R.id.result);
        Button save = findViewById(R.id.savebtn);
        Button test = findViewById(R.id.testbtn);

        serverText.setText(Settings.server(this));
        phoneText.setText(Settings.phones(this));
        keyText.setText(Settings.apiKey(this));

        save.setOnClickListener(v -> {
            saveAll();
            Toast.makeText(this, "Хадгаллаа", Toast.LENGTH_SHORT).show();
        });

        // Туршилтын хүсэлт: сайт холбогдож байгаа эсэхийг шалгана (TEST утгатай, 1₮)
        test.setOnClickListener(v -> {
            saveAll();
            resultText.setText("Илгээж байна...");
            new Thread(() -> {
                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
                String err = Uploader.send(this, "1", "TEST", "TEST: апп-аас туршилтын хүсэлт", "test", now);
                new Handler(Looper.getMainLooper()).post(() ->
                        resultText.setText(err == null ? "✓ Сервер хүлээж авлаа" : "✗ " + err));
            }).start();
        });
    }

    private void saveAll() {
        Settings.save(this, serverText.getText().toString(), phoneText.getText().toString(), keyText.getText().toString());
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }
}
