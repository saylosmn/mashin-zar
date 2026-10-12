package mn.messageparser;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class SmsAdapter extends RecyclerView.Adapter<SmsAdapter.VH> {
    private final List<SmsEntity> items = new ArrayList<>();

    static class VH extends RecyclerView.ViewHolder {
        final TextView money, value, date, mode;
        VH(View v) {
            super(v);
            money = v.findViewById(R.id.money);
            value = v.findViewById(R.id.value);
            date = v.findViewById(R.id.date);
            mode = v.findViewById(R.id.mode);
        }
    }

    public void setItems(List<SmsEntity> list) {
        items.clear();
        items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        return new VH(LayoutInflater.from(parent.getContext()).inflate(R.layout.sms_item, parent, false));
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        SmsEntity e = items.get(position);
        h.money.setText(e.money + " ₮");
        h.value.setText(e.value == null || e.value.isEmpty() ? e.body : "Утга: " + e.value);
        h.date.setText(e.date);
        if (e.mode == 1) {
            h.mode.setText("✓ Илгээсэн");
            h.mode.setTextColor(0xFF2E7D32);
        } else {
            h.mode.setText("Хүлээгдэж буй");
            h.mode.setTextColor(0xFFE65100);
        }
    }

    @Override
    public int getItemCount() { return items.size(); }
}
