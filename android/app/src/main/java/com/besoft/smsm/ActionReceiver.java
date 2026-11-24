package com.besoft.smsm;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** "تم" / "أجّل" pressed on the notification or in the pop-up. */
public class ActionReceiver extends BroadcastReceiver {
    static final String ACTION = "com.besoft.smsm.ACT";

    @Override
    public void onReceive(Context c, Intent intent) {
        handle(c, intent.getStringExtra("item"), intent.getStringExtra("act"), intent.getIntExtra("min", 10));
    }

    static void silence(Context c, int id) {
        Scheduler.cancelAlarm(c, id | Scheduler.REPEAT_FLAG);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
        Intent stop = new Intent(c, AlertService.class);
        stop.setAction(AlertService.ACTION_STOP);
        stop.putExtra("id", id);
        stop.putExtra("final", true);
        try { c.startService(stop); } catch (Exception ignored) {}
    }

    static void handle(Context c, String json, String act, int min) {
        if (json == null) return;
        try {
            JSONObject it = new JSONObject(json);
            String key = it.optString("key");
            int id = it.optInt("id");
            long now = System.currentTimeMillis();
            Scheduler.markDismissed(c, key);
            silence(c, id);
            JSONObject ack = new JSONObject();
            ack.put("key", key);
            ack.put("act", act);
            ack.put("at", now);
            if ("snooze".equals(act)) {
                long next = now + min * 60000L;
                ack.put("min", min);
                JSONObject copy = new JSONObject(it.toString());
                copy.put("time", next);
                copy.put("exp", next + 12L * 3600 * 1000);
                copy.put("key", it.optString("task") + ":" + next);
                copy.put("snoozed", it.optInt("snoozed", 0) + 1);
                Scheduler.setAlarm(c, id, next, copy.toString());
            }
            if (!"close".equals(act)) Scheduler.addAck(c, ack);
            SmsmPlugin.emit(ack);
        } catch (Exception ignored) {}
    }
}
