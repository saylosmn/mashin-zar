package mn.messageparser;

public class SmsEntity {
    public final int id;
    public final String money;
    public final String value;
    public final String body;
    public final String sender;
    public final String date;
    public final int mode;

    public SmsEntity(int id, String money, String value, String body, String sender, String date, int mode) {
        this.id = id;
        this.money = money;
        this.value = value;
        this.body = body;
        this.sender = sender;
        this.date = date;
        this.mode = mode;
    }
}
